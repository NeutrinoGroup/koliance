// Package chain is the liquidator's boundary to the chain. It owns the
// go-ethereum dependency: it dials the RPC and WS endpoints, reads back the
// frozen PositionOpened / PositionClosed / PositionLiquidated events, and
// converts them into the pure position.Position mirror types consumed by
// internal/perp.
//
// Nothing past this package's boundary sees a go-ethereum type. The
// internal/perp/position and internal/perp/nonce packages stay dependency-free;
// the type conversion is fenced inside this package.
package chain

import (
	"context"
	"fmt"
	"math/big"
	"sync"

	"github.com/ethereum/go-ethereum/accounts/abi/bind"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/ethclient"

	"github.com/koliance/backend/internal/chain/bindings"
	"github.com/koliance/backend/internal/perp/position"
)

// Network is one endpoint bundle: the RPC and WS endpoints, the chain id they
// are expected to belong to, and the PositionManager contract to watch
// (ADR-005 §5.4).
type Network struct {
	RPC             string
	WS              string
	ChainID         *big.Int
	ContractAddress common.Address
}

// Validate reports whether the bundle is usable. A zero contract address is
// rejected: it is a well-formed address that would silently match no logs.
func (n Network) Validate() error {
	if n.RPC == "" {
		return fmt.Errorf("chain: rpc endpoint is required")
	}
	if n.WS == "" {
		return fmt.Errorf("chain: ws endpoint is required")
	}
	if n.ChainID == nil || n.ChainID.Sign() <= 0 {
		return fmt.Errorf("chain: chain id must be a positive integer")
	}
	if n.ContractAddress == (common.Address{}) {
		return fmt.Errorf("chain: contract address is required (zero address would silently match nothing)")
	}
	return nil
}

// EventHandler consumes decoded position events. It is the seam where chain
// types stop and the pure position mirror begins.
//
// HandleFundingAccrued exists because the funding index is part of the
// liquidation verdict (PositionManager._isLiquidatable) but is NOT in the
// PositionOpened payload. The contract emits FundingAccrued from the same
// transaction, immediately BEFORE PositionOpened — _openPosition accrues at
// :427 and stores the index at :458 — so a replayer that feeds these events
// through in log order has the feed's index in hand by the time it sees the
// open. That ordering is the reason this is a handler method rather than a
// per-position getPosition() call: it costs no extra round-trip, and it works
// identically on the backfill and the live subscription.
type EventHandler interface {
	HandleOpened(p *position.Position)
	HandleClosed(id uint64)
	HandleLiquidated(id uint64)
	HandleFundingAccrued(feedID string, index *big.Int)
}

// Client holds the HTTP client (backfill and header reads), the WS client
// (live subscriptions), the decoded contract binding, and the once-read frozen
// parameters needed to fill the fields the events do not carry.
type Client struct {
	cfg             Network
	http            *ethclient.Client
	ws              *ethclient.Client
	bnd             *bindings.IPositionManager
	maxProfitBps    *big.Int
	openedTopic     common.Hash
	closedTopic     common.Hash
	liquidatedTopic common.Hash
	fundingTopic    common.Hash

	// seeds holds the latest funding index seen per feed, keyed by the same hex
	// string spelling used in position.Position.FeedID. It is what fills
	// EntryFundingIndex on an open. Guarded by seedMu because the live
	// subscription and a reconnecting backfill both write it.
	seedMu sync.Mutex
	seeds  map[string]*big.Int

	// blockTime resolves a block number to its timestamp. It is a field so
	// tests can inject a stub and prove the openedAt path without a node.
	blockTime func(ctx context.Context, block uint64) (uint64, error)
}

// chainIDReader is the slice of ethclient.Client the fail-fast check needs.
type chainIDReader interface {
	ChainID(ctx context.Context) (*big.Int, error)
}

// New dials both endpoints, fails fast when the node's chain id disagrees with
// the configured one (a mis-pointed address is legal on every chain and would
// otherwise silently watch the wrong one), and reads the frozen maxProfitBps
// once.
func New(ctx context.Context, cfg Network) (*Client, error) {
	if err := cfg.Validate(); err != nil {
		return nil, err
	}

	http, err := ethclient.DialContext(ctx, cfg.RPC)
	if err != nil {
		return nil, fmt.Errorf("chain: dial rpc %s: %w", cfg.RPC, err)
	}
	ws, err := ethclient.DialContext(ctx, cfg.WS)
	if err != nil {
		http.Close()
		return nil, fmt.Errorf("chain: dial ws %s: %w", cfg.WS, err)
	}

	if err := validateChainID(ctx, http, cfg.ChainID); err != nil {
		http.Close()
		ws.Close()
		return nil, err
	}

	bnd, err := bindings.NewIPositionManager(cfg.ContractAddress, http)
	if err != nil {
		http.Close()
		ws.Close()
		return nil, fmt.Errorf("chain: bind contract %s: %w", cfg.ContractAddress.Hex(), err)
	}
	maxProfitBps, err := bnd.MaxProfitBps(&bind.CallOpts{Context: ctx})
	if err != nil {
		http.Close()
		ws.Close()
		return nil, fmt.Errorf("chain: read maxProfitBps: %w", err)
	}

	opened, closed, liquidated, funding, err := eventTopics()
	if err != nil {
		http.Close()
		ws.Close()
		return nil, err
	}

	c := &Client{
		cfg:             cfg,
		http:            http,
		ws:              ws,
		bnd:             bnd,
		maxProfitBps:    maxProfitBps,
		openedTopic:     opened,
		closedTopic:     closed,
		liquidatedTopic: liquidated,
		fundingTopic:    funding,
		seeds:           make(map[string]*big.Int),
	}
	c.blockTime = c.fetchBlockTime
	return c, nil
}

// Close releases both endpoints.
func (c *Client) Close() {
	if c.http != nil {
		c.http.Close()
	}
	if c.ws != nil {
		c.ws.Close()
	}
}

// validateChainID fails fast when the node answers with a chain id other than
// the one configured.
func validateChainID(ctx context.Context, r chainIDReader, expected *big.Int) error {
	got, err := r.ChainID(ctx)
	if err != nil {
		return fmt.Errorf("chain: read chain id: %w", err)
	}
	if got.Cmp(expected) != 0 {
		return fmt.Errorf("chain: chain id mismatch: node reports %s, config expects %s", got.String(), expected.String())
	}
	return nil
}

// eventTopics returns the canonical topic hashes of the four watched events,
// derived from the frozen ABI rather than from hand-typed signatures.
//
// FundingAccrued is watched alongside the position events because the funding
// index is part of the liquidation verdict but absent from PositionOpened (see
// EventHandler). Its signature is frozen with the rest (IPositionManager.sol).
func eventTopics() (opened, closed, liquidated, funding common.Hash, err error) {
	parsed, err := bindings.IPositionManagerMetaData.GetAbi()
	if err != nil {
		return opened, closed, liquidated, funding, fmt.Errorf("chain: parse frozen abi: %w", err)
	}
	return parsed.Events["PositionOpened"].ID,
		parsed.Events["PositionClosed"].ID,
		parsed.Events["PositionLiquidated"].ID,
		parsed.Events["FundingAccrued"].ID,
		nil
}

// feedIDHex is the spelling of a bytes32 feed id that position.Position uses.
// It must be the ONLY conversion from a raw feed id to that string, or the
// seed map and the positions it seeds would key on different spellings.
func feedIDHex(feed [32]byte) string {
	return common.BytesToHash(feed[:]).Hex()
}

// seedFor returns the last observed funding index for a feed, or nil when none
// has been seen. Nil means "no observation" and the mirror reads it as zero
// funding — the pre-GAP-41 verdict, not a guess.
func (c *Client) seedFor(feedID string) *big.Int {
	c.seedMu.Lock()
	defer c.seedMu.Unlock()
	v, ok := c.seeds[feedID]
	if !ok {
		return nil
	}
	// Copy: the caller stores it on a long-lived Position, and the map entry
	// stays live for the next accrual to overwrite.
	return new(big.Int).Set(v)
}

// observeFunding records the index from a FundingAccrued log. It is the only
// writer of seeds, so the map cannot drift from the event stream.
func (c *Client) observeFunding(feedID string, index *big.Int) {
	if index == nil {
		return
	}
	c.seedMu.Lock()
	defer c.seedMu.Unlock()
	c.seeds[feedID] = new(big.Int).Set(index)
}
