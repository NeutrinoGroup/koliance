package oracle

import (
	"context"
	"math/big"
	"testing"

	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/crypto"
)

func testAddr() common.Address {
	return common.HexToAddress("0x1111111111111111111111111111111111111111")
}

// The selector must be pinned to the frozen IPriceOracle signature: if the
// interface re-freezes, this fails loudly instead of silently reading a
// different function.
func TestIPriceOracleSelectorPinned(t *testing.T) {
	r, err := NewEthDemoReader(nil, testAddr())
	if err != nil {
		t.Fatal(err)
	}
	er := r.(*ethDemoReader)

	sel := er.abi.Methods["getPrice"].ID
	hash := crypto.Keccak256Hash([]byte("getPrice(bytes32)"))
	want := hash[:4]
	if len(sel) != 4 {
		t.Fatalf("selector length = %d, want 4", len(sel))
	}
	for i := range sel {
		if sel[i] != want[i] {
			t.Fatalf("selector %x does not match keccak of frozen signature (want %x)", sel, want)
		}
	}
}

func TestNewEthDemoReaderValidatesAddress(t *testing.T) {
	if _, err := NewEthDemoReader(nil, common.Address{}); err == nil {
		t.Error("zero address accepted")
	}
}

// The output decode path — exactly what ReadPrice does after CallContract — is
// exercised without a node by packing the method's outputs and unpacking them
// through the same ABI.
func TestEthDemoReaderUnpackValues(t *testing.T) {
	r, err := NewEthDemoReader(nil, testAddr())
	if err != nil {
		t.Fatal(err)
	}
	er := r.(*ethDemoReader)

	price := usd18(180)
	publishTime := big.NewInt(1_700_000_000)
	data, err := er.abi.Methods["getPrice"].Outputs.Pack(price, publishTime)
	if err != nil {
		t.Fatalf("pack outputs: %v", err)
	}

	res, err := er.abi.Unpack("getPrice", data)
	if err != nil {
		t.Fatalf("unpack outputs: %v", err)
	}
	if len(res) != 2 {
		t.Fatalf("unpacked %d outputs, want 2", len(res))
	}
	if got := res[0].(*big.Int); got.Cmp(price) != 0 {
		t.Errorf("price = %s, want %s", got, price)
	}
	if got := res[1].(*big.Int); got.Cmp(publishTime) != 0 {
		t.Errorf("publishTime = %s, want %s", got, publishTime)
	}
}

func TestEthDemoReaderNilClientFailsClean(t *testing.T) {
	r, err := NewEthDemoReader(nil, testAddr())
	if err != nil {
		t.Fatal(err)
	}
	if _, _, err := r.ReadPrice(context.Background(), [32]byte{}); err == nil {
		t.Error("nil client ReadPrice did not fail")
	}
}
