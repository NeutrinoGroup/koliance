// Package liquidation persists and serves the liquidator's observation events:
// one row per successfully liquidated position, written by cmd/liquidator on the
// submission path and read back by the HTTP API for the dashboard.
//
// The store is a side-channel, not the main path: cmd/liquidator must keep
// liquidating when the store is absent or failing. Every write is therefore
// bounded by the caller's context (a short timeout derived from
// Config.ObsWriteTimeout) and its failure is logged, never propagated into the
// liquidation loop.
package liquidation

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// SchemaSQL creates the liquidation_events table and its timeline index. It is
// the single source of truth for the table shape (D4), shared by cmd/migrate
// (the repo's idempotent schema initialiser) and PG.EnsureSchema (the bot's
// startup best-effort creation). Idempotent by design: CREATE ... IF NOT EXISTS.
//
// exit_price / reward are NUMERIC(78,0): the raw 18-decimal fixed-point integer
// (uint256 range), serialised as a decimal string on the wire so the JSON
// boundary stays lossless for big.Int values.
const SchemaSQL = `
CREATE TABLE IF NOT EXISTS liquidation_events (
    id           BIGSERIAL PRIMARY KEY,
    position_id  BIGINT       NOT NULL,
    feed_id      VARCHAR(128) NOT NULL,
    exit_price   NUMERIC(78,0),
    reward       NUMERIC(78,0),
    tx_hash      VARCHAR(66)  NOT NULL,
    block_number BIGINT,
    created_at   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_liquidation_events_created
    ON liquidation_events (created_at DESC, id DESC);
`

// Event is one liquidation observation, as persisted and served by the API.
//
// ExitPrice is the 18-decimal fixed-point integer as a decimal string (the
// representation src/lib/perp.ts formatUsd consumes). At submission time this is
// the scan-time mark price that triggered the liquidation — the authoritative
// on-chain settlement exit price from the PositionLiquidated event is not
// visible to the bot without changing the frozen chain package, and is deferred
// to GAP-42.
//
// Reward and BlockNumber are nil at submission: the transaction is still
// pending, so its block and the settlement reward are unknown until the receipt
// / PositionLiquidated event is observed (GAP-42).
type Event struct {
	ID          int64     `json:"id"`
	PositionID  uint64    `json:"positionId"`
	FeedID      string    `json:"feedId"`
	ExitPrice   string    `json:"exitPrice"`
	Reward      *string   `json:"reward"`
	TxHash      string    `json:"txHash"`
	BlockNumber *int64    `json:"blockNumber"`
	CreatedAt   time.Time `json:"createdAt"`
}

// Store is the persistence seam the bot (writer) and the API (reader) share.
// It is an interface so both sides can be exercised with a stub in tests.
type Store interface {
	// Record appends one row per event, in one round-trip. It is a no-op for an
	// empty slice.
	Record(ctx context.Context, events []Event) error
	// Latest returns the most recent events, newest first, capped at limit.
	Latest(ctx context.Context, limit int) ([]Event, error)
}

// PG is the Postgres-backed Store.
type PG struct {
	pool *pgxpool.Pool
}

// NewPG returns a Postgres store over pool. A nil pool yields nil: callers treat
// "no store" as "observation disabled, log only".
func NewPG(pool *pgxpool.Pool) *PG {
	if pool == nil {
		return nil
	}
	return &PG{pool: pool}
}

// Close releases the underlying pool. It is safe on a nil or already-closed PG.
func (p *PG) Close() {
	if p != nil && p.pool != nil {
		p.pool.Close()
	}
}

// EnsureSchema creates the table if absent. It is authoritative for cmd/migrate
// and best-effort for cmd/liquidator (failure degrades to log-only there).
func (p *PG) EnsureSchema(ctx context.Context) error {
	if p == nil {
		return errors.New("liquidation: store disabled")
	}
	if _, err := p.pool.Exec(ctx, SchemaSQL); err != nil {
		return fmt.Errorf("liquidation: ensure schema: %w", err)
	}
	return nil
}

// Record appends one row per event in a single multi-row INSERT. A single
// round-trip keeps the observation channel's worst-case latency fixed no matter
// how many positions share one liquidate() call.
func (p *PG) Record(ctx context.Context, events []Event) error {
	if p == nil {
		return errors.New("liquidation: store disabled")
	}
	if len(events) == 0 {
		return nil
	}

	var sb strings.Builder
	sb.WriteString(`INSERT INTO liquidation_events
		(position_id, feed_id, exit_price, reward, tx_hash, block_number) VALUES `)
	args := make([]interface{}, 0, len(events)*6)
	for i, e := range events {
		if i > 0 {
			sb.WriteString(",")
		}
		base := i * 6
		fmt.Fprintf(&sb, "($%d,$%d,$%d,$%d,$%d,$%d)", base+1, base+2, base+3, base+4, base+5, base+6)
		// position_id is a uint256 on chain (PositionManager.sol:60) but the
		// liquidator mirror already narrows it to uint64; realistic ids stay far
		// below int64 max, so the narrowing is safe here too.
		args = append(args, int64(e.PositionID), e.FeedID, e.ExitPrice, e.Reward, e.TxHash, e.BlockNumber)
	}

	if _, err := p.pool.Exec(ctx, sb.String(), args...); err != nil {
		return fmt.Errorf("liquidation: record %d events: %w", len(events), err)
	}
	return nil
}

// Latest returns the most recent events, newest first, capped at limit. The
// NUMERIC columns are cast to text so they scan into strings without relying on
// the pgx numeric codec's exact string behaviour.
func (p *PG) Latest(ctx context.Context, limit int) ([]Event, error) {
	if p == nil {
		return nil, errors.New("liquidation: store disabled")
	}
	const q = `
		SELECT id, position_id, feed_id, exit_price::text, reward::text, tx_hash, block_number, created_at
		FROM liquidation_events
		ORDER BY created_at DESC, id DESC
		LIMIT $1`
	rows, err := p.pool.Query(ctx, q, limit)
	if err != nil {
		return nil, fmt.Errorf("liquidation: latest %d events: %w", limit, err)
	}
	defer rows.Close()

	out := make([]Event, 0, limit)
	for rows.Next() {
		var e Event
		if err := rows.Scan(
			&e.ID,
			&e.PositionID,
			&e.FeedID,
			&e.ExitPrice,
			&e.Reward,
			&e.TxHash,
			&e.BlockNumber,
			&e.CreatedAt,
		); err != nil {
			return nil, fmt.Errorf("liquidation: scan event: %w", err)
		}
		out = append(out, e)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("liquidation: iterate events: %w", err)
	}
	return out, nil
}
