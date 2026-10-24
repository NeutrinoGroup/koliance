-- Migration 006: Friends Address Book, Direct Messages & User Rewards Ledger
-- Target: PostgreSQL / Supabase
-- Reference: AGENTS.md & Executive Summary

-- 1. Common Contacts / Friends Address Book
CREATE TABLE IF NOT EXISTS friends (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(128) NOT NULL,
    friend_wallet VARCHAR(128) NOT NULL,
    friend_name VARCHAR(128),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT uq_user_friend UNIQUE(user_id, friend_wallet)
);

CREATE INDEX IF NOT EXISTS idx_friends_user ON friends(user_id);
CREATE INDEX IF NOT EXISTS idx_friends_wallet ON friends(friend_wallet);

-- 2. Direct Messages (Supports Rich Text, Images via Base64/URL, Receipts & Gifts)
CREATE TABLE IF NOT EXISTS direct_messages (
    id VARCHAR(64) PRIMARY KEY,
    sender_id VARCHAR(128) NOT NULL,
    recipient_id VARCHAR(128) NOT NULL,
    msg_type VARCHAR(20) NOT NULL DEFAULT 'TEXT', -- 'TEXT', 'IMAGE', 'TRANSFER_RECEIPT', 'GIFT'
    content TEXT NOT NULL,
    attachment_url TEXT,
    metadata JSONB DEFAULT '{}'::jsonb, -- txHash, amount, currency, giftAmount
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_pair ON direct_messages(sender_id, recipient_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_messages_recipient ON direct_messages(recipient_id, created_at ASC);

-- 3. Off-chain KOL Behavior Rewards Ledger
CREATE TABLE IF NOT EXISTS user_rewards (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(128) NOT NULL,
    action_type VARCHAR(64) NOT NULL, -- 'WALLET_BIND', 'FIRST_CARD', 'FIRST_API_KEY', 'CARD_CASHBACK_10', 'STRIPE_TOPUP', 'GIFT'
    amount_kol NUMERIC(18, 4) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'CLAIMABLE', -- 'CLAIMABLE', 'WITHDRAWN'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rewards_user_status ON user_rewards(user_id, status);
CREATE INDEX IF NOT EXISTS idx_rewards_user_action ON user_rewards(user_id, action_type);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE IF EXISTS friends ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS friends FORCE ROW LEVEL SECURITY;

ALTER TABLE IF EXISTS direct_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS direct_messages FORCE ROW LEVEL SECURITY;

ALTER TABLE IF EXISTS user_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS user_rewards FORCE ROW LEVEL SECURITY;

-- 5. Revoke anon role privileges and grant to authenticated/service_role
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        REVOKE ALL ON TABLE friends FROM anon;
        REVOKE ALL ON TABLE direct_messages FROM anon;
        REVOKE ALL ON TABLE user_rewards FROM anon;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE friends TO authenticated;
        GRANT SELECT, INSERT, UPDATE ON TABLE direct_messages TO authenticated;
        GRANT SELECT ON TABLE user_rewards TO authenticated;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
        GRANT ALL ON TABLE friends TO service_role;
        GRANT ALL ON TABLE direct_messages TO service_role;
        GRANT ALL ON TABLE user_rewards TO service_role;
    END IF;
END $$;
