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
type EventHandler interface {
	HandleOpened(p *position.Position)
	HandleClosed(id uint64)
	HandleLiquidated(id uint64)
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

	opened, closed, liquidated, err := eventTopics()
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

// eventTopics returns the canonical topic hashes of the three position events,
// derived from the frozen ABI rather than from hand-typed signatures.
func eventTopics() (opened, closed, liquidated common.Hash, err error) {
	parsed, err := bindings.IPositionManagerMetaData.GetAbi()
	if err != nil {
		return opened, closed, liquidated, fmt.Errorf("chain: parse frozen abi: %w", err)
	}
	return parsed.Events["PositionOpened"].ID,
		parsed.Events["PositionClosed"].ID,
		parsed.Events["PositionLiquidated"].ID,
		nil
}
