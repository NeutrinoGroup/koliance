package database

import (
	"context"
	"fmt"
	"log"
	"sync"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

type DB struct {
	Pool        *pgxpool.Pool
	IsConnected bool
	MemoryStore *MemoryStore
}

// MemoryStore provides instant in-memory persistence when Supabase credentials are not yet configured
type MemoryStore struct {
	mu           sync.RWMutex
	Cards        map[string]map[string]interface{}
	Transactions []map[string]interface{}
	Proofs       []map[string]interface{}
	Configs      map[string][]byte
}

func New(databaseURL string) *DB {
	mem := &MemoryStore{
		Cards:        make(map[string]map[string]interface{}),
		Transactions: make([]map[string]interface{}, 0),
		Proofs:       make([]map[string]interface{}, 0),
		Configs: map[string][]byte{
			"maintenance_mode":    []byte(`{"enabled":false}`),
			"quant_risk_limits":   []byte(`{"max_leverage":50,"max_single_trade_usd":10000,"daily_loss_limit_usd":500}`),
			"nansen_pipeline":     []byte(`{"poll_interval_seconds":300,"chains":["ethereum","monad"]}`),
			"credit_rating_engine": []byte(`{"steam_multiplier":1.0,"github_multiplier":1.5,"allow_synthetic_credit":false}`),
		},
	}

	if databaseURL == "" {
		log.Println("[Database] DATABASE_URL not set; running with high-speed in-memory store.")
		return &DB{
			Pool:        nil,
			IsConnected: false,
			MemoryStore: mem,
		}
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	config, err := pgxpool.ParseConfig(databaseURL)
	if err != nil {
		log.Printf("[Database] Failed to parse DATABASE_URL: %v. Falling back to memory store.", err)
		return &DB{Pool: nil, IsConnected: false, MemoryStore: mem}
	}

	config.MaxConns = 25
	config.MinConns = 5
	config.MaxConnLifetime = 30 * time.Minute

	pool, err := pgxpool.NewWithConfig(ctx, config)
	if err != nil {
		log.Printf("[Database] Failed to connect to Supabase: %v. Falling back to memory store.", err)
		return &DB{Pool: nil, IsConnected: false, MemoryStore: mem}
	}

	if err := pool.Ping(ctx); err != nil {
		log.Printf("[Database] Supabase ping failed: %v. Falling back to memory store.", err)
		return &DB{Pool: nil, IsConnected: false, MemoryStore: mem}
	}

	log.Println("[Database] Successfully connected to Supabase PostgreSQL pool!")
	return &DB{
		Pool:        pool,
		IsConnected: true,
		MemoryStore: mem,
	}
}

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
