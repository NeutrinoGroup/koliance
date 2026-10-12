package main

import (
	"bytes"
	"math"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// The gate is measured by itself (it is in the rules table), so these are not
// decoration: an unexercised gate is a gate whose verdict nobody has ever seen
// fail. Every branch below that could fail silently has a negative case
// pointing at it.

const goodProfile = `mode: atomic
github.com/koliance/backend/internal/example/a.go:10.1,12.2 4 1
github.com/koliance/backend/internal/example/b.go:20.1,22.2 6 0
github.com/koliance/backend/internal/other/c.go:5.1,6.2 10 3
`

// packageStatements is the per-package statement count, read from the profile on
// 2026-10-12 and kept here rather than in the rule table so that a change in
// package size surfaces as a test failure instead of silently weakening a floor.
var packageStatements = map[string]int64{
	"internal/settlement":        114,
	"internal/verifier":          3,
	"internal/perp/position":     101,
	"internal/perp/nonce":        20,
	"internal/config":            23,
	"internal/market":            247,
	"internal/httpapi":           604,
	"internal/agentcard":         176,
	"internal/agentapi":          179,
	"internal/oracle":            95,
	"internal/platform/database": 55,
	"internal/game":              207,
	"internal/chain":             129,
	"internal/liquidator":        326,
	"scripts/coverage-gate":      156,
}

func TestParseProfileAggregatesByPackage(t *testing.T) {
	pkgs, err := parseProfile(strings.NewReader(goodProfile))
	if err != nil {
		t.Fatalf("parseProfile: %v", err)
	}
	if len(pkgs) != 2 {
		t.Fatalf("got %d packages, want 2: %v", len(pkgs), pkgs)
	}

	ex := pkgs["github.com/koliance/backend/internal/example"]
	if ex.hit != 4 || ex.total != 10 {
		t.Errorf("example = %d/%d, want 4/10", ex.hit, ex.total)
	}
	other := pkgs["github.com/koliance/backend/internal/other"]
	if other.hit != 10 || other.total != 10 {
		t.Errorf("other = %d/%d, want 10/10", other.hit, other.total)
	}
}

// A block location may contain spaces; the two counts never do. A parser that
// splits left-to-right reads the location as a number on single-space lines and
// reports a confident wrong answer. This pins the right-to-left split, and the
// assertion is on the exact counts so the failure is not "roughly off".
func TestParseProfileSplitsCountsFromTheRight(t *testing.T) {
	const p = `mode: atomic
github.com/koliance/backend/internal/odd/a file with spaces.go:1.1,2.2 7 1
`
	pkgs, err := parseProfile(strings.NewReader(p))
	if err != nil {
		t.Fatalf("parseProfile: %v", err)
	}
	got := pkgs["github.com/koliance/backend/internal/odd"]
	if got.total != 7 {
		t.Fatalf("total = %d, want 7 (the location was read as the count?)", got.total)
	}
	if got.hit != 7 {
		t.Errorf("hit = %d, want 7", got.hit)
	}
}

func TestParseProfileRejectsMalformedInput(t *testing.T) {
	cases := map[string]string{
		"no count field":     "mode: atomic\ngithub.com/x/y/z.go:1.1,2.2 3\n",
		"count not numeric":  "mode: atomic\ngithub.com/x/y/z.go:1.1,2.2 3 x\n",
		"no statement field": "mode: atomic\ngithub.com/x/y/z.go:1.1,2.2\n",
		"statements not numeric": "mode: atomic\n" +
			"github.com/x/y/z.go:1.1,2.2 x 1\n",
		"no file:line separator": "mode: atomic\ngithub.com/x/y/z.go 3 1\n",
	}
	for name, p := range cases {
		t.Run(name, func(t *testing.T) {
			if _, err := parseProfile(strings.NewReader(p)); err == nil {
				t.Fatalf("parseProfile accepted malformed input:\n%s", p)
			}
		})
	}
}

// The empty-denominator case is the one this repo already got wrong once (a
// script printed "branches 100.00%" on a report with no branch records). The
// assertion is deliberately two-sided: the value must be zero AND the ok flag
// false. Testing only the number would pass for an implementation that returned
// 100 on the ok path.
func TestPctEmptyDenominatorIsNotOneHundred(t *testing.T) {
	p, ok := pct(stat{hit: 0, total: 0})
	if ok {
		t.Errorf("empty denominator scored as measurable")
	}
	if p != 0 {
		t.Errorf("empty denominator returned %v, want 0", p)
	}
	if p == 100 {
		t.Errorf("empty denominator reported 100%% — the false green this gate exists to avoid")
	}

	// And the ordinary path still works, so the guard is not vacuous.
	if p, ok := pct(stat{hit: 1, total: 4}); !ok || p != 25 {
		t.Errorf("pct(1/4) = %v, %v; want 25, true", p, ok)
	}
}

// A rule that matches nothing means the gate is measuring a package that no
// longer exists — renamed, moved, or the profile format changed under it. It
// must fail rather than quietly pass with a shorter table.
func TestVerdictFailsWhenARuleMatchesNothing(t *testing.T) {
	a := analysis{
		gated:     []pkgResult{{rule: rule{pkg: "internal/here"}, pkg: "m/internal/here", stat: stat{hit: 9, total: 10}}},
		allGated:  stat{hit: 9, total: 10},
		unmatched: []rule{{pkg: "internal/gone", floor: 50}},
	}
	err := verdict(a)
	if err == nil {
		t.Fatal("a rule that matched no package still passed")
	}
	if !strings.Contains(err.Error(), "internal/gone") {
		t.Errorf("the error does not name the dead rule: %v", err)
	}
}

// A gated package with zero statements is not a pass either: it means the rule
// pointed at something that carries no measurable code.
func TestVerdictFailsWhenAGatedPackageHasNoStatements(t *testing.T) {
	a := analysis{
		gated:    []pkgResult{{rule: rule{pkg: "internal/empty"}, pkg: "m/internal/empty", stat: stat{}}},
		allGated: stat{},
		unscored: []string{"m/internal/empty"},
	}
	if err := verdict(a); err == nil {
		t.Fatal("a gated package with zero statements still passed")
	}
}

func TestVerdictFailsBelowAPackageFloor(t *testing.T) {
	a := analysis{
		gated: []pkgResult{
			{rule: rule{pkg: "internal/low", floor: 50, measured: 60}, pkg: "m/internal/low", stat: stat{hit: 40, total: 100}},
		},
		allGated: stat{hit: 40, total: 100},
	}
	err := verdict(a)
	if err == nil {
		t.Fatal("40% cleared a 50% floor")
	}
	if !strings.Contains(err.Error(), "internal/low") {
		t.Errorf("the error does not name the package: %v", err)
	}
}

// The per-package floors exist because a total-only floor cannot see a small
// package falling to zero. This is that case stated directly: every package
// clears its own floor, the total is comfortably above totalFloor, and the
// verdict is nil.
func TestVerdictPassesWhenEverythingClears(t *testing.T) {
	a := analysis{
		gated: []pkgResult{
			{rule: rule{pkg: "internal/big", floor: 70, measured: 80}, pkg: "m/internal/big", stat: stat{hit: 800, total: 1000}},
			{rule: rule{pkg: "internal/small", floor: 70, measured: 80}, pkg: "m/internal/small", stat: stat{hit: 70, total: 100}},
		},
		allGated: stat{hit: 870, total: 1100},
	}
	if err := verdict(a); err != nil {
		t.Fatalf("everything above floor was rejected: %v", err)
	}
}

// The total floor catches what the per-package floors cannot: many packages
// each dropping a little. Here every package clears its own floor and the
// aggregate is still below totalFloor.
func TestVerdictTotalFloorCatchesManySmallDrops(t *testing.T) {
	var a analysis
	for i := 0; i < 4; i++ {
		s := stat{hit: 71, total: 100}
		a.gated = append(a.gated, pkgResult{rule: rule{pkg: "internal/p", floor: 70}, pkg: "m/internal/p", stat: s})
		a.allGated.hit += s.hit
		a.allGated.total += s.total
	}
	// 284/400 = 71%, above each 70% floor; force the aggregate below the total floor.
	a.allGated = stat{hit: 2400, total: 4000} // 60%
	err := verdict(a)
	if err == nil {
		t.Fatal("60% aggregate cleared the total floor")
	}
	if !strings.Contains(err.Error(), "TOTAL") {
		t.Errorf("the error does not name the total: %v", err)
	}
}

func TestAnalyseSortsWorstFirstAndListsExcluded(t *testing.T) {
	pkgs := map[string]stat{
		"m/" + rules[0].pkg:    {hit: 90, total: 100},
		"m/" + rules[1].pkg:    {hit: 10, total: 100},
		"m/internal/untracked": {hit: 1, total: 1},
	}
	a := analyse(pkgs)
	if len(a.gated) != 2 {
		t.Fatalf("gated %d packages, want 2", len(a.gated))
	}
	first, _ := pct(a.gated[0].stat)
	second, _ := pct(a.gated[1].stat)
	if first > second {
		t.Errorf("table is not worst-first: %v then %v", first, second)
	}
	if len(a.excluded) != 1 || a.excluded[0].pkg != "m/internal/untracked" {
		t.Errorf("excluded = %v, want the untracked package", a.excluded)
	}
	if len(a.unmatched) != len(rules)-2 {
		t.Errorf("unmatched = %d, want %d", len(a.unmatched), len(rules)-2)
	}
}

func TestReportPrintsTheFloorTable(t *testing.T) {
	pkgs := map[string]stat{}
	for _, r := range rules {
		pkgs["m/"+r.pkg] = stat{hit: 50, total: 100}
	}
	pkgs["m/internal/untracked"] = stat{hit: 0, total: 40}
	var buf bytes.Buffer
	report(&buf, analyse(pkgs), true)
	out := buf.String()
	for _, want := range []string{
		"score", "floor", "TOTAL (gated)", "all packages (NOT gated)",
		"excluded from the floor", "internal/untracked",
	} {
		if !strings.Contains(out, want) {
			t.Errorf("report is missing %q:\n%s", want, out)
		}
	}
}

func TestRunRejectsAMissingProfile(t *testing.T) {
	err := run(filepath.Join(t.TempDir(), "absent.out"), false)
	if err == nil {
		t.Fatal("a missing profile was accepted")
	}
	if !strings.Contains(err.Error(), "no coverage report") {
		t.Errorf("unhelpful error for a missing profile: %v", err)
	}
}

// An empty profile is the silent-pass shape this gate must not have: zero
// records means the test command changed shape, not that everything is covered.
func TestRunRejectsAnEmptyProfile(t *testing.T) {
	p := filepath.Join(t.TempDir(), "empty.out")
	if err := os.WriteFile(p, []byte("mode: atomic\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := run(p, false); err == nil {
		t.Fatal("a profile with no records was accepted")
	}
}

func TestRunAcceptsAProfileAboveEveryFloor(t *testing.T) {
	var b strings.Builder
	b.WriteString("mode: atomic\n")
	for _, r := range rules {
		// One fully covered block per rule floor is enough to clear it.
		b.WriteString("github.com/koliance/backend/" + r.pkg + "/x.go:1.1,2.2 1000 1\n")
	}
	p := filepath.Join(t.TempDir(), "full.out")
	if err := os.WriteFile(p, []byte(b.String()), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := run(p, false); err != nil {
		t.Fatalf("a fully covered profile was rejected: %v", err)
	}
}

func TestRunRejectsAProfileBelowTheFloor(t *testing.T) {
	var b strings.Builder
	b.WriteString("mode: atomic\n")
	for _, r := range rules {
		b.WriteString("github.com/koliance/backend/" + r.pkg + "/x.go:1.1,2.2 1000 0\n")
	}
	p := filepath.Join(t.TempDir(), "zero.out")
	if err := os.WriteFile(p, []byte(b.String()), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := run(p, false); err == nil {
		t.Fatal("a 0% profile cleared the floors")
	}
}

// The floors are calibrated against the readings recorded next to them. A floor
// set AT or ABOVE its measurement goes red on the next unrelated refactor and
// gets deleted by whoever is in a hurry — that is the failure the headroom in
// this table exists to prevent, so the invariant is enforced rather than
// trusted to a comment.
func TestFloorsSitBelowTheirMeasurement(t *testing.T) {
	for _, r := range rules {
		if r.floor >= r.measured {
			t.Errorf("%s: floor %.2f is not below the measured %.2f", r.pkg, r.floor, r.measured)
		}
		if head := r.measured - r.floor; head < 2 {
			t.Errorf("%s: headroom %.2f points is under 2 — the floor is at the measurement "+
				"and will be deleted the first time an unrelated commit moves the number", r.pkg, head)
		}
	}
}

// A floor far below its measurement is not a gate, it is a decoration: it would
// only fire on a catastrophic collapse, which is the one case a reviewer would
// notice without it. The ceiling used to be 12 points, and that ceiling was
// itself wrong — `verifier` and `perp/nonce` sit at 100%, and a percentage on a
// package of 3 statements has a granularity of 33 points, so any floor that
// permits less than one uncovered statement has to sit far below the reading.
// The bound is stated in the units the floor is written in (points) but the
// reason for slack is stated in units of statements, which is why one number
// cannot serve both. 20 is the sanity ceiling; the real invariant is
// TestHeadroomIsAtLeastOneStatement below.
func TestFloorHeadroomIsNotDecorative(t *testing.T) {
	const ceiling = 20.0
	for _, r := range rules {
		if head := r.measured - r.floor; head > ceiling {
			t.Errorf("%s: headroom %.2f points exceeds %.0f — this floor would not fire on "+
				"anything short of collapse", r.pkg, head, ceiling)
		}
	}
}

// The invariant the headroom actually exists for, expressed in the unit that
// causes the trouble: statements.
//
// A package of 3 statements (verifier) cannot express a 5-point tolerance at
// all — one statement IS 33 points — so a floor of 85 there means "all three
// covered". That is deliberate for an EIP-712 signature verifier, and it is
// ALSO the case that would make the floor get deleted if the package were big:
// a 300-statement package with the same shape would go red on any refactor.
//
// So the exception is allowed only while the package is small. The check below
// is written to fire on its own as the package grows: once a tight floor sits
// on a package with more than ten statements, this test fails and the floor has
// to be re-derived. Without that, "verifier is small" would be a claim nobody
// re-checks — the same shape as the stale self-referential statements AGENTS.md
// §8 lists.
func TestHeadroomIsAtLeastOneStatement(t *testing.T) {
	for _, r := range rules {
		total, ok := packageStatements[r.pkg]
		if !ok {
			t.Errorf("%s has no statement count in this test; add one so the headroom is checkable", r.pkg)
			continue
		}
		// math.Round, not truncation: 23 * 95.65 / 100 is 21.9995, and flooring
		// it to 21 asserts against a reading one statement below the real one.
		// The first version of this test did exactly that and failed on
		// internal/config — a false failure caused by the checker, not by the
		// floor, which is the same class of mistake as the profile-parsing bug
		// it is checking for.
		hit := int64(math.Round(float64(total) * r.measured / 100))

		// Tolerance: one covered statement may be lost and the floor still holds.
		if total <= 1 {
			continue
		}
		tolerated := float64(hit-1) / float64(total) * 100
		if tolerated >= r.floor {
			continue // this floor tolerates a statement of regression; nothing to justify
		}
		if total > 10 {
			t.Errorf("%s: floor %.2f on %d statements does not tolerate a single uncovered "+
				"statement (would be %.2f%%) — a floor that tight goes red on any unrelated "+
				"commit, which is how floors get deleted. Lower it or justify the exception here.",
				r.pkg, r.floor, total, tolerated)
		}
	}
}

// aggregateAtFloors is the gated total if every package sits exactly on its own
// floor. It is the level the per-package floors already guarantee, and therefore
// the level a meaningful totalFloor has to sit ABOVE.
func aggregateAtFloors(t *testing.T) float64 {
	t.Helper()
	var hit, total float64
	for _, r := range rules {
		n, ok := packageStatements[r.pkg]
		if !ok {
			t.Fatalf("%s has no statement count; add one so the total floor can be checked", r.pkg)
		}
		hit += r.floor / 100 * float64(n)
		total += float64(n)
	}
	return hit / total * 100
}

// A total floor below the level the per-package floors already guarantee is
// dead code: it can never be the reason a build fails, so it buys a false sense
// of a second line of defence.
//
// This is not hypothetical. The first version of the table set totalFloor to
// 67.0 while the per-package floors already implied 67.61%, and the only reason
// it was caught was a deliberate check of whether the branch could ever fire.
// Neither the report nor any other test would have shown it — the number looked
// plausible, the table printed it, and the gate stayed green. It is the same
// family as the "empty denominator scored as 100" bug this gate exists to
// prevent: a 判据 that cannot fail looks exactly like one that never needed to.
func TestTotalFloorCanStillFire(t *testing.T) {
	atFloors := aggregateAtFloors(t)
	if totalFloor <= atFloors {
		t.Errorf("totalFloor %.2f is at or below the %.2f the per-package floors already "+
			"guarantee — it can never fire. Raise it above %.2f or drop it and say why.",
			totalFloor, atFloors, atFloors)
	}
	if totalFloor >= 71.99 {
		t.Errorf("totalFloor %.2f is at or above the measured 71.99%% — it goes red on the "+
			"next unrelated refactor, which is how floors get deleted", totalFloor)
	}
	// And the bracket has to be wide enough to be usable, or the two
	// inequalities above are satisfied by a knife-edge nobody can maintain.
	if band := totalFloor - atFloors; band < 0.5 {
		t.Errorf("only %.2f points sit between the implied aggregate and the total floor; "+
			"that is too tight to survive a package growing", band)
	}
}

// Two rules matching one package would double its weight in the total; two
// rules for the same package would make one of them dead. Neither is visible
// from the table output, so both are checked.
func TestRulesAreUniqueAndNonEmpty(t *testing.T) {
	seen := map[string]bool{}
	for _, r := range rules {
		if r.pkg == "" {
			t.Error("a rule has an empty package name")
		}
		if seen[r.pkg] {
			t.Errorf("duplicate rule for %s", r.pkg)
		}
		seen[r.pkg] = true
		if r.note == "" {
			t.Errorf("%s has no note; an unexplained row reads as an oversight", r.pkg)
		}
	}
}

// A rule must match a real package and must not match a differently-named one.
// The second half is the one that bites: a prefix rule for "internal/chain"
// would also claim "internal/chainx", silently folding an unrelated package
// into a floor it was never calibrated for.
func TestRuleMatchingIsWholeSegment(t *testing.T) {
	r := rule{pkg: "internal/chain"}
	if !r.matches("github.com/koliance/backend/internal/chain") {
		t.Error("exact package did not match")
	}
	if r.matches("github.com/koliance/backend/internal/chainx") {
		t.Error("rule matched a package it does not name")
	}
	if r.matches("github.com/koliance/backend/internal/chain/bindings/extra") {
		t.Error("rule matched a subpackage it does not name")
	}
}
