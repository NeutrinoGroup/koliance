import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/market/route";
import { POST } from "@/app/api/user/profile/route";
import * as db from "@/lib/db";

describe("Performance & Reliability Benchmarks", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", () => Promise.reject(new Error("offline in test")));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("[BENCHMARK] Market synthetic deterministic feed latency and throughput", async () => {
    const iterations = 50;
    const symbols = ["NVDA", "AAPL", "BTC-USD", "ETH-USD", "MON-USD"];
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      const sym = symbols[i % symbols.length];
      const req = new NextRequest(`http://localhost/api/market?symbol=${sym}&range=1mo&interval=1d`);
      const res = await GET(req);
      const data = await res.json();
      expect(data.synthetic).toBe(true);
      expect(data.chart.closes.length).toBeGreaterThan(0);
    }

    const duration = performance.now() - start;
    const avgLatencyMs = duration / iterations;

    // Structured logging indicator
    console.log(`[BENCHMARK] Market Feed Fallback: ${iterations} runs in ${duration.toFixed(2)}ms (avg: ${avgLatencyMs.toFixed(3)}ms/op)`);
    expect(avgLatencyMs).toBeLessThan(50); // Must be well within acceptable bounds
  });

  it("[BENCHMARK] Profile payload privilege stripping throughput", async () => {
    const syncSpy = vi.spyOn(db, "syncUserToDatabase").mockImplementation(async (payload, isTrusted) => {
      expect(isTrusted).toBe(false);
      expect((payload as any).trust_tier).toBeUndefined();
      expect((payload as any).credit_allowance_usd).toBeUndefined();
      return {
        id: payload.id,
        email: payload.email,
        name: payload.name,
        trust_tier: "TIER_0",
        credit_allowance_usd: 0,
      };
    });

    const iterations = 200;
    const maliciousPayload = {
      id: "alice_bench",
      email: "alice@example.com",
      address: "0x1234567890123456789012345678901234567890",
      username: "alice",
      trust_tier: "TIER_VIP",
      credit_allowance_usd: 1000000,
      avatar_url: "https://example.com/alice.png",
      bio: "Automated benchmark agent",
    };

    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      const req = new NextRequest("http://localhost/api/user/profile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          authorization: "Bearer alice_bench",
        },
        body: JSON.stringify(maliciousPayload),
      });

      const res = await POST(req);
      const body = await res.json();
      expect(res.status).toBe(200);
      expect(body.user.trust_tier).toBe("TIER_0");
      expect(body.user.credit_allowance_usd).toBe(0);
    }

    const duration = performance.now() - start;
    const avgLatencyMs = duration / iterations;
    console.log(`[BENCHMARK] Profile Privilege Stripping: ${iterations} runs in ${duration.toFixed(2)}ms (avg: ${avgLatencyMs.toFixed(3)}ms/op)`);
    expect(avgLatencyMs).toBeLessThan(20);
    expect(syncSpy).toHaveBeenCalledTimes(iterations);
  });
});

