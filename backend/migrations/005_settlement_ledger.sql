-- Migration 005: Double-Entry Settlement Ledger
-- Target: PostgreSQL / Supabase
-- Source: RFC-001 section 4.2.2 (the RFC's DDL is reused verbatim for the
--         column set) + ADR-004 D1 (this table is one of the three reusable
--         pieces left by the RFC).
--
-- Why the file number is 005 and not 004: 004_liquidation_events.sql is taken
-- by the unmerged branch feat/liquidation-bot-chain, so 004 would collide on
-- the first merge. Rule from AGENTS.md D4 (single source of truth for
-- identifiers): check before you allocate.
--
-- The RFC gives the columns but no criterion for "the books balance". This
-- file therefore carries both the table and the invariants as database
-- constraints. The same invariants are restated in executable Go form in
-- internal/settlement/ledger.go (that is what the unit tests assert):
--   * a constraint that exists only in Go cannot stop a direct INSERT
--   * a constraint that exists only in SQL cannot run in a unit test
-- They are two independent gates on purpose (docs/changes/021 found that
-- running only one of two gates lets a defect through).
--
-- Invariant, in one sentence: replaying the postings of one intent in
-- ledger_seq order, the running total of (credit - debit) must be zero after
-- every single posting. A transfer is never a single row: every economic
-- event debits one account and credits another, so a one-sided journal is
-- rejected rather than silently accepted.

-- ==================== 1. Chart of accounts ====================
-- account_type is validated by a foreign key from settlement_ledger, so an
-- unknown account cannot be posted to. normal_side is metadata for reporting;
-- the balance rule itself only uses debit/credit.
CREATE TABLE IF NOT EXISTS settlement_accounts (
    account_type VARCHAR(32) PRIMARY KEY,
    normal_side  VARCHAR(8)  NOT NULL CHECK (normal_side IN ('DEBIT', 'CREDIT')),
    description  TEXT,
    created_at   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

INSERT INTO settlement_accounts (account_type, normal_side, description)
VALUES
    ('AVAILABLE_BALANCE',   'DEBIT',  'Spendable balance of the agent or card holder'),
    ('FROZEN_ESCROW',       'DEBIT',  'Amount reserved for an in-flight intent'),
    ('FEE_REVENUE',         'CREDIT', 'Protocol fee income'),
    ('SETTLEMENT_CLEARING', 'CREDIT', 'Counter-account: the balance sheet side of every event')
ON CONFLICT (account_type) DO NOTHING;

-- ==================== 2. Settlement intents ====================
-- settlement_ledger.intent_id references this table; the RFC's DDL had that
-- reference but did not ship trading_orders in this repository, so the parent
-- row is created here under a name that says what it is: the ledger's own
-- intent registry. The RFC's trading_orders lifecycle columns are kept so the
-- RFC's state names still apply.
CREATE TABLE IF NOT EXISTS settlement_intents (
    intent_id       VARCHAR(64) PRIMARY KEY,
    user_address    VARCHAR(42) NOT NULL,
    agent_id        VARCHAR(66),
    symbol          VARCHAR(32),
    side            VARCHAR(8),
    target_amount   NUMERIC(36, 18),
    reserved_amount NUMERIC(36, 18) NOT NULL DEFAULT 0,
    actual_amount   NUMERIC(36, 18) NOT NULL DEFAULT 0,
    state           VARCHAR(32) NOT NULL DEFAULT 'PENDING_AUTH',
    error_message   TEXT,
    created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT ck_settlement_intents_state CHECK (state IN (
        'PENDING_AUTH', 'RESERVED', 'ROUTING', 'FILLED', 'REVERTED', 'SETTLED'
    ))
);

CREATE INDEX IF NOT EXISTS idx_settlement_intents_user_state
    ON settlement_intents (user_address, state);

-- ==================== 3. The ledger ====================
-- ledger_seq orders postings *logically*; entry_id orders them *physically*.
-- They are separate on purpose: RFC section 4.3.2 plans a Redis state pool in
-- front of this table, and rows written concurrently then commit out of order.
-- Replay must follow ledger_seq, which is allocated by a sequence (monotonic
-- regardless of commit order), not entry_id (assigned at insert time).
CREATE SEQUENCE IF NOT EXISTS settlement_ledger_seq;

CREATE TABLE IF NOT EXISTS settlement_ledger (
    entry_id        BIGSERIAL PRIMARY KEY,
    ledger_seq      BIGINT NOT NULL UNIQUE,
    intent_id       VARCHAR(64) NOT NULL REFERENCES settlement_intents(intent_id),
    user_address    VARCHAR(42) NOT NULL,
    account_type    VARCHAR(32) NOT NULL REFERENCES settlement_accounts(account_type),
    debit           NUMERIC(36, 18) NOT NULL DEFAULT 0 CHECK (debit >= 0),
    credit          NUMERIC(36, 18) NOT NULL DEFAULT 0 CHECK (credit >= 0),
    -- Derived, never trusted: the value supplied by a client is recomputed by
    -- the trigger below (see settlement_ledger_before_insert). Scope is the
    -- (intent_id, account_type) running balance, which is what makes the
    -- column checkable from this table alone. The RFC only says
    -- "balance_after NUMERIC(36,18) NOT NULL" without saying whose balance;
    -- this is the scope this repository commits to.
    balance_after   NUMERIC(36, 18) NOT NULL,
    batch_rollup_id VARCHAR(66),
    recorded_at     TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    -- Single-sided postings only. debit = credit = 0 moves nothing and
    -- debit > 0 with credit > 0 is two postings crammed into one row; both
    -- are rejected so the journal cannot hide an unbalanced pair.
    CONSTRAINT ck_settlement_ledger_single_sided CHECK (
        (debit = 0 AND credit > 0) OR (credit = 0 AND debit > 0)
    )
);

-- Replay order within one intent (the RFC's index, extended with ledger_seq
-- so the ORDER BY of the balance trigger is index-backed).
CREATE INDEX IF NOT EXISTS idx_ledger_intent
    ON settlement_ledger (intent_id, ledger_seq);
-- Batch rollup scan: the postings that no rollup has claimed yet.
CREATE INDEX IF NOT EXISTS idx_settlement_ledger_unrolled
    ON settlement_ledger (ledger_seq) WHERE batch_rollup_id IS NULL;

-- One BEFORE INSERT function doing both jobs, in order:
--   1. allocate the logical replay position (ledger_seq),
--   2. derive balance_after from the postings that precede it.
--
-- These are deliberately NOT two triggers. PostgreSQL fires triggers of the
-- same timing in name order, so a pair named ".._balance_after" and
-- ".._fill_seq" would run balance_after FIRST - against a NULL ledger_seq, so
-- the "previous posting" lookup would match nothing and every row would record
-- its own delta as its balance. The bug is invisible until someone reads a
-- balance, and it cannot be caught by a unit test: it needs a live server.
-- One function, one trigger, no name-order dependency.
--
-- ledger_seq is allocated here rather than by the writer so that a client
-- cannot pick its own replay position (which would break replay order as soon
-- as two writers interleave), and so a writer that omits the column gets a
-- value instead of a NOT NULL violation.
--
-- The transaction-scoped advisory lock serializes concurrent postings on the
-- same intent; without it two writers read the same predecessor row and both
-- write the same balance_after.
CREATE OR REPLACE FUNCTION settlement_ledger_before_insert() RETURNS trigger AS $$
DECLARE
    prev NUMERIC(36, 18);
BEGIN
    IF NEW.ledger_seq IS NULL OR NEW.ledger_seq = 0 THEN
        NEW.ledger_seq := nextval('settlement_ledger_seq');
    END IF;

    PERFORM pg_advisory_xact_lock(hashtextextended(NEW.intent_id, 0));

    SELECT l.balance_after INTO prev
      FROM settlement_ledger l
     WHERE l.intent_id = NEW.intent_id
       AND l.account_type = NEW.account_type
       AND l.ledger_seq < NEW.ledger_seq
     ORDER BY l.ledger_seq DESC
     LIMIT 1;

    IF prev IS NULL THEN
        NEW.balance_after := NEW.debit - NEW.credit;
    ELSE
        NEW.balance_after := prev + NEW.debit - NEW.credit;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_settlement_ledger_before_insert ON settlement_ledger;
CREATE TRIGGER trg_settlement_ledger_before_insert
    BEFORE INSERT ON settlement_ledger
    FOR EACH ROW EXECUTE FUNCTION settlement_ledger_before_insert();

-- ==================== 4. Row level security ====================
-- Same posture as migration 002 (deny anon by default) with one deliberate
-- difference: ENABLE, but no FORCE.
-- FORCE subjects the table *owner* to the policies too, and this file defines
-- no permissive policy. On a plain PostgreSQL (no anon role, no policies)
-- FORCE would therefore deny the application itself - a silent, total outage
-- of exactly the kind GAP-49 exists to remove. Supabase's service_role
-- bypasses RLS either way, so FORCE buys nothing here and costs a footgun.
ALTER TABLE settlement_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE settlement_intents  ENABLE ROW LEVEL SECURITY;
ALTER TABLE settlement_ledger   ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
    tbl text;
    tables text[] := ARRAY['settlement_accounts', 'settlement_intents', 'settlement_ledger'];
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        FOREACH tbl IN ARRAY tables LOOP
            EXECUTE format('DROP POLICY IF EXISTS "deny_anon_access_%s" ON %I;', tbl, tbl);
            EXECUTE format('CREATE POLICY "deny_anon_access_%s" ON %I AS RESTRICTIVE FOR ALL TO anon USING (false);', tbl, tbl);
        END LOOP;
    END IF;
END $$;
