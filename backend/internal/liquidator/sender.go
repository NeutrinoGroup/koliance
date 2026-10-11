package liquidator

import (
	"context"
	"crypto/ecdsa"
	"fmt"
	"math/big"
	"strings"

	"github.com/ethereum/go-ethereum/accounts/abi/bind"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/ethclient"

	"github.com/koliance/backend/internal/chain/bindings"
	"github.com/koliance/backend/internal/perp/nonce"
)

// Sender broadcasts liquidate() transactions for the liquidator EOA.
type Sender struct {
	client *ethclient.Client
	bnd    *bindings.IPositionManager
	// opts is the base TransactOpts (From + Signer). Nonce is filled per call
	// from the local manager immediately before broadcast.
	opts     *bind.TransactOpts
	nonce    *nonce.Manager
	from     common.Address
	gasPrice *big.Int
	gasLimit uint64
}

// NewSender binds the PositionManager to the write backend and builds the
// keyed transactor. The client may be nil (tests, or callers that only inspect
// the resulting opts); broadcasting then fails cleanly.
func NewSender(client *ethclient.Client, chainID *big.Int, key *ecdsa.PrivateKey, mgr *nonce.Manager, contract common.Address, gasPrice *big.Int, gasLimit uint64) (*Sender, error) {
	bnd, err := bindings.NewIPositionManager(contract, client)
	if err != nil {
		return nil, fmt.Errorf("liquidator: bind position manager: %w", err)
	}
	opts, err := bind.NewKeyedTransactorWithChainID(key, chainID)
	if err != nil {
		return nil, fmt.Errorf("liquidator: transact opts: %w", err)
	}
	return &Sender{
		client:   client,
		bnd:      bnd,
		opts:     opts,
		nonce:    mgr,
		from:     opts.From,
		gasPrice: gasPrice,
		gasLimit: gasLimit,
	}, nil
}

// Liquidate broadcasts one liquidate() call for ids with pythUpdateData.
//
// The nonce is allocated from the local manager immediately before broadcast —
// never at batch-construction time — so an abandoned batch cannot burn a nonce
// (nonce/manager.go:63-66). On a "nonce too low" rejection the manager resyncs
// forward to the chain's confirmed nonce, because that signal means some other
// process sharing the key advanced the chain past us.
func (s *Sender) Liquidate(ctx context.Context, ids []*big.Int, updates [][]byte) (common.Hash, error) {
	n, err := s.nonce.Allocate()
	if err != nil {
		return common.Hash{}, err
	}

	opts := *s.opts
	opts.Nonce = new(big.Int).SetUint64(n)
	opts.GasLimit = s.gasLimit
	if s.gasPrice != nil {
		opts.GasPrice = new(big.Int).Set(s.gasPrice)
	}

	session := &bindings.IPositionManagerSession{
		Contract:     s.bnd,
		CallOpts:     bind.CallOpts{Context: ctx},
		TransactOpts: opts,
	}

	tx, err := session.Liquidate(ids, updates)
	if err != nil {
		if isNonceTooLow(err) {
			if seed, e := s.client.NonceAt(ctx, s.from, nil); e == nil {
				s.nonce.Resync(seed)
			}
		}
		return common.Hash{}, fmt.Errorf("liquidator: liquidate %d positions: %w", len(ids), err)
	}
	return tx.Hash(), nil
}

// isNonceTooLow reports whether a broadcast error is the node's "nonce too low"
// rejection, the trigger for resyncing the local counter forward.
func isNonceTooLow(err error) bool {
	if err == nil {
		return false
	}
	return strings.Contains(strings.ToLower(err.Error()), "nonce too low")
}
