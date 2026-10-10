package chain

import (
	"context"
	"errors"
	"math/big"
	"testing"

	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/crypto"

	"github.com/koliance/backend/internal/chain/bindings"
	"github.com/koliance/backend/internal/perp/position"
)

type stubChainID struct {
	id  *big.Int
	err error
}

func (s stubChainID) ChainID(context.Context) (*big.Int, error) { return s.id, s.err }

func TestValidateChainID(t *testing.T) {
	ctx := context.Background()
	want := big.NewInt(10143)

	if err := validateChainID(ctx, stubChainID{id: big.NewInt(10143)}, want); err != nil {
		t.Errorf("matching chain id failed: %v", err)
	}
	if err := validateChainID(ctx, stubChainID{id: big.NewInt(143)}, want); err == nil {
		t.Errorf("mismatched chain id did not fail")
	}
	if err := validateChainID(ctx, stubChainID{err: errors.New("boom")}, want); err == nil {
		t.Errorf("chain id read error did not propagate")
	}
}

func TestNetworkValidate(t *testing.T) {
	base := Network{
		RPC:             "http://rpc",
		WS:              "ws://ws",
		ChainID:         big.NewInt(10143),
		ContractAddress: common.HexToAddress("0x1111111111111111111111111111111111111111"),
	}
	if err := base.Validate(); err != nil {
		t.Errorf("valid network rejected: %v", err)
	}

	for name, mutate := range map[string]func(*Network){
		"missing rpc":           func(n *Network) { n.RPC = "" },
		"missing ws":            func(n *Network) { n.WS = "" },
		"zero chain id":         func(n *Network) { n.ChainID = big.NewInt(0) },
		"nil chain id":          func(n *Network) { n.ChainID = nil },
		"zero contract address": func(n *Network) { n.ContractAddress = common.Address{} },
	} {
		n := base
		mutate(&n)
		if err := n.Validate(); err == nil {
			t.Errorf("%s: expected validation error", name)
		}
	}
}

// The topics must be pinned to the frozen event signatures: if the interface
// re-freezes with a changed signature, this test fails until it is updated.
func TestEventTopicsPinnedToFrozenSignatures(t *testing.T) {
	opened, closed, liquidated, err := eventTopics()
	if err != nil {
		t.Fatal(err)
	}

	sigs := map[common.Hash]string{
		opened:     "PositionOpened(uint256,address,bytes32,uint256,uint256,uint256,bool)",
		closed:     "PositionClosed(uint256,address,uint256,int256)",
		liquidated: "PositionLiquidated(uint256,address,address,uint256,uint256)",
	}
	if len(sigs) != 3 {
		t.Fatalf("topics not distinct: opened=%s closed=%s liquidated=%s", opened.Hex(), closed.Hex(), liquidated.Hex())
	}
	for topic, sig := range sigs {
		if want := crypto.Keccak256Hash([]byte(sig)); topic != want {
			t.Errorf("topic %s does not match keccak of frozen signature %q (got %s)", topic.Hex(), sig, want.Hex())
		}
	}
}

type recordingHandler struct {
	opened     []*position.Position
	closed     []uint64
	liquidated []uint64
}

func (h *recordingHandler) HandleOpened(p *position.Position) { h.opened = append(h.opened, p) }
func (h *recordingHandler) HandleClosed(id uint64)            { h.closed = append(h.closed, id) }
func (h *recordingHandler) HandleLiquidated(id uint64)        { h.liquidated = append(h.liquidated, id) }

// testClient builds a Client with a nil backend: Parse only needs the ABI,
// never a live node, and blockTime is stubbed.
func testClient(t *testing.T) *Client {
	t.Helper()
	addr := common.HexToAddress("0x2222222222222222222222222222222222222222")
	bnd, err := bindings.NewIPositionManager(addr, nil)
	if err != nil {
		t.Fatalf("NewIPositionManager(nil backend): %v", err)
	}
	opened, closed, liquidated, err := eventTopics()
	if err != nil {
		t.Fatal(err)
	}
	return &Client{
		cfg:             Network{ContractAddress: addr},
		bnd:             bnd,
		maxProfitBps:    big.NewInt(10_000),
		openedTopic:     opened,
		closedTopic:     closed,
		liquidatedTopic: liquidated,
		blockTime: func(context.Context, uint64) (uint64, error) {
			return 1_700_000_000, nil
		},
	}
}

func openedLog(t *testing.T, addr common.Address, id int64, owner common.Address, feed [32]byte, collateral, size, entry *big.Int, isLong bool) types.Log {
	t.Helper()
	parsed, err := bindings.IPositionManagerMetaData.GetAbi()
	if err != nil {
		t.Fatal(err)
	}
	ev := parsed.Events["PositionOpened"]
	data, err := ev.Inputs.NonIndexed().Pack(collateral, size, entry, isLong)
	if err != nil {
		t.Fatalf("pack PositionOpened data: %v", err)
	}
	return types.Log{
		Address: addr,
		Topics: []common.Hash{
			ev.ID,
			common.BigToHash(big.NewInt(id)),
			common.BytesToHash(owner.Bytes()),
			common.BytesToHash(feed[:]),
		},
		Data:        data,
		BlockNumber: 1234,
	}
}

func TestDispatchOpened(t *testing.T) {
	c := testClient(t)
	h := &recordingHandler{}
	owner := common.HexToAddress("0x1111111111111111111111111111111111111111")
	feed := feedBytes()

	log := openedLog(t, c.cfg.ContractAddress, 7, owner, feed, usd(1000), usd(10000), usd(180), true)
	if err := c.dispatch(context.Background(), log, h); err != nil {
		t.Fatalf("dispatch: %v", err)
	}
	if len(h.opened) != 1 {
		t.Fatalf("opened count = %d, want 1", len(h.opened))
	}

	p := h.opened[0]
	if p.ID != 7 {
		t.Errorf("ID = %d, want 7", p.ID)
	}
	if p.Owner != owner.Hex() {
		t.Errorf("Owner = %s, want %s", p.Owner, owner.Hex())
	}
	if p.FeedID != common.BytesToHash(feed[:]).Hex() {
		t.Errorf("FeedID = %s, want %s", p.FeedID, common.BytesToHash(feed[:]).Hex())
	}
	if p.CollateralUSD.Cmp(usd(1000)) != 0 {
		t.Errorf("CollateralUSD = %s, want %s", p.CollateralUSD, usd(1000))
	}
	if p.SizeUSD.Cmp(usd(10000)) != 0 {
		t.Errorf("SizeUSD = %s, want %s", p.SizeUSD, usd(10000))
	}
	if p.EntryPrice.Cmp(usd(180)) != 0 {
		t.Errorf("EntryPrice = %s, want %s", p.EntryPrice, usd(180))
	}
	if !p.IsLong {
		t.Errorf("IsLong = false, want true")
	}
	// payoutCap = 1000 + 10000*10000/10000 = 11000.
	if p.PayoutCapUSD.Cmp(usd(11000)) != 0 {
		t.Errorf("PayoutCapUSD = %s, want %s", p.PayoutCapUSD, usd(11000))
	}
	if p.OpenedAt != 1_700_000_000 {
		t.Errorf("OpenedAt = %d, want 1700000000", p.OpenedAt)
	}
}

func TestDispatchClosedAndLiquidated(t *testing.T) {
	c := testClient(t)
	h := &recordingHandler{}
	owner := common.HexToAddress("0x1111111111111111111111111111111111111111")
	liquidator := common.HexToAddress("0x3333333333333333333333333333333333333333")

	parsed, err := bindings.IPositionManagerMetaData.GetAbi()
	if err != nil {
		t.Fatal(err)
	}

	closedEv := parsed.Events["PositionClosed"]
	closedData, err := closedEv.Inputs.NonIndexed().Pack(usd(190), big.NewInt(0))
	if err != nil {
		t.Fatalf("pack PositionClosed: %v", err)
	}
	closedLog := types.Log{
		Address: c.cfg.ContractAddress,
		Topics: []common.Hash{
			closedEv.ID,
			common.BigToHash(big.NewInt(7)),
			common.BytesToHash(owner.Bytes()),
		},
		Data: closedData,
	}
	if err := c.dispatch(context.Background(), closedLog, h); err != nil {
		t.Fatalf("dispatch closed: %v", err)
	}

	liquidatedEv := parsed.Events["PositionLiquidated"]
	liquidatedData, err := liquidatedEv.Inputs.NonIndexed().Pack(usd(0), usd(50))
	if err != nil {
		t.Fatalf("pack PositionLiquidated: %v", err)
	}
	liquidatedLog := types.Log{
		Address: c.cfg.ContractAddress,
		Topics: []common.Hash{
			liquidatedEv.ID,
			common.BigToHash(big.NewInt(9)),
			common.BytesToHash(owner.Bytes()),
			common.BytesToHash(liquidator.Bytes()),
		},
		Data: liquidatedData,
	}
	if err := c.dispatch(context.Background(), liquidatedLog, h); err != nil {
		t.Fatalf("dispatch liquidated: %v", err)
	}

	if len(h.closed) != 1 || h.closed[0] != 7 {
		t.Errorf("closed = %v, want [7]", h.closed)
	}
	if len(h.liquidated) != 1 || h.liquidated[0] != 9 {
		t.Errorf("liquidated = %v, want [9]", h.liquidated)
	}
}

// An unknown topic must fail loud, never be dropped silently.
func TestDispatchUnknownTopic(t *testing.T) {
	c := testClient(t)
	h := &recordingHandler{}
	log := types.Log{Address: c.cfg.ContractAddress, Topics: []common.Hash{common.HexToHash("0xdeadbeef")}}

	if err := c.dispatch(context.Background(), log, h); err == nil {
		t.Errorf("unknown topic did not fail")
	}
}

func TestFilterQuery(t *testing.T) {
	c := testClient(t)

	q := c.filterQuery(new(big.Int).SetUint64(10), new(big.Int).SetUint64(20))
	if len(q.Addresses) != 1 || q.Addresses[0] != c.cfg.ContractAddress {
		t.Errorf("Addresses = %v, want [%s]", q.Addresses, c.cfg.ContractAddress.Hex())
	}
	if len(q.Topics) != 1 || len(q.Topics[0]) != 3 {
		t.Fatalf("Topics = %v, want exactly one OR group of 3", q.Topics)
	}
	if q.Topics[0][0] != c.openedTopic || q.Topics[0][1] != c.closedTopic || q.Topics[0][2] != c.liquidatedTopic {
		t.Errorf("Topics[0] = %v, want [opened closed liquidated]", q.Topics[0])
	}
	if q.FromBlock == nil || q.FromBlock.Cmp(big.NewInt(10)) != 0 {
		t.Errorf("FromBlock = %v, want 10", q.FromBlock)
	}
	if q.ToBlock == nil || q.ToBlock.Cmp(big.NewInt(20)) != 0 {
		t.Errorf("ToBlock = %v, want 20", q.ToBlock)
	}

	live := c.filterQuery(nil, nil)
	if live.FromBlock != nil || live.ToBlock != nil {
		t.Errorf("live query bounds = %v, %v; want nil, nil", live.FromBlock, live.ToBlock)
	}
}
