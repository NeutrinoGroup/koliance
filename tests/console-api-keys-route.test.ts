import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST, DELETE } from "@/app/api/console/api-keys/route";

describe("Console API Keys Route (/api/console/api-keys)", () => {
  const testWallet = "0x89205a3a3b2a69de6dbf7f01ed13b2108b2c43e7";

  it("rejects unauthorized access when user is not registered or authenticated", async () => {
    const req = new NextRequest("http://localhost:3000/api/console/api-keys");
    const res = await GET(req);
    expect(res.status).toBe(401);

    const json = await res.json();
    expect(json.error).toBe("UNAUTHORIZED_REGISTRATION_REQUIRED");
  });

  it("creates user API key and saves into api_keys table when authenticated", async () => {
    const req = new NextRequest("http://localhost:3000/api/console/api-keys", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${testWallet}`,
      },
      body: JSON.stringify({
        wallet_address: testWallet,
        name: "My Custom Quant Key",
        tier: "STARTER_FREE",
        rate_limit_rpm: 120,
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(201);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.key).toBeDefined();
    expect(json.key.name).toBe("My Custom Quant Key");
    expect(json.raw_key.startsWith("kol_live_")).toBe(true);
  });

  it("lists API keys for authenticated registered developer", async () => {
    const req = new NextRequest(`http://localhost:3000/api/console/api-keys?wallet=${testWallet}`, {
      headers: {
        Authorization: `Bearer ${testWallet}`,
      },
    });

    const res = await GET(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(Array.isArray(json.keys)).toBe(true);
    expect(json.keys.length).toBeGreaterThan(0);
  });

  it("revokes an existing user API key", async () => {
    // 1. Create key
    const createReq = new NextRequest("http://localhost:3000/api/console/api-keys", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${testWallet}`,
      },
      body: JSON.stringify({
        wallet_address: testWallet,
        name: "Revocable Key",
      }),
    });
    const createRes = await POST(createReq);
    const createJson = await createRes.json();
    const keyId = createJson.key.id;

    // 2. Delete / Revoke key
    const delReq = new NextRequest(`http://localhost:3000/api/console/api-keys?key_id=${keyId}&wallet=${testWallet}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${testWallet}`,
      },
    });
    const delRes = await DELETE(delReq);
    expect(delRes.status).toBe(200);

    const delJson = await delRes.json();
    expect(delJson.success).toBe(true);
  });
});
