# Change 093: Hermes signed update review

Synchronize the branch with main and document the signed-update slice of GAP-39 without claiming production readiness. Add regression coverage at the broadcast boundary for missing Hermes data, unchanged signed update bytes, and demo-mode behavior. Correct comments to reflect the contract behavior: empty updates are skipped, updater failures are caught, and cached prices remain subject to freshness checks.

## Verification

Fresh reconstruction on 2026-11-04; prior session results do not certify this tree.

- Frontend type check and lint: PASS with existing warnings.
- Frontend initial run: 417/419 passed, two unrelated five-second timeouts under concurrent compilation. Rerun with two workers and a 60-second test timeout: PASS (39 files, 419 tests); no source test thresholds changed.
- Rust cargo test: PASS (8 tests).
- Contracts compile: PASS (20 Solidity files); type check and coverage suite in progress.
- Go vet/race: in progress with bounded parallelism.
- Production frontend build: pending the shared serial build slot.
- Independent review: no correctness/security blocker found; GAP-39 scope comment corrected.
- Historical full-history secret scanning still has findings. This PR must remain unmerged until required CI and review pass; no baseline suppression was introduced.
