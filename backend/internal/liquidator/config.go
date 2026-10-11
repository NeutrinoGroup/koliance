// Package liquidator assembles the perp liquidation bot: it wires the chain
// event indexer (internal/chain), the position mirror (internal/perp/position),
// the price feed (internal/oracle) and the local nonce manager
// (internal/perp/nonce) into one runnable single-instance process
// (cmd/liquidator).
//
// The package owns the ADR-005 §5 runtime constraints the lower layers
// deliberately left to the caller:
//
//   - §5.1 private key: env-only, no default, fail-fast on missing/invalid;
//   - §5.3 watermark + reconnect: lastProcessedBlock persistence, exponential
//     backoff, backfill-then-resubscribe (indexLoop);
//   - §5.5 observability: structured logs incl. nonce.Manager.Issued();
//   - §5.6 single instance: an advisory file lock held for the process lifetime.
//
// The only go-ethereum touchpoints are the chain boundary, the oracle and the
// sender's abigen session; nothing leaks go-ethereum types into internal/perp,
// which stays dependency-free (ADR-005).
package liquidator

import (
	"crypto/ecdsa"
	"errors"
	"fmt"
	"math/big"
	"strconv"
	"strings"
	"time"

	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/crypto"
)

// Config is the liquidator's runtime configuration, assembled from environment
// variables by LoadConfig. The private key has no default and its absence is
// fatal — ADR-005 §5.1, the reverse of the GAP-12 plaintext-defaults habit.
type Config struct {
	RPC string
	WS  string

	// ChainID is the expected chain id, checked against the node at startup by
	// chain.New (ADR-005 §5.4).
	ChainID *big.Int

	// PositionManager is the frozen IPositionManager contract to index and
	// liquidate against.
	PositionManager common.Address

	// DemoOracle is the demo price oracle, required when Feed is "demo".
	DemoOracle common.Address

	// Feed selects the price source: "demo" (DemoOracle, the demo path) or
	// "hermes" (HermesFeed, production narrative).
	Feed      string
	HermesURL string

	// PrivateKeyHex is the liquidator EOA key, hex with or without 0x. No
	// default; missing or malformed fails startup.
	PrivateKeyHex string

	// StartBlock is the block the contract was deployed in. A cold start (no
	// watermark) backfills from here; lower watermarks are clamped up to it.
	StartBlock uint64

	WatermarkPath string
	LockPath      string

	TickInterval     time.Duration
	BackoffBase      time.Duration
	BackoffMax       time.Duration
	HealthyThreshold time.Duration

	// MaxPositionsPerCall caps one liquidate() call's position count so a batch
	// stays under the block gas limit while keeping the per-feed snapshot
	// invariant (ADR-005 §5.6). Dynamic EstimateGas chunking is deferred to the
	// local-chain validation (GAP-40).
	MaxPositionsPerCall int

	// ObsWriteTimeout bounds each observation write (one round-trip, all
	// positions of one chunk). The observation channel is a side-channel: a slow
	// or hung DB must never stall the liquidation loop, so a timeout here
	// degrades to a warning log rather than propagating.
	ObsWriteTimeout time.Duration

	// GasPriceWei, when positive, is used verbatim (testnet: pin it high rather
	// than estimate, 推进方案 2.2). Nil lets the node suggest.
	GasPriceWei *big.Int
	// GasLimit, when positive, is used verbatim; zero lets the binding estimate.
	GasLimit uint64

	TxTimeout time.Duration
}

// LoadConfig reads the liquidator configuration from getenv (os.Getenv in
// production, an injectable map in tests). Required fields fail fast with a
// clear message; optional knobs fall back to documented defaults.
func LoadConfig(getenv func(string) string) (*Config, error) {
	chainID, err := parseChainID(getenv("LIQUIDATOR_CHAIN_ID"))
	if err != nil {
		return nil, err
	}
	pm, err := parseRequiredAddress(getenv("LIQUIDATOR_POSITION_MANAGER"), "LIQUIDATOR_POSITION_MANAGER")
	if err != nil {
		return nil, err
	}
	demoOracle, err := parseOptionalAddress(getenv("LIQUIDATOR_DEMO_ORACLE"))
	if err != nil {
		return nil, err
	}

	cfg := &Config{
		RPC:                 strings.TrimSpace(getenv("LIQUIDATOR_RPC")),
		WS:                  strings.TrimSpace(getenv("LIQUIDATOR_WS")),
		ChainID:             chainID,
		PositionManager:     pm,
		DemoOracle:          demoOracle,
		Feed:                strings.ToLower(strings.TrimSpace(getenv("LIQUIDATOR_FEED"))),
		HermesURL:           strings.TrimSpace(getenv("LIQUIDATOR_HERMES_URL")),
		PrivateKeyHex:       strings.TrimSpace(getenv("LIQUIDATOR_PRIVATE_KEY")),
		StartBlock:          parseUint(getenv("LIQUIDATOR_START_BLOCK")),
		WatermarkPath:       defaultString(getenv("LIQUIDATOR_WATERMARK_PATH"), "./liquidator.watermark"),
		LockPath:            defaultString(getenv("LIQUIDATOR_LOCK_PATH"), "./liquidator.lock"),
		TickInterval:        parseDuration(getenv("LIQUIDATOR_TICK_INTERVAL"), time.Second),
		BackoffBase:         parseDuration(getenv("LIQUIDATOR_BACKOFF_BASE"), time.Second),
		BackoffMax:          parseDuration(getenv("LIQUIDATOR_BACKOFF_MAX"), 30*time.Second),
		HealthyThreshold:    parseDuration(getenv("LIQUIDATOR_HEALTHY_THRESHOLD"), 30*time.Second),
		MaxPositionsPerCall: parseInt(getenv("LIQUIDATOR_MAX_POSITIONS_PER_CALL"), 50),
		ObsWriteTimeout:     parseDuration(getenv("LIQUIDATOR_OBS_WRITE_TIMEOUT"), 2*time.Second),
		GasPriceWei:         parseBigWei(getenv("LIQUIDATOR_GAS_PRICE_WEI")),
		GasLimit:            parseUint(getenv("LIQUIDATOR_GAS_LIMIT")),
		TxTimeout:           parseDuration(getenv("LIQUIDATOR_TX_TIMEOUT"), 60*time.Second),
	}

	if cfg.Feed == "" {
		cfg.Feed = "demo"
	}
	if cfg.HermesURL == "" {
		cfg.HermesURL = "https://hermes.pyth.network"
	}
	if err := cfg.validate(); err != nil {
		return nil, err
	}
	return cfg, nil
}

// validate rejects configurations that would fail silently in production. The
// private key check here is existence only; the crypto parse (also fail-fast)
// happens in loadPrivateKey, called by Bot.New.
func (c Config) validate() error {
	if c.RPC == "" {
		return errors.New("liquidator: LIQUIDATOR_RPC is required")
	}
	if c.WS == "" {
		return errors.New("liquidator: LIQUIDATOR_WS is required")
	}
	if c.ChainID == nil || c.ChainID.Sign() <= 0 {
		return errors.New("liquidator: LIQUIDATOR_CHAIN_ID must be a positive integer")
	}
	if c.PositionManager == (common.Address{}) {
		return errors.New("liquidator: LIQUIDATOR_POSITION_MANAGER is required")
	}
	if c.PrivateKeyHex == "" {
		return errors.New("liquidator: LIQUIDATOR_PRIVATE_KEY is required (no default)")
	}
	if c.Feed != "demo" && c.Feed != "hermes" {
		return fmt.Errorf("liquidator: LIQUIDATOR_FEED %q must be demo or hermes", c.Feed)
	}
	if c.Feed == "demo" && c.DemoOracle == (common.Address{}) {
		return errors.New("liquidator: LIQUIDATOR_DEMO_ORACLE is required when LIQUIDATOR_FEED=demo")
	}
	if c.TickInterval <= 0 {
		return errors.New("liquidator: LIQUIDATOR_TICK_INTERVAL must be positive")
	}
	if c.BackoffBase <= 0 {
		return errors.New("liquidator: LIQUIDATOR_BACKOFF_BASE must be positive")
	}
	if c.BackoffMax < c.BackoffBase {
		return errors.New("liquidator: LIQUIDATOR_BACKOFF_MAX must be >= LIQUIDATOR_BACKOFF_BASE")
	}
	if c.MaxPositionsPerCall <= 0 {
		return errors.New("liquidator: LIQUIDATOR_MAX_POSITIONS_PER_CALL must be positive")
	}
	return nil
}

// loadPrivateKey parses the liquidator EOA key. It fails on empty (missing) and
// malformed hex alike — a bot must never run with a placeholder key, which
// would sign transactions with a known or zero key (ADR-005 §5.1).
func loadPrivateKey(hex string) (*ecdsa.PrivateKey, error) {
	hex = strings.TrimSpace(hex)
	if hex == "" {
		return nil, errors.New("liquidator: LIQUIDATOR_PRIVATE_KEY is required (no default)")
	}
	// crypto.HexToECDSA decodes raw hex only — it does not strip the 0x prefix
	// (measured, not assumed: it rejects the 'x').
	hex = strings.TrimPrefix(strings.TrimPrefix(hex, "0x"), "0X")
	key, err := crypto.HexToECDSA(hex)
	if err != nil {
		return nil, fmt.Errorf("liquidator: parse LIQUIDATOR_PRIVATE_KEY: %w", err)
	}
	return key, nil
}

func parseChainID(s string) (*big.Int, error) {
	s = strings.TrimSpace(s)
	if s == "" {
		return nil, errors.New("liquidator: LIQUIDATOR_CHAIN_ID is required")
	}
	n, ok := new(big.Int).SetString(s, 10)
	if !ok || n.Sign() <= 0 {
		return nil, fmt.Errorf("liquidator: LIQUIDATOR_CHAIN_ID %q must be a positive integer", s)
	}
	return n, nil
}

func parseRequiredAddress(s, name string) (common.Address, error) {
	s = strings.TrimSpace(s)
	if s == "" {
		return common.Address{}, fmt.Errorf("liquidator: %s is required", name)
	}
	if !common.IsHexAddress(s) {
		return common.Address{}, fmt.Errorf("liquidator: %s %q is not a valid address", name, s)
	}
	return common.HexToAddress(s), nil
}

func parseOptionalAddress(s string) (common.Address, error) {
	s = strings.TrimSpace(s)
	if s == "" {
		return common.Address{}, nil
	}
	if !common.IsHexAddress(s) {
		return common.Address{}, fmt.Errorf("liquidator: %q is not a valid address", s)
	}
	return common.HexToAddress(s), nil
}

func parseUint(s string) uint64 {
	n, _ := strconv.ParseUint(strings.TrimSpace(s), 10, 64)
	return n
}

func parseInt(s string, def int) int {
	n, err := strconv.Atoi(strings.TrimSpace(s))
	if err != nil || n <= 0 {
		return def
	}
	return n
}

func parseDuration(s string, def time.Duration) time.Duration {
	if strings.TrimSpace(s) == "" {
		return def
	}
	d, err := time.ParseDuration(s)
	if err != nil || d <= 0 {
		return def
	}
	return d
}

func parseBigWei(s string) *big.Int {
	s = strings.TrimSpace(s)
	if s == "" {
		return nil
	}
	n, ok := new(big.Int).SetString(s, 10)
	if !ok || n.Sign() < 0 {
		return nil
	}
	return n
}

func defaultString(s, def string) string {
	if s == "" {
		return def
	}
	return s
}
