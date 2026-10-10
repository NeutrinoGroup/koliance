package oracle

import (
	"context"
	"math/big"
	"strings"
	"testing"

	"github.com/koliance/backend/internal/perp/position"
)

// usd18 returns an 18-decimal USD amount.
func usd18(n int64) *big.Int {
	return new(big.Int).Mul(big.NewInt(n), new(big.Int).Exp(big.NewInt(10), big.NewInt(18), nil))
}

type stubFeed struct {
	price *big.Int
	ok    bool
	got   string
}

func (s *stubFeed) Price(_ context.Context, feedID string) (*big.Int, bool) {
	s.got = feedID
	return s.price, s.ok
}

func TestAsPriceLookup(t *testing.T) {
	f := &stubFeed{price: big.NewInt(42), ok: true}
	lookup := AsPriceLookup(context.Background(), f)

	price, ok := lookup("0xfeed")
	if !ok || price.Cmp(big.NewInt(42)) != 0 {
		t.Fatalf("lookup = (%v, %v), want (42, true)", price, ok)
	}
	if f.got != "0xfeed" {
		t.Errorf("feed id = %q, want 0xfeed", f.got)
	}

	// The adapter must produce the exact func signature position.Scan consumes.
	var _ position.PriceLookup = AsPriceLookup(context.Background(), f)
}

func TestParseFeedID(t *testing.T) {
	hex64 := "000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f"

	got, ok := ParseFeedID("0x" + hex64)
	if !ok {
		t.Fatal("canonical feed id rejected")
	}
	for i := range got {
		if got[i] != byte(i) {
			t.Fatalf("byte %d = %#x, want %#x", i, got[i], byte(i))
		}
	}

	// An uppercase 0X prefix is accepted.
	if _, ok := ParseFeedID("0X" + hex64); !ok {
		t.Error("uppercase 0X prefix rejected")
	}

	for name, s := range map[string]string{
		"empty":     "",
		"no prefix": hex64,
		"short":     "0x1234",
		"odd hex":   "0x123",
		"bad hex":   "0x" + strings.Repeat("z", 64),
		"too long":  "0x" + hex64 + "00",
	} {
		if _, ok := ParseFeedID(s); ok {
			t.Errorf("%s: accepted %q", name, s)
		}
	}
}
