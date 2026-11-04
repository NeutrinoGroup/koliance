package liquidator

import (
	"bytes"
	"context"
	"github.com/ethereum/go-ethereum/common"
	"github.com/koliance/backend/internal/perp/nonce"
	"github.com/koliance/backend/internal/perp/position"
	"log/slog"
	"math/big"
	"reflect"
	"strings"
	"testing"
	"time"
)

func TestNextBackoff(t *testing.T) {
	base := time.Second
	max := 8 * time.Second

	got := []time.Duration{base}
	for i := 0; i < 5; i++ {
		got = append(got, nextBackoff(got[len(got)-1], max))
	}
	want := []time.Duration{time.Second, 2 * time.Second, 4 * time.Second, 8 * time.Second, 8 * time.Second, 8 * time.Second}
	for i := range want {
		if got[i] != want[i] {
			t.Fatalf("backoff[%d] = %s, want %s (full: %v)", i, got[i], want[i], got)
		}
	}
}

func TestNextBackoffZeroNormalized(t *testing.T) {
	if got := nextBackoff(0, 10*time.Second); got != time.Second {
		t.Errorf("nextBackoff(0) = %s, want 1s", got)
	}
}

func TestSleepCtx(t *testing.T) {
	// Cancelled before the sleep returns false immediately.
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	if sleepCtx(ctx, time.Hour) {
		t.Error("sleepCtx on a cancelled ctx returned true")
	}

	// A short sleep completes normally.
	if !sleepCtx(context.Background(), time.Millisecond) {
		t.Error("sleepCtx on a live ctx returned false")
	}
}

type scanFeed struct{}

func (scanFeed) Price(context.Context, string) (*big.Int, bool) { return big.NewInt(1), true }

type scanSender struct {
	calls   int
	updates [][]byte
	ids     []*big.Int
}

func (s *scanSender) Liquidate(_ context.Context, ids []*big.Int, updates [][]byte) (common.Hash, error) {
	s.calls++
	s.ids = ids
	s.updates = updates
	return common.Hash{}, nil
}

func TestScanHermesUpdateGate(t *testing.T) {
	for _, tc := range []struct {
		name, feed string
		updates    [][]byte
		calls      int
	}{
		{"missing hermes", "hermes", nil, 0},
		{"signed hermes", "hermes", [][]byte{{0xde, 0xad, 0xbe, 0xef}}, 1},
		{"demo no updates", "demo", nil, 1},
	} {
		t.Run(tc.name, func(t *testing.T) {
			table := position.NewTable()
			table.ApplyOpen(&position.Position{ID: 1, FeedID: "test-feed", CollateralUSD: big.NewInt(1), SizeUSD: big.NewInt(100), EntryPrice: big.NewInt(100), IsLong: true, EntryFundingIndex: big.NewInt(0)})
			sender := &scanSender{}
			var logs bytes.Buffer
			b := &Bot{cfg: Config{Feed: tc.feed, TxTimeout: time.Second, MaxPositionsPerCall: 10}, log: slog.New(slog.NewTextHandler(&logs, nil)), table: table, feed: scanFeed{}, mmrBps: 100, sender: sender, nonce: nonce.NewManager(0), updates: func(context.Context, string) [][]byte { return tc.updates }}
			b.scanAndLiquidate(context.Background())
			if sender.calls != tc.calls {
				t.Fatalf("broadcasts=%d want=%d; %s", sender.calls, tc.calls, logs.String())
			}
			if tc.calls == 0 && !strings.Contains(logs.String(), "no hermes update data") {
				t.Fatal("missing skip diagnostic")
			}
			if tc.calls > 0 && (len(sender.ids) != 1 || sender.ids[0].Uint64() != 1 || !reflect.DeepEqual(sender.updates, tc.updates)) {
				t.Fatalf("broadcast payload changed: ids=%v updates=%x", sender.ids, sender.updates)
			}
		})
	}
}
