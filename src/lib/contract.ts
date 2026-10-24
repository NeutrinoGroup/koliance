import { defineChain, http, fallback } from "viem";

// Single source of truth for the Monad Testnet read endpoints (issue #50).
//
// Order matters, and it is not cosmetic: `testnet-rpc.monad.xyz` MUST come
// first. `monad-testnet.drpc.org` answers `eth_chainId` but rejects
// `eth_call` / `eth_blockNumber` with -32601 ("method does not exist"), so as a
// *primary* read RPC it costs one guaranteed-failed round-trip on every
// contract read and spams the browser console with 400s. Components used to
// keep their own copies of this list with drpc first, which is exactly how the
// two orders drifted apart; they now call monadRpcTransport() below.
export const MONAD_RPC_URLS = [
  "https://testnet-rpc.monad.xyz",
  "https://monad-testnet.drpc.org",
] as const;

/**
 * A fresh viem transport for the Monad Testnet read endpoints.
 *
 * A function rather than a shared constant on purpose: each `createPublicClient`
 * call gets its own transport instance, so there is no cross-client state to
 * reason about. Prefer this over an inline `fallback([...])` so the endpoint set
 * and its order stay defined in exactly one place.
 *
 * Configured with resilient defaults: 10s per-call timeout, 3 automatic retries
 * with exponential backoff, and JSON-RPC batching support.
 */
export function monadRpcTransport(options?: {
  timeout?: number;
  retryCount?: number;
  retryDelay?: number;
  batch?: boolean;
}) {
  const timeout = options?.timeout ?? 10_000;
  const retryCount = options?.retryCount ?? 3;
  const retryDelay = options?.retryDelay ?? 500;
  const batch = options?.batch ?? true;

  return fallback(
    MONAD_RPC_URLS.map((url) =>
      http(url, {
        timeout,
        retryCount,
        retryDelay,
        batch,
      })
    ),
    { rank: false }
  );
}

// Monad Testnet Chain Definition
export const monadTestnet = defineChain({
  id: 10143,
  name: "Monad Testnet",
  nativeCurrency: {
    name: "Monad",
    symbol: "MON",
    decimals: 18,
  },
  rpcUrls: {
    default: { http: [...MONAD_RPC_URLS] },
    public: { http: [...MONAD_RPC_URLS] },
  },
  blockExplorers: {
    default: {
      name: "Monad Explorer",
      url: "https://testnet.monadexplorer.com",
    },
  },
  contracts: {
    multicall3: {
      address: "0xcA11bde05977b3631167028862bE2a173976CA11",
    },
  },
  testnet: true,
});

// Default contract address (can be overridden via NEXT_PUBLIC_KOLIANCE_ADDRESS in .env.local)
export const KOLIANCE_ADDRESS = (process.env.NEXT_PUBLIC_KOLIANCE_ADDRESS ||
  "0x32fDd6B096EE14246b5b6971135286Bad01F4928") as `0x${string}`;

// KolToken (KOL) deployed on Monad Testnet
export const KOL_TOKEN_ADDRESS = (process.env.NEXT_PUBLIC_KOL_TOKEN_ADDRESS ||
  "0x4cadb6f0e1b83ccb7207db4786b2a1500f066328") as `0x${string}`;

export const KOL_TOKEN_ABI = [
  {
    type: "function",
    name: "name",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
  },
  {
    type: "function",
    name: "symbol",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
  },
  {
    type: "function",
    name: "decimals",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
  {
    type: "function",
    name: "totalSupply",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "MAX_SUPPLY",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "claimBlockReward",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [{ name: "reward", type: "uint256" }],
  },
  {
    type: "function",
    name: "transfer",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "currentEra",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "currentRewardRatePerSecond",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "event",
    name: "Transfer",
    inputs: [
      { name: "from", type: "address", indexed: true },
      { name: "to", type: "address", indexed: true },
      { name: "value", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "BlockClaimed",
    inputs: [
      { name: "miner", type: "address", indexed: true },
      { name: "reward", type: "uint256", indexed: false },
      { name: "timestamp", type: "uint256", indexed: false },
    ],
  },
] as const;


// Koliance Contract ABI
export const KOLIANCE_ABI = [
  {
    type: "function",
    name: "register",
    stateMutability: "nonpayable",
    inputs: [{ name: "metadataHash", type: "string" }],
    outputs: [],
  },
  {
    type: "function",
    name: "addTrust",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "action", type: "string" },
      { name: "proof", type: "bytes32" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "identities",
    stateMutability: "view",
    inputs: [{ name: "", type: "address" }],
    outputs: [
      { name: "exists", type: "bool" },
      { name: "createdAt", type: "uint256" },
      { name: "metadataHash", type: "string" },
    ],
  },
  {
    type: "function",
    name: "records",
    stateMutability: "view",
    inputs: [{ name: "", type: "uint256" }],
    outputs: [
      { name: "from", type: "address" },
      { name: "to", type: "address" },
      { name: "action", type: "string" },
      { name: "proof", type: "bytes32" },
      { name: "timestamp", type: "uint256" },
    ],
  },
  {
    type: "function",
    name: "getRecordsCount",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "getAllRecords",
    stateMutability: "view",
    inputs: [],
    outputs: [
      {
        type: "tuple[]",
        components: [
          { name: "from", type: "address" },
          { name: "to", type: "address" },
          { name: "action", type: "string" },
          { name: "proof", type: "bytes32" },
          { name: "timestamp", type: "uint256" },
        ],
      },
    ],
  },
  {
    type: "event",
    name: "IdentityRegistered",
    inputs: [
      { name: "user", type: "address", indexed: true },
      { name: "timestamp", type: "uint256", indexed: false },
      { name: "metadataHash", type: "string", indexed: false },
    ],
  },
  {
    type: "event",
    name: "TrustAdded",
    inputs: [
      { name: "from", type: "address", indexed: true },
      { name: "to", type: "address", indexed: true },
      { name: "action", type: "string", indexed: false },
      { name: "proof", type: "bytes32", indexed: false },
      { name: "timestamp", type: "uint256", indexed: false },
    ],
  },
] as const;

export interface IdentityData {
  exists: boolean;
  createdAt: bigint;
  metadataHash: string;
}

export interface TrustRecordData {
  from: `0x${string}`;
  to: `0x${string}`;
  action: string;
  proof: `0x${string}`;
  timestamp: bigint;
}
