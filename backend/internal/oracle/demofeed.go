package oracle

import (
	"context"
	"fmt"
	"math/big"

	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/ethclient"
)

// DemoFeed is the demo price source: it reads DemoOracle.getPrice over RPC, so
// a presenter's DemoControlPanel "调低价格" (DemoOracle.setPrice / bumpPrice)
// is picked up by the bot through the exact on-chain value the contracts read.
// No local memory overlay backs the demo path — an injected price the frontend
// could not move would silently break the "one on-chain source of truth" story
// (推进方案.md 阶段 3.5 彩排第 4 步).
type DemoFeed struct {
	read  DemoPriceReader
	close func()
}

// NewDemoFeed wires a caller-supplied reader. Tests and callers that already
// hold an ethclient use this; the RPC dialing convenience is
// NewDemoFeedFromRPC.
func NewDemoFeed(r DemoPriceReader) *DemoFeed {
	return &DemoFeed{read: r}
}

// NewDemoFeedFromRPC dials the RPC and returns a feed backed by the
// IPriceOracle at addr. The caller must Close the returned feed to release the
// underlying client.
func NewDemoFeedFromRPC(ctx context.Context, rpc string, addr common.Address) (*DemoFeed, error) {
	cl, err := ethclient.DialContext(ctx, rpc)
	if err != nil {
		return nil, fmt.Errorf("oracle: dial demo rpc %s: %w", rpc, err)
	}
	r, err := NewEthDemoReader(cl, addr)
	if err != nil {
		cl.Close()
		return nil, err
	}
	f := NewDemoFeed(r)
	f.close = cl.Close
	return f, nil
}

// Close releases the underlying RPC client when the feed was built with
// NewDemoFeedFromRPC. It is a no-op for injected-reader feeds.
func (f *DemoFeed) Close() {
	if f.close != nil {
		f.close()
	}
}

// Price resolves a feed id through the on-chain DemoOracle. It returns ok=false
// — never a guessed price — when the id does not decode, the RPC call fails, or
// the contract reports a non-positive price.
func (f *DemoFeed) Price(ctx context.Context, feedID string) (*big.Int, bool) {
	b32, ok := ParseFeedID(feedID)
	if !ok {
		return nil, false
	}
	price, _, err := f.read.ReadPrice(ctx, b32)
	if err != nil || price == nil || price.Sign() <= 0 {
		return nil, false
	}
	return price, true
}
