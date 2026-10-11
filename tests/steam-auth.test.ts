import { describe, it, expect, vi, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/auth/steam/verify/route";

function req(body: object) {
  return new NextRequest("http://localhost:3000/api/auth/steam/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Steam OpenID Server-Side Verification", () => {
  it("rejects request when claimed_id is malformed or not 17 digits", async () => {
    const res = await POST(req({
      "openid.claimed_id": "https://steamcommunity.com/openid/id/12345",
      "openid.identity": "https://steamcommunity.com/openid/id/12345",
    }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.valid).toBe(false);
    expect(data.error).toMatch(/Invalid Steam OpenID/);
  });

  it("rejects request when claimed_id does not match identity", async () => {
    const res = await POST(req({
      "openid.claimed_id": "https://steamcommunity.com/openid/id/76561198034202275",
      "openid.identity": "https://steamcommunity.com/openid/id/76561198000000000",
    }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.valid).toBe(false);
    expect(data.error).toMatch(/mismatch/);
  });

  it("calls Steam check_authentication and accepts when is_valid:true", async () => {
    const fetchMock = vi.fn(async () => new Response("ns:http://specs.openid.net/auth/2.0\nis_valid:true\n", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const res = await POST(req({
      "openid.claimed_id": "https://steamcommunity.com/openid/id/76561198034202275",
      "openid.identity": "https://steamcommunity.com/openid/id/76561198034202275",
      "openid.sig": "test_sig",
    }));

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.valid).toBe(true);
    expect(data.steamId).toBe("76561198034202275");
    expect(data.synthetic).toBe(false);
    expect(fetchMock).toHaveBeenCalled();
  });

  it("rejects when Valve Steam server returns is_valid:false", async () => {
    const fetchMock = vi.fn(async () => new Response("ns:http://specs.openid.net/auth/2.0\nis_valid:false\n", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const res = await POST(req({
      "openid.claimed_id": "https://steamcommunity.com/openid/id/76561198034202275",
      "openid.identity": "https://steamcommunity.com/openid/id/76561198034202275",
      "openid.sig": "invalid_sig",
    }));

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.valid).toBe(false);
    expect(data.error).toMatch(/rejected/);
  });

  it("returns explicit synthetic: true and zero credit disclaimer for demo requests", async () => {
    const res = await POST(req({ demo: true, steamId: "76561198034202275" }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.valid).toBe(true);
    expect(data.synthetic).toBe(true);
    expect(data.dataCaveat).toMatch(/0 credit allocation/);
  });
});
