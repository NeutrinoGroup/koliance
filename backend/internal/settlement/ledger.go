// Package settlement holds the executable form of the settlement_ledger
// invariants introduced by migration 005.
//
// The schema half lives in SQL (columns, CHECKs, the balance_after trigger);
// the rules below are the half a single row cannot express - above all
// "the books balance", which is a property of a set of postings and not of any
// one of them. The two halves overlap on purpose: a rule that exists only in
// Go cannot stop a direct INSERT, and one that exists only in SQL cannot run
// in a unit test (docs/changes/021: two independent gates, and running only
// one of them lets a defect through).
//
// Money is math/big.Rat, never float64. The RFC's own Lua ledger drifted by
// 5e-12 on repeated HINCRBYFLOAT (GAP-20), which is what floats do to a
// ledger. big.Rat is exact for decimal literals, and it needs no new module
// (shopspring/decimal would be a dependency decision, not a bug fix).
package settlement

import (
	"errors"
	"fmt"
	"math/big"
	"regexp"
	"sort"
	"strings"
	"sync"
)

// AccountType mirrors settlement_accounts.account_type (migration 005). The
// migration enforces the same set with a foreign key, so an unknown account
// cannot be posted even by a client that bypasses this package.
type AccountType string

const (
	// AccountAvailableBalance is spendable balance.
	AccountAvailableBalance AccountType = "AVAILABLE_BALANCE"
	// AccountFrozenEscrow is an amount reserved for an in-flight intent.
	AccountFrozenEscrow AccountType = "FROZEN_ESCROW"
	// AccountFeeRevenue is protocol fee income.
	AccountFeeRevenue AccountType = "FEE_REVENUE"
	// AccountSettlementClearing is the counter-account of every event; without
	// it a two-party transfer has nowhere to credit, and a ledger that only
	// knows debit accounts cannot balance at all.
	AccountSettlementClearing AccountType = "SETTLEMENT_CLEARING"
)

// Valid reports whether a is a known account.
func (a AccountType) Valid() bool {
	switch a {
	case AccountAvailableBalance, AccountFrozenEscrow, AccountFeeRevenue, AccountSettlementClearing:
		return true
	default:
		return false
	}
}

const (
	// MaxScale is the number of decimal places NUMERIC(36, 18) stores.
	MaxScale = 18
	// MaxIntegerDigits is what is left of the 36 digits of precision.
	MaxIntegerDigits = 36 - MaxScale
)

var (
	// ErrEmptyJournal is returned for an empty posting set. An empty set is
	// not "balanced": reporting 100% on an empty denominator is the exact
	// failure documented in docs/changes/007.
	ErrEmptyJournal = errors.New("settlement: no postings to check")
	// ErrBadAmount is returned for an amount that is not a plain decimal
	// literal within NUMERIC(36, 18). Exponents and fractions are rejected
	// rather than rounded, because rounding is what makes a ledger drift.
	ErrBadAmount = errors.New("settlement: invalid amount")
	// ErrNegativeAmount is returned for a negative debit or credit. Direction
	// is carried by which column is filled, never by the sign (the migration
	// has the same CHECK).
	ErrNegativeAmount = errors.New("settlement: negative amount")
	// ErrSingleSided is returned when a row moves nothing or fills both
	// columns. The migration has the same CHECK.
	ErrSingleSided = errors.New("settlement: a posting must fill exactly one of debit/credit")
	// ErrUnknownAccount is returned for an account outside the chart.
	ErrUnknownAccount = errors.New("settlement: unknown account_type")
	// ErrMalformedEntry is returned when a non-amount field is missing.
	ErrMalformedEntry = errors.New("settlement: malformed posting")
	// ErrDuplicateSeq is returned when two postings claim the same replay
	// position; replay order would be ambiguous and the balance check would
	// depend on sort stability.
	ErrDuplicateSeq = errors.New("settlement: duplicate ledger_seq")
	// ErrOutOfOrder is returned when a posting arrives with a replay position
	// at or below its predecessor's. Replay follows ledger_seq, so accepting
	// an out-of-order posting would compute balance_after against the wrong
	// predecessor.
	ErrOutOfOrder = errors.New("settlement: ledger_seq is not strictly increasing")
	// ErrNotBalanced is returned when an intent's debits and credits differ.
	// This is the trial balance: the criterion behind "借贷必须平".
	ErrNotBalanced = errors.New("settlement: postings do not balance")
	// ErrBalanceAfterMismatch is returned when a stored balance_after does not
	// match the value replayed from the postings.
	ErrBalanceAfterMismatch = errors.New("settlement: balance_after does not match the replayed balance")
)

var decimalLiteral = regexp.MustCompile(`^-?[0-9]+(\.[0-9]+)?$`)

func zero() *big.Rat { return new(big.Rat) }

// copyRat detaches a value from the checker's live state. Any *big.Rat that
// leaves this package must go through here: a Report that shares a pointer with
// the checker is a report that a later Append silently rewrites, which is the
// one failure mode a ledger cannot afford (a number that changes with no error
// and no crash).
func copyRat(r *big.Rat) *big.Rat { return new(big.Rat).Set(r) }

// ParseAmount parses a plain decimal literal. The empty string is zero, so a
// posting's unused column can be left as "" instead of "0".
func ParseAmount(lit string) (*big.Rat, error) {
	s := strings.TrimSpace(lit)
	if s == "" {
		return zero(), nil
	}
	if !decimalLiteral.MatchString(s) {
		return nil, fmt.Errorf("%w: %q is not a plain decimal literal", ErrBadAmount, lit)
	}
	body := strings.TrimPrefix(s, "-")
	intPart, fracPart, _ := strings.Cut(body, ".")
	if len(strings.TrimLeft(intPart, "0")) > MaxIntegerDigits {
		return nil, fmt.Errorf("%w: %q has more than %d integer digits", ErrBadAmount, lit, MaxIntegerDigits)
	}
	if len(fracPart) > MaxScale {
		return nil, fmt.Errorf("%w: %q has more than %d decimal places", ErrBadAmount, lit, MaxScale)
	}
	r, ok := new(big.Rat).SetString(body)
	if !ok {
		return nil, fmt.Errorf("%w: %q", ErrBadAmount, lit)
	}
	if strings.HasPrefix(s, "-") {
		r.Neg(r)
	}
	return r, nil
}

// formatAmount renders an exact amount for logs and error messages, trimming
// the padding NUMERIC(36, 18) would carry.
func formatAmount(r *big.Rat) string {
	s := r.FloatString(MaxScale)
	if !strings.Contains(s, ".") {
		return s
	}
	s = strings.TrimRight(s, "0")
	return strings.TrimSuffix(s, ".")
}

// Entry is one row of settlement_ledger, as it is written or read back.
type Entry struct {
	// Seq is ledger_seq: the replay position, allocated by the migration's
	// sequence. Replay must not use the physical row id, because rows written
	// concurrently commit out of order.
	Seq int64
	// IntentID groups the postings of one order lifecycle.
	IntentID string
	// UserAddress is the owner the posting belongs to (NOT NULL in the DDL).
	UserAddress string
	// Account is the account being debited or credited.
	Account AccountType
	// Debit and Credit are decimal literals; exactly one is non-zero. ""
	// means zero.
	Debit  string
	Credit string
	// BalanceAfter is optional. Empty means "not asserted" (the database
	// derives the column). When set, it must equal the balance replayed from
	// the postings, which is how a tampered or drifted stored balance is
	// caught.
	BalanceAfter string
}

// AccountBalance is one account's replayed balance.
type AccountBalance struct {
	Account AccountType
	Balance *big.Rat
}

// IntentReport is the per-intent trial balance.
type IntentReport struct {
	IntentID string
	Entries  int
	// DebitTotal and CreditTotal are equal whenever the intent balances;
	// both are reported so the equality is visible rather than assumed.
	DebitTotal  *big.Rat
	CreditTotal *big.Rat
	// Accounts are the per-account balances after replay, in the order the
	// accounts first appear. A finished intent usually leaves every account at
	// zero, but that is not an invariant: the reserve leg credits
	// FROZEN_ESCROW and leaves it standing until the settle leg spends it.
	Accounts []AccountBalance
}

// Report is the result of a successful check.
type Report struct {
	Intents []IntentReport
	// Total is the sum of every intent's debit total, i.e. the volume the
	// journal moved. Balanced by construction: no report is produced
	// otherwise.
	Total *big.Rat
}

// Summary renders a stable, line-per-intent report. It exists so the check
// leaves evidence in a test log or a runbook run instead of a bare "ok".
func (r *Report) Summary() string {
	var b strings.Builder
	fmt.Fprintf(&b, "settlement: %d intent(s), total debit %s", len(r.Intents), formatAmount(r.Total))
	for _, in := range r.Intents {
		fmt.Fprintf(&b, "\n  intent=%s entries=%d debit=%s credit=%s balanced=%t",
			in.IntentID, in.Entries, formatAmount(in.DebitTotal), formatAmount(in.CreditTotal),
			in.DebitTotal.Cmp(in.CreditTotal) == 0)
		for _, ab := range in.Accounts {
			fmt.Fprintf(&b, "\n    %s=%s", ab.Account, formatAmount(ab.Balance))
		}
	}
	return b.String()
}

type intentState struct {
	id          string
	entries     int
	debitTotal  *big.Rat
	creditTotal *big.Rat
	balances    map[AccountType]*big.Rat
	order       []AccountType
}

// diffHint names the per-account balances so an unbalanced intent points at
// the leg that was forgotten, not only at the totals.
func (st *intentState) diffHint() string {
	parts := make([]string, 0, len(st.order))
	for _, acc := range st.order {
		parts = append(parts, fmt.Sprintf("%s=%s", acc, formatAmount(st.balances[acc])))
	}
	return strings.Join(parts, " ")
}

// checker folds postings in replay order. Both entry points - CheckEntries for
// a batch read back from the database, and Journal for postings accumulated in
// process - go through it, so the two cannot drift apart.
type checker struct {
	seenSeq map[int64]struct{}
	states  map[string]*intentState
	order   []string
	total   *big.Rat
	count   int
	// lastSeq is the highest replay position folded so far. Strictly
	// increasing input is what makes the per-account running balance equal to
	// the balance at that point in the replay.
	lastSeq int64
}

func newChecker() *checker {
	return &checker{
		seenSeq: make(map[int64]struct{}),
		states:  make(map[string]*intentState),
		order:   make([]string, 0, 4),
		total:   zero(),
	}
}

// apply folds one posting and enforces every per-posting rule. It is
// all-or-nothing: on error the receiver is left untouched.
func (c *checker) apply(e Entry) error {
	if e.Seq <= 0 {
		return fmt.Errorf("%w: seq %d is not allocated (ledger_seq starts at 1)", ErrMalformedEntry, e.Seq)
	}
	if _, dup := c.seenSeq[e.Seq]; dup {
		return fmt.Errorf("%w: seq %d appears twice", ErrDuplicateSeq, e.Seq)
	}
	if c.count > 0 && e.Seq <= c.lastSeq {
		return fmt.Errorf("%w: seq %d follows seq %d", ErrOutOfOrder, e.Seq, c.lastSeq)
	}
	if e.IntentID == "" || e.UserAddress == "" {
		return fmt.Errorf("%w: seq %d has an empty intent_id or user_address", ErrMalformedEntry, e.Seq)
	}
	if !e.Account.Valid() {
		return fmt.Errorf("%w: seq %d (intent %s) uses %q", ErrUnknownAccount, e.Seq, e.IntentID, e.Account)
	}

	debit, err := ParseAmount(e.Debit)
	if err != nil {
		return fmt.Errorf("seq %d (intent %s) debit: %w", e.Seq, e.IntentID, err)
	}
	credit, err := ParseAmount(e.Credit)
	if err != nil {
		return fmt.Errorf("seq %d (intent %s) credit: %w", e.Seq, e.IntentID, err)
	}

	if debit.Sign() < 0 || credit.Sign() < 0 {
		return fmt.Errorf("%w: seq %d (intent %s) has a negative amount (debit=%s credit=%s); direction is the column, not the sign",
			ErrNegativeAmount, e.Seq, e.IntentID, formatAmount(debit), formatAmount(credit))
	}
	switch {
	case debit.Sign() == 0 && credit.Sign() == 0:
		return fmt.Errorf("%w: seq %d (intent %s) moves nothing", ErrSingleSided, e.Seq, e.IntentID)
	case debit.Sign() > 0 && credit.Sign() > 0:
		return fmt.Errorf("%w: seq %d (intent %s) fills both debit=%s and credit=%s; that is two postings in one row",
			ErrSingleSided, e.Seq, e.IntentID, formatAmount(debit), formatAmount(credit))
	}

	// Everything below mutates state; the checks above have all passed.
	st := c.states[e.IntentID]
	if st == nil {
		st = &intentState{
			id:          e.IntentID,
			debitTotal:  zero(),
			creditTotal: zero(),
			balances:    make(map[AccountType]*big.Rat, 4),
		}
		c.states[e.IntentID] = st
		c.order = append(c.order, e.IntentID)
	}
	st.entries++
	st.debitTotal.Add(st.debitTotal, debit)
	st.creditTotal.Add(st.creditTotal, credit)
	c.total.Add(c.total, debit)

	bal := st.balances[e.Account]
	if bal == nil {
		bal = zero()
		st.balances[e.Account] = bal
		st.order = append(st.order, e.Account)
	}
	bal.Add(bal, debit)
	bal.Sub(bal, credit)

	if e.BalanceAfter != "" {
		stored, err := ParseAmount(e.BalanceAfter)
		if err != nil {
			return fmt.Errorf("seq %d (intent %s) balance_after: %w", e.Seq, e.IntentID, err)
		}
		if stored.Cmp(bal) != 0 {
			return fmt.Errorf("%w: intent %s seq %d account %s: stored %s, replayed %s",
				ErrBalanceAfterMismatch, e.IntentID, e.Seq, e.Account, formatAmount(stored), formatAmount(bal))
		}
	}

	c.seenSeq[e.Seq] = struct{}{}
	c.lastSeq = e.Seq
	c.count++
	return nil
}

// close asserts the trial balance and builds the report.
//
// The report is a SNAPSHOT: every amount is copied out of the checker, so a
// caller that keeps it does not hold a window onto state that later appends
// mutate. Close was a pure read only because nothing used to append afterwards.
func (c *checker) close() (*Report, error) {
	if c.count == 0 {
		return nil, ErrEmptyJournal
	}
	rep := &Report{Intents: make([]IntentReport, 0, len(c.order)), Total: copyRat(c.total)}
	for _, id := range c.order {
		st := c.states[id]
		if st.debitTotal.Cmp(st.creditTotal) != 0 {
			return nil, fmt.Errorf("%w: intent %s: debit total %s != credit total %s (%s)",
				ErrNotBalanced, id, formatAmount(st.debitTotal), formatAmount(st.creditTotal), st.diffHint())
		}
		in := IntentReport{
			IntentID:    id,
			Entries:     st.entries,
			DebitTotal:  copyRat(st.debitTotal),
			CreditTotal: copyRat(st.creditTotal),
			Accounts:    make([]AccountBalance, 0, len(st.order)),
		}
		for _, acc := range st.order {
			in.Accounts = append(in.Accounts, AccountBalance{Account: acc, Balance: copyRat(st.balances[acc])})
		}
		rep.Intents = append(rep.Intents, in)
	}
	return rep, nil
}

// CheckEntries replays a set of postings and asserts the ledger invariants.
//
// The criterion for "the books balance" is a trial balance per intent: the
// debits must equal the credits. A prefix-by-prefix variant was deliberately
// NOT used. It would accept the paired postings written today, but it also
// rejects a legitimate three-leg voucher - for instance "debit
// AVAILABLE_BALANCE 100, credit FROZEN_ESCROW 98, credit FEE_REVENUE 2", which
// is unbalanced after its second leg and balanced after its third. The schema
// carries no voucher key to partition on, so a per-posting rule would have to
// assume a two-row voucher and would fail closed on a correct journal.
//
// It is also not a database constraint, on purpose. The same rule as a
// deferred constraint trigger would fire when the reserve leg commits -
// before the settle leg exists - and would reject the incremental flow it is
// meant to protect. It is an assertion to run over a finished set of postings.
func CheckEntries(entries []Entry) (*Report, error) {
	ordered := make([]Entry, len(entries))
	copy(ordered, entries)
	sort.SliceStable(ordered, func(i, j int) bool { return ordered[i].Seq < ordered[j].Seq })

	c := newChecker()
	for _, e := range ordered {
		if err := c.apply(e); err != nil {
			return nil, err
		}
	}
	return c.close()
}

// Journal accumulates postings in replay order and re-checks each one as it
// arrives, so a caller cannot build an unbalanced journal and only discover it
// at Close. Per-posting rules bite immediately; the trial balance is asserted
// by Close, because a voucher is legitimately unbalanced while it is being
// written.
//
// CONCURRENCY CONTRACT (added in docs/changes/044): one Journal is safe for
// concurrent use by multiple goroutines. Append and Close are serialized by an
// internal mutex, so callers never touch the checker's maps at the same time -
// without it, two Appends reaching c.seenSeq (read) and c.states (write)
// concurrently make the Go runtime abort the whole process with `fatal error:
// concurrent map writes`, which is not a recoverable panic and takes every other
// test result in the binary with it.
//
// What the lock does NOT change: a posting whose ledger_seq is not greater than
// the last one folded is still refused with ErrOutOfOrder. Concurrency is not a
// way to relax replay order - a sequence hands out ledger_seq, and the journal
// follows it. Callers that only ever append in that order cannot observe the
// lock at all.
//
// A failed Append leaves the journal exactly as it was; a Report returned by
// Close is an immutable snapshot and is unaffected by later appends.
type Journal struct {
	mu sync.Mutex
	c  *checker
}

// NewJournal returns an empty journal.
func NewJournal() *Journal { return &Journal{c: newChecker()} }

// Append adds one posting. The journal is unchanged when the posting is
// refused. Seq must be strictly greater than the previous posting's, which is
// what a monotonic sequence gives.
func (j *Journal) Append(e Entry) error {
	j.mu.Lock()
	defer j.mu.Unlock()
	return j.c.apply(e)
}

// Close asserts the trial balance and returns the report. The journal may keep
// being appended to afterwards; Close is a read, and the report it hands back
// cannot be changed by it.
func (j *Journal) Close() (*Report, error) {
	j.mu.Lock()
	defer j.mu.Unlock()
	return j.c.close()
}
