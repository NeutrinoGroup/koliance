package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"sort"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joho/godotenv"
)

// Single Source of Truth: Canonical migrations loaded from backend/migrations/*.sql
func loadMigrationFiles() ([]string, error) {
	candidates := []string{
		"migrations",
		"backend/migrations",
		"../migrations",
	}

	var migrationDir string
	for _, dir := range candidates {
		if fi, err := os.Stat(dir); err == nil && fi.IsDir() {
			migrationDir = dir
			break
		}
	}

	if migrationDir == "" {
		return nil, fmt.Errorf("migrations directory not found in candidates: %v", candidates)
	}

	entries, err := os.ReadDir(migrationDir)
	if err != nil {
		return nil, fmt.Errorf("failed to read migrations dir: %w", err)
	}

	var sqlFiles []string
	for _, e := range entries {
		if !e.IsDir() && filepath.Ext(e.Name()) == ".sql" {
			sqlFiles = append(sqlFiles, filepath.Join(migrationDir, e.Name()))
		}
	}

	sort.Strings(sqlFiles)
	return sqlFiles, nil
}

func main() {
	_ = godotenv.Load()
	_ = godotenv.Load("../.env")

	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		log.Fatal("DATABASE_URL environment variable is required")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()

	fmt.Println("[INFO] Connecting to Supabase PostgreSQL...")
	pool, err := pgxpool.New(ctx, dbURL)
	if err != nil {
		log.Fatalf("[ERROR] Failed to parse/connect to Supabase: %v", err)
	}
	defer pool.Close()

	if err := pool.Ping(ctx); err != nil {
		log.Fatalf("[ERROR] Supabase ping failed: %v", err)
	}
	fmt.Println("[OK] Successfully connected to Supabase PostgreSQL!")

	migrationFiles, err := loadMigrationFiles()
	if err != nil {
		log.Fatalf("[ERROR] Could not load canonical migrations: %v", err)
	}

	fmt.Printf("[INFO] Applying %d canonical migration files (Single Source of Truth)...\n", len(migrationFiles))
	for _, f := range migrationFiles {
		content, err := os.ReadFile(f)
		if err != nil {
			log.Fatalf("[ERROR] Failed to read %s: %v", f, err)
		}

		fmt.Printf("   ├─ Applying: %s\n", filepath.Base(f))
		if _, err := pool.Exec(ctx, string(content)); err != nil {
			log.Fatalf("[ERROR] Migration %s failed: %v", filepath.Base(f), err)
		}
	}

	fmt.Println("[OK] All canonical migrations applied successfully!")
}
