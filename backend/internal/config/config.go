package config

import (
	"log"
	"os"
	"strings"

	"github.com/joho/godotenv"
)

type Config struct {
	Port        string
	Environment string
	DatabaseURL string
	SteamAPIKey string
	SteamDomain string
	// AlpacaAPIKey / AlpacaAPISecret have NO default. They used to fall back to
	// credentials committed in this file, which meant a deployment that forgot
	// to set the env vars silently authenticated as whoever those keys belonged
	// to. Missing credentials are now an explicit state (AlpacaConfigured),
	// never a path to fabricated data. See AlpacaConfigured.
	AlpacaAPIKey    string
	AlpacaAPISecret string
	AlpacaBaseURL   string
	// AlpacaDataURL / AlpacaDataFeed are the market-data API (a different host
	// from the trading API in AlpacaBaseURL) and the data feed. Neither is a
	// secret: they are safe defaults, and they are env-overridable so a
	// deployment can point at a private feed.
	AlpacaDataURL        string
	AlpacaDataFeed       string
	StripePublishableKey string
	StripeSecretKey      string
	PythHermesURL        string
	MonadRPCURL          string
	MonadChainID         string
	KolianceContract     string

	// CORSAllowedOrigins is the exact list of browser origins allowed to call
	// the API (CORS_ALLOWED_ORIGINS, comma separated). No wildcard support on
	// purpose: "*" is what this replaced.
	CORSAllowedOrigins []string
	// APIToken is the operator bearer token (KOLIANCE_API_TOKEN). Operator-only
	// endpoints fail closed (503) when it is unset.
	APIToken string
	// DemoPublicTrading opens the Alpaca paper-trading write endpoints to
	// unauthenticated browsers (DEMO_PUBLIC_TRADING=true). Default false, i.e.
	// those endpoints require the operator token unless explicitly opted in.
	DemoPublicTrading bool
}

// AlpacaConfigured reports whether both Alpaca credentials are present.
//
// This is the single source of truth for "can we serve real market data".
// Endpoints that would otherwise answer with numbers gate on it and fail
// closed (503): a deployment without credentials has no market data, and
// saying so is the only honest answer. Returning a generated series instead
// is the defect this guards (issue #14, GAP-14).
func (c *Config) AlpacaConfigured() bool {
	return c.AlpacaAPIKey != "" && c.AlpacaAPISecret != ""
}

// DefaultCORSOrigins is used when CORS_ALLOWED_ORIGINS is unset: the
// production homepage plus the local Next.js dev server.
const DefaultCORSOrigins = "https://koliance.oodai.space,http://localhost:3000,http://127.0.0.1:3000"

func Load() *Config {
	// Attempt to load .env, ignore if missing
	if err := godotenv.Load(); err != nil {
		_ = godotenv.Load("../.env")
	}

	return loadFrom(getEnv)
}

// loadFrom is Load with an injectable reader, so a test can assert the defaults
// without depending on (or being defeated by) the ambient environment. The
// first version of the credential test used t.Setenv("ALPACA_API_KEY", "") and
// passed for the wrong reason: godotenv.Load() above re-populates the variable
// from a developer's .env, and godotenv does not overwrite an existing value —
// but it DOES set one that is merely empty. A test that reads .env is measuring
// the machine, not the code.
func loadFrom(read func(key, defaultVal string) string) *Config {
	cfg := &Config{
		Port:        read("PORT", "8080"),
		Environment: read("ENVIRONMENT", "development"),
		DatabaseURL: read("DATABASE_URL", ""),
		SteamAPIKey: read("STEAM_API_KEY", "745B577BC3554647B4FA40BE9635E838"),
		SteamDomain: read("STEAM_DOMAIN", "koliance.oodai.space"),
		// No defaults, deliberately. A committed fallback key is a credential
		// leak that also disguises a misconfigured deployment as a working one.
		AlpacaAPIKey:         read("ALPACA_API_KEY", ""),
		AlpacaAPISecret:      read("ALPACA_API_SECRET", ""),
		AlpacaBaseURL:        read("ALPACA_BASE_URL", "https://paper-api.alpaca.markets/v2"),
		AlpacaDataURL:        read("ALPACA_DATA_URL", "https://data.alpaca.markets"),
		AlpacaDataFeed:       read("ALPACA_DATA_FEED", "iex"),
		StripePublishableKey: read("STRIPE_PUBLISHABLE_KEY", ""), // env only, no committed fallback (unused by the backend today)
		StripeSecretKey:      read("STRIPE_SECRET_KEY", ""),
		PythHermesURL:        read("PYTH_HERMES_URL", "https://hermes.pyth.network"),
		MonadRPCURL:          read("MONAD_RPC_URL", "https://testnet-rpc.monad.xyz"),
		MonadChainID:         read("MONAD_CHAIN_ID", "10143"),
		KolianceContract:     read("KOLIANCE_CONTRACT_ADDRESS", "0x32fDd6B096EE14246b5b6971135286Bad01F4928"),
	}
	cfg.CORSAllowedOrigins = ParseOrigins(read("CORS_ALLOWED_ORIGINS", DefaultCORSOrigins))
	cfg.APIToken = read("KOLIANCE_API_TOKEN", "")
	cfg.DemoPublicTrading = strings.EqualFold(read("DEMO_PUBLIC_TRADING", "false"), "true")
	if cfg.APIToken == "" {
		log.Println("[Config] KOLIANCE_API_TOKEN not set: operator-only endpoints will refuse every request (fail closed).")
	}
	if !cfg.AlpacaConfigured() {
		log.Println("[Config] ALPACA_API_KEY/ALPACA_API_SECRET not set: /api/v1/market/* will refuse every request (fail closed, 503). No synthetic market data is served.")
	}

	log.Printf("[Config] Loaded configuration: Port=%s, SteamDomain=%s, AlpacaBase=%s, AlpacaData=%s (credentials configured: %t)",
		cfg.Port, cfg.SteamDomain, cfg.AlpacaBaseURL, cfg.AlpacaDataURL, cfg.AlpacaConfigured())
	return cfg
}

// ParseOrigins splits a comma separated origin list, trimming blanks and any
// trailing slash so "https://a.b/" and "https://a.b" compare equal.
func ParseOrigins(raw string) []string {
	out := make([]string, 0)
	for _, o := range strings.Split(raw, ",") {
		o = strings.TrimRight(strings.TrimSpace(o), "/")
		if o != "" && o != "*" {
			out = append(out, o)
		}
	}
	return out
}

func getEnv(key, defaultVal string) string {
	if val := os.Getenv(key); val != "" {
		return strings.TrimSpace(val)
	}
	return strings.TrimSpace(defaultVal)
}
