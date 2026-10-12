package database

import (
	"context"
	"errors"
	"fmt"
	"log"
	"regexp"
	"strings"
	"sync"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// ErrDatabaseURLRequired is returned when the process was started without
// DATABASE_URL.
//
// This is the whole point of GAP-49: the previous New() logged one line and
// handed back a MemoryStore, so a deployment with no database answered every
// business route with 200 while persisting nothing. The failure was
// indistinguishable from success from the outside, which is the class of
// defect that never gets noticed.
var ErrDatabaseURLRequired = errors.New("database: DATABASE_URL is required; refusing to start against a silent in-memory store")

// ErrDatabaseUnavailable is returned when a DATABASE_URL was supplied but the
// pool could not be established. Falling back to memory here would be worse
// than not starting: the data would look committed and vanish on restart.
var ErrDatabaseUnavailable = errors.New("database: could not connect to the configured PostgreSQL instance")

type DB struct {
	Pool        *pgxpool.Pool
	IsConnected bool
	MemoryStore *MemoryStore
}

// MemoryStore provides instant in-memory persistence.
//
// It is still used by the service layer, but it is no longer a fallback: the
// only ways to obtain one are NewMemoryOnly and newMemoryStore, and neither is
// reachable from New(). A test or an offline tool asks for it explicitly; a
// production process cannot arrive here by having a missing environment
// variable.
type MemoryStore struct {
	mu           sync.RWMutex
	Cards        map[string]map[string]interface{}
	Transactions []map[string]interface{}
	Proofs       []map[string]interface{}
	Configs      map[string][]byte
}

func newMemoryStore() *MemoryStore {
	return &MemoryStore{
		Cards:        make(map[string]map[string]interface{}),
		Transactions: make([]map[string]interface{}, 0),
		Proofs:       make([]map[string]interface{}, 0),
		Configs: map[string][]byte{
			"maintenance_mode":     []byte(`{"enabled":false}`),
			"quant_risk_limits":    []byte(`{"max_leverage":50,"max_single_trade_usd":10000,"daily_loss_limit_usd":500}`),
			"nansen_pipeline":      []byte(`{"poll_interval_seconds":300,"chains":["ethereum","monad"]}`),
			"credit_rating_engine": []byte(`{"steam_multiplier":1.0,"github_multiplier":1.5,"allow_synthetic_credit":false}`),
		},
	}
}

// NewMemoryOnly returns a DB backed solely by the in-memory store. It exists
// for tests and offline tooling. It is deliberately explicit: nothing in the
// production startup path may reach it, which is what makes the degradation
// visible instead of silent.
func NewMemoryOnly() *DB {
	log.Println("[Database] Explicit in-memory store requested: nothing written here survives a restart.")
	return &DB{Pool: nil, IsConnected: false, MemoryStore: newMemoryStore()}
}

// Err resolves the database the caller asked for, or refuses to guess.
//
// Failures are returned, never logged and swallowed: the caller decides
// whether a missing database is fatal (cmd/api treats it as fatal).
func New(ctx context.Context, databaseURL string) (*DB, error) {
	if strings.TrimSpace(databaseURL) == "" {
		return nil, ErrDatabaseURLRequired
	}

	config, err := pgxpool.ParseConfig(databaseURL)
	if err != nil {
		// The parse error is wrapped, but the DSN itself is never echoed: it
		// carries the password, and this error reaches the process log and
		// potentially a screenshot.
		return nil, fmt.Errorf("%w: DATABASE_URL is not a valid PostgreSQL connection string: %v",
			ErrDatabaseUnavailable, sanitizeDSNError(err, databaseURL))
	}

	config.MaxConns = 25
	config.MinConns = 5
	config.MaxConnLifetime = 30 * time.Minute

	pool, err := pgxpool.NewWithConfig(ctx, config)
	if err != nil {
		return nil, fmt.Errorf("%w: %v", ErrDatabaseUnavailable, sanitizeDSNError(err, databaseURL))
	}

	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("%w: ping failed: %v", ErrDatabaseUnavailable, sanitizeDSNError(err, databaseURL))
	}

	log.Println("[Database] Successfully connected to Supabase PostgreSQL pool!")
	return &DB{
		Pool:        pool,
		IsConnected: true,
		MemoryStore: newMemoryStore(),
	}, nil
}

// dsnUserinfoRe matches the credential part of a connection URL: the
// "user:password@" immediately after the scheme. Only that span is replaced, so
// the host and database in the message survive for diagnosis.
var dsnUserinfoRe = regexp.MustCompile(`(?i)\b(postgres(?:ql)?://)[^/?#\s]*@`)

// dsnPasswordRe matches the keyword form (host=... password=...).
var dsnPasswordRe = regexp.MustCompile(`(?i)\bpassword\s*=\s*\S+`)

// sanitizeDSNError removes the credential from an error message before it
// reaches a log.
//
// Every replacement is anchored to a credential position - the userinfo of a
// URL, or the value of a password= keyword. An earlier version replaced the
// bare password string anywhere in the message, which was worse than useless:
// with a one-character password (the pgctest-style "postgres://u:x@...") it
// rewrote "db.example" into "db.eREDACTEDample", and with a password containing
// an unescaped '@' the string it "redacted" was a single character, so the
// real password survived the check that claimed to remove it.
//
// No bare-substring pass is kept. That leaves one residual exposure - an error
// that echoes the password with neither anchor - which is registered as GAP-61
// rather than papered over with a heuristic length threshold. (It was GAP-51
// when this comment was written; the number has been re-allocated twice since,
// 51 -> 57 -> 61, on cross-branch collisions - see docs/changes/042. GAP-51 in
// the merged tree is an unrelated front-end item, so the old pointer here was
// sending readers to someone else's gap.)
func sanitizeDSNError(err error, databaseURL string) string {
	msg := dsnUserinfoRe.ReplaceAllString(err.Error(), "${1}REDACTED@")
	msg = dsnPasswordRe.ReplaceAllString(msg, "password=REDACTED")
	return msg
}

// DatabaseURLEnvVar is the environment variable New() requires. Named here so
// the error message and the docs cannot drift apart.
const DatabaseURLEnvVar = "DATABASE_URL"

func (db *DB) Close() {
	if db.Pool != nil {
		db.Pool.Close()
	}
}

func (m *MemoryStore) SaveCard(cardID string, data map[string]interface{}) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.Cards[cardID] = data
}

func (m *MemoryStore) GetCard(cardID string) (map[string]interface{}, bool) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	c, ok := m.Cards[cardID]
	return c, ok
}

func (m *MemoryStore) AppendTransaction(tx map[string]interface{}) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.Transactions = append(m.Transactions, tx)
}

func (m *MemoryStore) AppendProof(proof map[string]interface{}) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.Proofs = append(m.Proofs, proof)
}

type SystemConfig struct {
	Key         string    `json:"key"`
	Value       []byte    `json:"value"` // raw JSONB
	Description string    `json:"description"`
	UpdatedAt   time.Time `json:"updatedAt"`
}

func (db *DB) GetSystemConfig(ctx context.Context, key string) (*SystemConfig, error) {
	if db.Pool != nil && db.IsConnected {
		var cfg SystemConfig
		row := db.Pool.QueryRow(ctx, "SELECT key, value, COALESCE(description, ''), updated_at FROM system_configs WHERE key = $1", key)
		if err := row.Scan(&cfg.Key, &cfg.Value, &cfg.Description, &cfg.UpdatedAt); err != nil {
			return nil, err
		}
		return &cfg, nil
	}
	// Memory store fallback
	db.MemoryStore.mu.RLock()
	defer db.MemoryStore.mu.RUnlock()
	if val, ok := db.MemoryStore.Configs[key]; ok {
		return &SystemConfig{
			Key:         key,
			Value:       val,
			Description: "In-memory dynamic configuration",
			UpdatedAt:   time.Now().UTC(),
		}, nil
	}
	return nil, fmt.Errorf("config key not found: %s", key)
}

func (db *DB) SetSystemConfig(ctx context.Context, key string, value []byte, description string) error {
	if db.Pool != nil && db.IsConnected {
		_, err := db.Pool.Exec(ctx,
			"INSERT INTO system_configs (key, value, description, updated_at) VALUES ($1, $2, $3, NOW()) ON CONFLICT (key) DO UPDATE SET value = $2, description = $3, updated_at = NOW()",
			key, value, description,
		)
		return err
	}
	db.MemoryStore.mu.Lock()
	defer db.MemoryStore.mu.Unlock()
	db.MemoryStore.Configs[key] = value
	return nil
}
