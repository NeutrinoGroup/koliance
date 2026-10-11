-- Migration 002: Enable Row Level Security (RLS) and Deny Anon Access by Default
-- Target: PostgreSQL / Supabase

-- 1. Ensure optional / referenced tables exist before applying security rules
CREATE TABLE IF NOT EXISTS agent_cards (
    card_id VARCHAR(64) PRIMARY KEY,
    wallet_address VARCHAR(128) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS trading_accounts (
    account_id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(128),
    account_number VARCHAR(64),
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Enable Row Level Security (RLS) on ALL tables
ALTER TABLE IF EXISTS users ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS card_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS session_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS game_proofs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS market_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS google_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS agent_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS trading_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS dev_contexts ENABLE ROW LEVEL SECURITY;

-- 3. Force Row Level Security (RLS) to apply even to table owners where possible
ALTER TABLE IF EXISTS users FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS cards FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS card_transactions FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS session_keys FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS game_proofs FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS market_orders FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS google_accounts FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS agent_cards FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS trading_accounts FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS dev_contexts FORCE ROW LEVEL SECURITY;

-- 4. Clean up any insecure legacy public policies
DROP POLICY IF EXISTS "Allow public read access on dev_contexts" ON dev_contexts;
DROP POLICY IF EXISTS "Allow public insert access on dev_contexts" ON dev_contexts;

-- 5. Revoke direct anon role privileges if anon role exists in Supabase
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        REVOKE ALL ON TABLE users FROM anon;
        REVOKE ALL ON TABLE cards FROM anon;
        REVOKE ALL ON TABLE card_transactions FROM anon;
        REVOKE ALL ON TABLE session_keys FROM anon;
        REVOKE ALL ON TABLE game_proofs FROM anon;
        REVOKE ALL ON TABLE market_orders FROM anon;
        REVOKE ALL ON TABLE google_accounts FROM anon;
        REVOKE ALL ON TABLE agent_cards FROM anon;
        REVOKE ALL ON TABLE trading_accounts FROM anon;
        REVOKE ALL ON TABLE dev_contexts FROM anon;
    END IF;
END $$;

-- 6. Add default-deny policies for anon and authenticated self-service access
-- Service role key (SUPABASE_SERVICE_ROLE_KEY) automatically bypasses RLS in Supabase.
-- For anon role, explicitly disallow any SELECT / INSERT / UPDATE / DELETE by default:
DO $$
DECLARE
    tbl text;
    tables text[] := ARRAY[
        'users',
        'cards',
        'card_transactions',
        'session_keys',
        'game_proofs',
        'market_orders',
        'google_accounts',
        'agent_cards',
        'trading_accounts',
        'dev_contexts'
    ];
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        FOREACH tbl IN ARRAY tables LOOP
            EXECUTE format('DROP POLICY IF EXISTS "deny_anon_access_%s" ON %I;', tbl, tbl);
            EXECUTE format('CREATE POLICY "deny_anon_access_%s" ON %I AS RESTRICTIVE FOR ALL TO anon USING (false);', tbl, tbl);
        END LOOP;
    END IF;
END $$;
