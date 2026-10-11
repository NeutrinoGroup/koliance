-- liquidation_events: one row per successfully liquidated position.
--
-- Written by cmd/liquidator on the submission path and read back by
-- GET /api/v1/liquidations for the dashboard. Mirrors internal/liquidation.SchemaSQL
-- (the bot's best-effort EnsureSchema on startup); this file is the canonical
-- migration entry point, that constant is the runtime fallback.
--
-- Idempotent (IF NOT EXISTS): cmd/migrate re-runs every file on each invocation.
--
-- exit_price / reward are NUMERIC(78,0): the raw 18-decimal fixed-point integer
-- (uint256 range), serialised as a decimal string on the wire so the JSON
-- boundary stays lossless for big.Int values.

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
