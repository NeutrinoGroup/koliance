import { describe, it, expect, vi, afterEach } from "vitest";
import {
  parseApiError,
  classifyStatus,
  executeMarketTrade,
  closeMarketPosition,
  createStripeCheckout,
  authorizeMicropayment,
  fetchMarketOverviewChecked,
} from "@/lib/api";
import { GET as marketRouteHandler } from "@/app/api/market/route";
import { NextRequest } from "next/server";

describe("ADR-006 Frontend Error Envelope Handling", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe("parseApiError", () => {
    it("parses standard ADR-006 envelope: code, error, requestId", async () => {
      const mockRes = new Response(
        JSON.stringify({
          code: "INVALID_REQUEST",
          error: "invalid request parameters or payload format",
          requestId: "req_test_123",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );

      const parsed = await parseApiError(mockRes);
      expect(parsed.rawStatus).toBe(400);
      expect(parsed.code).toBe("INVALID_REQUEST");
      expect(parsed.error).toBe("invalid request parameters or payload format");
      expect(parsed.requestId).toBe("req_test_123");
    });

    it("parses developer/agent envelope with errorCode", async () => {
      const mockRes = new Response(
        JSON.stringify({
          code: 400,
          errorCode: "INVALID_PROOF",
          error: "cryptographic proof verification failed: invalid proof",
          requestId: "req_dev_456",
          response: "cryptographic proof verification failed: invalid proof",
          data: null,
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );

      const parsed = await parseApiError(mockRes);
      expect(parsed.code).toBe("INVALID_PROOF");
      expect(parsed.error).toBe("cryptographic proof verification failed: invalid proof");
      expect(parsed.requestId).toBe("req_dev_456");
    });

    it("falls back to X-Request-Id header when body lacks requestId", async () => {
      const mockRes = new Response(
        JSON.stringify({
          code: "UNAUTHORIZED",
          error: "authentication required or credentials invalid",
        }),
        {
          status: 401,
          headers: {
            "Content-Type": "application/json",
            "X-Request-Id": "header_req_789",
          },
        }
      );

      const parsed = await parseApiError(mockRes);
      expect(parsed.code).toBe("UNAUTHORIZED");
      expect(parsed.error).toBe("authentication required or credentials invalid");
      expect(parsed.requestId).toBe("header_req_789");
    });

    it("handles non-JSON error body gracefully with status and header requestId", async () => {
      const mockRes = new Response("Bad Gateway HTML / proxy failure", {
        status: 502,
        headers: {
          "Content-Type": "text/html",
          "X-Request-Id": "proxy_req_999",
        },
      });

      const parsed = await parseApiError(mockRes);
      expect(parsed.rawStatus).toBe(502);
      expect(parsed.error).toBe("HTTP 502");
      expect(parsed.code).toBeUndefined();
      expect(parsed.requestId).toBe("proxy_req_999");
    });
  });

  describe("executeMarketTrade", () => {
    it("returns order data on HTTP 200 success", async () => {
      const successPayload = {
        success: true,
        order: {
          id: "ord_1001",
          symbol: "NVDA",
          status: "filled",
          side: "buy",
          notional: "400.00",
        },
        message: "Order placed successfully",
        symbol: "NVDA",
        side: "buy",
        notionalUSD: 400,
      };

      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(
          new Response(JSON.stringify(successPayload), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          })
        )
      );

      const res = await executeMarketTrade("NVDA", "buy", 100, 4);
      expect(res.success).toBe(true);
      expect(res.order?.id).toBe("ord_1001");
      expect(res.error).toBeUndefined();
    });

    it("retains code, error, and requestId on HTTP 400 INVALID_REQUEST", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(
          new Response(
            JSON.stringify({
              code: "INVALID_REQUEST",
              error: "invalid request parameters or payload format",
              requestId: "req_trade_err_1",
            }),
            {
              status: 400,
              headers: { "Content-Type": "application/json" },
            }
          )
        )
      );

      const res = await executeMarketTrade("NVDA", "buy", -10, 4);
      expect(res.success).toBe(false);
      expect(res.code).toBe("INVALID_REQUEST");
      expect(res.error).toBe("invalid request parameters or payload format");
      expect(res.requestId).toBe("req_trade_err_1");
    });

    it("retains code, error, and requestId on HTTP 503 SERVICE_NOT_CONFIGURED", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(
          new Response(
            JSON.stringify({
              code: "SERVICE_NOT_CONFIGURED",
              error: "service credentials are not configured on this deployment",
              requestId: "req_trade_err_503",
            }),
            {
              status: 503,
              headers: { "Content-Type": "application/json" },
            }
          )
        )
      );

      const res = await executeMarketTrade("NVDA", "buy", 100, 4);
      expect(res.success).toBe(false);
      expect(res.code).toBe("SERVICE_NOT_CONFIGURED");
      expect(res.error).toBe("service credentials are not configured on this deployment");
      expect(res.requestId).toBe("req_trade_err_503");
    });

    it("captures 200 OK pseudo-success with success: false (broker error) and exposes code and error", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(
          new Response(
            JSON.stringify({
              success: false,
              message: "upstream market data provider failed to respond",
              symbol: "NVDA",
              side: "buy",
              notionalUSD: 400,
            }),
            {
              status: 200,
              headers: {
                "Content-Type": "application/json",
                "X-Request-Id": "req_trade_broker_down",
              },
            }
          )
        )
      );

      const res = await executeMarketTrade("NVDA", "buy", 100, 4);
      expect(res.success).toBe(false);
      expect(res.error).toBe("upstream market data provider failed to respond");
      expect(res.code).toBe("UPSTREAM_UNAVAILABLE");
      expect(res.requestId).toBe("req_trade_broker_down");
    });

    it("handles fetch network failure gracefully", async () => {
      vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNREFUSED")));

      const res = await executeMarketTrade("NVDA", "buy", 100, 4);
      expect(res.success).toBe(false);
      expect(res.error).toBe("ECONNREFUSED");
      expect(res.code).toBeUndefined();
    });
  });

  describe("closeMarketPosition", () => {
    it("returns success on HTTP 200", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(
          new Response(
            JSON.stringify({
              message: "Position closed",
              symbol: "NVDA",
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            }
          )
        )
      );

      const res = await closeMarketPosition("NVDA");
      expect(res.success).toBe(true);
      expect(res.message).toBe("Position closed");
      expect(res.error).toBeUndefined();
    });

    it("retains code, error, and requestId on HTTP 500 INTERNAL_ERROR", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(
          new Response(
            JSON.stringify({
              code: "INTERNAL_ERROR",
              error: "internal service error; please reference requestId for support",
              requestId: "req_close_err_500",
            }),
            {
              status: 500,
              headers: { "Content-Type": "application/json" },
            }
          )
        )
      );

      const res = await closeMarketPosition("NVDA");
      expect(res.success).toBe(false);
      expect(res.code).toBe("INTERNAL_ERROR");
      expect(res.error).toBe("internal service error; please reference requestId for support");
      expect(res.requestId).toBe("req_close_err_500");
    });
  });

  describe("createStripeCheckout", () => {
    it("retains code, error, and requestId on HTTP 503 SERVICE_NOT_CONFIGURED", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(
          new Response(
            JSON.stringify({
              code: "SERVICE_NOT_CONFIGURED",
              error: "service credentials are not configured on this deployment",
              requestId: "req_stripe_503",
            }),
            {
              status: 503,
              headers: { "Content-Type": "application/json" },
            }
          )
        )
      );

      const res = await createStripeCheckout(5000, "Top-up");
      expect(res.url).toBeUndefined();
      expect(res.code).toBe("SERVICE_NOT_CONFIGURED");
      expect(res.error).toBe("service credentials are not configured on this deployment");
      expect(res.requestId).toBe("req_stripe_503");
    });
  });

  describe("authorizeMicropayment", () => {
    it("retains code, error, and requestId on HTTP 401 UNAUTHORIZED", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(
          new Response(
            JSON.stringify({
              code: "UNAUTHORIZED",
              error: "authentication required or credentials invalid",
              requestId: "req_micro_401",
            }),
            {
              status: 401,
              headers: { "Content-Type": "application/json" },
            }
          )
        )
      );

      const res = await authorizeMicropayment("card_1", "sk_invalid", 5.0, "Steam");
      expect(res.success).toBe(false);
      expect(res.code).toBe("UNAUTHORIZED");
      expect(res.error).toBe("authentication required or credentials invalid");
      expect(res.requestId).toBe("req_micro_401");
    });
  });

  describe("classifyStatus", () => {
    it("prioritizes DATABASE_UNAVAILABLE over 503 and returns upstream-error instead of not-configured", () => {
      const result = classifyStatus(503, "database is unavailable; this endpoint requires a durable store", {
        code: "DATABASE_UNAVAILABLE",
      });
      expect(result.reason).toBe("upstream-error");
      expect(result.detail).toBe("database is unavailable; this endpoint requires a durable store");
    });

    it("maps SERVICE_NOT_CONFIGURED on 503 to not-configured", () => {
      const result = classifyStatus(503, "service credentials are not configured on this deployment", {
        code: "SERVICE_NOT_CONFIGURED",
      });
      expect(result.reason).toBe("not-configured");
    });

    it("maps UPSTREAM_UNAVAILABLE on 502 to upstream-error", () => {
      const result = classifyStatus(502, "upstream market data provider failed to respond", {
        code: "UPSTREAM_UNAVAILABLE",
      });
      expect(result.reason).toBe("upstream-error");
    });

    it("maps RESOURCE_NOT_FOUND on 404 to invalid-symbol", () => {
      const result = classifyStatus(404, "requested resource or market symbol not found", {
        code: "RESOURCE_NOT_FOUND",
      });
      expect(result.reason).toBe("invalid-symbol");
    });

    it("falls back to upstream-error when status is 503 and detail mentions database without envelope code", () => {
      const result = classifyStatus(503, "database connection error: connection refused");
      expect(result.reason).toBe("upstream-error");
    });

    it("falls back to not-configured when status is 503 without code or database detail", () => {
      const result = classifyStatus(503, "missing credentials");
      expect(result.reason).toBe("not-configured");
    });
  });

  describe("fetchMarketOverviewChecked", () => {
    it("populates code and requestId on non-2xx failure", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(
          new Response(
            JSON.stringify({
              code: "SERVICE_NOT_CONFIGURED",
              error: "service credentials are not configured on this deployment",
              requestId: "req_overview_503",
            }),
            {
              status: 503,
              headers: { "Content-Type": "application/json" },
            }
          )
        )
      );

      const res = await fetchMarketOverviewChecked();
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.reason).toBe("not-configured");
        expect(res.code).toBe("SERVICE_NOT_CONFIGURED");
        expect(res.requestId).toBe("req_overview_503");
        expect(res.detail).toBe("service credentials are not configured on this deployment");
      }
    });

    it("does not guess not-configured on 503 when code is DATABASE_UNAVAILABLE", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(
          new Response(
            JSON.stringify({
              code: "DATABASE_UNAVAILABLE",
              error: "database is unavailable; this endpoint requires a durable store",
              requestId: "req_overview_db_down",
            }),
            {
              status: 503,
              headers: { "Content-Type": "application/json" },
            }
          )
        )
      );

      const res = await fetchMarketOverviewChecked();
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.reason).toBe("upstream-error");
        expect(res.code).toBe("DATABASE_UNAVAILABLE");
        expect(res.requestId).toBe("req_overview_db_down");
        expect(res.detail).toBe("database is unavailable; this endpoint requires a durable store");
      }
    });
  });

  describe("/api/market BFF proxy route", () => {
    it("relays code and requestId when upstream gateway refuses", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(
          new Response(
            JSON.stringify({
              code: "SERVICE_NOT_CONFIGURED",
              error: "service credentials are not configured on this deployment",
              requestId: "req_bff_relay_503",
            }),
            {
              status: 503,
              headers: { "Content-Type": "application/json" },
            }
          )
        )
      );

      const req = new NextRequest("http://localhost/api/market?symbol=NVDA");
      const res = await marketRouteHandler(req);
      const json = await res.json();

      expect(res.status).toBe(503);
      expect(json.reason).toBe("not-configured");
      expect(json.code).toBe("SERVICE_NOT_CONFIGURED");
      expect(json.requestId).toBe("req_bff_relay_503");
      expect(json.error).toBe("service credentials are not configured on this deployment");
    });

    it("classifies DATABASE_UNAVAILABLE as upstream-error and preserves status 503", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(
          new Response(
            JSON.stringify({
              code: "DATABASE_UNAVAILABLE",
              error: "database is unavailable; this endpoint requires a durable store",
              requestId: "req_bff_db_503",
            }),
            {
              status: 503,
              headers: { "Content-Type": "application/json" },
            }
          )
        )
      );

      const req = new NextRequest("http://localhost/api/market?symbol=NVDA");
      const res = await marketRouteHandler(req);
      const json = await res.json();

      expect(res.status).toBe(503);
      expect(json.reason).toBe("upstream-error");
      expect(json.code).toBe("DATABASE_UNAVAILABLE");
      expect(json.requestId).toBe("req_bff_db_503");
      expect(json.error).toBe("database is unavailable; this endpoint requires a durable store");
    });

    it("preserves upstream status 500 rather than forcing to 503", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(
          new Response(
            JSON.stringify({
              code: "INTERNAL_ERROR",
              error: "internal service error; please reference requestId for support",
              requestId: "req_bff_500",
            }),
            {
              status: 500,
              headers: { "Content-Type": "application/json" },
            }
          )
        )
      );

      const req = new NextRequest("http://localhost/api/market?symbol=NVDA");
      const res = await marketRouteHandler(req);
      const json = await res.json();

      expect(res.status).toBe(500);
      expect(json.reason).toBe("upstream-error");
      expect(json.code).toBe("INTERNAL_ERROR");
      expect(json.requestId).toBe("req_bff_500");
    });

    it("preserves upstream status 502 rather than forcing to 503", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(
          new Response(
            JSON.stringify({
              code: "UPSTREAM_UNAVAILABLE",
              error: "upstream market data provider failed to respond",
              requestId: "req_bff_502",
            }),
            {
              status: 502,
              headers: { "Content-Type": "application/json" },
            }
          )
        )
      );

      const req = new NextRequest("http://localhost/api/market?symbol=NVDA");
      const res = await marketRouteHandler(req);
      const json = await res.json();

      expect(res.status).toBe(502);
      expect(json.reason).toBe("upstream-error");
      expect(json.code).toBe("UPSTREAM_UNAVAILABLE");
      expect(json.requestId).toBe("req_bff_502");
    });

    it("preserves upstream status 429 rather than forcing to 503", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(
          new Response(
            JSON.stringify({
              code: "RATE_LIMITED",
              error: "request rate limit exceeded; please retry later",
              requestId: "req_bff_429",
            }),
            {
              status: 429,
              headers: { "Content-Type": "application/json" },
            }
          )
        )
      );

      const req = new NextRequest("http://localhost/api/market?symbol=NVDA");
      const res = await marketRouteHandler(req);
      const json = await res.json();

      expect(res.status).toBe(429);
      expect(json.reason).toBe("upstream-error");
      expect(json.code).toBe("RATE_LIMITED");
      expect(json.requestId).toBe("req_bff_429");
    });
  });
});
