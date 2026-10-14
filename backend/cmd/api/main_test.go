package main

import (
	"errors"
	"net"
	"testing"
	"time"

	"github.com/koliance/backend/internal/config"
	"github.com/koliance/backend/internal/platform/database"
)

// GAP-65. `cmd/api` had no test file at all, so the process-level half of
// GAP-49 — refusing to start when the database is unreachable — had no
// automated judge. The ledger records the mutation that proves it: reverting
// `run` to the pre-GAP-49 silent in-memory fallback left `go build`, `go vet`
// and `go test -race ./...` all green, because nothing executed this entry
// point.
//
// Boundaries (worth stating so a later reader does not over-trust this):
//   - `run` is not injectable. A test can drive it only as far as "it refused,
//     with the right error, before touching a port". Everything past the DB
//     gate — wiring Deps, the handler chain — stays uncovered; that is the
//     part reachable after a successful connection and needs a live database.
//   - `run` builds its own 10s context and calls the real `database.New`, so
//     the case under test must be one that fails *before* any network I/O.
//     An empty DATABASE_URL is exactly that case.

// runBounded drives run on its own goroutine so that a run which fails to
// refuse cannot hang the suite. `blocked` is true when run did not return
// within the bound — which is what a regression to the pre-GAP-49 behaviour
// looks like, because that code path reaches ListenAndServe.
func runBounded(t *testing.T, cfg *config.Config) (err error, blocked bool) {
	t.Helper()
	done := make(chan error, 1)
	go func() { done <- run(cfg) }()
	select {
	case err = <-done:
		return err, false
	case <-time.After(3 * time.Second):
		return nil, true
	}
}

// TestRun_RefusesToStartWithoutDatabaseURL is the positive half: with no
// DATABASE_URL, run must return an error wrapping ErrDatabaseURLRequired, and
// must not return nil.
func TestRun_RefusesToStartWithoutDatabaseURL(t *testing.T) {
	err, blocked := runBounded(t, &config.Config{})
	if blocked {
		t.Fatal("run did not return within 3s — a process with no database reached the server loop instead of refusing (GAP-49 regression)")
	}
	if err == nil {
		t.Fatal("run(&config.Config{}) returned nil — a process with no database must not be allowed to start (GAP-49)")
	}
	if !errors.Is(err, database.ErrDatabaseURLRequired) {
		t.Fatalf("run returned %v; want an error wrapping database.ErrDatabaseURLRequired", err)
	}
}

// TestRun_RefusesBeforeBindingPort is the negative control (AGENTS.md D3).
//
// It holds an ephemeral port and passes that address into run via cfg.Port. A
// run that refused *after* reaching ListenAndServe would hit EADDRINUSE and
// return a bind error — not the database sentinel — so requiring the sentinel
// while the port is held proves the refusal happens before any port is touched.
//
// Why the port must actually be held: without it, "run returned the sentinel"
// is compatible with a run that bound a *different* port and bound it
// successfully. Holding the port removes that reading, so the two tests assert
// independent properties (refused · refused-early) rather than the same one
// twice.
func TestRun_RefusesBeforeBindingPort(t *testing.T) {
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("could not reserve a probe port: %v", err)
	}
	defer ln.Close()
	_, port, _ := net.SplitHostPort(ln.Addr().String())

	runErr, blocked := runBounded(t, &config.Config{Port: port})
	if blocked {
		t.Fatal("run did not return within 3s while its port was already held — it cannot have refused before binding")
	}
	if runErr == nil {
		t.Fatal("run returned nil while its port was already held — it cannot have refused before binding")
	}
	if !errors.Is(runErr, database.ErrDatabaseURLRequired) {
		t.Fatalf("run with port %s held returned %v; want ErrDatabaseURLRequired (refusal must precede any port binding)", port, runErr)
	}
}
