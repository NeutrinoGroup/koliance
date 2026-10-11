package oracle

import (
	"context"
	"errors"
	"math/big"
	"testing"
)

type stubReader struct {
	price *big.Int
	pub   uint64
	err   error
	got   [32]byte
}

func (s *stubReader) ReadPrice(_ context.Context, feedID [32]byte) (*big.Int, uint64, error) {
	s.got = feedID
	return s.price, s.pub, s.err
}

const goodFeedHex = "0x000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f"

func TestDemoFeedPrice(t *testing.T) {
	r := &stubReader{price: usd18(180)}
	f := NewDemoFeed(r)

	price, ok := f.Price(context.Background(), goodFeedHex)
	if !ok || price.Cmp(usd18(180)) != 0 {
		t.Fatalf("Price = (%v, %v), want (180e18, true)", price, ok)
	}

	want, _ := ParseFeedID(goodFeedHex)
	if r.got != want {
		t.Errorf("reader got feed id %x, want %x", r.got, want)
	}
}

// A missing price must surface as ok=false — never a guessed price. Four ways
// to have no usable price are all distinct.
func TestDemoFeedNoPrice(t *testing.T) {
	for name, r := range map[string]*stubReader{
		"rpc error":  {err: errors.New("boom")},
		"nil price":  {price: nil},
		"zero price": {price: big.NewInt(0)},
		"neg price":  {price: big.NewInt(-1)},
	} {
		f := NewDemoFeed(r)
		if price, ok := f.Price(context.Background(), goodFeedHex); ok {
			t.Errorf("%s: Price = (%v, true), want ok=false", name, price)
		}
	}
}

func TestDemoFeedInvalidFeedID(t *testing.T) {
	r := &stubReader{price: big.NewInt(1)}
	f := NewDemoFeed(r)

	if _, ok := f.Price(context.Background(), "not-a-feed"); ok {
		t.Error("invalid feed id returned ok=true")
	}
	// The reader must not have been called for an undecodable id.
	if r.got != ([32]byte{}) {
		t.Errorf("reader called with %x for invalid feed id", r.got)
	}
}
