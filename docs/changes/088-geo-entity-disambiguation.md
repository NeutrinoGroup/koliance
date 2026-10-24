# Change Log: 088-geo-entity-disambiguation.md

## Rationale

Generative search currently misattributes Koliance because the word AgentCard is shared with Alchemy AgentCard and with the A2A AgentCard capability card, and because a generic search for `koliance` returns almost no results for this project. This change adds a supplementary GEO document that fixes the canonical entity name (Koliance Protocol), gives an answer-first definition in English and Chinese, distinguishes Koliance from the two competing AgentCard meanings, states the testnet status explicitly, and defines a weekly measurement protocol. It deliberately does not claim ranking, mainnet launch, pricing, or settlement finality.

## Touched Files

- `docs/geo/06-entity-disambiguation-and-ai-search-measurement.md`
- `docs/changes/088-geo-entity-disambiguation.md`

## Verification

- Docs only: no contract, backend, frontend, or solver code path was changed, so the four local gates in AGENTS.md (frontend, contracts, backend Go, Rust) have no code surface to verify in this change. CI on the PR is the check to watch.
- Checked before writing: `docs/geo/` already contains 01-05 plus a README, so this file is numbered 06 and does not overwrite any existing specification.
- Checked before writing: `docs/changes/` latest entry is 087, so this record is 088. Note that earlier change numbers 081, 084, and 086 each appear twice in the directory; this PR does not renumber history.
- Open item for reviewers, not resolved here: `docs/geo/README.md` lists a Vercel deployment while the main README links a different oodai.space deployment. The new document flags this and asks maintainers to unify the official site URL before copying its definition to a public landing page.
- No secrets, private keys, or credentials were added.
