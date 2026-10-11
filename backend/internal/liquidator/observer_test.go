package liquidator

import (
	"bytes"
	"context"
	"errors"
	"log/slog"
	"math/big"
	"strings"
	"testing"
	"time"

	"github.com/ethereum/go-ethereum/common"

	"github.com/koliance/backend/internal/liquidation"
	"github.com/koliance/backend/internal/perp/position"
)

// stubStore records the events passed to Record and can be told to fail.
type stubStore struct {
	events  []liquidation.Event
	failErr error
}

func (s *stubStore) Record(ctx context.Context, events []liquidation.Event) error {
	if s.failErr != nil {
		return s.failErr
	}
	s.events = append(s.events, events...)
	return nil
}

func (s *stubStore) Latest(ctx context.Context, limit int) ([]liquidation.Event, error) {
	return nil, nil
}

func testBatch() (position.Batch, []*big.Int, common.Hash) {
	markPrice, ok := new(big.Int).SetString("163600000000000000000", 10)
	if !ok {
		panic("bad test mark price literal")
	}
	return position.Batch{
			FeedID:    "0xfeed",
			MarkPrice: markPrice,
		},
		[]*big.Int{big.NewInt(1), big.NewInt(2), big.NewInt(3)},
		common.HexToHash("0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")
}

// TestRecordLiquidationNoStoreIsNoop proves the nil-store (no DATABASE_URL)
// path is a silent no-op, not a panic or a blocking call.
func TestRecordLiquidationNoStoreIsNoop(t *testing.T) {
	b := &Bot{cfg: Config{ObsWriteTimeout: time.Second}, log: slog.Default(), obs: nil}
	batch, chunk, hash := testBatch()
	b.recordLiquidation(context.Background(), batch, chunk, hash) // must not panic
}

// TestRecordLiquidationDegradesOnStoreFailure proves a failing store only
// produces a warning log and never propagates the error to the caller.
func TestRecordLiquidationDegradesOnStoreFailure(t *testing.T) {
	var buf bytes.Buffer
	log := slog.New(slog.NewJSONHandler(&buf, nil))
	b := &Bot{
		cfg: Config{ObsWriteTimeout: time.Second},
		log: log,
		obs: &stubStore{failErr: errors.New("dial timeout")},
	}
	batch, chunk, hash := testBatch()

	b.recordLiquidation(context.Background(), batch, chunk, hash) // must not panic

	out := buf.String()
	if !strings.Contains(out, "liquidation events not persisted") {
		t.Errorf("expected a warning log, got %q", out)
	}
	if !strings.Contains(out, "dial timeout") {
		t.Errorf("warning should carry the store error, got %q", out)
	}
}

// TestRecordLiquidationFansOutOneEventPerPosition proves the write path emits
// one row per position, all sharing the chunk's feed, mark price and tx hash.
func TestRecordLiquidationFansOutOneEventPerPosition(t *testing.T) {
	store := &stubStore{}
	b := &Bot{cfg: Config{ObsWriteTimeout: time.Second}, log: slog.Default(), obs: store}
	batch, chunk, hash := testBatch()

	b.recordLiquidation(context.Background(), batch, chunk, hash)

	if len(store.events) != 3 {
		t.Fatalf("recorded %d events, want 3", len(store.events))
	}
	for i, e := range store.events {
		if e.PositionID != uint64(i+1) {
			t.Errorf("events[%d].PositionID = %d, want %d", i, e.PositionID, i+1)
		}
		if e.FeedID != "0xfeed" {
			t.Errorf("events[%d].FeedID = %q", i, e.FeedID)
		}
		if e.ExitPrice != "163600000000000000000" {
			t.Errorf("events[%d].ExitPrice = %q", i, e.ExitPrice)
		}
		if e.TxHash != hash.Hex() {
			t.Errorf("events[%d].TxHash = %q", i, e.TxHash)
		}
		if e.Reward != nil || e.BlockNumber != nil {
			t.Errorf("events[%d] should carry nil reward/blockNumber", i)
		}
	}
}
