# 091 - Reject unverified identity proofs and card operations

Date: 2026-11-04. Scope: issue #55; replay design follow-up #80.

Steam and GitHub service failures previously returned invented profile statistics and credit. The browser generated random developer proof hashes after failed requests. These fallbacks are removed. Profile and repository responses must be valid; Steam API status, profile identity, and achievement success are checked. Proofs use a game from the verified library, reject absent explicit games, and permit appId zero to select the first owned game. Games without community-visible stats use verified playtime with zero achievement contribution. When stats are advertised but achievements unavailable, proof issuance fails closed; this can also reject games exposing stats without an achievements schema.

Missing identities return 400. Upstream failures return the existing ADR-006 503 UPSTREAM_UNAVAILABLE envelope without raw errors. Both proof UIs show a retry notice on failure.

The card console had a shared embedded session bearer, a synthetic transaction history entry, and failure paths claiming local payment success/cashback. No authenticated per-user card/session acquisition exists in this component. Remove the shared bearer and disable its freeze/payment actions with explicit unavailable-authorization notices. Do not mutate spending, rewards, or freeze state until real authorization exists. Removing a bearer from current source does not rotate it or erase history. Historical credential rotation and full-history secret scanning remain release requirements.

No x402 credential redemption handler was found in backend/src/contracts source. Issue #80 remains open as a design requirement: durable atomic credential consumption, request binding, concurrent replay rejection, and idempotent fulfillment must be implemented when that endpoint is introduced. This change does not claim replay protection for an absent endpoint.

Fresh reconstruction verification (this tree):

- Frontend TypeScript and Next lint pass (existing warnings). Vitest: 40 files, 423 tests pass with two workers and a 60-second CLI timeout; initial heavily concurrent runs hit unrelated five-second test timeouts.
- Contracts: 20 Solidity files compile with official SHA256-verified solc 0.8.31; TypeScript and 209 tests pass. Gated line coverage 88.92%, above 88% floor. Hardhat compiler-list download initially failed; ordinary curl populated the verified compiler cache.
- Go: GOMAXPROCS=2 go vet -p 2 ./... and go test -p 2 -race ./... pass, including offline HTTP503 and proof-integrity regressions.
- Rust cargo test passes (8 tests).
- Next production build is still running at draft publication; its final result must be recorded before readiness.
- Independent fresh code review passes after the Steam notice and achievement-error regression follow-up.
- Current changed-file snapshot: gitleaks dir clean, zero findings. Full history: 276 commits scanned, 10 historical findings remain (test/sample auth strings and the inherited card bearer). Do not merge while required secret CI remains red. Removing current source does not rotate historical credentials. No baseline suppression was added.

Prior environment results are not evidence for this reconstructed tree.
