package main

import (
	"context"
	"fmt"
	"log"
	"log/slog"
	"net/http"
	"os"
	"strconv"
	"time"

	"github.com/koliance/backend/internal/agentapi"
	"github.com/koliance/backend/internal/agentcard"
	"github.com/koliance/backend/internal/config"
	"github.com/koliance/backend/internal/developer"
	"github.com/koliance/backend/internal/game"
	"github.com/koliance/backend/internal/httpapi"
	"github.com/koliance/backend/internal/liquidation"
	"github.com/koliance/backend/internal/market"
	"github.com/koliance/backend/internal/platform/database"
	"github.com/koliance/backend/internal/platform/stripeclient"
	"github.com/koliance/backend/internal/verifier"
)

func main() {
	cfg := config.Load()

	// 1. Initialize Database.
	//
	// A missing or unreachable database is fatal. This used to fall back to an
	// in-memory store with a single log line, so a deployment with no
	// credentials served every business route from a store that persists
	// nothing - indistinguishable from success from the outside (GAP-49).
	// Refusing to start is the point: a process that cannot remember anything
	// must not accept traffic.
	if err := run(cfg); err != nil {
		log.Fatalf("[Koliance] startup refused: %v", err)
	}
}

func run(cfg *config.Config) error {
	// The process-wide structured logger (ADR-006 §3.2). Same idiom as
	// cmd/liquidator/main.go:29 - JSON to stdout, one object per line.
	//
	// SetDefault is not decoration: the router falls back to slog.Default() when
	// Deps.Logger is nil, and without this line that fallback would be the
	// stdlib's text handler on stderr - a second, differently-shaped log stream
	// produced by the same process. Here the fallback and the injected logger are
	// the same handler, so there is no configuration under which the two drift.
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	slog.SetDefault(logger)

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	db, err := database.New(ctx, cfg.DatabaseURL)
	if err != nil {
		return err
	}
	defer db.Close()

	// 2. Initialize Steam Client & Service
	steamCli := game.NewSteamClient(cfg.SteamAPIKey)
	gameService := game.NewService(steamCli, db)

	// 3. Initialize AgentCard Guard & Service
	guard := agentcard.NewPermissionGuard()
	cardService := agentcard.NewService(guard, db)

	// 4. Initialize Market Alpaca & Real-time Price Oracle
	alpacaCli := market.NewAlpacaClient(cfg.AlpacaBaseURL, cfg.AlpacaAPIKey, cfg.AlpacaAPISecret)
	priceOracle := market.NewPriceOracle(cfg.AlpacaAPIKey, cfg.AlpacaAPISecret)
	priceOracle.SetDataBaseURL(cfg.AlpacaDataURL)
	priceOracle.SetFeed(cfg.AlpacaDataFeed)
	marketService := market.NewService(alpacaCli, priceOracle, db)

	// 5. Initialize Stripe Client
	stripeCli := stripeclient.New(cfg.StripeSecretKey)

	// 6. Initialize GitHub Developer Service
	githubCli := developer.NewGitHubClient("")
	devService := developer.NewService(githubCli)

	// 7. Proof verifier slot (GAP-44). The no-op is what ADR-004 D1 kept from
	// the RFC's ZK layer, so the endpoint answers 501 until a real proof system
	// is wired in here - and only here.
	proofVerifier := verifier.NewNoop()

	// 8. Initialize Autonomous Agent API & Quota Service
	agentAPIService := agentapi.NewService(db)

	handler := httpapi.NewRouter(httpapi.Deps{
		Cfg:          cfg,
		DB:           db,
		Game:         gameService,
		Cards:        cardService,
		Market:       marketService,
		PriceOracle:  priceOracle,
		Stripe:       stripeCli,
		Dev:          devService,
		Verifier:     proofVerifier,
		Liquidations: liquidation.NewPG(db.Pool),
		AgentAPI:     agentAPIService,
		Logger:       logger,
	})

	port := cfg.Port
	if p, err := strconv.Atoi(port); err != nil || p <= 0 {
		port = "8080"
	}

	server := &http.Server{
		Addr:         ":" + port,
		Handler:      handler,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
	}

	fmt.Printf("[Koliance] Go Backend Service listening on http://localhost:%s\n", port)
	fmt.Printf("   ├─ Steam Web API: Active (%s)\n", cfg.SteamDomain)
	// Presence only — never the value.
	fmt.Printf("   ├─ Alpaca Paper API: Active (%s), credentials configured: %t\n",
		cfg.AlpacaBaseURL, cfg.AlpacaConfigured())
	fmt.Printf("   ├─ Alpaca Market Data: %s (feed %s) — /api/v1/market/* fails closed (503) without credentials\n",
		cfg.AlpacaDataURL, cfg.AlpacaDataFeed)
	fmt.Printf("   ├─ Pyth Hermes Oracle: Active (%s)\n", cfg.PythHermesURL)
	fmt.Printf("   ├─ Stripe Integration: Ready (Key loaded: %t)\n", cfg.StripeSecretKey != "")
	fmt.Printf("   ├─ PostgreSQL: Connected (memory fallback removed, GAP-49)\n")
	fmt.Printf("   ├─ CORS origins: %v\n", cfg.CORSAllowedOrigins)
	fmt.Printf("   ├─ Proof verifier slot: %s (not wired, /api/v1/verifier/verify answers 501)\n", proofVerifier.Scheme())
	fmt.Printf("   └─ Operator token configured: %t, public demo trading: %t\n", cfg.APIToken != "", cfg.DemoPublicTrading)

	if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		return fmt.Errorf("server failed: %w", err)
	}
	return nil
}
