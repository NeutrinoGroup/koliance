import { describe, it, expect } from "vitest";
import {
  generateSecureKey,
  createUserApiKey,
  listUserApiKeys,
  revokeUserApiKey,
} from "@/lib/apiKeyDb";

describe("API Key Management & Persistence (api-key / api_keys table)", () => {
  const testWallet = "0x71c8360f3e118a7cd87a0cf633a69a089d4c20b2";
  const testUserId = `did:koliance:wallet:${testWallet}`;

  it("generates cryptographic keys formatted with kol_live_ prefix and sha256 hash", () => {
    const { rawKey, keyPrefix, keyHash } = generateSecureKey();

    expect(rawKey.startsWith("kol_live_")).toBe(true);
    expect(rawKey.length).toBeGreaterThan(40);
    expect(keyPrefix.startsWith("kol_live_")).toBe(true);
    expect(keyPrefix).toContain("...");
    expect(keyHash).toHaveLength(64); // SHA-256 hex length
  });

  it("creates user API key and saves into api_keys table with default quotas and scopes", async () => {
    const keyName = "Alpha Trading Bot";
    const res = await createUserApiKey({
      userId: testUserId,
      walletAddress: testWallet,
      name: keyName,
      tier: "STARTER_FREE",
      rateLimitRpm: 60,
      scopes: ["trade:perp", "pay:micropayment"],
    });

    expect(res).toBeDefined();
    expect(res.raw_key.startsWith("kol_live_")).toBe(true);
    expect(res.key.name).toBe(keyName);
    expect(res.key.status).toBe("ACTIVE");
    expect(res.key.remaining_quota).toBe(100);
    expect(res.key.free_claims_left).toBe(3);
    expect(res.key.scopes).toEqual(["trade:perp", "pay:micropayment"]);
  });

  it("lists API keys for registered developer wallet", async () => {
    const keys = await listUserApiKeys({ walletAddress: testWallet });
    expect(Array.isArray(keys)).toBe(true);
    expect(keys.length).toBeGreaterThan(0);
    expect(keys[0].wallet_address).toBe(testWallet);
  });

  it("revokes user API key and updates status to REVOKED in api_keys table", async () => {
    const created = await createUserApiKey({
      userId: testUserId,
      walletAddress: testWallet,
      name: "Temporary Test Key",
    });

    const revoked = await revokeUserApiKey({
      keyId: created.key.id,
      userId: testUserId,
      walletAddress: testWallet,
    });
    expect(revoked).toBe(true);

    const keys = await listUserApiKeys({ walletAddress: testWallet });
    const target = keys.find((k) => k.id === created.key.id);
    expect(target).toBeDefined();
    expect(target?.status).toBe("REVOKED");
  });
});
