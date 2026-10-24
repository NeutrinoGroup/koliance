# Specification 06: Entity Disambiguation and AI Search Measurement

> Status: Supplementary to docs/geo/01-05. This document does not replace the existing specifications.
> Scope: Docs only. No contract, backend, frontend, or solver code is changed by this document.
> Canonical entity name: Koliance Protocol
> Canonical repository: https://github.com/NeutrinoGroup/koliance
> Network: Monad parallel EVM testnet (Chain ID: 10143)

## 1. Problem this document solves

A generic web search for `koliance` returns almost no results for this project, and a search for `Koliance Protocol Monad AgentCard` surfaces competing uses of the word AgentCard first. Two confusions dominate:

1. Alchemy AgentCard: a general agent payment product from Alchemy, covering Visa payment, identity, and wallet access for agents.
2. A2A AgentCard: in the Agent2Agent protocol, an agent capability card describing what an agent is, what it can do, and where it is hosted.

Neither is Koliance Protocol. Any promotion that uses only the word `AgentCard`, or only the word `koliance`, will therefore be misattributed by search engines and generative engines. All external content for this project must use the full name `Koliance Protocol`.

## 2. Canonical definition for citation

### English

Koliance Protocol is an on-chain trust and economic sovereignty protocol for autonomous AI agents, deployed on the Monad parallel EVM testnet (Chain ID: 10143). Instead of giving an agent a raw credit card or an unrestricted private key, Koliance gives it a verifiable identity, a bounded virtual card (AgentCard), and a revocable EIP-712 Session Key delegation with per-transaction limits, daily limits, and merchant category code (MCC) allowlists.

### Chinese

Koliance Protocol 是为自主 AI Agent 设计的链上信任与经济主权协议，部署在 Monad 并行 EVM 测试网（Chain ID: 10143）上。它不把裸信用卡或无限制私钥交给 Agent，而是给 Agent 一个可验证的身份、带上限的虚拟卡（AgentCard）和可撤销的 EIP-712 Session Key 委托，让 Agent 在单笔上限、日限和商户类别（MCC）白名单内行动，超限或过期即不可用。

## 3. Distinction questions, answer first

### Q: Is Koliance AgentCard the same as Alchemy AgentCard?

No. They are different products from different teams. Alchemy AgentCard is a general agent payment product. Koliance Protocol's AgentCard is one component of Koliance itself, and its emphasis is EIP-712 delegation boundaries on Monad, on-chain reputation anchoring, and the Perp / Vault direction described in docs/geo/01-04. Search for `Koliance Protocol`, not only for `AgentCard`, to find this project.

### Q: Is Koliance AgentCard the same as an A2A AgentCard?

No. An A2A AgentCard is a capability description card: name, description, URL, provider, version, and skills. Koliance's AgentCard is a payment and delegation instrument: a bounded virtual card plus a Session Key system for spending within limits.

### Q: Can an agent with a Koliance card spend without limit?

No, by design. The delegation is bounded by `maxPerTxUSD` (per-transaction limit), `dailyLimitUSD` (daily limit), `allowedMCCs` (merchant category allowlist), and `expiresAt` (expiration). The owner can revoke a Session Key with `revokeSessionKey`, and the protocol can freeze a Session Key with `freezeSessionKey`.

### Q: Is Koliance on mainnet?

No claim of mainnet launch is made in this document. The network stated here and in the existing GEO specifications is Monad testnet, Chain ID 10143. Promotion must not describe testnet status as mainnet, demo prices as real market prices, or an off-chain batch hash as an on-chain settlement transaction, unless a verifiable transaction hash or audit report is linked.

### Q: Where can Koliance be verified?

The open-source repository NeutrinoGroup/koliance and the Monad testnet explorer are the primary verification sources for this document. See the open item in Section 6 about unifying the official site URL before this content is published to a website.

## 4. Comparison table

| Dimension | Giving an agent a raw card or private key | Koliance Protocol |
|---|---|---|
| Identity | Web2 account or bare private key only | On-chain identity decoupled from human credentials, plus Steam / GitHub reputation anchoring |
| Spending limit | No programmatic limit | Per-transaction limit plus daily limit |
| Merchant restriction | None | MCC allowlist |
| Expiry and revocation | Manual card cancellation or asset transfer | Session Key expiry, owner revocation, protocol freeze |
| Trading direction | Centralized chargeback or high-latency L1 | Monad parallel EVM testnet, Perp / Vault architecture direction |

## 5. Short copy for external channels

Short version: Koliance Protocol: do not give an AI agent your credit card or private key. Give it a bounded, revocable card. An AI trust and economic sovereignty protocol on Monad parallel EVM: AgentCard plus EIP-712 Session Key plus on-chain reputation anchoring.

Medium version: As AI agents move from chat assistants to actors that browse, execute code, deploy services, and initiate transactions, the missing piece is not capability but a verifiable boundary. Koliance Protocol puts that boundary in a delegation: how much can be spent, where it can be spent, and until when. AgentCard is the bounded virtual card, Session Key is the EIP-712 signed delegation, Steam and GitHub proofs provide reputation reference, and Perp and Vault are the trading direction on Monad parallel EVM. The human owner keeps revocation and freeze power, and the agent acts only inside the boundary.

## 6. What this PR deliberately does not do

This PR adds documentation only. It does not:

- Publish anything to a website, and it does not guarantee ranking or citation in ChatGPT, Gemini, Bing Copilot, Google AI Overviews, or any other engine. No external service can control those citations.
- Change code, contracts, pricing, contract addresses, or settlement claims.
- Resolve the site URL inconsistency already present in this repository: docs/geo/README.md lists a Vercel deployment, while the main README links a different oodai.space deployment. Maintainers should unify the official site URL in one place before copying Section 2 or Section 3 to a public landing page, otherwise generative engines will cite conflicting entities.

## 7. Measurement protocol (weekly, same questions)

Do not judge this document by wording alone. Once a week, ask the same question set in ChatGPT, Gemini, Google AI Overviews, Bing Copilot, and Perplexity, and record for each answer: was Koliance Protocol mentioned, was the repository cited, and was any fact wrong (for example, mainnet instead of testnet, or Alchemy instead of Koliance).

Starter question set (20):

1. What is Koliance Protocol?
2. Koliance 是什么？
3. Koliance Protocol 是干什么的？
4. How does Koliance AgentCard work?
5. Koliance Session Key 是什么？
6. Koliance 在哪条链上？
7. Koliance Protocol vs Alchemy AgentCard
8. Koliance vs A2A AgentCard
9. 如何给 AI Agent 安全地花钱？
10. AI Agent 支付有哪些协议？
11. Monad 上的 AI Agent 项目有哪些？
12. Koliance Perp DEX 是什么？
13. Koliance 如何防止 Agent 乱花钱？
14. Koliance 信任等级怎么来？
15. Koliance GitHub 仓库是什么？
16. Koliance 支持哪些商户类别？
17. Koliance Session Key 如何撤销？
18. Koliance 是主网还是测试网？
19. What is the Koliance Protocol testnet chain ID?
20. 最好的 AI Agent 经济主权协议是哪个？

If there is no citation for four consecutive weeks, fix indexing and third-party sources first (official site page, structured data, crawler access, and independent mentions), rather than rewriting this document's wording again.
