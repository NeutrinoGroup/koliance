// Package oracle is the liquidator's price layer. It resolves a feed id to an
// 18-decimal USD mark price for internal/perp/position.Scan, which decides what
// is liquidatable.
//
// Two implementations mirror the on-chain IPriceOracle split:
//
//   - DemoFeed (demo path, highest priority) reads the owner-settable
//     DemoOracle.getPrice over RPC, so the presenter's "crash the market"
//     button propagates through the exact on-chain price the contracts use.
//   - HermesFeed (production narrative) reads the latest Pyth price from
//     hermes.pyth.network and normalizes it to 18 decimals, mirroring
//     PythOracleAdapter._normalize.
//
// The go-ethereum dependency is fenced inside this package (and internal/chain):
// internal/perp/position and internal/perp/nonce stay dependency-free. The only
// position type that crosses the boundary here is the pure PriceLookup func.
package oracle

import (
	"context"
	"encoding/hex"
	"math/big"

	"github.com/koliance/backend/internal/perp/position"
)

// PriceFeed resolves a feed id to an 18-decimal USD mark price. The bool is
// false when the feed has no usable price; the caller (position.Scan) then
// skips the position instead of guessing — a missing price must never be read
// as "not liquidatable" silently.
type PriceFeed interface {
	Price(ctx context.Context, feedID string) (*big.Int, bool)
}

// AsPriceLookup adapts a PriceFeed to the position.PriceLookup func that
// position.Scan consumes. The ctx is bound here because PriceLookup carries no
// context parameter; the caller passes the scan's request context.
func AsPriceLookup(ctx context.Context, f PriceFeed) position.PriceLookup {
	return func(feedID string) (*big.Int, bool) {
		return f.Price(ctx, feedID)
	}
}

// ParseFeedID converts the canonical 0x-prefixed 32-byte hex string used for
// position.FeedID into a raw bytes32. The bool is false for anything else: a
// feed id that does not decode must surface as "no price", never as a silently
// truncated hash.
func ParseFeedID(s string) ([32]byte, bool) {
	var out [32]byte
	if len(s) != 66 || s[0] != '0' || (s[1] != 'x' && s[1] != 'X') {
		return out, false
	}
	b, err := hex.DecodeString(s[2:])
	if err != nil {
		return out, false
	}
	copy(out[:], b)
	return out, true
}
