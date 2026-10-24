---
title: "Architecting Verifiable Agent Cards and Parallel EVM Settlement for Autonomous AI Agents"
published: true
description: "A deep dive into building decentralized trust, EIP-712 session delegation, and sub-second solvency on Monad 10,000 TPS Parallel EVM with Koliance Protocol."
tags: "web3, ai, ethereum, solidity, blockchain"
canonical_url: "https://koliance.vercel.app/docs"
---

# Architecting Verifiable Agent Cards and Parallel EVM Settlement for Autonomous AI Agents

*By the Koliance Protocol Engineering Team (https://koliance.vercel.app)*

The software industry is experiencing a profound architectural shift: software is transitioning from human-operated tools to **autonomous AI agents acting as economic principals**.

Today, agents can write code, audit smart contracts, and analyze financial markets. However, deploying an agent to execute real financial actions introduces two major bottlenecks:
1. **The Trust Deficit**: How do external protocols verify that an agent has a legitimate operating history and reputation without compromising user privacy?
2. **The Key Exposure Vulnerability**: If an agent stores an unconstrained private key, any prompt injection or software bug can result in immediate, irreversible wallet drainage.

In this engineering breakdown, we walk through the architecture of **Koliance Protocol**—an open-source system designed to solve these bottlenecks on **Monad's 10,000 TPS Parallel EVM**.

---

## 1. Dynamic Neural Agent Cards: On-Chain Identity

To distinguish reputable agents from disposable Sybil bots, Koliance implements **Agent Cards**—on-chain dynamic neural identity passports (ERC-721 compatible).

### 1.1 Reputation Formulation
An agent's Neural Trust Score ($T_{score}$) is calculated deterministically on-chain:

$$T_{score} = \min\left(1000, \, 0.40 \cdot S_{solvency} + 0.30 \cdot S_{developer} + 0.20 \cdot S_{endorsements} + 0.10 \cdot S_{longevity}\right)$$

- **Solvency ($S_{solvency}$)**: Tracks historical trading solvency and absence of liquidation events.
- **Developer Attestation ($S_{developer}$)**: Cryptographically binds verified GitHub activity, commit history, and repository stars without exposing OAuth tokens.
- **Peer Endorsements ($S_{endorsements}$)**: Verifiable on-chain attestations from other Tier-2 or Tier-3 Agent Cards.

```solidity
function getTrustTier(address agent) external view returns (TrustTier) {
    uint16 score = agentCards[agent].trustScore;
    if (score >= 800) return TrustTier.SOVEREIGN;
    if (score >= 500) return TrustTier.REPUTABLE;
    if (score >= 200) return TrustTier.VERIFIED;
    return TrustTier.UNVERIFIED;
}
```

---

## 2. EIP-712 Session Key Delegation with Deterministic Ceilings

Rather than giving an autonomous runner root private keys, Koliance uses `SessionKeyRegistry.sol` (deployed on Monad Testnet at `0xCb7f01F6E9B9b33aC5161FEaA28eB8Ce3b5fB09D`).

```typescript
// EIP-712 Delegation Schema
const types = {
  SessionKeyDelegation: [
    { name: "agentAddress", type: "address" },
    { name: "maxPerTxUSD", type: "uint256" },
    { name: "dailyLimitUSD", type: "uint256" },
    { name: "validUntil", type: "uint256" },
    { name: "nonce", type: "uint256" },
  ],
};
```

### Safety Guarantees
- **Strict Caps**: Transactions exceeding `maxPerTxUSD` or cumulative 24h spending limits automatically revert on-chain.
- **Single-Transaction Circuit Breakers**: The owner wallet retains root veto authority. Calling `freezeSessionKey(agent)` halts all agent transactions immediately.

---

## 3. Why Monad Parallel EVM?

Sequential EVM chains (Ethereum, Arbitrum, Base) process transactions linearly. When dozens of agents execute trades simultaneously, gas fees surge and blocks fill up.

Monad re-engineers the EVM execution pipeline:
- **10,000 Transactions Per Second (TPS)**: Independent transactions execute in parallel across multiple CPU cores.
- **1-Second Deterministic Finality**: Eliminates reorg risks for high-frequency algorithmic balancing.
- **Sub-Cent Gas Fees (<$0.001)**: Enables viable micro-payments and frequent on-chain attestations.

---

## 4. Developer Quickstart

Developers can start testing immediately on Monad Testnet (Chain ID: 10143):

```bash
# 1. Query market pricing and verify quota
curl -X GET "https://koliance.vercel.app/api/market" \
  -H "Authorization: Bearer <YOUR_API_KEY>"
```

### Key Resources:
- **Official DApp**: https://koliance.vercel.app
- **Developer Documentation**: https://koliance.vercel.app/docs
- **Free Sandbox Quota ($0 Starter Pack)**: https://koliance.vercel.app/pricing
- **Open Source Codebase**: https://github.com/NeutrinoGroup/koliance (MIT License)
- **Comprehensive LLM Knowledge Base**: https://koliance.vercel.app/llms-full.txt
