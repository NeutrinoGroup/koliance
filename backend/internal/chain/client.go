package chain

import (
	"context"
	"fmt"
	"math/big"

	ethereum "github.com/ethereum/go-ethereum"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"

	"github.com/koliance/backend/internal/chain/bindings"
	"github.com/koliance/backend/internal/perp/position"
)

// filterQuery matches the four events this client cares about on the configured
// contract: the three position events plus FundingAccrued.
//
// FundingAccrued is here because the funding index is part of the liquidation
// verdict but is not in the PositionOpened payload. The contract emits it
// immediately before the open in the same transaction (PositionManager.sol:427
// accrues, :476 emits the open), so log order guarantees the index is in hand
// when the open is converted. Missing it would leave every mirrored position
// priced as if it owed funding from index zero.
func (c *Client) filterQuery(from, to *big.Int) ethereum.FilterQuery {
	return ethereum.FilterQuery{
		FromBlock: from,
		ToBlock:   to,
		Addresses: []common.Address{c.cfg.ContractAddress},
		Topics: [][]common.Hash{{
			c.openedTopic,
			c.closedTopic,
			c.liquidatedTopic,
			c.fundingTopic,
		}},
	}
}

// Backfill pulls the position and funding events in [from, to] inclusive and
// feeds them to the handler in the order the node returns them (block, then log
// index).
//
// That order is load-bearing, not incidental: the contract accrues a feed's
// funding in the same transaction as the open that consumes it, immediately
// before emitting PositionOpened, so replaying by log index means the
// FundingAccrued that seeds a position always arrives first two lines above it.
func (c *Client) Backfill(ctx context.Context, from, to uint64, h EventHandler) error {
	if from > to {
		return fmt.Errorf("chain: backfill range [%d, %d] is empty", from, to)
	}
	logs, err := c.http.FilterLogs(ctx, c.filterQuery(new(big.Int).SetUint64(from), new(big.Int).SetUint64(to)))
	if err != nil {
		return fmt.Errorf("chain: eth_getLogs [%d, %d]: %w", from, to, err)
	}
	for _, l := range logs {
		if err := c.dispatch(ctx, l, h); err != nil {
			return err
		}
	}
	return nil
}

// Subscribe streams live position and funding events to the handler until ctx is
// cancelled or the subscription errors. It is a primitive, not a self-healing
// loop: the caller owns reconnect and the lastProcessedBlock watermark
// (ADR-005 §5.3).
func (c *Client) Subscribe(ctx context.Context, h EventHandler) error {
	ch := make(chan types.Log, 256)
	sub, err := c.ws.SubscribeFilterLogs(ctx, c.filterQuery(nil, nil), ch)
	if err != nil {
		return fmt.Errorf("chain: eth_subscribe logs: %w", err)
	}
	defer sub.Unsubscribe()

	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case err := <-sub.Err():
			return fmt.Errorf("chain: subscription: %w", err)
		case l := <-ch:
			if err := c.dispatch(ctx, l, h); err != nil {
				return err
			}
		}
	}
}

// dispatch decodes one raw log and routes it to the handler. An unknown topic
// fails loud rather than being dropped silently.
func (c *Client) dispatch(ctx context.Context, l types.Log, h EventHandler) error {
	switch l.Topics[0] {
	case c.openedTopic:
		ev, err := c.bnd.ParsePositionOpened(l)
		if err != nil {
			return fmt.Errorf("chain: parse PositionOpened: %w", err)
		}
		p, err := c.positionFromEvent(ctx, ev)
		if err != nil {
			return err
		}
		h.HandleOpened(p)
		return nil
	case c.closedTopic:
		ev, err := c.bnd.ParsePositionClosed(l)
		if err != nil {
			return fmt.Errorf("chain: parse PositionClosed: %w", err)
		}
		h.HandleClosed(ev.PositionId.Uint64())
		return nil
	case c.liquidatedTopic:
		ev, err := c.bnd.ParsePositionLiquidated(l)
		if err != nil {
			return fmt.Errorf("chain: parse PositionLiquidated: %w", err)
		}
		h.HandleLiquidated(ev.PositionId.Uint64())
		return nil
	case c.fundingTopic:
		ev, err := c.bnd.ParseFundingAccrued(l)
		if err != nil {
			return fmt.Errorf("chain: parse FundingAccrued: %w", err)
		}
		feedID := feedIDHex(ev.FeedId)
		// Observed before it is dispatched: the seed has to be in place before
		// the handler sees it, because a subscriber that ignores the callback
		// must still leave the next open with a correct entry index.
		c.observeFunding(feedID, ev.Index)
		h.HandleFundingAccrued(feedID, ev.Index)
		return nil
	default:
		return fmt.Errorf("chain: unexpected log topic %s", l.Topics[0].Hex())
	}
}

// positionFromEvent fills the three fields the event does not carry and converts.
//
// payoutCapUsd comes from the frozen maxProfitBps (fixed at open on chain),
// openedAt from the log's block, and entryFundingIndex from the last
// FundingAccrued for the feed — which, by log order, is the one this open just
// accrued (PositionManager.sol:427). A feed with no observed accrual yields nil,
// which the mirror reads as index zero rather than inventing a value.
func (c *Client) positionFromEvent(ctx context.Context, ev *bindings.IPositionManagerPositionOpened) (*position.Position, error) {
	openedAt, err := c.blockTime(ctx, ev.Raw.BlockNumber)
	if err != nil {
		return nil, fmt.Errorf("chain: block time for block %d: %w", ev.Raw.BlockNumber, err)
	}
	return PositionFromOpened(
		ev,
		payoutCapUSD(ev.CollateralUsd, ev.SizeUsd, c.maxProfitBps),
		openedAt,
		c.seedFor(feedIDHex(ev.FeedId)),
	), nil
}

// fetchBlockTime resolves a block number to its timestamp in unix seconds.
func (c *Client) fetchBlockTime(ctx context.Context, block uint64) (uint64, error) {
	hdr, err := c.http.HeaderByNumber(ctx, new(big.Int).SetUint64(block))
	if err != nil {
		return 0, err
	}
	return hdr.Time, nil
}
