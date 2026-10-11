// Package bindings holds the abigen-generated IPositionManager contract
// binding. It is the one place the go-ethereum ABI/event machinery is allowed
// to live, and it does not leak go-ethereum types past the internal/chain
// boundary (the chain package converts them into pure position.Position
// values before anything else sees them).
//
// The binding is generated from the frozen interface
// (contracts/contracts/perp/interfaces/IPositionManager.sol) and is committed
// deliberately: it is a build artifact, but committing it keeps the build
// offline and gives a compile-time error if a consumer and the frozen ABI
// drift apart (ADR-005).
//
// Regenerate after the interface re-freezes (see the FROZEN SURFACE list at
// the top of IPositionManager.sol). The ABI snapshot next to this file is the
// input; refresh it from the contracts artifact first:
//
//	cd contracts && npx hardhat compile
//	# then copy the "abi" field of
//	#   artifacts/contracts/perp/interfaces/IPositionManager.sol/IPositionManager.json
//	# into ipositionmanager.abi.json (UTF-8, no BOM)
//	cd ../backend && go generate ./internal/chain/bindings
package bindings

//go:generate go run github.com/ethereum/go-ethereum/cmd/abigen@v1.16.9 --abi ipositionmanager.abi.json --pkg bindings --type IPositionManager --out ipositionmanager.go
