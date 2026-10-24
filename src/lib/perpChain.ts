import {
  createPublicClient,
  createWalletClient,
  custom,
  defineChain,
  fallback,
  http,
  type Chain,
  type PublicClient,
  type WalletClient,
} from "viem";
import { privateKeyToAccount, type PrivateKeyAccount } from "viem/accounts";
import { monadTestnet, monadRpcTransport } from "@/lib/contract";

/**
 * Which chain the perp module (/perp, PositionPanel, DemoControlPanel) talks to.
 *
 * Default: Monad testnet (10143) — nothing changes unless the env says so.
 *
 * Local rehearsal / recording against `npx hardhat node`:
 *   NEXT_PUBLIC_PERP_CHAIN=local
 *   NEXT_PUBLIC_PERP_RPC_URL=http://127.0.0.1:8545     (default for local)
 *   NEXT_PUBLIC_PERP_CHAIN_ID=31337                    (default for local)
 *   NEXT_PUBLIC_PERP_LOCAL_DEV_KEY=0x...               (optional, see below)
 *
 * NEXT_PUBLIC_PERP_LOCAL_DEV_KEY lets the page sign with a Hardhat dev account
 * instead of a browser wallet, so the demo can be driven on a machine without
 * MetaMask. It is honoured ONLY in local mode, and it ends up in the client
 * bundle — use the publicly known Hardhat test keys, never a real key.
 */
export const PERP_IS_LOCAL = process.env.NEXT_PUBLIC_PERP_CHAIN === "local";

export const PERP_RPC_URL =
  process.env.NEXT_PUBLIC_PERP_RPC_URL ||
  (PERP_IS_LOCAL ? "http://127.0.0.1:8545" : "https://testnet-rpc.monad.xyz");

const localChain = defineChain({
  id: Number(process.env.NEXT_PUBLIC_PERP_CHAIN_ID || 31337),
  name: "Local Hardhat",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [PERP_RPC_URL] } },
  testnet: true,
});

export const perpChain: Chain = PERP_IS_LOCAL ? localChain : monadTestnet;

/** Explorer link for a perp tx, or null on a local chain (no explorer). */
export function perpTxUrl(hash: string): string | null {
  if (PERP_IS_LOCAL) return null;
  return `${monadTestnet.blockExplorers.default.url}/tx/${hash}`;
}

/** Read client. Uses resilient fallback transport across Monad endpoints with automatic retries and timeouts. */
export function createPerpPublicClient(): PublicClient {
  const transport = PERP_IS_LOCAL
    ? http(PERP_RPC_URL, { timeout: 10_000, retryCount: 2, batch: true })
    : process.env.NEXT_PUBLIC_PERP_RPC_URL
    ? fallback(
        [
          http(process.env.NEXT_PUBLIC_PERP_RPC_URL, {
            timeout: 10_000,
            retryCount: 3,
            retryDelay: 500,
            batch: true,
          }),
          monadRpcTransport({ timeout: 10_000, retryCount: 3, batch: true }),
        ],
        { rank: false }
      )
    : monadRpcTransport({ timeout: 10_000, retryCount: 3, batch: true });

  return createPublicClient({
    chain: perpChain,
    transport,
    batch: { multicall: !PERP_IS_LOCAL },
  }) as PublicClient;
}

const devKey = process.env.NEXT_PUBLIC_PERP_LOCAL_DEV_KEY as `0x${string}` | undefined;

/** Hardhat dev signer for local mode, when configured. Never active on Monad. */
export const perpLocalDevAccount: PrivateKeyAccount | null =
  PERP_IS_LOCAL && devKey ? privateKeyToAccount(devKey) : null;

/**
 * Write client for `account`: the local dev signer when it matches, otherwise
 * the injected browser wallet. Null when neither is available.
 */
export function createPerpWalletClient(account: `0x${string}` | null): WalletClient | null {
  if (!account) return null;
  if (perpLocalDevAccount && perpLocalDevAccount.address.toLowerCase() === account.toLowerCase()) {
    return createWalletClient({ account: perpLocalDevAccount, chain: perpChain, transport: http(PERP_RPC_URL) });
  }
  if (typeof window === "undefined" || !window.ethereum) return null;
  return createWalletClient({ account, chain: perpChain, transport: custom(window.ethereum) });
}
