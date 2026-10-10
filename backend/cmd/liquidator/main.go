// Command liquidator is the perp liquidation bot (ADR-005): it backfills the
// PositionManager events, follows them over WebSocket, scans the local position
// mirror on a price tick, and submits liquidate() batches for positions that
// breach the maintenance margin.
//
// The runtime constraints this binary enforces are the ADR-005 §5 set: the
// private key is env-only (no default, fail-fast on missing), the process holds
// a single-instance lock for its lifetime, and the event watermark is persisted
// so a restart or reconnect resumes without losing events. See
// docs/adr/ADR-005-引入go-ethereum.md.
package main

import (
	"context"
	"log/slog"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/koliance/backend/internal/liquidation"
	"github.com/koliance/backend/internal/liquidator"
)

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	slog.SetDefault(logger)

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	cfg, err := liquidator.LoadConfig(os.Getenv)
	if err != nil {
		logger.Error("config", "err", err)
		os.Exit(1)
	}

	// Single-instance guard BEFORE any dialing or transaction work: a second
	// process sharing the key would seed its own nonce.Manager from the same
	// confirmed nonce and hand out colliding nonces (ADR-005 §5.6).
	release, err := liquidator.AcquireLock(cfg.LockPath)
	if err != nil {
		logger.Error("another liquidator instance holds the lock", "lock_path", cfg.LockPath, "err", err)
		os.Exit(1)
	}
	defer release()

	// Observation is a side-channel: the store is optional, and every failure
	// below degrades to "log only, no store" rather than blocking the bot.
	obs := connectObservationStore(ctx, logger)
	if obs != nil {
		defer obs.Close()
	}

	bot, err := liquidator.New(ctx, *cfg, logger, obs)
	if err != nil {
		logger.Error("startup", "err", err)
		os.Exit(1)
	}
	defer bot.Close()

	if err := bot.Run(ctx); err != nil && ctx.Err() == nil {
		logger.Error("bot stopped", "err", err)
		os.Exit(1)
	}
	logger.Info("liquidator stopped cleanly")
}

// connectObservationStore builds the liquidation_events store from DATABASE_URL.
// It never fails the process: an absent URL or any connection/schema failure is
// logged as an explicit warning and returns nil, which disables observation
// while the liquidation loop keeps running.
func connectObservationStore(ctx context.Context, logger *slog.Logger) *liquidation.PG {
	url := strings.TrimSpace(os.Getenv("DATABASE_URL"))
	if url == "" {
		logger.Warn("liquidation observations disabled: DATABASE_URL is not set")
		return nil
	}

	cctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	pool, err := pgxpool.New(cctx, url)
	if err != nil {
		logger.Warn("liquidation observations disabled: failed to build pool", "err", err)
		return nil
	}
	if err := pool.Ping(cctx); err != nil {
		pool.Close()
		logger.Warn("liquidation observations disabled: ping failed", "err", err)
		return nil
	}

	store := liquidation.NewPG(pool)
	if err := store.EnsureSchema(cctx); err != nil {
		pool.Close()
		logger.Warn("liquidation observations disabled: ensure schema failed", "err", err)
		return nil
	}

	logger.Info("liquidation observations enabled")
	return store
}
