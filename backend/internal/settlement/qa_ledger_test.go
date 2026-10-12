package settlement

// Independent 03-ring suite for the settlement ledger invariants (GAP-43).
//
// This file is written by qa-validator, NOT by the implementing role. It
// deliberately does not reuse the helpers in ledger_test.go: the two files must
// be deletable independently, and a helper shared between author and verifier
// is a place where a wrong assumption can hide twice.
//
// What it pins down, and why each case exists:
//
//   - the criterion really is a PER-INTENT TRIAL BALANCE (debits == credits),
//     not a net total and not a per-posting prefix rule;
//   - a three-leg voucher (100 = 98 + 2) is accepted, and a SINGLE missing leg
//     is rejected - the "is it deaf?" question asked of every balance gate;
//   - what the criterion CANNOT see, stated as an executable limitation rather
//     than as prose (see TestQATrialBalanceCannotSeeWhichPairIsIncomplete);
//   - boundaries: zero amount, single leg, negative seq, MaxInt64, column
//     envelope, unicode digits, nil vs empty slice;
//   - concurrency, under -race.

import (
	"errors"
	"fmt"
	"math"
	"math/big"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
)

const qaWallet = "0x0000000000000000000000000000000000000001"

// qaPost builds one posting. Names are qa-prefixed throughout so a collision
// with the implementation's own test file is a compile error, not a silent
// shadow.
func qaPost(seq int64, intent string, account AccountType, debit, credit string) Entry {
	return Entry{
		Seq:         seq,
		IntentID:    intent,
		UserAddress: qaWallet,
		Account:     account,
		Debit:       debit,
		Credit:      credit,
	}
}

// qaWant compares an exact rational against a decimal literal.
func qaWant(t *testing.T, label string, got *big.Rat, want string) {
	t.Helper()
	if got == nil {
		t.Errorf("%s = nil, want %s", label, want)
		return
	}
	w, ok := new(big.Rat).SetString(want)
	if !ok {
		t.Fatalf("bad want literal %q", want)
	}
	if got.Cmp(w) != 0 {
		t.Errorf("%s = %s, want %s", label, got.RatString(), want)
	}
}

// ==================== A. multi-leg vouchers and the trial balance ====================

// The exact example from the task book's DoD wording (A3): 100 = 98 + 2.
// A prefix-per-posting criterion would reject this at leg 2; the trial balance
// accepts it. If this test ever fails, the criterion was narrowed back.
func TestQAThreeLegVoucher100Equals98Plus2(t *testing.T) {
	entries := []Entry{
		qaPost(1, "qa-3leg", AccountAvailableBalance, "100", ""),
		qaPost(2, "qa-3leg", AccountFrozenEscrow, "", "98"),
		qaPost(3, "qa-3leg", AccountFeeRevenue, "", "2"),
	}
	rep, err := CheckEntries(entries)
	if err != nil {
		t.Fatalf("100 = 98 + 2 rejected: %v", err)
	}
	qaWant(t, "Total", rep.Total, "100")
	qaWant(t, "DebitTotal", rep.Intents[0].DebitTotal, "100")
	qaWant(t, "CreditTotal", rep.Intents[0].CreditTotal, "100")
	if rep.Intents[0].Entries != 3 {
		t.Errorf("Entries = %d, want 3", rep.Intents[0].Entries)
	}
	t.Logf("evidence:\n%s", rep.Summary())
}

// Four legs, two fees: 100 = 97 + 2 + 1. More than one fee leg is what a real
// split (protocol fee + LP fee + insurance) produces.
func TestQAFourLegVoucherSplitsTwoFees(t *testing.T) {
	entries := []Entry{
		qaPost(1, "qa-4leg", AccountAvailableBalance, "100", ""),
		qaPost(2, "qa-4leg", AccountFrozenEscrow, "", "97"),
		qaPost(3, "qa-4leg", AccountFeeRevenue, "", "2"),
		qaPost(4, "qa-4leg", AccountSettlementClearing, "", "1"),
	}
	rep, err := CheckEntries(entries)
	if err != nil {
		t.Fatalf("100 = 97 + 2 + 1 rejected: %v", err)
	}
	qaWant(t, "Total", rep.Total, "100")
}

// A single leg of a normal two-leg transfer: the classic missing-credit defect.
// This is the "can it catch a dropped leg" case with no other rows to hide
// behind.
func TestQASingleLegIsRejected(t *testing.T) {
	entries := []Entry{
		qaPost(1, "qa-single", AccountAvailableBalance, "100", ""),
	}
	_, err := CheckEntries(entries)
	if !errors.Is(err, ErrNotBalanced) {
		t.Fatalf("single leg: err = %v, want ErrNotBalanced", err)
	}
	if !strings.Contains(err.Error(), "qa-single") {
		t.Errorf("error does not name the intent: %v", err)
	}
	t.Logf("evidence: %v", err)
}

// Dropping the fee leg of a three-leg voucher leaves two legal postings
// (100 debit, 98 credit). The imbalance is only visible at intent level, which
// is precisely the criterion's job.
func TestQADroppedFeeLegOnThreeLegVoucherIsRejected(t *testing.T) {
	full := []Entry{
		qaPost(1, "qa-drop-fee", AccountAvailableBalance, "100", ""),
		qaPost(2, "qa-drop-fee", AccountFrozenEscrow, "", "98"),
		qaPost(3, "qa-drop-fee", AccountFeeRevenue, "", "2"),
	}
	if _, err := CheckEntries(full); err != nil {
		t.Fatalf("control: the complete voucher must pass: %v", err)
	}
	_, err := CheckEntries(full[:2]) // fee leg never written
	if !errors.Is(err, ErrNotBalanced) {
		t.Fatalf("missing fee leg: err = %v, want ErrNotBalanced", err)
	}
	if !strings.Contains(err.Error(), "qa-drop-fee") {
		t.Errorf("error does not name the intent: %v", err)
	}
	t.Logf("evidence: %v", err)
}

// A half atom of imbalance inside a three-leg voucher. Integer money would call
// this zero; big.Rat must not.
func TestQADustImbalanceInThreeLegVoucherIsRejected(t *testing.T) {
	entries := []Entry{
		qaPost(1, "qa-dust-3leg", AccountAvailableBalance, "100", ""),
		qaPost(2, "qa-dust-3leg", AccountFrozenEscrow, "", "97.999999999999999999"),
		qaPost(3, "qa-dust-3leg", AccountFeeRevenue, "", "2"),
	}
	_, err := CheckEntries(entries)
	if !errors.Is(err, ErrNotBalanced) {
		t.Fatalf("1e-18 imbalance: err = %v, want ErrNotBalanced", err)
	}
	t.Logf("evidence: %v", err)
}

// The criterion is arithmetic, not semantic: an intent whose every leg stands
// on the same account (debit 100, credit 100) balances and is accepted, and it
// nets the account to zero. Asserted so that nobody believes the checker is
// doing a "no self-dealing" or direction check it is not.
func TestQASelfCancellingIntentIsAccepted(t *testing.T) {
	entries := []Entry{
		qaPost(1, "qa-self", AccountAvailableBalance, "100", ""),
		qaPost(2, "qa-self", AccountAvailableBalance, "", "100"),
	}
	rep, err := CheckEntries(entries)
	if err != nil {
		t.Fatalf("self-cancelling intent rejected: %v", err)
	}
	if len(rep.Intents[0].Accounts) != 1 {
		t.Fatalf("accounts = %d, want 1", len(rep.Intents[0].Accounts))
	}
	qaWant(t, "account balance", rep.Intents[0].Accounts[0].Balance, "0")
}

// A zero-amount leg is not a posting. The DDL has the same CHECK, so the two
// gates agree - and both must.
func TestQAZeroLegIsRejected(t *testing.T) {
	entries := []Entry{
		qaPost(1, "qa-zero", AccountAvailableBalance, "0", ""),
		qaPost(2, "qa-zero", AccountSettlementClearing, "", "0"),
	}
	_, err := CheckEntries(entries)
	if !errors.Is(err, ErrSingleSided) {
		t.Fatalf("zero legs: err = %v, want ErrSingleSided", err)
	}
}

// One missing leg out of fifty independent intents. The check is per intent, so
// it must name the damaged one specifically - not "something is wrong".
func TestQADroppedLegAmongFiftyIntentsNamesTheDamagedOne(t *testing.T) {
	var entries []Entry
	seq := int64(1)
	for i := 0; i < 50; i++ {
		intent := fmt.Sprintf("qa-many-%02d", i)
		entries = append(entries, qaPost(seq, intent, AccountAvailableBalance, "10", ""))
		seq++
		if i == 17 {
			seq++ // the credit leg of intent 17 was never written
			continue
		}
		entries = append(entries, qaPost(seq, intent, AccountSettlementClearing, "", "10"))
		seq++
	}
	_, err := CheckEntries(entries)
	if !errors.Is(err, ErrNotBalanced) {
		t.Fatalf("dropped leg among 50 intents: err = %v, want ErrNotBalanced", err)
	}
	if !strings.Contains(err.Error(), "qa-many-17") {
		t.Errorf("error does not name the damaged intent: %v", err)
	}
	t.Logf("evidence: %v", err)
}

// Two intents, each wrong in the opposite direction: the global net is zero.
// A net-total criterion would report "balanced"; the per-intent trial balance
// must not.
func TestQAOppositeImbalancesAcrossIntentsAreRejected(t *testing.T) {
	entries := []Entry{
		qaPost(1, "qa-short", AccountAvailableBalance, "100", ""),
		qaPost(2, "qa-long", AccountSettlementClearing, "", "100"),
	}
	_, err := CheckEntries(entries)
	if !errors.Is(err, ErrNotBalanced) {
		t.Fatalf("global net zero but per-intent wrong: err = %v, want ErrNotBalanced", err)
	}
	if !strings.Contains(err.Error(), "qa-short") {
		t.Errorf("error hides the failing intent: %v", err)
	}
}

// ==================== B. what the criterion cannot see (executable limitation) ====================

// LIMITATION, ASSERTED ON PURPOSE - READ BEFORE CHANGING IT.
//
// The criterion compares an intent's TOTAL debits against its TOTAL credits.
// Two complete voucher pairs written under a single intent_id are therefore
// accepted - correctly, because a legitimate four-leg voucher has exactly that
// shape. The consequence is the part that matters: the checker cannot tell a
// well-formed four-leg voucher from two interleaved events, so a leg dropped in
// one event is compensated by a surplus leg belonging to another event as long
// as both events share an intent_id.
//
// The postings below are the minimal demonstration. Nothing in them says the
// FEE_REVENUE credit belongs to the same economic event as the FROZEN_ESCROW
// debit - and nothing in the schema can say it, because there is no voucher key
// to say it with (SETTLEMENT_CLEARING is the one account that is explicitly
// shared, so the account alone cannot serve as the key either).
//
// This test asserts the CURRENT, permissive behaviour. It is not an endorsement:
// it is the hole written down where a reader will find it. When the ledger gets
// a per-voucher key (or the writer stops sharing an intent_id between two
// economic events), this test must be INVERTED, and it will fail until someone
// does - which is the point.
func TestQATrialBalanceCannotSeeWhichPairIsIncomplete(t *testing.T) {
	entries := []Entry{
		// event X, complete
		qaPost(1, "qa-merged", AccountAvailableBalance, "100", ""),
		qaPost(2, "qa-merged", AccountSettlementClearing, "", "100"),
		// event Y, whose debit was written here and whose credit was not
		qaPost(3, "qa-merged", AccountFrozenEscrow, "100", ""),
		// the credit that makes the totals cancel - it could belong to a third
		// event entirely, and nothing here or in the schema would notice
		qaPost(4, "qa-merged", AccountFeeRevenue, "", "100"),
	}
	rep, err := CheckEntries(entries)
	if err != nil {
		// If the criterion is ever tightened to a voucher-level or prefix-level
		// rule, this is the assertion that will fire first. That is expected and
		// desirable: replace this whole test with the tightened expectation.
		t.Fatalf("the limitation was closed (good news): %v - invert this test", err)
	}
	qaWant(t, "Total", rep.Total, "200")
	perAccount := map[AccountType]string{}
	for _, ab := range rep.Intents[0].Accounts {
		perAccount[ab.Account] = ab.Balance.RatString()
	}
	// Both "pairs" are individually complete in the totals, and the account
	// picture is indistinguishable from two correct events.
	if perAccount[AccountAvailableBalance] != "100" || perAccount[AccountSettlementClearing] != "-100" {
		t.Errorf("group X accounts moved: %v", perAccount)
	}
	t.Logf("LIMITATION EVIDENCE - the checker reports balanced for a journal in which one economic event has no credit leg:\n%s", rep.Summary())
}

// ==================== C. balance_after scope ====================

// balance_after is a per-(intent, account) running balance, not a per-intent
// one. Asserted from the outside so the statement in the code comment is
// checkable: the two accounts legitimately hold different values at the same
// moment.
func TestQABalanceAfterIsPersistedAndScopedPerAccount(t *testing.T) {
	entries := []Entry{
		qaPost(1, "qa-bal-scope", AccountAvailableBalance, "100", ""),
		qaPost(2, "qa-bal-scope", AccountSettlementClearing, "", "100"),
	}
	entries[0].BalanceAfter = "100"  // its own account is up by 100
	entries[1].BalanceAfter = "-100" // its own account is down by 100
	if _, err := CheckEntries(entries); err != nil {
		t.Fatalf("per-account balance_after rejected: %v", err)
	}

	// The wrong scope: leg 2 asserting the balance of leg 1's account.
	entries[1].BalanceAfter = "100"
	_, err := CheckEntries(entries)
	if !errors.Is(err, ErrBalanceAfterMismatch) {
		t.Fatalf("balance_after with the wrong account scope: err = %v, want ErrBalanceAfterMismatch", err)
	}
	t.Logf("evidence: %v", err)
}

// A tampered stored balance on an ACCUMULATING account (two postings, same
// account) - the case where the running value, not the delta, is wrong.
func TestQATamperedRunningBalanceAfterOnAccumulatingAccountIsRejected(t *testing.T) {
	entries := []Entry{
		qaPost(1, "qa-bal-run", AccountAvailableBalance, "100", ""),
		qaPost(2, "qa-bal-run", AccountAvailableBalance, "50", ""),
		qaPost(3, "qa-bal-run", AccountSettlementClearing, "", "150"),
	}
	entries[0].BalanceAfter = "100"
	entries[1].BalanceAfter = "150"
	if _, err := CheckEntries(entries); err != nil {
		t.Fatalf("control: correct running balances rejected: %v", err)
	}
	entries[1].BalanceAfter = "100" // "the delta", not the running balance
	_, err := CheckEntries(entries)
	if !errors.Is(err, ErrBalanceAfterMismatch) {
		t.Fatalf("running balance mistaken for a delta: err = %v, want ErrBalanceAfterMismatch", err)
	}
}

// ==================== D. boundaries and extremes ====================

// The full NUMERIC(36, 18) envelope is usable, and one digit past it is not.
func TestQAColumnEnvelopeIsUsableAndOneDigitPastIsNot(t *testing.T) {
	max := "9" + strings.Repeat("9", 17) + "." + strings.Repeat("9", 18) // 18 + 18 digits
	if _, err := CheckEntries([]Entry{
		qaPost(1, "qa-max", AccountAvailableBalance, max, ""),
		qaPost(2, "qa-max", AccountSettlementClearing, "", max),
	}); err != nil {
		t.Fatalf("column envelope rejected: %v", err)
	}
	overInt := "1" + max // 19 integer digits
	overScale := max + "9"
	for _, lit := range []string{overInt, overScale} {
		if _, err := ParseAmount(lit); !errors.Is(err, ErrBadAmount) {
			t.Errorf("ParseAmount(%q): err = %v, want ErrBadAmount", lit, err)
		}
	}
}

// Leading and trailing zeros are the same amount; the ledger must not treat
// "0100.000" as a different figure from "100".
func TestQALeadingAndTrailingZerosAreTheSameAmount(t *testing.T) {
	r, err := ParseAmount("0100.000")
	if err != nil {
		t.Fatalf("ParseAmount(0100.000): %v", err)
	}
	qaWant(t, "0100.000", r, "100")
	if _, err := CheckEntries([]Entry{
		qaPost(1, "qa-zeros", AccountAvailableBalance, "0100.000", ""),
		qaPost(2, "qa-zeros", AccountSettlementClearing, "", "100"),
	}); err != nil {
		t.Fatalf("zero-padded balance rejected: %v", err)
	}
}

// Amounts that are not plain ASCII decimals. Non-ASCII decimal digits are the
// interesting entry: they are real numbers to a human and invalid literals to a
// ledger, and a permissive parser would silently mis-read or zero them.
func TestQAOddAmountLiteralsAreRejected(t *testing.T) {
	bad := []string{
		"١٠٠",   // Arabic-Indic digits
		"１００",   // fullwidth digits
		"+100",  // explicit plus
		"1e3",   // exponent
		".5",    // no integer part
		"100.",  // trailing point
		"1_000", // digit separator
		"−100",  // U+2212 minus, not ASCII '-'
		"-100",  // negative: parses, then rejected as a *negative* amount
	}
	for _, lit := range bad {
		r, err := ParseAmount(lit)
		if lit == "-100" {
			if err != nil {
				t.Errorf("ParseAmount(%q) = %v; -100 is a valid literal and the sign check belongs to the posting", lit, err)
			} else if r.Sign() >= 0 {
				t.Errorf("ParseAmount(%q) = %s, want a negative value", lit, r.RatString())
			}
			continue
		}
		if !errors.Is(err, ErrBadAmount) {
			t.Errorf("ParseAmount(%q) = %v, %v; want ErrBadAmount", lit, r, err)
		}
	}
	// Whitespace-only and empty both mean "this column is zero" - documented
	// behaviour, pinned so it cannot drift into an error.
	for _, lit := range []string{"", " ", "\t"} {
		r, err := ParseAmount(lit)
		if err != nil || r.Sign() != 0 {
			t.Errorf("ParseAmount(%q) = %v, %v; want 0, nil", lit, r, err)
		}
	}
}

// seq is a replay position allocated by a sequence: 1..MaxInt64. Zero and
// negative are "never allocated", and MaxInt64 must not overflow anything.
func TestQASeqBoundaries(t *testing.T) {
	for _, seq := range []int64{0, -1, math.MinInt64} {
		_, err := CheckEntries([]Entry{qaPost(seq, "qa-seq", AccountAvailableBalance, "1", "")})
		if !errors.Is(err, ErrMalformedEntry) {
			t.Errorf("seq %d: err = %v, want ErrMalformedEntry", seq, err)
		}
	}

	rep, err := CheckEntries([]Entry{
		qaPost(math.MaxInt64-1, "qa-seqmax", AccountAvailableBalance, "1", ""),
		qaPost(math.MaxInt64, "qa-seqmax", AccountSettlementClearing, "", "1"),
	})
	if err != nil {
		t.Fatalf("MaxInt64 replay position rejected: %v", err)
	}
	qaWant(t, "Total", rep.Total, "1")
}

// ledger_seq is globally UNIQUE in the DDL. The Go half must agree, or a
// journal that the checker accepts cannot be inserted.
func TestQADuplicateSeqAcrossDifferentIntentsIsRejected(t *testing.T) {
	entries := []Entry{
		qaPost(7, "qa-dup-a", AccountAvailableBalance, "1", ""),
		qaPost(7, "qa-dup-b", AccountSettlementClearing, "", "1"),
	}
	_, err := CheckEntries(entries)
	if !errors.Is(err, ErrDuplicateSeq) {
		t.Fatalf("same ledger_seq in two intents: err = %v, want ErrDuplicateSeq (the DDL has UNIQUE on ledger_seq)", err)
	}
}

// A journal reports its own volume; the summary is what a runbook run leaves
// behind, so it must not be empty and must not claim balance it does not have.
func TestQAReportSummaryCarriesTheEvidence(t *testing.T) {
	rep, err := CheckEntries([]Entry{
		qaPost(1, "qa-summary", AccountAvailableBalance, "100", ""),
		qaPost(2, "qa-summary", AccountFrozenEscrow, "", "98"),
		qaPost(3, "qa-summary", AccountFeeRevenue, "", "2"),
	})
	if err != nil {
		t.Fatalf("CheckEntries: %v", err)
	}
	s := rep.Summary()
	for _, want := range []string{"qa-summary", "balanced=true", "100", "98", "2"} {
		if !strings.Contains(s, want) {
			t.Errorf("summary %q does not contain %q", s, want)
		}
	}
	t.Logf("evidence:\n%s", s)
}

// ==================== E. concurrency (-race) ====================

// Sixty-four producers build postings concurrently; one appender writes them in
// replay order. This is the supported shape (a sequence hands out ledger_seq
// and the journal follows it) and it is what -race has to see clean.
func TestQAJournalConcurrentProducersWithOrderedAppender(t *testing.T) {
	const pairs = 64
	total := 2 * pairs

	// Each producer owns exactly one slot, so concurrent construction is
	// race-free by construction and -race will say so.
	slots := make([]Entry, total)
	var wg sync.WaitGroup
	for i := 0; i < pairs; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			slots[2*i] = qaPost(int64(2*i+1), "qa-conc", AccountAvailableBalance, "1", "")
			slots[2*i+1] = qaPost(int64(2*i+2), "qa-conc", AccountSettlementClearing, "", "1")
		}(i)
	}
	wg.Wait()

	j := NewJournal()
	for _, e := range slots {
		if err := j.Append(e); err != nil {
			t.Fatalf("ordered append of seq %d refused: %v", e.Seq, err)
		}
	}
	rep, err := j.Close()
	if err != nil {
		t.Fatalf("Close after %d ordered appends: %v", total, err)
	}
	if rep.Intents[0].Entries != total {
		t.Errorf("Entries = %d, want %d", rep.Intents[0].Entries, total)
	}
	qaWant(t, "Total", rep.Total, fmt.Sprintf("%d", pairs))
}

// Concurrent append to ONE journal: the same replay position, contended by 64
// goroutines, eight times over.
//
// This test REPLACES the environment-gated reproducer that used to stand here
// (docs/changes/044). That reproducer was excluded from CI on purpose - it
// aborted the test binary - which meant the concurrency contract had no
// criterion that ever ran; the only evidence was a command someone had to
// remember to type. It was also only probabilistic evidence even when enabled:
// measured at 3 false-greens out of 20 runs against the unfixed code.
//
// The assertions below are chosen so that they are DETERMINISTIC ON CORRECT CODE
// - they do not flake - while the defect still fails them in two independent
// ways:
//
//   - The count. With the mutex, "has this ledger_seq been folded?" and "record
//     it" are one atomic step, so of 64 concurrent appends of the SAME position
//     exactly ONE can win and the other 63 must be told ErrDuplicateSeq. Without
//     serialization two goroutines can both read the map as empty and both
//     return nil, and the count becomes 2.
//   - The runtime. An actual concurrent map write aborts the process with
//     `fatal error`, which is a non-zero exit before any assertion is reached.
//
// The closing trial-balance assertion is timing-free: only one leg per round can
// ever land, so the intent is one-sided no matter which goroutine won.
func TestQAConcurrentAppendToASharedJournalAdmitsExactlyOnePostingPerReplayPosition(t *testing.T) {
	const rounds, workers = 8, 64
	j := NewJournal()
	for r := 0; r < rounds; r++ {
		seq := int64(r + 1)
		e := qaPost(seq, "qa-conc-shared", AccountAvailableBalance, "1", "")

		// A start barrier, so all 64 calls contend inside the same window instead
		// of draining through the scheduler one at a time.
		var ready, done sync.WaitGroup
		start := make(chan struct{})
		errs := make([]error, workers)
		ready.Add(workers)
		done.Add(workers)
		for i := 0; i < workers; i++ {
			go func(i int) {
				defer done.Done()
				ready.Done()
				<-start
				errs[i] = j.Append(e)
			}(i)
		}
		ready.Wait()
		close(start)
		done.Wait()

		accepted := 0
		for _, err := range errs {
			switch {
			case err == nil:
				accepted++
			case errors.Is(err, ErrDuplicateSeq):
				// The expected answer for every loser. apply() checks the duplicate
				// before the ordering rule, so a loser cannot surface as
				// ErrOutOfOrder here.
			default:
				t.Errorf("round %d: concurrent append returned %v, want nil or ErrDuplicateSeq", r, err)
			}
		}
		if accepted != 1 {
			t.Errorf("round %d: %d of %d concurrent appends of ledger_seq %d were accepted, want exactly 1; "+
				"the duplicate check and the fold are not one atomic step (ledger.go)", r, accepted, workers, seq)
		}
	}
	t.Logf("evidence: %d rounds x %d goroutines contending on one replay position each; every round admitted exactly one posting", rounds, workers)

	if _, err := j.Close(); !errors.Is(err, ErrNotBalanced) {
		t.Errorf("Close on a journal of single-sided legs: %v, want ErrNotBalanced", err)
	}
}

// A Report is a SNAPSHOT, not a window onto live state.
//
// Close used to hand out the checker's own *big.Rat pointers, so a journal that
// kept being appended to rewrote a report the caller already held: the number
// changed with no error, no crash and no race report. The mutex added for
// concurrent append does not cover this - mutual exclusion inside the critical
// section says nothing about who owns the value handed out of it.
//
// The second Close is what makes the first one checkable: both come from the
// same journal, and the first must be unaffected by what happened between them.
func TestQAReportIsASnapshotNotAViewOfLiveState(t *testing.T) {
	j := NewJournal()
	for _, e := range []Entry{
		qaPost(1, "qa-snapshot", AccountAvailableBalance, "100", ""),
		qaPost(2, "qa-snapshot", AccountSettlementClearing, "", "100"),
	} {
		if err := j.Append(e); err != nil {
			t.Fatalf("append seq %d: %v", e.Seq, err)
		}
	}
	first, err := j.Close()
	if err != nil {
		t.Fatalf("first Close: %v", err)
	}
	qaWant(t, "first Total", first.Total, "100")

	// A second, independently balanced pair on the SAME intent: legal, and it
	// moves every total the first report carries.
	for _, e := range []Entry{
		qaPost(3, "qa-snapshot", AccountAvailableBalance, "100", ""),
		qaPost(4, "qa-snapshot", AccountAvailableBalance, "", "100"),
	} {
		if err := j.Append(e); err != nil {
			t.Fatalf("append seq %d: %v", e.Seq, err)
		}
	}
	second, err := j.Close()
	if err != nil {
		t.Fatalf("second Close: %v", err)
	}
	qaWant(t, "second Total", second.Total, "200")
	if second.Intents[0].Entries != 4 {
		t.Errorf("second report Entries = %d, want 4", second.Intents[0].Entries)
	}

	// The first report must still describe the journal as it was when it was
	// taken. These are the assertions the shared-pointer version fails.
	qaWant(t, "first Total after later appends", first.Total, "100")
	qaWant(t, "first DebitTotal after later appends", first.Intents[0].DebitTotal, "100")
	qaWant(t, "first CreditTotal after later appends", first.Intents[0].CreditTotal, "100")
	if first.Intents[0].Entries != 2 {
		t.Errorf("first report Entries = %d, want 2 (a later append changed a finished report)", first.Intents[0].Entries)
	}
	for _, ab := range first.Intents[0].Accounts {
		want := map[AccountType]string{
			AccountAvailableBalance:   "100",
			AccountSettlementClearing: "-100",
		}[ab.Account]
		if got := formatAmount(ab.Balance); got != want {
			t.Errorf("first report account %s = %s, want %s (a later append changed a finished report)", ab.Account, got, want)
		}
	}
	t.Logf("evidence: first report total=100 entries=2; after a further balanced pair: first.total=%s (unchanged), second.total=%s entries=%d",
		formatAmount(first.Total), formatAmount(second.Total), second.Intents[0].Entries)
}

// The contract the package actually documents is "postings arrive in replay
// order". This is that contract under -race: sixty-four independent producers,
// sixty-four INDEPENDENT journals, one shared factory. Anything the package
// shares between them (the amount parser, the account chart, the decimal
// regexp) is exercised concurrently here, and a race in any of it is a real
// defect rather than a misuse of Journal.
func TestQAIndependentJournalsAreRaceClean(t *testing.T) {
	const workers = 64
	reports := make([]*Report, workers)
	errs := make([]error, workers)
	var wg sync.WaitGroup
	for w := 0; w < workers; w++ {
		wg.Add(1)
		go func(w int) {
			defer wg.Done()
			j := NewJournal()
			intent := fmt.Sprintf("qa-ind-%02d", w)
			for i := 0; i < 4; i++ {
				base := int64(4*i + 1)
				if err := j.Append(qaPost(base, intent, AccountAvailableBalance, "1", "")); err != nil {
					errs[w] = err
					return
				}
				if err := j.Append(qaPost(base+1, intent, AccountSettlementClearing, "", "1")); err != nil {
					errs[w] = err
					return
				}
				if _, err := ParseAmount("0.1"); err != nil {
					errs[w] = err
					return
				}
				_ = AccountType("FEE_REVENUE").Valid()
			}
			reports[w], errs[w] = j.Close()
		}(w)
	}
	wg.Wait()

	// NOTE: the slices are written by distinct goroutines, but read only after
	// wg.Wait(), which is a happens-before edge.
	for w := 0; w < workers; w++ {
		if errs[w] != nil {
			t.Fatalf("worker %d: %v", w, errs[w])
		}
		if reports[w] == nil || reports[w].Intents[0].Entries != 8 {
			t.Fatalf("worker %d: report = %+v, want 8 postings", w, reports[w])
		}
	}
	t.Logf("evidence: %d independent journals, 8 postings each, closed clean under -race", workers)
}

// Concurrent reads of a finished journal. Close is documented as a read, so it
// must be safe to call repeatedly and concurrently - and on a balanced voucher
// it must agree with itself every time.
func TestQAJournalCloseIsConcurrencySafe(t *testing.T) {
	j := NewJournal()
	for i := 0; i < 10; i++ {
		if err := j.Append(qaPost(int64(2*i+1), "qa-read", AccountAvailableBalance, "1", "")); err != nil {
			t.Fatalf("append %d: %v", i, err)
		}
		if err := j.Append(qaPost(int64(2*i+2), "qa-read", AccountSettlementClearing, "", "1")); err != nil {
			t.Fatalf("append %d: %v", i, err)
		}
	}
	var wg sync.WaitGroup
	var bad int64
	for i := 0; i < 16; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			rep, err := j.Close()
			if err != nil || rep == nil || rep.Intents[0].Entries != 20 || rep.Total.Cmp(big.NewRat(10, 1)) != 0 {
				atomic.AddInt64(&bad, 1)
			}
		}()
	}
	wg.Wait()
	if bad != 0 {
		t.Errorf("%d of 16 concurrent Close calls disagreed on a finished journal", bad)
	}

	// Control: the same read-only path on an unbalanced journal must refuse
	// every time, so the assertion above is not passing because Close is a no-op.
	u := NewJournal()
	if err := u.Append(qaPost(1, "qa-unbal", AccountAvailableBalance, "1", "")); err != nil {
		t.Fatalf("append: %v", err)
	}
	var nils int64
	for i := 0; i < 8; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			if _, err := u.Close(); err == nil {
				atomic.AddInt64(&nils, 1)
			}
		}()
	}
	wg.Wait()
	if nils != 0 {
		t.Errorf("%d of 8 concurrent Close calls accepted an unbalanced journal", nils)
	}
}
