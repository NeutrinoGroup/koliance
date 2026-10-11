package oracle

import (
	"context"
	"fmt"
	"math/big"
	"strings"

	ethereum "github.com/ethereum/go-ethereum"
	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/ethclient"
)

// ipriceOracleABI pins the frozen IPriceOracle.getPrice surface — the exact
// selector both DemoOracle and PythOracleAdapter implement (IPriceOracle.sol).
//
// It is a hand-kept single-method ABI rather than an abigen artifact on
// purpose: this package needs exactly one view function, and an abigen binding
// would drag in the whole bind/event machinery for a single call. The selector
// is pinned by a test so a re-freeze fails the build loudly instead of silently
// reading the wrong function.
const ipriceOracleABI = `[{"type":"function","name":"getPrice","inputs":[{"name":"feedId","type":"bytes32"}],"outputs":[{"name":"price","type":"uint256"},{"name":"publishTime","type":"uint256"}],"stateMutability":"view"}]`

// DemoPriceReader reads one feed's price from the on-chain DemoOracle. It is
// the seam where the demo feed stops depending on go-ethereum: tests inject a
// stub, and the only production implementation is ethDemoReader.
type DemoPriceReader interface {
	ReadPrice(ctx context.Context, feedID [32]byte) (price *big.Int, publishTime uint64, err error)
}

// ethDemoReader calls getPrice(bytes32) on the IPriceOracle contract at addr.
type ethDemoReader struct {
	cl   *ethclient.Client
	addr common.Address
	abi  abi.ABI
}

// NewEthDemoReader builds a chain-backed reader for the IPriceOracle at addr.
// The client may be nil (tests, or a caller that wires the reader before
// dialing); ReadPrice then fails cleanly rather than panicking.
func NewEthDemoReader(cl *ethclient.Client, addr common.Address) (DemoPriceReader, error) {
	if addr == (common.Address{}) {
		return nil, fmt.Errorf("oracle: demo oracle address is required (zero address would silently read nothing)")
	}
	parsed, err := abi.JSON(strings.NewReader(ipriceOracleABI))
	if err != nil {
		return nil, fmt.Errorf("oracle: parse IPriceOracle abi: %w", err)
	}
	return &ethDemoReader{cl: cl, addr: addr, abi: parsed}, nil
}

// ReadPrice calls getPrice and returns the 18-decimal price. A revert — e.g.
// DemoOracle.PriceNotSet for a feed nobody seeded — surfaces as an error, which
// the feed maps to "no price" so the position is skipped rather than guessed.
func (r *ethDemoReader) ReadPrice(ctx context.Context, feedID [32]byte) (*big.Int, uint64, error) {
	if r.cl == nil {
		return nil, 0, fmt.Errorf("oracle: nil ethclient")
	}
	data, err := r.abi.Pack("getPrice", feedID)
	if err != nil {
		return nil, 0, fmt.Errorf("oracle: pack getPrice: %w", err)
	}
	out, err := r.cl.CallContract(ctx, ethereum.CallMsg{To: &r.addr, Data: data}, nil)
	if err != nil {
		return nil, 0, fmt.Errorf("oracle: call getPrice(%s): %w", common.BytesToHash(feedID[:]).Hex(), err)
	}
	res, err := r.abi.Unpack("getPrice", out)
	if err != nil {
		return nil, 0, fmt.Errorf("oracle: unpack getPrice: %w", err)
	}
	price := new(big.Int).Set(res[0].(*big.Int))
	publishTime := res[1].(*big.Int)
	if !publishTime.IsUint64() {
		return nil, 0, fmt.Errorf("oracle: publishTime %s overflows uint64", publishTime.String())
	}
	return price, publishTime.Uint64(), nil
}
