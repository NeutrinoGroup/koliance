import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, POST } from "@/app/api/user/profile/route";
import { NextRequest } from "next/server";
import * as db from "@/lib/db";

describe("User Profile Security & Privilege Stripping", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("disallows arbitrary email query in GET", async () => {
    const req = new NextRequest("http://localhost:3000/api/user/profile?email=alice@example.com", {
      method: "GET",
    });

    const res = await GET(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/Arbitrary queries by email or wallet are disallowed/);
  });

  it("disallows arbitrary wallet query in GET", async () => {
    const req = new NextRequest("http://localhost:3000/api/user/profile?wallet=0x1234567890abcdef", {
      method: "GET",
    });

    const res = await GET(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/Arbitrary queries by email or wallet are disallowed/);
  });

  it("rejects unauthenticated GET requests", async () => {
    const req = new NextRequest("http://localhost:3000/api/user/profile?id=user_123", {
      method: "GET",
    });

    const res = await GET(req);
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toMatch(/Authentication required/);
  });

  it("rejects authenticated user attempting to view someone else's profile", async () => {
    const req = new NextRequest("http://localhost:3000/api/user/profile?id=victim_user", {
      method: "GET",
      headers: {
        authorization: "Bearer attacker_user",
      },
    });

    const res = await GET(req);
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toMatch(/Forbidden/);
  });

  it("allows user to view their own profile when authenticated", async () => {
    vi.spyOn(db, "fetchUserFromDatabase").mockResolvedValueOnce({
      id: "alice_user",
      email: "alice@example.com",
      name: "Alice",
      trust_tier: "GOOGLE VERIFIED CITIZEN",
      credit_allowance_usd: 600,
    });

    const req = new NextRequest("http://localhost:3000/api/user/profile?id=alice_user", {
      method: "GET",
      headers: {
        authorization: "Bearer alice_user",
      },
    });

    const res = await GET(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.user.id).toBe("alice_user");
  });

  it("rejects unauthenticated POST requests", async () => {
    const req = new NextRequest("http://localhost:3000/api/user/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: "alice_user",
        email: "alice@example.com",
        name: "Alice Hacked",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toMatch(/Authentication required/);
  });

  it("rejects authenticated user attempting to update someone else's profile", async () => {
    const req = new NextRequest("http://localhost:3000/api/user/profile", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        authorization: "Bearer attacker_user",
      },
      body: JSON.stringify({
        id: "victim_user",
        email: "victim@example.com",
        name: "Victim Hacked",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toMatch(/Forbidden/);
  });

  it("strips trust_tier and credit_allowance_usd from user-controlled profile updates", async () => {
    const syncSpy = vi.spyOn(db, "syncUserToDatabase").mockImplementation(async (payload, isTrusted) => {
      expect(isTrusted).toBe(false);
      expect((payload as any).trust_tier).toBeUndefined();
      expect((payload as any).credit_allowance_usd).toBeUndefined();
      return {
        id: payload.id,
        email: payload.email,
        name: payload.name,
        trust_tier: "GOOGLE VERIFIED CITIZEN",
        credit_allowance_usd: 600,
      };
    });

    const req = new NextRequest("http://localhost:3000/api/user/profile", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        authorization: "Bearer alice_user",
      },
      body: JSON.stringify({
        id: "alice_user",
        email: "alice@example.com",
        name: "Alice Modified",
        trust_tier: "ILLEGAL_SUPER_ADMIN",
        credit_allowance_usd: 9999999,
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(syncSpy).toHaveBeenCalled();
    expect(data.user.trust_tier).toBe("GOOGLE VERIFIED CITIZEN");
    expect(data.user.credit_allowance_usd).toBe(600);
  });
});
