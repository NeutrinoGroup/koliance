-- Migration 004: Developer Console API Keys Table
-- Target: PostgreSQL / Supabase
-- Reference: docs/developer-api-service-spec.md & AGENTS.md

CREATE TABLE IF NOT EXISTS api_keys (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(128) NOT NULL,
    wallet_address VARCHAR(128) NOT NULL,
    name VARCHAR(128) NOT NULL DEFAULT 'Default API Key',
    key_prefix VARCHAR(32) NOT NULL,
    key_hash VARCHAR(64) NOT NULL UNIQUE,
    encrypted_key TEXT,
    tier VARCHAR(32) NOT NULL DEFAULT 'STARTER_FREE',
    remaining_quota INT NOT NULL DEFAULT 100,
    free_claims_left INT NOT NULL DEFAULT 3,
    rate_limit_rpm INT NOT NULL DEFAULT 60,
    status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',
    scopes JSONB NOT NULL DEFAULT '["trade:perp", "pay:micropayment", "query:proof"]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_used_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys (user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_wallet ON api_keys (wallet_address);
CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys (key_hash);

-- Provide "api-key" alias view so queries targeting "api-key" or api_keys work seamlessly
CREATE OR REPLACE VIEW "api-key" AS SELECT * FROM api_keys;

-- Enable Row Level Security (RLS) on api_keys
ALTER TABLE IF EXISTS api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS api_keys FORCE ROW LEVEL SECURITY;

-- Revoke direct anon role privileges if anon role exists in Supabase
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        REVOKE ALL ON TABLE api_keys FROM anon;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE api_keys TO authenticated;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
        GRANT ALL ON TABLE api_keys TO service_role;
    END IF;
END $$;
