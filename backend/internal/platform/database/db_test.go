package database

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"
)

// The in-memory store is still exercisable, but only by asking for it. This
// used to be reachable by starting the process without DATABASE_URL, which is
// the degradation GAP-49 removed.
func TestSystemConfigMemoryFallback(t *testing.T) {
	db := NewMemoryOnly()
	ctx := context.Background()

	cfg, err := db.GetSystemConfig(ctx, "maintenance_mode")
	if err != nil {
		t.Fatalf("expected maintenance_mode config, got err: %v", err)
	}
	if string(cfg.Value) != `{"enabled":false}` {
		t.Errorf("unexpected value: %s", string(cfg.Value))
	}

	// Update config
	newVal := []byte(`{"enabled":true}`)
	if err := db.SetSystemConfig(ctx, "maintenance_mode", newVal, "Test override"); err != nil {
		t.Fatalf("failed to set config: %v", err)
	}

	updated, err := db.GetSystemConfig(ctx, "maintenance_mode")
	if err != nil {
		t.Fatalf("failed to get updated config: %v", err)
	}
	if string(updated.Value) != `{"enabled":true}` {
		t.Errorf("expected updated value, got %s", string(updated.Value))
	}

	// Missing key
	if _, err := db.GetSystemConfig(ctx, "non_existent_key"); err == nil {
		t.Errorf("expected error for non_existent_key, got nil")
	}
}

// ==================== GAP-49: explicit degradation ====================

// No credentials must be a refusal, not a downgrade.
func TestNewWithoutDatabaseURLIsAnExplicitError(t *testing.T) {
	for _, dsn := range []string{"", "   ", "\t"} {
		db, err := New(context.Background(), dsn)
		if !errors.Is(err, ErrDatabaseURLRequired) {
			t.Errorf("New(%q): err = %v, want ErrDatabaseURLRequired", dsn, err)
		}
		if db != nil {
			t.Errorf("New(%q) returned a %T; a refused startup must return no handle at all", dsn, db)
		}
	}
}

// A supplied but unusable DSN must also fail. The previous implementation
// logged and returned a MemoryStore here, so the deployment looked healthy
// while persisting nothing.
func TestNewRejectsUnparseableDSN(t *testing.T) {
	db, err := New(context.Background(), "this is not a connection string")
	if !errors.Is(err, ErrDatabaseUnavailable) {
		t.Fatalf("err = %v, want ErrDatabaseUnavailable", err)
	}
	if db != nil {
		t.Fatalf("New returned a %T alongside the error", db)
	}
}

// A reachable-looking DSN pointing at a closed port must fail rather than
// degrade. 127.0.0.1:1 is refused immediately, so this does not depend on a
// timeout.
func TestNewConnectionFailureIsAnExplicitError(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	const secret = "sup3rsecret"
	dsn := "postgres://koliance:" + secret + "@127.0.0.1:1/koliance?sslmode=disable"
	db, err := New(ctx, dsn)
	if !errors.Is(err, ErrDatabaseUnavailable) {
		t.Fatalf("err = %v, want ErrDatabaseUnavailable", err)
	}
	if db != nil {
		t.Fatalf("New returned a %T alongside the error", db)
	}
	if strings.Contains(err.Error(), secret) {
		t.Errorf("error leaks the password: %v", err)
	}
	t.Logf("evidence: %v", err)
}

// Direct test of the credential redaction: the sanitizer is what stands
// between a pgx error and the process log, and pgx does echo the DSN.
//
// The first version of this test passed for the wrong reason - the "password"
// it replaced was the single character "p", because the DSN parser ends the
// userinfo at the first '@'. Every assertion below is written so that failure
// mode cannot pass: the secret must be present in the raw message before
// sanitizing, the host must survive unchanged, and the secret must be gone
// afterwards.
//
// Residual exposure (NOT covered here, registered as GAP-61): a pgx error that
// echoes the password with neither a URL userinfo nor a password= keyword
// anchor is not redacted. That case is deliberately not papered over with a
// length heuristic, which is what caused the "db.eREDACTEDample" corruption.
// (The number read GAP-51 when this test was written; it has been re-allocated
// twice since, 51 -> 57 -> 61 - see docs/changes/042.)
func TestSanitizeDSNErrorRemovesPassword(t *testing.T) {
	cases := []struct {
		name string
		// rawSecrets must appear in the unsanitized message (vacuity guard)
		// and must be gone from the sanitized one.
		rawSecrets []string
		// outputSecrets must not appear in the sanitized message. Unlike
		// rawSecrets they need not be in the input: the decoded spelling of a
		// percent-encoded password exists only in the DSN, and it is the
		// spelling that would be dangerous to leak if anything ever decoded it.
		outputSecrets []string
		dsn           string
		rawEcho       string
	}{
		{
			name:       "plain password",
			rawSecrets: []string{"sup3rsecret"},
			dsn:        "postgres://user:sup3rsecret@db.example:5432/koliance",
			rawEcho:    "postgres://user:sup3rsecret@db.example:5432/koliance",
		},
		{
			name:          "percent-encoded special characters",
			rawSecrets:    []string{"p%40ssw0rd%2Fwith%2Bchars"},
			outputSecrets: []string{"p@ssw0rd/with+chars"},
			dsn:           "postgres://user:p%40ssw0rd%2Fwith%2Bchars@db.example:5432/koliance",
			rawEcho:       "postgres://user:p%40ssw0rd%2Fwith%2Bchars@db.example:5432/koliance",
		},
		{
			name:       "keyword form",
			rawSecrets: []string{"kwsecret"},
			dsn:        "host=db.example user=user password=kwsecret dbname=koliance",
			rawEcho: "failed to connect to `host=db.example user=user database=koliance`: " +
				"host=db.example user=user password=kwsecret dbname=koliance",
		},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			raw := errors.New(tc.rawEcho)
			for _, s := range tc.rawSecrets {
				if !strings.Contains(raw.Error(), s) {
					t.Fatalf("test is vacuous: raw message does not contain %q: %q", s, tc.rawEcho)
				}
			}

			got := sanitizeDSNError(raw, tc.dsn)
			for _, s := range append(append([]string{}, tc.rawSecrets...), tc.outputSecrets...) {
				if strings.Contains(got, s) {
					t.Errorf("%q survived sanitization: %s", s, got)
				}
			}
			if !strings.Contains(got, "REDACTED") {
				t.Errorf("expected a REDACTED marker, got: %s", got)
			}
			// The non-secret parts must still be readable, or the message is
			// useless for the diagnosis it exists for.
			for _, want := range []string{"db.example", "koliance"} {
				if !strings.Contains(got, want) {
					t.Errorf("sanitization destroyed %q, which is not secret: %s", want, got)
				}
			}
			t.Logf("evidence: %s", got)
		})
	}
}

// Sanitizing an unrelated error must not damage it, and an unparseable DSN
// must not panic.
func TestSanitizeDSNErrorPassesThroughUnrelatedInput(t *testing.T) {
	plain := errors.New("connectex: No connection could be made because the target machine actively refused it.")
	if got := sanitizeDSNError(plain, "postgres://user:secret@h:1/db"); got != plain.Error() {
		t.Errorf("unrelated error rewritten: %q", got)
	}
	if got := sanitizeDSNError(plain, "not a dsn"); got != plain.Error() {
		t.Errorf("unparseable DSN broke the message: %q", got)
	}
	if got := sanitizeDSNError(plain, ""); got != plain.Error() {
		t.Errorf("empty DSN broke the message: %q", got)
	}
	// A DSN with userinfo but no password must not produce a bogus target.
	if got := sanitizeDSNError(plain, "postgres://user@h:1/db"); got != plain.Error() {
		t.Errorf("passwordless DSN broke the message: %q", got)
	}
}

// A password that is a substring of a longer, non-secret field must not be
// allowed to fragment it. The first implementation replaced the bare password
// anywhere, which turned "db.example" into "db.eREDACTEDample" for the
// one-character password in this DSN.
func TestSanitizeDSNErrorDoesNotFragmentIrrelevantText(t *testing.T) {
	raw := errors.New("dial tcp db.example:5432: connect: connection refused")
	got := sanitizeDSNError(raw, "postgres://u:x@db.example:5432/koliance")
	if got != raw.Error() {
		t.Errorf("message rewritten although the password (x) does not appear: %q", got)
	}
}

// NewMemoryOnly is the explicit door. It must be usable and must not claim a
// connection it does not have.
func TestNewMemoryOnlyIsExplicitAndHonest(t *testing.T) {
	db := NewMemoryOnly()
	if db.Pool != nil {
		t.Error("memory-only handle has a pool")
	}
	if db.IsConnected {
		t.Error("memory-only handle claims to be connected")
	}
	if db.MemoryStore == nil {
		t.Fatal("memory-only handle has no store")
	}
}

// ==================== BENCHMARKS ====================

func BenchmarkSystemConfigGet(b *testing.B) {
	db := NewMemoryOnly()
	ctx := context.Background()
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, _ = db.GetSystemConfig(ctx, "maintenance_mode")
	}
}

func BenchmarkSystemConfigSet(b *testing.B) {
	db := NewMemoryOnly()
	ctx := context.Background()
	val := []byte(`{"enabled":true}`)
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = db.SetSystemConfig(ctx, "maintenance_mode", val, "benchmark update")
	}
}
