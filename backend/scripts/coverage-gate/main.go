// Command coverage-gate enforces the backend's statement-coverage floors.
//
// Go ships coverage *reporting* but no coverage *threshold*: `go test -cover`
// prints a percentage per package and exits 0 no matter how low it is, so a
// regression would sail through CI. The contracts side hit the same wall with
// Hardhat and solved it with scripts/check-coverage.ts (docs/changes/007); the
// frontend solved it with vitest.config.mts thresholds (docs/changes/011).
// This is the backend's copy of that decision.
//
// Two steps, the first producing the profile the second reads:
//
//	mkdir -p coverage
//	go test -count=1 -covermode=atomic -coverprofile=coverage/coverage.out ./...
//	go run ./scripts/coverage-gate
//
// The profile goes under `coverage/` because the root .gitignore already
// ignores that directory at any depth, so it cannot be committed by accident.
// Go does NOT create the directory — hence the mkdir.
//
// Exit status is the verdict: 0 above every floor, 1 below one or when the
// report cannot be scored at all.
//
// # Scope
//
// 15 of the 23 packages are gated. The rest are excluded on purpose, and the
// exclusions are the interesting part:
//
//   - cmd/* (133 statements, 0%): `main` wiring. Testing it means running a
//     process against a database and a chain; the number would sit at 0
//     forever and drag the score down without telling anyone anything.
//     Measured, not assumed: those three packages have no test files. This is
//     registered as GAP-65, which records the sharper version of the same
//     finding — the GAP-49 startup fail-fast has no automated judgement at all,
//     and mutating it back to a silent in-memory downgrade leaves the whole
//     suite green. The right fix is to cover the observable seam (`run(cfg)`)
//     rather than the process.
//   - internal/chain/bindings (471 statements, 0%): abigen output. It is
//     generated, it is vendored by definition, and regenerating it must not
//     move a floor. Same reason the contracts gate does not measure
//     node_modules.
//   - internal/developer (61 statements, 0%): no test file exists.
//   - internal/liquidation (42 statements, 0%): a test file DOES exist
//     (store_test.go) and the package still measures 0% — that test only
//     marshals an Event struct, so none of the store's 42 statements run. It
//     is registered as GAP-72 with exactly this evidence.
//   - internal/platform/stripeclient (12 statements, 0%): no test file exists.
//   - internal/model: `[no test files]`, and the profile carries no statement
//     blocks for it at all — a pure type declaration file.
//
// Gating the whole tree instead — the 55.6% `go tool cover -func` reports —
// gives a figure dominated by 719 statements of untested code that nobody
// disputes is untested. A floor set under *that* number would be a floor under
// 0%-packages: it could never move for the right reason. That is the same trap
// the frontend record describes (70.35% measured over files some test happened
// to import, against 7.89% over the real tree); the fix there was also to pick
// a scope, not to pick a smaller number.
//
// The excluded packages are NOT declared "fine". Each is either generated, or
// registered as a gap in docs/GAP台账.md.
//
// # Line endings (read this before re-calibrating a floor)
//
// The repo has already been burned once by measuring coverage on a CRLF
// working tree: the Solidity floor was calibrated to a local 94.37% and CI
// failed its first run at the LF figure of 89.22% (docs/changes/007). So:
// measure on an LF tree, which is what CI and every Linux contributor has.
// `.gitattributes` pins `*.go` to `text eol=lf`, and `git ls-files --eol
// backend` confirms the index is LF.
//
// Go's own sensitivity to line endings is far smaller than Hardhat's, because
// the compiler tracks token positions rather than bytecode offsets. Measured
// here by rewriting the whole working tree to CRLF and re-running: the
// statement total is identical (2998 either way), and no gated package moved
// by more than one statement.
//
// A first version of this comment claimed a 53.7692% (LF) vs 53.8025% (CRLF)
// split. That pair came out of a capture bug in the throwaway harness, not out
// of the line endings: it split profile lines on runs of spaces and, for the
// single-space lines, silently read the block's location as its statement
// count. parseProfile below splits from the right for exactly this reason. The
// CRLF experiment is kept as the honest version of the claim; the pair is not.
//
// # The floors
//
// Every floor sits 3-5 points under its measurement, for the reason the
// contract side's own first CI failure wrote down: a floor set at the current
// number goes red on the next unrelated refactor and then gets deleted by
// whoever is in a hurry, while a floor a few points down still catches a real
// drop. Raising them as the numbers climb is the goal, not a side effect.
//
// Both a per-package floor and a total floor are enforced, and the reason is
// arithmetic rather than taste. The gated set is 2435 statements of which
// httpapi alone is 604. A single total-only floor would let any package below
// 604/2435 = 24.8% lose ALL of its coverage while the total still cleared
// (loss ≤ 24.8% against total headroom of 5 points). For `liquidator`, a
// 326-statement package at 43.56% — 142 statements — removing every one of its
// tests moves the total by 5.83 points, so the total floor does catch it, but
// only just, and only because 5.83 happens to exceed 5. Reduce the package to
// 200 statements and the same total collapse becomes a green build. The
// per-package floors state the rule the weight argument only approximates.
//
// The converse is the trap: a total floor set below the aggregate the
// per-package floors already imply is not a second line of defence, it is a
// line that never fires. That aggregate is 67.61% here (each package exactly on
// its floor), so the total floor has to clear it to mean anything — and it then
// catches what the per-package floors structurally cannot see: several packages
// dropping together, each still above its own floor.
//
// All numbers below were read on 2026-10-12 from an LF working tree with
// `go test -count=1 -covermode=atomic -coverprofile=... ./...`, and each was
// cross-checked against the per-package `go test -cover` reading and against
// `go tool cover -func`.
//
// # A known wobble, and why it does not threaten the floors
//
// One block is not deterministic: agentcard/visa_generator.go:104.13,106.5,
// the `if n > 9` branch inside ValidateLuhn. Over 100 consecutive runs of
// `./internal/agentcard` it executed 98 times and was recorded as 0 twice. The
// card number is random (9 digits from crypto/rand) and a Luhn doubling that
// overflows 9 depends on those digits, so the block is genuinely
// data-dependent; whether the profile then marks it is a further step this
// comment does not claim to explain.
//
// The effect on the gated score is one statement out of 2435, or 0.57 points
// on agentcard — whose floor sits 5 off. That is the entire reason the floors
// carry headroom instead of being set at the measurement. It is written down
// because a reader whose CI flutters by 0.05 points deserves to find it
// already explained rather than have to rediscover it.
package main

import (
	"bufio"
	"flag"
	"fmt"
	"io"
	"os"
	"sort"
	"strconv"
	"strings"
)

// modulePrefix is what a Go coverage profile records as the package prefix, on
// every platform. Rules name packages by their suffix below it.
const modulePrefix = "github.com/koliance/backend/"

// defaultProfile is the path the `go test` command in the package doc and in
// .github/workflows/ci.yml writes. Keeping the default identical to what CI
// produces is the point: a gate whose default path is wrong fails with "no
// coverage report" and reads as a broken gate rather than as a red one. That
// happened while building this — the default was `coverage.out` while the run
// wrote `coverage/coverage.out`.
const defaultProfile = "coverage/coverage.out"

// totalFloor applies to the gated set as a whole. Measured 71.99% when set.
//
// It is NOT free to choose. If every package sits exactly on its own floor the
// aggregate is already 67.61%, so any total floor at or below that can never be
// the deciding factor — it would be a bound that is dead on arrival. The first
// version of this table set 67, which was exactly that mistake. 69.0 sits
// 2.99 points under the measurement and 1.39 points above the aggregate the
// per-package floors already imply; TestTotalFloorCanStillFire enforces both
// inequalities so this cannot silently rot back.
const totalFloor = 69.0

// rule is one gated package: the tail of its import path and its floor.
//
// The match is on an import-path suffix, not a filesystem path. That is what
// makes this gate portable without normalisation: a profile records the same
// import path on Windows and on the Linux runner, and it never carries a drive
// letter or a backslash.
type rule struct {
	pkg      string  // e.g. "internal/settlement"
	floor    float64 // enforced minimum, percent
	measured float64 // the reading the floor was derived from
	note     string  // shown in the table, so an exclusion never looks accidental
}

var rules = []rule{
	{"internal/settlement", 90.0, 94.74, "per-position ledger, double-entry"},
	{"internal/verifier", 85.0, 100.00, "EIP-712 settlement signature verification"},
	{"internal/perp/position", 92.0, 97.03, "position table, shared with the price loop"},
	{"internal/perp/nonce", 85.0, 100.00, "nonce manager, shared with the sender"},
	{"internal/config", 90.0, 95.65, "config parsing / validation"},
	{"internal/market", 82.0, 86.64, "price feed and movers ranking"},
	{"internal/httpapi", 76.0, 80.13, "router, middleware, handlers (604 stmts)"},
	{"internal/agentcard", 70.0, 75.00, "card issuance, PAN/CVV containment"},
	{"internal/agentapi", 70.0, 73.74, "agent-facing API"},
	{"internal/oracle", 61.0, 65.26, "Pyth Hermes reader + demo feed"},
	{"internal/platform/database", 50.0, 54.55, "pgx pool, DSN redaction, degradation"},
	{"internal/game", 46.0, 50.24, "game catalog service"},
	{"internal/chain", 44.0, 48.06, "chain client / event subscription"},
	{"internal/liquidator", 40.0, 43.56, "liquidation bot loop and watermark"},
	{"scripts/coverage-gate", 85.0, 89.74, "the gate itself: a gate nobody exercises is a gate nobody trusts"},
}

// stat is an accumulated statement count.
type stat struct {
	hit   int64
	total int64
}

// add accumulates one profile block into s.
func (s *stat) add(numStmt, count int64) {
	s.total += numStmt
	if count > 0 {
		s.hit += numStmt
	}
}

// pct returns the coverage percentage and whether it could be computed.
//
// The bool is not decoration. An empty denominator scored as 100 is the exact
// false green this repo already shipped once: a coverage script printed
// "branches 100.00%" on a report that carried no branch records at all,
// because it divided by zero and defaulted upward (docs/changes/007, and the
// "coverage 口径" row in AGENTS.md §8). A gate that reports n/a and refuses to
// score is strictly better than one that invents a number.
func pct(s stat) (float64, bool) {
	if s.total == 0 {
		return 0, false
	}
	return float64(s.hit) / float64(s.total) * 100, true
}

// parseProfile reads a Go coverage profile into per-package statistics.
//
// Format, one block per line after the header:
//
//	mode: atomic
//	<import/path/file.go>:<sl>.<sc>,<el>.<ec> <numStmt> <count>
//
// The two trailing integers are split from the right. This is not fastidiousness:
// the block location is earlier on the line and may in principle contain spaces,
// but a naive left-to-right split on runs of spaces silently reads the LOCATION
// as the statement count on lines that happen to carry a single space. That bug
// was written and caught while building this file — it produced readings like
// "108/114" reported as "0/0" — and it is the same family as the empty-denominator
// bug noted on pct below: a parser that fails quietly reports a confident number.
func parseProfile(r io.Reader) (map[string]stat, error) {
	files := map[string]stat{}
	sc := bufio.NewScanner(r)
	sc.Buffer(make([]byte, 0, 1<<16), 1<<22)

	header := true
	for lineNo := 1; sc.Scan(); lineNo++ {
		line := strings.TrimSpace(sc.Text())
		if line == "" {
			continue
		}
		if header {
			header = false
			if strings.HasPrefix(line, "mode:") {
				continue
			}
		}

		countStr, rest, ok := cutLast(line)
		if !ok {
			return nil, fmt.Errorf("line %d: no count field: %q", lineNo, line)
		}
		count, err := strconv.ParseInt(countStr, 10, 64)
		if err != nil {
			return nil, fmt.Errorf("line %d: bad count %q: %w", lineNo, countStr, err)
		}
		numStr, loc, ok := cutLast(rest)
		if !ok {
			return nil, fmt.Errorf("line %d: no statement field: %q", lineNo, line)
		}
		numStmt, err := strconv.ParseInt(numStr, 10, 64)
		if err != nil {
			return nil, fmt.Errorf("line %d: bad statement count %q: %w", lineNo, numStr, err)
		}
		colon := strings.LastIndex(loc, ":")
		if colon < 0 {
			return nil, fmt.Errorf("line %d: no file:line separator: %q", lineNo, loc)
		}
		file := loc[:colon]

		f := files[file]
		f.add(numStmt, count)
		files[file] = f
	}
	if err := sc.Err(); err != nil {
		return nil, fmt.Errorf("read profile: %w", err)
	}

	pkgs := map[string]stat{}
	for file, s := range files {
		dir := file
		if slash := strings.LastIndex(file, "/"); slash >= 0 {
			dir = file[:slash]
		}
		p := pkgs[dir]
		p.hit += s.hit
		p.total += s.total
		pkgs[dir] = p
	}
	return pkgs, nil
}

// cutLast splits s at its final space, returning (tail, head, ok).
func cutLast(s string) (string, string, bool) {
	i := strings.LastIndex(s, " ")
	if i < 0 {
		return "", "", false
	}
	return s[i+1:], strings.TrimSpace(s[:i]), true
}

// pkgResult is one gated package after aggregation.
type pkgResult struct {
	rule rule
	pkg  string
	stat stat
}

// analysis is everything the report and the verdict need.
type analysis struct {
	gated     []pkgResult // sorted worst-first
	allGated  stat
	allTree   stat
	excluded  []pkgResult // matched by no rule; printed for context
	unmatched []rule      // rules that matched no package: a broken gate, not a pass
	unscored  []string    // gated packages carrying zero statements
}

// matches reports whether pkg is the package named by the rule.
func (r rule) matches(pkg string) bool {
	return strings.HasSuffix(pkg, "/"+r.pkg)
}

func analyse(pkgs map[string]stat) analysis {
	var a analysis

	for _, r := range rules {
		found := false
		for pkg, s := range pkgs {
			if !r.matches(pkg) {
				continue
			}
			found = true
			a.gated = append(a.gated, pkgResult{rule: r, pkg: pkg, stat: s})
			a.allGated.hit += s.hit
			a.allGated.total += s.total
			if s.total == 0 {
				a.unscored = append(a.unscored, pkg)
			}
		}
		if !found {
			a.unmatched = append(a.unmatched, r)
		}
	}
	sort.Slice(a.gated, func(i, j int) bool {
		pi, _ := pct(a.gated[i].stat)
		pj, _ := pct(a.gated[j].stat)
		if pi != pj {
			return pi < pj
		}
		return a.gated[i].pkg < a.gated[j].pkg
	})
	sort.Strings(a.unscored)

	for pkg, s := range pkgs {
		a.allTree.hit += s.hit
		a.allTree.total += s.total
		gated := false
		for _, r := range rules {
			if r.matches(pkg) {
				gated = true
				break
			}
		}
		if !gated {
			a.excluded = append(a.excluded, pkgResult{pkg: pkg, stat: s})
		}
	}
	sort.Slice(a.excluded, func(i, j int) bool { return a.excluded[i].pkg < a.excluded[j].pkg })

	return a
}

func report(w io.Writer, a analysis, verbose bool) {
	fmt.Fprintln(w, "\nBackend coverage (statements)")
	fmt.Fprintln(w, strings.Repeat("─", 88))
	fmt.Fprintf(w, "  %-6s %-7s %-13s %-30s %s\n", "score", "floor", "statements", "package", "")
	fmt.Fprintln(w, strings.Repeat("─", 88))

	for _, g := range a.gated {
		p, ok := pct(g.stat)
		score, mark := fmt.Sprintf("%6.2f", p), " "
		if !ok {
			score, mark = "   n/a", "!"
		} else if p < g.rule.floor {
			mark = "!"
		}
		fmt.Fprintf(w, "%s %s %6.2f  %5d/%-6d %-30s %s\n",
			mark, score, g.rule.floor, g.stat.hit, g.stat.total, short(g.pkg), g.rule.note)
	}

	fmt.Fprintln(w, strings.Repeat("─", 88))
	tp, ok := pct(a.allGated)
	score := "   n/a"
	if ok {
		score = fmt.Sprintf("%6.2f", tp)
	}
	fmt.Fprintf(w, "  %s %6.2f  %5d/%-6d %-30s %s\n",
		score, totalFloor, a.allGated.hit, a.allGated.total, "TOTAL (gated)",
		"excludes generated + untested-by-design")
	ap, _ := pct(a.allTree)
	fmt.Fprintf(w, "  %6.2f %6s  %5d/%-6d %-30s %s\n",
		ap, "-", a.allTree.hit, a.allTree.total, "all packages (NOT gated)",
		"context only — see the scope comment")

	if verbose && len(a.excluded) > 0 {
		fmt.Fprintf(w, "\n  excluded from the floor (%d packages, %d statements):\n",
			len(a.excluded), a.allTree.total-a.allGated.total)
		for _, e := range a.excluded {
			p, ok := pct(e.stat)
			if !ok {
				fmt.Fprintf(w, "    %-30s %s\n", short(e.pkg), "no statement blocks in the profile")
				continue
			}
			fmt.Fprintf(w, "    %-30s %6.2f%%  %4d/%d\n", short(e.pkg), p, e.stat.hit, e.stat.total)
		}
	}
}

// verdict turns the analysis into an error, or nil when everything clears.
func verdict(a analysis) error {
	var problems []string

	// A rule that matches nothing is the failure mode this whole script exists
	// to avoid: the gate would keep reporting a pass while measuring a package
	// that is no longer there (renamed, moved, or the profile format changed
	// under it). Fail loudly instead.
	for _, r := range a.unmatched {
		problems = append(problems,
			fmt.Sprintf("rule %q matched no package — renamed, moved, or the profile format changed", r.pkg))
	}
	for _, pkg := range a.unscored {
		problems = append(problems,
			fmt.Sprintf("%s is gated but has zero statements — nothing is being measured", short(pkg)))
	}

	for _, g := range a.gated {
		p, ok := pct(g.stat)
		if !ok {
			continue // already reported by unscored
		}
		if p < g.rule.floor {
			problems = append(problems, fmt.Sprintf(
				"%-30s %6.2f%% < %5.2f%%  (measured %.2f%% when the floor was set)",
				short(g.pkg), p, g.rule.floor, g.rule.measured))
		}
	}
	if p, ok := pct(a.allGated); !ok {
		problems = append(problems, "the gated set carries zero statements")
	} else if p < totalFloor {
		problems = append(problems,
			fmt.Sprintf("%-30s %6.2f%% < %5.2f%%", "TOTAL (gated)", p, totalFloor))
	}

	if len(problems) == 0 {
		return nil
	}
	return fmt.Errorf("coverage below floor:\n       - %s", strings.Join(problems, "\n       - "))
}

// short trims the module prefix so the table fits on a terminal.
func short(pkg string) string { return strings.TrimPrefix(pkg, modulePrefix) }

func main() {
	profile := flag.String("profile", defaultProfile, "path to the Go coverage profile")
	verbose := flag.Bool("v", true, "print the excluded packages as well")
	flag.Parse()

	if err := run(*profile, *verbose); err != nil {
		fmt.Fprintf(os.Stderr, "\n[ERROR] %v\n\n", err)
		os.Exit(1)
	}
	fmt.Println("\n[OK] Coverage above every floor")
}

func run(profile string, verbose bool) error {
	f, err := os.Open(profile)
	if err != nil {
		if os.IsNotExist(err) {
			return fmt.Errorf("no coverage report at %s\n"+
				"       produce it first:\n"+
				"         go test -count=1 -covermode=atomic -coverprofile=%s ./...", profile, profile)
		}
		return fmt.Errorf("open %s: %w", profile, err)
	}
	defer f.Close()

	pkgs, err := parseProfile(f)
	if err != nil {
		return fmt.Errorf("parse %s: %w", profile, err)
	}
	if len(pkgs) == 0 {
		// A profile with no records is not a pass. It means the test command
		// changed shape and the gate would otherwise sit green measuring nothing.
		return fmt.Errorf("profile %s carries no coverage records", profile)
	}

	a := analyse(pkgs)
	report(os.Stdout, a, verbose)
	return verdict(a)
}
