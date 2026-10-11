package httpapi

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"testing"
	"time"

	"github.com/koliance/backend/internal/config"
	"github.com/koliance/backend/internal/liquidation"
)

// stubLiquidations is the test double for the liquidation observation store.
type stubLiquidations struct {
	latest func(ctx context.Context, limit int) ([]liquidation.Event, error)
}

func (s *stubLiquidations) Record(ctx context.Context, events []liquidation.Event) error { return nil }
func (s *stubLiquidations) Latest(ctx context.Context, limit int) ([]liquidation.Event, error) {
	return s.latest(ctx, limit)
}

func newLiquidationsRouter(store liquidation.Store) http.Handler {
	cfg := &config.Config{
		CORSAllowedOrigins: config.ParseOrigins(config.DefaultCORSOrigins),
		APIToken:           opToken,
	}
	return NewRouter(Deps{Cfg: cfg, Liquidations: store})
}

func TestLiquidationsDefaultsAndPassthrough(t *testing.T) {
	now := time.Date(2026, 10, 11, 12, 0, 0, 0, time.UTC)
	events := []liquidation.Event{
		{ID: 2, PositionID: 2, FeedID: "0xf2", ExitPrice: "200000000000000000000", TxHash: "0xt2", CreatedAt: now},
		{ID: 1, PositionID: 1, FeedID: "0xf1", ExitPrice: "163600000000000000000", TxHash: "0xt1", CreatedAt: now.Add(-time.Minute)},
	}
	var gotLimit int
	store := &stubLiquidations{latest: func(ctx context.Context, limit int) ([]liquidation.Event, error) {
		gotLimit = limit
		return events, nil
	}}
	h := newLiquidationsRouter(store)

	rr := do(h, http.MethodGet, "/api/v1/liquidations", "", nil)
	if rr.Code != http.StatusOK {
		t.Fatalf("GET /api/v1/liquidations: %d %s", rr.Code, rr.Body.String())
	}
	if gotLimit != 50 {
		t.Errorf("default limit passed to store = %d, want 50", gotLimit)
	}
	var body struct {
		Liquidations []liquidation.Event `json:"liquidations"`
	}
	if err := json.Unmarshal(rr.Body.Bytes(), &body); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if len(body.Liquidations) != 2 {
		t.Fatalf("returned %d events, want 2", len(body.Liquidations))
	}
	if body.Liquidations[0].PositionID != 2 || body.Liquidations[0].ExitPrice != "200000000000000000000" {
		t.Errorf("first event wrong: %+v", body.Liquidations[0])
	}
}

func TestLiquidationsCustomLimit(t *testing.T) {
	var gotLimit int
	store := &stubLiquidations{latest: func(ctx context.Context, limit int) ([]liquidation.Event, error) {
		gotLimit = limit
		return []liquidation.Event{}, nil
	}}
	h := newLiquidationsRouter(store)

	if rr := do(h, http.MethodGet, "/api/v1/liquidations?limit=10", "", nil); rr.Code != http.StatusOK {
		t.Fatalf("limit=10: %d", rr.Code)
	}
	if gotLimit != 10 {
		t.Errorf("limit passed to store = %d, want 10", gotLimit)
	}
}

func TestLiquidationsRejectsBadLimit(t *testing.T) {
	h := newLiquidationsRouter(&stubLiquidations{latest: func(ctx context.Context, limit int) ([]liquidation.Event, error) {
		return nil, nil
	}})
	for _, q := range []string{"limit=0", "limit=-1", "limit=abc", "limit=201"} {
		if rr := do(h, http.MethodGet, "/api/v1/liquidations?"+q, "", nil); rr.Code != http.StatusBadRequest {
			t.Errorf("%s: %d, want 400", q, rr.Code)
		}
	}
}

func TestLiquidationsNilStoreReturnsEmptyList(t *testing.T) {
	h := newLiquidationsRouter(nil)
	rr := do(h, http.MethodGet, "/api/v1/liquidations", "", nil)
	if rr.Code != http.StatusOK {
		t.Fatalf("nil store: %d", rr.Code)
	}
	// jsonResponse encodes with a trailing newline.
	if got := rr.Body.String(); got != "{\"liquidations\":[]}\n" {
		t.Errorf("nil store body = %q, want an empty JSON list", got)
	}
}

func TestLiquidationsStoreErrorIs500(t *testing.T) {
	store := &stubLiquidations{latest: func(ctx context.Context, limit int) ([]liquidation.Event, error) {
		return nil, errors.New("relation liquidation_events does not exist")
	}}
	h := newLiquidationsRouter(store)
	if rr := do(h, http.MethodGet, "/api/v1/liquidations", "", nil); rr.Code != http.StatusInternalServerError {
		t.Errorf("store error: %d, want 500", rr.Code)
	}
}

func TestLiquidationsMethodNotAllowed(t *testing.T) {
	h := newLiquidationsRouter(&stubLiquidations{latest: func(ctx context.Context, limit int) ([]liquidation.Event, error) {
		return nil, nil
	}})
	if rr := do(h, http.MethodPost, "/api/v1/liquidations", `{}`, nil); rr.Code != http.StatusMethodNotAllowed {
		t.Errorf("POST: %d, want 405", rr.Code)
	}
}
