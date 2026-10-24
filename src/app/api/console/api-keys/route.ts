import { NextRequest, NextResponse } from "next/server";
import { listUserApiKeys, createUserApiKey, revokeUserApiKey } from "@/lib/apiKeyDb";
import { fetchUserFromDatabase, syncUserToDatabase } from "@/lib/db";
import { corsHeadersFor } from "@/lib/cors";
import { getSessionIdentity, SessionConfigError, type SessionIdentity } from "@/lib/session";

/**
 * Developer API keys.
 *
 * Security (issue #35 P0-1): the caller's identity comes ONLY from a verified
 * session token (`Authorization: Bearer <token>`, see src/lib/session.ts).
 * X-User-Id / X-Wallet-Address headers, the koliance_user_id cookie, the
 * ?wallet= / ?user_id= query parameters and body.user_id / body.wallet_address
 * are no longer read. CORS is restricted to KOLIANCE_ALLOWED_ORIGINS.
 */
const METHODS = "GET, POST, DELETE, OPTIONS";
const ZERO_WALLET = "0x0000000000000000000000000000000000000000";
const ALLOWED_TIERS = new Set(["STARTER_FREE"]);
const ALLOWED_SCOPES = new Set(["trade:perp", "pay:micropayment", "query:proof"]);

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeadersFor(request, METHODS) });
}

type AuthResult = { identity: SessionIdentity } | { response: NextResponse };

function authenticate(request: NextRequest, cors: Record<string, string>): AuthResult {
  let identity: SessionIdentity | null;
  try {
    identity = getSessionIdentity(request);
  } catch (err) {
    if (err instanceof SessionConfigError) {
      return { response: NextResponse.json({ error: "SESSION_NOT_CONFIGURED", message: err.message }, { status: 503, headers: cors }) };
    }
    throw err;
  }
  if (!identity) {
    return {
      response: NextResponse.json(
        {
          error: "UNAUTHORIZED_REGISTRATION_REQUIRED",
          message: "A valid session token is required. Sign in with Google or your wallet first.",
        },
        { status: 401, headers: cors }
      ),
    };
  }
  return { identity };
}

// GET: List API keys owned by the signed-in user
export async function GET(request: NextRequest) {
  const cors = corsHeadersFor(request, METHODS);
  try {
    const auth = authenticate(request, cors);
    if ("response" in auth) return auth.response;
    const { userId, walletAddress } = auth.identity;
    const keys = await listUserApiKeys({ userId, walletAddress });
    return NextResponse.json({ success: true, keys }, { headers: cors });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500, headers: cors });
  }
}

// POST: Create a new API key for the signed-in user
export async function POST(request: NextRequest) {
  const cors = corsHeadersFor(request, METHODS);
  try {
    const auth = authenticate(request, cors);
    if ("response" in auth) return auth.response;
    const { userId, walletAddress } = auth.identity;

    let body: Record<string, unknown> = {};
    try {
      body = await request.json();
    } catch {
      // Empty body allowed with defaults
    }

    const effectiveWallet = walletAddress || ZERO_WALLET;

    try {
      const existing = await fetchUserFromDatabase({ id: userId });
      if (!existing) {
        await syncUserToDatabase(
          {
            id: userId,
            email: `${effectiveWallet.slice(0, 8)}@koliance.user`,
            name: `Dev-${effectiveWallet.slice(0, 6)}`,
            wallet_address: walletAddress,
          },
          false
        );
      }
    } catch (e) {
      console.warn("[API Keys Route] Notice during user existence check:", e);
    }

    const keyName = typeof body.name === "string" && body.name.trim() ? body.name.trim().slice(0, 64) : "Default API Key";
    // Tier and rate limit are billing attributes; self-service creation cannot raise them.
    const tier = typeof body.tier === "string" && ALLOWED_TIERS.has(body.tier) ? body.tier : "STARTER_FREE";
    const rpm = Number(body.rate_limit_rpm);
    const rateLimitRpm = Number.isFinite(rpm) && rpm > 0 ? Math.min(Math.floor(rpm), 60) : 60;
    const requestedScopes = Array.isArray(body.scopes)
      ? body.scopes.filter((s): s is string => typeof s === "string" && ALLOWED_SCOPES.has(s))
      : [];
    const scopes = requestedScopes.length > 0 ? requestedScopes : Array.from(ALLOWED_SCOPES);

    const result = await createUserApiKey({
      userId,
      walletAddress: effectiveWallet,
      name: keyName,
      tier,
      rateLimitRpm,
      scopes,
    });

    // Behavior Incentive: award +50 KOL on first API key created (anti-sybil checked in rewardsDb)
    let rewardGranted: { amount: number; actionType: string } | null = null;
    try {
      const { recordUserReward } = await import("@/lib/rewardsDb");
      const targetId = walletAddress || userId;
      const rewardRes = await recordUserReward(targetId, "FIRST_API_KEY", 50);
      if (!rewardRes.alreadyClaimed && rewardRes.reward) {
        rewardGranted = { amount: 50, actionType: "FIRST_API_KEY" };
      }
    } catch (e) {
      console.warn("[API Keys Route] Reward recording notice:", e);
    }

    return NextResponse.json(
      {
        success: true,
        message: "API key created successfully and persisted to api_keys table.",
        key: result.key,
        raw_key: result.raw_key, // Returned only once!
        rewardGranted,
      },
      { status: 201, headers: cors }
    );
  } catch (err: unknown) {

    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500, headers: cors });
  }
}

// DELETE: Revoke an API key owned by the signed-in user
export async function DELETE(request: NextRequest) {
  const cors = corsHeadersFor(request, METHODS);
  try {
    const auth = authenticate(request, cors);
    if ("response" in auth) return auth.response;
    const url = new URL(request.url);
    const keyId = url.searchParams.get("key_id") || url.searchParams.get("id");

    if (!keyId || !/^key_[0-9a-f]{1,64}$/.test(keyId)) {
      return NextResponse.json({ error: "key_id parameter is required" }, { status: 400, headers: cors });
    }

    const revoked = await revokeUserApiKey({ keyId, userId: auth.identity.userId });

    if (!revoked) {
      return NextResponse.json({ error: "Key not found or unauthorized to revoke" }, { status: 404, headers: cors });
    }

    return NextResponse.json({ success: true, message: "API key successfully revoked" }, { headers: cors });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500, headers: cors });
  }
}
