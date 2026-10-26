package liquidator

import (
	"context"
	"fmt"
	"log/slog"
	"math/big"
	"time"

	"github.com/ethereum/go-ethereum/accounts/abi/bind"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/ethereum/go-ethereum/ethclient"

	"github.com/koliance/backend/internal/chain"
	"github.com/koliance/backend/internal/chain/bindings"
	"github.com/koliance/backend/internal/liquidation"
	"github.com/koliance/backend/internal/oracle"
	"github.com/koliance/backend/internal/perp/nonce"
	"github.com/koliance/backend/internal/perp/position"
)

// UpdateProvider supplies the pythUpdateData bytes for one feed. The demo path
// (DemoOracle) returns nothing: PositionManager.priceUpdater is zero, so
// _pushPrices no-ops before reading the on-chain DemoOracle price
// (PositionManager.sol:790-793). The Hermes path returns the signed update
// fetched from Hermes immediately before the transaction (GAP-39).
type UpdateProvider func(ctx context.Context, feedID string) [][]byte

// noUpdates is the demo-path UpdateProvider.
func noUpdates(context.Context, string) [][]byte { return nil }

// Bot is the assembled liquidator: an event-indexed position table, a price
// feed, and a transaction sender over a local nonce manager.
type Bot struct {
	cfg     Config
	log     *slog.Logger
	chain   *chain.Client // event indexer (backfill + subscribe)
	write   *ethclient.Client
	table   *position.Table
	feed    oracle.PriceFeed
	mmrBps  uint64
	sender  *Sender
	nonce   *nonce.Manager
	updates UpdateProvider
	handler chain.EventHandler

	// obs is the observation store for the dashboard endpoint. It is a
	// side-channel: nil when DATABASE_URL is unset, and its failures are logged
	// rather than propagated into the liquidation loop.
	obs liquidation.Store

	// watermark is the committed lastProcessedBlock (in-memory mirror of the
	// persisted file; advanced atomically only at backfill commit points).
	watermark uint64
}

// New dials the chain and write clients, reads the frozen parameters, seeds the
// nonce manager from the confirmed nonce, builds the sender and the price feed,
// and loads the watermark. Any failure here is fatal and closes the resources
// opened so far.
//
// obs is the optional liquidation observation store (nil = observation
// disabled, log only); it is deliberately not fatal to pass nil or for the
// store to fail later, because observation is a side-channel, not the main path.
func New(ctx context.Context, cfg Config, log *slog.Logger, obs liquidation.Store) (*Bot, error) {
	if log == nil {
		log = slog.Default()
	}

	key, err := loadPrivateKey(cfg.PrivateKeyHex)
	if err != nil {
		return nil, err
	}

	cl, err := chain.New(ctx, chain.Network{
		RPC:             cfg.RPC,
		WS:              cfg.WS,
		ChainID:         cfg.ChainID,
		ContractAddress: cfg.PositionManager,
	})
	if err != nil {
		return nil, err
	}

	write, err := ethclient.DialContext(ctx, cfg.RPC)
	if err != nil {
		cl.Close()
		return nil, fmt.Errorf("liquidator: dial write rpc %s: %w", cfg.RPC, err)
	}

	mmrBps, err := readMaintenanceMarginBps(ctx, write, cfg.PositionManager)
	if err != nil {
		cl.Close()
		write.Close()
		return nil, err
	}

	from := crypto.PubkeyToAddress(key.PublicKey)
	seed, err := write.NonceAt(ctx, from, nil)
	if err != nil {
		cl.Close()
		write.Close()
		return nil, fmt.Errorf("liquidator: read confirmed nonce for %s: %w", from.Hex(), err)
	}
	mgr := nonce.NewManager(seed)

	sender, err := NewSender(write, cfg.ChainID, key, mgr, cfg.PositionManager, cfg.GasPriceWei, cfg.GasLimit)
	if err != nil {
		cl.Close()
		write.Close()
		return nil, err
	}

	feed, closeFeed, err := buildFeed(ctx, cfg, write)
	if err != nil {
		cl.Close()
		write.Close()
		return nil, err
	}
	_ = closeFeed // DemoFeed built with the shared write client: no separate close.

	wm, err := LoadWatermark(cfg.WatermarkPath)
	if err != nil {
		cl.Close()
		write.Close()
		return nil, err
	}

	table := position.NewTable()

	// Hermes mode must not fall back to noUpdates: on a Pyth deployment
	// an empty pythUpdateData reverts on chain, so a silent fallback
	// would turn every liquidation attempt into a wasted transaction.
	// The feed built above is a *oracle.HermesFeed in hermes mode;
	// in any other mode, or with a non-Hermes feed, keep noUpdates and
	// let scanAndLiquidate skip hermes batches with no data.
	updates := UpdateProvider(noUpdates)
	if cfg.Feed == "hermes" {
		if hf, ok := feed.(*oracle.HermesFeed); ok {
			updates = func(ctx context.Context, feedID string) [][]byte {
				data, err := hf.UpdateData(ctx, feedID)
				if err != nil {
					return nil
				}
				return data
			}
		}
	}

	b := &Bot{
		cfg:       cfg,
		log:       log,
		chain:     cl,
		write:     write,
		table:     table,
		feed:      feed,
		mmrBps:    mmrBps,
		sender:    sender,
		nonce:     mgr,
		updates:   updates,
		obs:       obs,
		watermark: wm,
	}
	b.handler = tableHandler{table: table}
	return b, nil
}

// Close releases the chain and write clients.
func (b *Bot) Close() {
	b.chain.Close()
	b.write.Close()
}

// Run does the initial backfill, then runs the indexer and price loops until
// ctx is cancelled or either loop fails.
func (b *Bot) Run(ctx context.Context) error {
	b.log.Info("liquidator starting",
		"chain_id", b.cfg.ChainID.String(),
		"position_manager", b.cfg.PositionManager.Hex(),
		"feed", b.cfg.Feed,
		"watermark", b.watermark,
		"start_block", b.cfg.StartBlock,
		"mmr_bps", b.mmrBps,
		"nonce_seed", b.nonce.Peek(),
	)

	// Initial backfill before anything else so the first scan sees the book
	// (启动 → Backfill → Subscribe → tick).
	if err := b.catchUp(ctx); err != nil {
		return fmt.Errorf("liquidator: initial backfill: %w", err)
	}

	errCh := make(chan error, 2)
	go func() { errCh <- b.indexLoop(ctx) }()
	go func() { errCh <- b.priceLoop(ctx) }()

	select {
	case <-ctx.Done():
		return ctx.Err()
	case err := <-errCh:
		return err
	}
}

// catchUp backfills [from, head] into the table and commits the watermark.
//
// It is the only place the watermark advances: after a full range is applied,
// the watermark is atomically persisted (tmp+rename). Subscribe-driven events
// are idempotent (position.ApplyOpen/ApplyClose), so re-backfilling an already
// live-processed range on reconnect is harmless — the no-loss guarantee comes
// from always re-pulling from watermark+1 (ADR-005 §5.3).
func (b *Bot) catchUp(ctx context.Context) error {
	head, err := b.write.BlockNumber(ctx)
	if err != nil {
		return fmt.Errorf("liquidator: read head: %w", err)
	}

	from := b.watermark + 1
	if from < b.cfg.StartBlock {
		from = b.cfg.StartBlock
	}
	if from > head {
		// Chain reset or reorg below the committed watermark: start over from
		// the deployment block rather than wedging on an impossible range.
		b.log.Warn("head below watermark, resetting to start block",
			"head", head, "watermark", b.watermark, "start_block", b.cfg.StartBlock)
		from = b.cfg.StartBlock
	}

	if from <= head {
		if err := b.chain.Backfill(ctx, from, head, b.handler); err != nil {
			return fmt.Errorf("liquidator: backfill [%d, %d]: %w", from, head, err)
		}
		b.watermark = head
		if err := SaveWatermark(b.cfg.WatermarkPath, head); err != nil {
			return err
		}
		b.log.Info("backfilled", "from", from, "to", head, "positions", b.table.Len())
	}
	return nil
}

// indexLoop subscribes to live events and reconnects with exponential backoff.
// On every reconnect it backfills the outage gap before resubscribing, closing
// the window the WS drop opened (ADR-005 §5.3).
func (b *Bot) indexLoop(ctx context.Context) error {
	delay := b.cfg.BackoffBase
	for {
		sessionStart := time.Now()
		err := b.chain.Subscribe(ctx, b.handler)
		if ctx.Err() != nil {
			return ctx.Err()
		}
		b.log.Warn("ws subscription dropped", "err", err, "uptime", time.Since(sessionStart))

		// A session that stayed up for the healthy threshold resets the
		// backoff; a flapping one doubles it.
		if time.Since(sessionStart) >= b.cfg.HealthyThreshold {
			delay = b.cfg.BackoffBase
		}
		if !sleepCtx(ctx, delay) {
			return ctx.Err()
		}
		delay = nextBackoff(delay, b.cfg.BackoffMax)

		// Backfill the outage gap before resubscribing.
		if err := b.catchUp(ctx); err != nil {
			if ctx.Err() != nil {
				return ctx.Err()
			}
			b.log.Error("backfill after reconnect failed", "err", err)
		}
	}
}

// priceLoop scans the table on every tick and liquidates what breached the
// maintenance margin.
func (b *Bot) priceLoop(ctx context.Context) error {
	ticker := time.NewTicker(b.cfg.TickInterval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-ticker.C:
			b.scanAndLiquidate(ctx)
		}
	}
}

// scanAndLiquidate runs one Scan → per-feed-batch → per-chunk liquidate pass.
func (b *Bot) scanAndLiquidate(ctx context.Context) {
	ctx, cancel := context.WithTimeout(ctx, b.cfg.TxTimeout)
	defer cancel()

	batches, skipped := b.table.Scan(b.mmrBps, oracle.AsPriceLookup(ctx, b.feed))
	if len(skipped) > 0 {
		b.log.Warn("positions skipped: no price", "count", len(skipped), "ids", skipped)
	}

	for _, batch := range batches {
		ids := toBigIntIDs(batch.PositionIDs)
		updates := b.updates(ctx, batch.FeedID)
		if b.cfg.Feed == "hermes" && len(updates) == 0 {
			b.log.Error("skipping liquidation: no hermes update data", "feed", batch.FeedID, "count", len(ids))
			continue
		}
		for _, chunk := range chunkIDs(ids, b.cfg.MaxPositionsPerCall) {
			hash, err := b.sender.Liquidate(ctx, chunk, updates)
			if err != nil {
				b.log.Error("liquidate failed", "feed", batch.FeedID, "count", len(chunk), "err", err)
				continue
			}
			b.log.Info("liquidate submitted", "feed", batch.FeedID, "count", len(chunk), "tx", hash.Hex())
			b.recordLiquidation(ctx, batch, chunk, hash)
		}
	}

	// Saturation: how far ahead of the chain the local nonce counter is. A
	// persistently rising value means transactions are not landing (ADR-005 §5.5).
	b.log.Info("scan complete",
		"positions", b.table.Len(),
		"batches", len(batches),
		"skipped", len(skipped),
		"nonce_issued", b.nonce.Issued(),
		"nonce_next", b.nonce.Peek(),
	)
}

// recordLiquidation persists one successfully submitted liquidate() chunk as one
// observation event per position. It is a side-channel: a nil store is a no-op,
// and any store failure (including a timeout) degrades to a warning log so the
// observation path can never block or fail the liquidation loop.
func (b *Bot) recordLiquidation(ctx context.Context, batch position.Batch, chunk []*big.Int, txHash common.Hash) {
	if b.obs == nil {
		return
	}

	events := make([]liquidation.Event, 0, len(chunk))
	for _, id := range chunk {
		events = append(events, liquidation.Event{
			PositionID: id.Uint64(),
			FeedID:     batch.FeedID,
			ExitPrice:  batch.MarkPrice.String(),
			TxHash:     txHash.Hex(),
		})
	}

	// One bounded round-trip for the whole chunk, regardless of its size, so a
	// hung DB can stall the loop by at most ObsWriteTimeout per submission.
	wctx, cancel := context.WithTimeout(ctx, b.cfg.ObsWriteTimeout)
	defer cancel()
	if err := b.obs.Record(wctx, events); err != nil {
		b.log.Warn("liquidation events not persisted",
			"feed", batch.FeedID, "count", len(events), "tx", txHash.Hex(), "err", err)
	}
}

// tableHandler feeds chain events into the position table. HandleLiquidated
// maps to ApplyClose: both remove the position from the open set.
type tableHandler struct {
	table *position.Table
}

func (h tableHandler) HandleOpened(p *position.Position) { h.table.ApplyOpen(p) }
func (h tableHandler) HandleClosed(id uint64)            { h.table.ApplyClose(id) }
func (h tableHandler) HandleLiquidated(id uint64)        { h.table.ApplyClose(id) }

// HandleFundingAccrued keeps the per-feed index the scanner values funding
// against. Dropping it — which is what happened before GAP-41 — makes every
// verdict funding-free, so a position the contract would liquidate on cost of
// carry alone reads as healthy here.
func (h tableHandler) HandleFundingAccrued(feedID string, index *big.Int) {
	h.table.ApplyFundingIndex(feedID, index)
}

// buildFeed selects the price source. The demo feed reuses the shared write
// client rather than dialing a fourth connection.
func buildFeed(ctx context.Context, cfg Config, write *ethclient.Client) (oracle.PriceFeed, func(), error) {
	switch cfg.Feed {
	case "hermes":
		return oracle.NewHermesFeed(cfg.HermesURL, nil), func() {}, nil
	case "demo":
		if cfg.DemoOracle == (common.Address{}) {
			return nil, nil, fmt.Errorf("liquidator: LIQUIDATOR_DEMO_ORACLE is required when LIQUIDATOR_FEED=demo")
		}
		r, err := oracle.NewEthDemoReader(write, cfg.DemoOracle)
		if err != nil {
			return nil, nil, err
		}
		return oracle.NewDemoFeed(r), func() {}, nil
	default:
		return nil, nil, fmt.Errorf("liquidator: unknown LIQUIDATOR_FEED %q (want demo or hermes)", cfg.Feed)
	}
}

// readMaintenanceMarginBps reads the maintenance margin from the contract
// rather than hardcoding it: the deployed instance is the never-stale source
// (ADR-005 §6).
func readMaintenanceMarginBps(ctx context.Context, write *ethclient.Client, contract common.Address) (uint64, error) {
	caller, err := bindings.NewIPositionManagerCaller(contract, write)
	if err != nil {
		return 0, fmt.Errorf("liquidator: bind mmr reader: %w", err)
	}
	mmr, err := caller.MaintenanceMarginBps(&bind.CallOpts{Context: ctx})
	if err != nil {
		return 0, fmt.Errorf("liquidator: read maintenanceMarginBps: %w", err)
	}
	if !mmr.IsUint64() {
		return 0, fmt.Errorf("liquidator: maintenanceMarginBps %s overflows uint64", mmr.String())
	}
	return mmr.Uint64(), nil
}

// nextBackoff doubles delay up to max. A zero or negative delay is treated as
// the base second rather than doubled, so the schedule never emits zero.
func nextBackoff(delay, max time.Duration) time.Duration {
	if delay <= 0 {
		return time.Second
	}
	if d := delay * 2; d <= max {
		return d
	}
	return max
}

// sleepCtx sleeps for d or until ctx is done. It reports whether the sleep
// completed (true) rather than being cut short by cancellation (false).
func sleepCtx(ctx context.Context, d time.Duration) bool {
	t := time.NewTimer(d)
	defer t.Stop()
	select {
	case <-ctx.Done():
		return false
	case <-t.C:
		return true
	}
}
