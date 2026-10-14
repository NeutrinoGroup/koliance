import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST, DELETE, OPTIONS } from "@/app/api/console/api-keys/route";
import { createSessionToken } from "@/lib/session";

describe("Console API Keys Route (/api/console/api-keys) - issue #35 P0-1", () => {
  const testWallet = "0x89205a3a3b2a69de6dbf7f01ed13b2108b2c43e7";
  const victimWallet = "0x71c8360f3e118a7cd87a0cf633a69a089d4c20b2";
  const token = createSessionToken({ userId: `did:koliance:wallet:${testWallet}`, walletAddress: testWallet });
  const victimToken = createSessionToken({ userId: `did:koliance:wallet:${victimWallet}`, walletAddress: victimWallet });
  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

  const create = async (t: string, body: Record<string, unknown> = {}) =>
    POST(
      new NextRequest("http://localhost:3000/api/console/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...auth(t) },
        body: JSON.stringify(body),
      })
    );

  it("rejects requests without a session token", async () => {
    const res = await GET(new NextRequest("http://localhost:3000/api/console/api-keys"));
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe("UNAUTHORIZED_REGISTRATION_REQUIRED");
  });

  it("ignores spoofable identity sources (query, X-User-Id, X-Wallet-Address, cookie, raw wallet bearer)", async () => {
    const spoofs: NextRequest[] = [
      new NextRequest(`http://localhost:3000/api/console/api-keys?wallet=${victimWallet}`),
      new NextRequest(`http://localhost:3000/api/console/api-keys?user_id=did:koliance:wallet:${victimWallet}`),
      new NextRequest("http://localhost:3000/api/console/api-keys", { headers: { "X-User-Id": `did:koliance:wallet:${victimWallet}` } }),
      new NextRequest("http://localhost:3000/api/console/api-keys", { headers: { "X-Wallet-Address": victimWallet } }),
      new NextRequest("http://localhost:3000/api/console/api-keys", { headers: { cookie: `koliance_user_id=did:koliance:wallet:${victimWallet}` } }),
      new NextRequest("http://localhost:3000/api/console/api-keys", { headers: auth(victimWallet) }),
    ];
    for (const req of spoofs) {
      expect((await GET(req)).status).toBe(401);
    }
  });

  it("rejects a tampered session token", async () => {
    const [body, mac] = token.split(".");
    const forged = Buffer.from(JSON.stringify({ sub: `did:koliance:wallet:${victimWallet}`, wallet: victimWallet, exp: 9999999999 })).toString("base64url");
    const res = await GET(new NextRequest("http://localhost:3000/api/console/api-keys", { headers: auth(`${forged}.${mac}`) }));
    expect(res.status).toBe(401);
    expect(body).toBeTruthy();
  });

  it("creates a key for the session identity, ignoring body user_id / wallet_address", async () => {
    const res = await create(token, {
      user_id: `did:koliance:wallet:${victimWallet}`,
      wallet_address: victimWallet,
      name: "My Custom Quant Key",
      tier: "SCALE_ULTRA",
      rate_limit_rpm: 100000,
    });
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.key.name).toBe("My Custom Quant Key");
    expect(json.key.user_id).toBe(`did:koliance:wallet:${testWallet}`);
    expect(json.key.wallet_address).toBe(testWallet);
    expect(json.key.tier).toBe("STARTER_FREE");
    expect(json.key.rate_limit_rpm).toBeLessThanOrEqual(60);
    expect(json.raw_key.startsWith("kol_live_")).toBe(true);
  }, 15000);

  it("lists only the caller's own keys", async () => {
    await create(victimToken, { name: "victim key" });
    const res = await GET(new NextRequest(`http://localhost:3000/api/console/api-keys?wallet=${victimWallet}`, { headers: auth(token) }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.keys.length).toBeGreaterThan(0);
    for (const k of json.keys) expect(k.wallet_address).toBe(testWallet);
  }, 15000);

  it("revokes own key but not someone else's", async () => {
    const victimKey = (await (await create(victimToken, { name: "Victim Key" })).json()).key.id;
    const attack = await DELETE(new NextRequest(`http://localhost:3000/api/console/api-keys?key_id=${victimKey}&wallet=${victimWallet}`, { method: "DELETE", headers: auth(token) }));
    expect(attack.status).toBe(404);

    const ownKey = (await (await create(token, { name: "Revocable Key" })).json()).key.id;
    const res = await DELETE(new NextRequest(`http://localhost:3000/api/console/api-keys?key_id=${ownKey}`, { method: "DELETE", headers: auth(token) }));
    expect(res.status).toBe(200);
    expect((await res.json()).success).toBe(true);
  }, 15000);

  it("does not answer CORS for arbitrary origins", async () => {
    const res = await OPTIONS(new NextRequest("http://localhost:3000/api/console/api-keys", { method: "OPTIONS", headers: { Origin: "https://evil.example" } }));
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
  });
});
