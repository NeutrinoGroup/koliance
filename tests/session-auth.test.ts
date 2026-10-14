import { describe, it, expect, vi, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { createSessionToken, verifySessionToken, isValidWalletAddress } from "@/lib/session";
import { corsHeadersFor } from "@/lib/cors";
import { GET as challengeGET, POST as walletPOST } from "@/app/api/auth/wallet/route";
import { listUserApiKeys } from "@/lib/apiKeyDb";

describe("issue #35 session tokens", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("round-trips and rejects tampering / expiry", () => {
    const t = createSessionToken({ userId: "did:koliance:google:1", walletAddress: null });
    expect(verifySessionToken(t)).toEqual({ userId: "did:koliance:google:1", walletAddress: null });
    expect(verifySessionToken(t + "x")).toBeNull();
    expect(verifySessionToken("did:koliance:google:1")).toBeNull();
    expect(verifySessionToken(createSessionToken({ userId: "u", walletAddress: null }, -1))).toBeNull();
  });

  it("fails closed when the secret is missing", () => {
    vi.stubEnv("KOLIANCE_SESSION_SECRET", "");
    expect(() => createSessionToken({ userId: "u", walletAddress: null })).toThrow(/KOLIANCE_SESSION_SECRET/);
  });

  it("validates wallet format", () => {
    expect(isValidWalletAddress("0x89205a3a3b2a69de6dbf7f01ed13b2108b2c43e7")).toBe(true);
    expect(isValidWalletAddress("x,user_id.neq.0")).toBe(false);
    expect(isValidWalletAddress("0x89205a3a3b2a69de6dbf7f01ed13b2108b2c43e7,user_id.neq.0")).toBe(false);
  });

  it("restricts CORS to configured origins", () => {
    vi.stubEnv("KOLIANCE_ALLOWED_ORIGINS", "https://koliance.oodai.space");
    const ok = corsHeadersFor(new Request("http://x", { headers: { origin: "https://koliance.oodai.space" } }), "GET");
    const bad = corsHeadersFor(new Request("http://x", { headers: { origin: "https://evil.example" } }), "GET");
    expect(ok["Access-Control-Allow-Origin"]).toBe("https://koliance.oodai.space");
    expect(bad["Access-Control-Allow-Origin"]).toBeUndefined();
  });

  it("listUserApiKeys refuses filter-injection wallet strings", async () => {
    expect(await listUserApiKeys({ walletAddress: "x,user_id.neq.0" })).toEqual([]);
  });
});

describe("issue #35 wallet sign-in route", () => {
  const account = privateKeyToAccount(generatePrivateKey());
  const addr = account.address;

  async function challenge(address: string) {
    const res = await challengeGET(new NextRequest(`http://localhost/api/auth/wallet?address=${address}`));
    return { status: res.status, json: await res.json() };
  }
  const post = (body: unknown) =>
    walletPOST(new NextRequest("http://localhost/api/auth/wallet", { method: "POST", body: JSON.stringify(body) }));

  it("issues a wallet-bound session for a valid signature", async () => {
    const { json } = await challenge(addr);
    const signature = await account.signMessage({ message: json.message });
    const res = await post({ address: addr, challenge: json.challenge, signature });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(verifySessionToken(data.sessionToken)).toEqual({
      userId: `did:koliance:wallet:${addr.toLowerCase()}`,
      walletAddress: addr.toLowerCase(),
    });
  });

  it("rejects a signature from another wallet and a challenge for another address", async () => {
    const other = privateKeyToAccount(generatePrivateKey());
    const { json } = await challenge(addr);
    const badSig = await other.signMessage({ message: json.message });
    expect((await post({ address: addr, challenge: json.challenge, signature: badSig })).status).toBe(401);
    const goodSig = await account.signMessage({ message: json.message });
    expect((await post({ address: other.address, challenge: json.challenge, signature: goodSig })).status).toBe(401);
  });

  it("rejects malformed addresses", async () => {
    expect((await challenge("0xnotanaddress")).status).toBe(400);
  });
});
