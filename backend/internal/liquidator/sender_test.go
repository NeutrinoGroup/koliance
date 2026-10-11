package liquidator

import (
	"errors"
	"math/big"
	"testing"

	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/crypto"

	"github.com/koliance/backend/internal/perp/nonce"
)

func TestNewSenderTransactOpts(t *testing.T) {
	key, err := loadPrivateKey(testPrivateKeyHex)
	if err != nil {
		t.Fatal(err)
	}
	chainID := big.NewInt(10143)
	contract := common.HexToAddress("0x1111111111111111111111111111111111111111")
	mgr := nonce.NewManager(0)

	s, err := NewSender(nil, chainID, key, mgr, contract, nil, 0)
	if err != nil {
		t.Fatalf("NewSender: %v", err)
	}

	from := crypto.PubkeyToAddress(key.PublicKey)
	if s.opts.From != from {
		t.Errorf("opts.From = %s, want %s", s.opts.From.Hex(), from.Hex())
	}
	if s.opts.Signer == nil {
		t.Fatal("opts.Signer is nil")
	}

	// Sign a legacy transaction and recover the sender: the signer must produce
	// a transaction whose recovered address is the key's address.
	tx := types.NewTransaction(0, contract, big.NewInt(0), 21000, big.NewInt(1), nil)
	signed, err := s.opts.Signer(s.opts.From, tx)
	if err != nil {
		t.Fatalf("sign: %v", err)
	}
	got, err := types.Sender(types.LatestSignerForChainID(chainID), signed)
	if err != nil {
		t.Fatalf("recover sender: %v", err)
	}
	if got != from {
		t.Errorf("recovered sender = %s, want %s", got.Hex(), from.Hex())
	}
}

func TestIsNonceTooLow(t *testing.T) {
	cases := []struct {
		err  error
		want bool
	}{
		{nil, false},
		{errors.New("nonce too low"), true},
		{errors.New("replacement transaction underpriced: NONCE TOO LOW"), true},
		{errors.New("insufficient funds for gas"), false},
	}
	for _, tc := range cases {
		if got := isNonceTooLow(tc.err); got != tc.want {
			t.Errorf("isNonceTooLow(%v) = %v, want %v", tc.err, got, tc.want)
		}
	}
}
