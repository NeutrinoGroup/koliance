-- Migration 003: Idempotency Keys & Dynamic System Configs
-- Target: PostgreSQL / Supabase

-- 8. Idempotency Keys Table (Task 15: prevent duplicate orders, transfers, and webhooks)
CREATE TABLE IF NOT EXISTS idempotency_keys (
    key VARCHAR(128) PRIMARY KEY,
    scope VARCHAR(64) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'COMPLETED',
    response_payload JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (NOW() + INTERVAL '24 hours')
);

CREATE INDEX IF NOT EXISTS idx_idempotency_scope_expires ON idempotency_keys (scope, expires_at);

-- 9. System Configs Table (Task 14 & Dynamic Config requirement)
CREATE TABLE IF NOT EXISTS system_configs (
    key VARCHAR(64) PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Seed initial secure defaults
INSERT INTO system_configs (key, value, description)
VALUES 
    ('maintenance_mode', '{"enabled": false}', 'Global system maintenance toggle'),
    ('quant_risk_limits', '{"max_leverage": 50, "max_single_trade_usd": 10000, "daily_loss_limit_usd": 500}', 'Risk limit thresholds for autonomous trading agents'),
    ('nansen_pipeline', '{"poll_interval_seconds": 300, "chains": ["ethereum", "monad"]}', 'Nansen smart money scraping intervals and target chains'),
    ('credit_rating_engine', '{"steam_multiplier": 1.0, "github_multiplier": 1.5, "allow_synthetic_credit": false}', 'Trust scoring multipliers; synthetic credentials strictly disallowed')
ON CONFLICT (key) DO NOTHING;
