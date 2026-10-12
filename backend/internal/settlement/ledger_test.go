package settlement

import (
	"errors"
	"fmt"
	"strings"
	"testing"
)

// build returns postings numbered from seq, all belonging to one intent. The
// debit/credit pairs are given as (account, debit, credit) triples.
func build(intent string, seq int64, legs ...[3]string) []Entry {
	out := make([]Entry, 0, len(legs))
	for i, l := range legs {
		out = append(out, Entry{
			Seq:         seq + int64(i),
			IntentID:    intent,
			UserAddress: "0x0000000000000000000000000000000000000001",
			Account:     AccountType(l[0]),
			Debit:       l[1],
			Credit:      l[2],
		})
	}
	return out
}

func leg(account AccountType, debit, credit string) [3]string {
	return [3]string{string(account), debit, credit}
}

// assertAccountsNetToZero restates the trial balance in balance form: the
// per-account balances of one intent must sum to zero. Individual accounts are
// explicitly NOT required to be zero - the clearing counter-account stands at
// -amount after a transfer, by construction.
func assertAccountsNetToZero(t *testing.T, in IntentReport) {
	t.Helper()
	sum := zero()
	for _, ab := range in.Accounts {
		sum.Add(sum, ab.Balance)
	}
	if sum.Sign() != 0 {
		parts := make([]string, 0, len(in.Accounts))
		for _, ab := range in.Accounts {
			parts = append(parts, fmt.Sprintf("%s=%s", ab.Account, formatAmount(ab.Balance)))
		}
		t.Errorf("intent %s: account balances sum to %s, want 0 (%s)",
			in.IntentID, formatAmount(sum), strings.Join(parts, " "))
	}
}

// A two-leg transfer: the shape every write path in this repository produces.
func transferVoucher(intent string, seq int64) []Entry {
	return build(intent, seq,
		leg(AccountAvailableBalance, "100", ""),
		leg(AccountSettlementClearing, "", "100"),
	)
}

// ==================== POSITIVE ====================

func TestCheckEntriesBalancedTransfer(t *testing.T) {
	rep, err := CheckEntries(transferVoucher("intent-1", 1))
	if err != nil {
		t.Fatalf("balanced transfer rejected: %v", err)
	}
	if len(rep.Intents) != 1 || rep.Intents[0].Entries != 2 {
		t.Fatalf("unexpected report shape: %+v", rep.Intents)
	}
	in := rep.Intents[0]
	if in.DebitTotal.Cmp(in.CreditTotal) != 0 {
		t.Errorf("totals differ: %s vs %s", formatAmount(in.DebitTotal), formatAmount(in.CreditTotal))
	}
	if got := formatAmount(rep.Total); got != "100" {
		t.Errorf("total volume = %s, want 100", got)
	}
	// Counter-account standing, asserted explicitly: AVAILABLE_BALANCE is up by
	// the transfer and SETTLEMENT_CLEARING is down by it. Requiring every
	// account to be zero here would fail a correct journal.
	if len(in.Accounts) != 2 {
		t.Fatalf("accounts = %d, want 2", len(in.Accounts))
	}
	want := map[AccountType]string{
		AccountAvailableBalance:   "100",
		AccountSettlementClearing: "-100",
	}
	for _, ab := range in.Accounts {
		if got := formatAmount(ab.Balance); got != want[ab.Account] {
			t.Errorf("account %s = %s, want %s", ab.Account, got, want[ab.Account])
		}
	}
	assertAccountsNetToZero(t, in)
	t.Logf("evidence:\n%s", rep.Summary())
}

// A three-leg voucher. This is the case that rules out a per-posting prefix
// criterion: after leg 2 the running total is -98, and it only returns to zero
// after leg 3.
func TestCheckEntriesThreeLegVoucher(t *testing.T) {
	entries := build("intent-3leg", 1,
		leg(AccountFrozenEscrow, "98", ""),
		leg(AccountFeeRevenue, "2", ""),
		leg(AccountSettlementClearing, "", "100"),
	)
	rep, err := CheckEntries(entries)
	if err != nil {
		t.Fatalf("three-leg voucher rejected: %v", err)
	}
	if got := formatAmount(rep.Total); got != "100" {
		t.Errorf("total = %s, want 100", got)
	}
	assertAccountsNetToZero(t, rep.Intents[0])
	t.Logf("evidence:\n%s", rep.Summary())
}

// Reserve and settle are two vouchers over one intent; the escrow account is
// deliberately non-zero in the middle of the intent's life.
func TestCheckEntriesReserveThenSettle(t *testing.T) {
	entries := build("intent-lifecycle", 1,
		leg(AccountAvailableBalance, "100", ""),
		leg(AccountFrozenEscrow, "", "100"),
		leg(AccountFrozenEscrow, "100", ""),
		leg(AccountSettlementClearing, "", "100"),
	)
	rep, err := CheckEntries(entries)
	if err != nil {
		t.Fatalf("lifecycle postings rejected: %v", err)
	}
	in := rep.Intents[0]
	if in.Entries != 4 {
		t.Errorf("entries = %d, want 4", in.Entries)
	}
	// FROZEN_ESCROW appears twice: the second posting is not "a duplicate", it
	// is the spend of the reserved amount.
	if len(in.Accounts) != 3 {
		t.Fatalf("accounts = %d, want 3", len(in.Accounts))
	}
	// The lifecycle ends with the escrow spent and the transfer standing on the
	// clearing counter-account.
	want := map[AccountType]string{
		AccountAvailableBalance:   "100",
		AccountFrozenEscrow:       "0",
		AccountSettlementClearing: "-100",
	}
	for _, ab := range in.Accounts {
		if got := formatAmount(ab.Balance); got != want[ab.Account] {
			t.Errorf("account %s = %s, want %s", ab.Account, got, want[ab.Account])
		}
	}
	assertAccountsNetToZero(t, in)
}

// 0.1 + 0.2 == 0.3 only under exact arithmetic. Under float64 this voucher
// would report a residue of 5.55e-17 and a naive equality test would fail the
// ledger for being correct (GAP-20 is the same failure on-chain).
func TestCheckEntriesExactDecimalArithmetic(t *testing.T) {
	entries := build("intent-precision", 1,
		leg(AccountAvailableBalance, "0.1", ""),
		leg(AccountFeeRevenue, "0.2", ""),
		leg(AccountSettlementClearing, "", "0.3"),
	)
	if _, err := CheckEntries(entries); err != nil {
		t.Fatalf("exact decimal voucher rejected: %v", err)
	}
}

// Input order must not matter: replay follows ledger_seq, not slice order.
func TestCheckEntriesSortsBySeq(t *testing.T) {
	entries := transferVoucher("intent-sorted", 1)
	entries[0], entries[1] = entries[1], entries[0]
	rep, err := CheckEntries(entries)
	if err != nil {
		t.Fatalf("reordered input rejected: %v", err)
	}
	if rep.Intents[0].Entries != 2 {
		t.Errorf("entries = %d", rep.Intents[0].Entries)
	}
}

// balance_after is derived by migration 005; when a caller does assert it, the
// replayed value must match.
func TestCheckEntriesAcceptsCorrectBalanceAfter(t *testing.T) {
	entries := build("intent-bal", 1,
		leg(AccountAvailableBalance, "100", ""),
		leg(AccountSettlementClearing, "", "100"),
	)
	entries[0].BalanceAfter = "100"
	entries[1].BalanceAfter = "-100"
	if _, err := CheckEntries(entries); err != nil {
		t.Fatalf("correct balance_after rejected: %v", err)
	}
}

// The 36-digit envelope of NUMERIC(36, 18) must be usable, not rejected by an
// over-eager parser.
func TestCheckEntriesAcceptsColumnEnvelope(t *testing.T) {
	big18 := "999999999999999999" + "." + strings.Repeat("9", MaxScale) // 18+18 digits
	entries := build("intent-wide", 1,
		leg(AccountAvailableBalance, big18, ""),
		leg(AccountSettlementClearing, "", big18),
	)
	if _, err := CheckEntries(entries); err != nil {
		t.Fatalf("column-envelope amount rejected: %v", err)
	}
}

// A journal is legitimately unbalanced while it is being written, so Append
// takes the postings and Close is what refuses the unfinished voucher.
func TestJournalIntermediateStateIsUnbalancedButAppendable(t *testing.T) {
	j := NewJournal()
	entries := transferVoucher("intent-journal", 1)

	if err := j.Append(entries[0]); err != nil {
		t.Fatalf("first leg refused: %v", err)
	}
	if _, err := j.Close(); !errors.Is(err, ErrNotBalanced) {
		t.Fatalf("Close on a half-written voucher: %v, want ErrNotBalanced", err)
	}
	if err := j.Append(entries[1]); err != nil {
		t.Fatalf("second leg refused: %v", err)
	}
	rep, err := j.Close()
	if err != nil {
		t.Fatalf("Close on a finished voucher: %v", err)
	}
	if rep.Intents[0].Entries != 2 {
		t.Errorf("entries = %d, want 2", rep.Intents[0].Entries)
	}
}

// ==================== NEGATIVE (falsification) ====================

// N1: drop the credit leg. This is the "one-sided journal" the whole mechanism
// exists to catch.
func TestUnbalancedOneSidedIntentIsRejected(t *testing.T) {
	entries := build("intent-dropped-leg", 1,
		leg(AccountAvailableBalance, "100", ""),
	)
	_, err := CheckEntries(entries)
	if !errors.Is(err, ErrNotBalanced) {
		t.Fatalf("one-sided intent accepted: err = %v, want ErrNotBalanced", err)
	}
	if !strings.Contains(err.Error(), "intent-dropped-leg") {
		t.Errorf("error does not name the intent: %v", err)
	}
	t.Logf("evidence: %v", err)
}

// N2: a tampered / drifted stored balance. Without this check the column could
// say anything.
func TestTamperedBalanceAfterIsRejected(t *testing.T) {
	entries := transferVoucher("intent-tampered", 1)
	entries[0].BalanceAfter = "99" // replay says 100
	_, err := CheckEntries(entries)
	if !errors.Is(err, ErrBalanceAfterMismatch) {
		t.Fatalf("tampered balance_after accepted: err = %v, want ErrBalanceAfterMismatch", err)
	}
	t.Logf("evidence: %v", err)
}

// N3: two postings crammed into one row. The migration has the same CHECK, so
// the two gates agree.
func TestBothColumnsFilledIsRejected(t *testing.T) {
	entries := build("intent-double", 1,
		leg(AccountAvailableBalance, "100", "100"),
		leg(AccountSettlementClearing, "", "100"),
	)
	_, err := CheckEntries(entries)
	if !errors.Is(err, ErrSingleSided) {
		t.Fatalf("both-columns row accepted: err = %v, want ErrSingleSided", err)
	}
}

// N4: a row that moves nothing is not a posting.
func TestZeroPostingIsRejected(t *testing.T) {
	entries := build("intent-zero", 1,
		leg(AccountAvailableBalance, "0", ""),
		leg(AccountSettlementClearing, "", "0"),
	)
	if _, err := CheckEntries(entries); !errors.Is(err, ErrSingleSided) {
		t.Fatalf("zero posting accepted: err = %v, want ErrSingleSided", err)
	}
}

// N5: the empty denominator. Reporting "balanced" for an empty set is the
// failure documented in docs/changes/007 (an empty denominator was printed as
// 100%).
func TestEmptyJournalIsNotBalanced(t *testing.T) {
	if _, err := CheckEntries(nil); !errors.Is(err, ErrEmptyJournal) {
		t.Fatalf("empty journal accepted: err = %v, want ErrEmptyJournal", err)
	}
	if _, err := NewJournal().Close(); !errors.Is(err, ErrEmptyJournal) {
		t.Fatalf("empty journal Close accepted: err = %v, want ErrEmptyJournal", err)
	}
}

// N6: an imbalance the size of the last decimal place. A tolerance-based check
// would wave this through.
func TestSubCentImbalanceIsRejected(t *testing.T) {
	entries := build("intent-dust", 1,
		leg(AccountAvailableBalance, "100", ""),
		leg(AccountSettlementClearing, "", "100.000000000000000001"),
	)
	_, err := CheckEntries(entries)
	if !errors.Is(err, ErrNotBalanced) {
		t.Fatalf("1e-18 imbalance accepted: err = %v, want ErrNotBalanced", err)
	}
	t.Logf("evidence: %v", err)
}

// N7: direction is the column, not the sign.
func TestNegativeAmountIsRejected(t *testing.T) {
	entries := build("intent-negative", 1,
		leg(AccountAvailableBalance, "-100", ""),
		leg(AccountSettlementClearing, "", "-100"),
	)
	if _, err := CheckEntries(entries); !errors.Is(err, ErrNegativeAmount) {
		t.Fatalf("negative amount accepted: err = %v, want ErrNegativeAmount", err)
	}
}

// N8: the chart of accounts is closed; the migration enforces it with a
// foreign key.
func TestUnknownAccountIsRejected(t *testing.T) {
	entries := build("intent-unknown", 1,
		leg("PETTY_CASH", "100", ""),
		leg(AccountSettlementClearing, "", "100"),
	)
	if _, err := CheckEntries(entries); !errors.Is(err, ErrUnknownAccount) {
		t.Fatalf("unknown account accepted: err = %v, want ErrUnknownAccount", err)
	}
}

// N9: replay order must be unambiguous - a duplicated position makes the
// result depend on sort stability.
func TestDuplicateSeqIsRejected(t *testing.T) {
	entries := transferVoucher("intent-dupseq", 1)
	entries[1].Seq = entries[0].Seq
	if _, err := CheckEntries(entries); !errors.Is(err, ErrDuplicateSeq) {
		t.Fatalf("duplicate seq accepted: err = %v, want ErrDuplicateSeq", err)
	}
}

// N10: a posting whose position was never allocated. seq 0 would otherwise
// sort ahead of every real posting and be silently treated as the opening
// balance.
func TestUnallocatedSeqIsRejected(t *testing.T) {
	entries := transferVoucher("intent-seq0", 0)
	if _, err := CheckEntries(entries); !errors.Is(err, ErrMalformedEntry) {
		t.Fatalf("seq 0 accepted: err = %v, want ErrMalformedEntry", err)
	}
}

// N11: this is the same defect class as the duplicate above, seen through the
// incremental entry point.
func TestOutOfOrderAppendIsRejected(t *testing.T) {
	j := NewJournal()
	entries := transferVoucher("intent-order", 5)
	if err := j.Append(entries[0]); err != nil {
		t.Fatalf("first append: %v", err)
	}
	low := entries[1]
	low.Seq = 4
	if err := j.Append(low); !errors.Is(err, ErrOutOfOrder) {
		t.Fatalf("backwards append accepted: err = %v, want ErrOutOfOrder", err)
	}
	// The rejected posting must not have been folded in.
	if err := j.Append(entries[1]); err != nil {
		t.Fatalf("journal corrupted by the rejected append: %v", err)
	}
	if rep, err := j.Close(); err != nil || rep.Intents[0].Entries != 2 {
		t.Fatalf("after recovery: rep=%v err=%v", rep, err)
	}
}

// N12: amount literals that are not plain decimals. A ledger that accepts
// "1e3" or silently rounds 19 decimal places is a ledger that drifts.
func TestMalformedAmountsAreRejected(t *testing.T) {
	cases := []string{
		"1e3",
		"0x10",
		"1/3",
		"1,000",
		"-",
		"NaN",
		"Inf",
		"0.0000000000000000001", // 19 decimals, past NUMERIC(36, 18)
		"10000000000000000000",  // 20 integer digits, past 36-18
		"1.2.3",
		" 1 000 ",
	}
	for _, c := range cases {
		if _, err := ParseAmount(c); !errors.Is(err, ErrBadAmount) {
			t.Errorf("ParseAmount(%q): err = %v, want ErrBadAmount", c, err)
		}
	}
	// The empty string is the documented spelling of "this column is zero".
	if r, err := ParseAmount(""); err != nil || r.Sign() != 0 {
		t.Errorf(`ParseAmount("") = %v, %v; want 0, nil`, r, err)
	}
}

// N13: the criterion is per intent, not a global net. Two intents that are
// each unbalanced in opposite directions cancel out in a total, so a
// net-total check would pass while each intent is wrong.
func TestOppositeImbalancesDoNotCancelAcrossIntents(t *testing.T) {
	entries := append(
		build("intent-short", 1, leg(AccountAvailableBalance, "100", "")),
		build("intent-long", 2, leg(AccountAvailableBalance, "", "100"))...,
	)
	rep, err := CheckEntries(entries)
	if err == nil {
		t.Fatalf("per-intent imbalance netted out and passed: %+v", rep.Intents)
	}
	if !errors.Is(err, ErrNotBalanced) {
		t.Fatalf("err = %v, want ErrNotBalanced", err)
	}
	// Sanity: the two totals really do cancel, which is why the global net is
	// not a sufficient criterion.
	if !strings.Contains(err.Error(), "intent-short") {
		t.Errorf("error hides the failing intent: %v", err)
	}
	t.Logf("evidence: %v", err)
}

// A rejected posting must leave the journal exactly as it was.
func TestJournalRollsBackRejectedPosting(t *testing.T) {
	j := NewJournal()
	entries := transferVoucher("intent-rollback", 1)
	if err := j.Append(entries[0]); err != nil {
		t.Fatalf("first append: %v", err)
	}
	bad := entries[1]
	bad.Credit = "-100"
	if err := j.Append(bad); !errors.Is(err, ErrNegativeAmount) {
		t.Fatalf("bad append: err = %v, want ErrNegativeAmount", err)
	}
	if err := j.Append(entries[1]); err != nil {
		t.Fatalf("append after rejection: %v", err)
	}
	rep, err := j.Close()
	if err != nil {
		t.Fatalf("Close: %v", err)
	}
	if rep.Intents[0].Entries != 2 {
		t.Errorf("entries = %d, want 2 (the rejected posting was folded in)", rep.Intents[0].Entries)
	}
}

// ==================== BENCHMARKS ====================

func BenchmarkCheckEntries1000(b *testing.B) {
	entries := make([]Entry, 0, 1000)
	for i := 0; i < 500; i++ {
		entries = append(entries, build(fmt.Sprintf("intent-%d", i), int64(2*i+1),
			leg(AccountAvailableBalance, "100", ""),
			leg(AccountSettlementClearing, "", "100"),
		)...)
	}
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		if _, err := CheckEntries(entries); err != nil {
			b.Fatalf("check failed: %v", err)
		}
	}
}
