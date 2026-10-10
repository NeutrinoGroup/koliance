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
	"syscall"

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

	bot, err := liquidator.New(ctx, *cfg, logger)
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
