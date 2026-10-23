import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function parseEnvKeys(content: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx !== -1) {
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim();
      map.set(key, val);
    }
  }
  return map;
}

describe("GAP-79 Environment Variables & Contract Address Parity", () => {
  const rootDir = resolve(__dirname, "..");
  const rootEnv = parseEnvKeys(readFileSync(resolve(rootDir, ".env.example"), "utf8"));
  const backendEnv = parseEnvKeys(readFileSync(resolve(rootDir, "backend/.env.example"), "utf8"));
  const contractsEnv = parseEnvKeys(readFileSync(resolve(rootDir, "contracts/.env.example"), "utf8"));

  it("documents all deployed Monad Testnet contracts in root .env.example", () => {
    const expectedContracts: Record<string, string> = {
      NEXT_PUBLIC_KOLIANCE_ADDRESS: "0x32fDd6B096EE14246b5b6971135286Bad01F4928",
      NEXT_PUBLIC_KOL_TOKEN_ADDRESS: "0x4cadb6f0e1b83ccb7207db4786b2a1500f066328",
      NEXT_PUBLIC_PERP_USDC: "0x8a5008E2755A428d914cA13E92E6bB91123Bb5FC",
      NEXT_PUBLIC_PERP_ORACLE: "0x84e16cE1389D009A250510c6cFa13f36863430b7",
      NEXT_PUBLIC_PERP_VAULT: "0x9c32622699394ac1493d5b76ab96c04068c806d7",
      NEXT_PUBLIC_PERP_POSITION_MANAGER: "0x82040c06da6efc60e9505f2efee0099e909b15c5",
      SESSION_KEY_REGISTRY: "0xCb7f48F455a19778fC75afb0564aaA88b64FA004",
    };

    for (const [key, addr] of Object.entries(expectedContracts)) {
      expect(rootEnv.has(key), `Missing ${key} in root .env.example`).toBe(true);
      expect(rootEnv.get(key)?.toLowerCase()).toBe(addr.toLowerCase());
    }
  });

  it("documents PR #46 fail-closed server authentication variables in root .env.example", () => {
    const requiredServerKeys = [
      "KOLIANCE_SESSION_SECRET",
      "KOLIANCE_ALLOWED_ORIGINS",
      "NEXT_PUBLIC_SITE_URL",
      "SUPABASE_URL",
      "SUPABASE_SERVICE_ROLE_KEY",
      "GITHUB_CLIENT_SECRET",
      "GOOGLE_CLIENT_SECRET",
      "NEXT_PUBLIC_GO_BACKEND_URL",
    ];

    for (const key of requiredServerKeys) {
      expect(rootEnv.has(key), `Missing required server key ${key} in root .env.example`).toBe(true);
    }
  });

  it("documents security, CORS, and liquidator keys in backend/.env.example", () => {
    const requiredBackendKeys = [
      "DATABASE_URL",
      "ALPACA_API_KEY",
      "ALPACA_API_SECRET",
      "KOLIANCE_API_TOKEN",
      "CORS_ALLOWED_ORIGINS",
      "LIQUIDATOR_RPC",
      "LIQUIDATOR_WS",
      "LIQUIDATOR_POSITION_MANAGER",
      "LIQUIDATOR_DEMO_ORACLE",
    ];

    for (const key of requiredBackendKeys) {
      expect(backendEnv.has(key), `Missing ${key} in backend/.env.example`).toBe(true);
    }
  });

  it("documents chain ID and wiring addresses in contracts/.env.example", () => {
    const requiredContractKeys = [
      "PRIVATE_KEY",
      "ETHERSCAN_API_KEY",
      "RPC_URL",
      "CHAIN_ID",
      "POSITION_MANAGER",
      "SESSION_KEY_REGISTRY",
    ];

    for (const key of requiredContractKeys) {
      expect(contractsEnv.has(key), `Missing ${key} in contracts/.env.example`).toBe(true);
    }
  });
});
