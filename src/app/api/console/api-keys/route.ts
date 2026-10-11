import { NextRequest, NextResponse } from "next/server";
import { listUserApiKeys, createUserApiKey, revokeUserApiKey } from "@/lib/apiKeyDb";
import { fetchUserFromDatabase, syncUserToDatabase } from "@/lib/db";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-User-Id, X-Wallet-Address",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders });
}

function getAuthIdentity(request: NextRequest): { userId: string | null; walletAddress: string | null } {
  let userId: string | null = null;
  let walletAddress: string | null = null;

  const authHeader = request.headers.get("authorization");
  if (authHeader) {
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (token) {
      if (token.startsWith("0x")) {
        walletAddress = token.toLowerCase();
      } else {
        userId = token;
      }
    }
  }

  const xUserId = request.headers.get("x-user-id");
  if (xUserId && xUserId.trim()) {
    userId = xUserId.trim();
  }

  const xWallet = request.headers.get("x-wallet-address");
  if (xWallet && xWallet.trim()) {
    walletAddress = xWallet.trim().toLowerCase();
  }

  const cookieUser = request.cookies.get("koliance_user_id")?.value;
  if (cookieUser && cookieUser.trim()) {
    userId = cookieUser.trim();
  }

  // Also inspect query params for wallet if not specified
  const url = new URL(request.url);
  const qWallet = url.searchParams.get("wallet");
  if (!walletAddress && qWallet && qWallet.startsWith("0x")) {
    walletAddress = qWallet.trim().toLowerCase();
  }

  const qUser = url.searchParams.get("user_id");
  if (!userId && qUser) {
    userId = qUser.trim();
  }

  return { userId, walletAddress };
}

// GET: List API keys for authenticated & registered user
export async function GET(request: NextRequest) {
  try {
    const { userId, walletAddress } = getAuthIdentity(request);

    if (!userId && !walletAddress) {
      return NextResponse.json(
        {
          error: "UNAUTHORIZED_REGISTRATION_REQUIRED",
          message: "User registration or authentication required to access developer API keys.",
        },
        { status: 401, headers: corsHeaders }
      );
    }

    const keys = await listUserApiKeys({ userId, walletAddress });
    return NextResponse.json({ success: true, keys }, { headers: corsHeaders });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500, headers: corsHeaders });
  }
}

// POST: Create a new API key for the registered user
export async function POST(request: NextRequest) {
  try {
    const identity = getAuthIdentity(request);
    let body: any = {};
    try {
      body = await request.json();
    } catch {
      // Empty body allowed with defaults
    }

    const userId = body.user_id || identity.userId || (identity.walletAddress ? `did:koliance:wallet:${identity.walletAddress}` : null);
    const walletAddress = body.wallet_address || identity.walletAddress;

    // Strict Gate: Developer MUST be registered / authenticated
    if (!userId && !walletAddress) {
      return NextResponse.json(
        {
          error: "REGISTRATION_REQUIRED",
          message: "Please register your developer account or connect your wallet before creating an API key.",
        },
        { status: 401, headers: corsHeaders }
      );
    }

    const effectiveWallet = walletAddress || "0x0000000000000000000000000000000000000000";
    const effectiveUserId = userId || `did:koliance:wallet:${effectiveWallet}`;

    // Ensure user record exists in database
    if (effectiveUserId) {
      try {
        const existing = await fetchUserFromDatabase({ id: effectiveUserId });
        if (!existing) {
          await syncUserToDatabase(
            {
              id: effectiveUserId,
              email: body.email || `${effectiveWallet.slice(0, 8)}@koliance.user`,
              name: body.user_name || body.name || `Dev-${effectiveWallet.slice(0, 6)}`,
              wallet_address: effectiveWallet,
            },
            false
          );
        }
      } catch (e) {
        console.warn("[API Keys Route] Notice during user existence check:", e);
      }
    }

    const keyName = body.name?.trim() || "Default API Key";
    const tier = body.tier || "STARTER_FREE";
    const rateLimitRpm = body.rate_limit_rpm ? Number(body.rate_limit_rpm) : 60;
    const scopes = Array.isArray(body.scopes) && body.scopes.length > 0
      ? body.scopes
      : ["trade:perp", "pay:micropayment", "query:proof"];

    const result = await createUserApiKey({
      userId: effectiveUserId,
      walletAddress: effectiveWallet,
      name: keyName,
      tier,
      rateLimitRpm,
      scopes,
    });

    return NextResponse.json(
      {
        success: true,
        message: "API key created successfully and persisted to api_keys table.",
        key: result.key,
        raw_key: result.raw_key, // Returned only once!
      },
      { status: 201, headers: corsHeaders }
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500, headers: corsHeaders });
  }
}

// DELETE: Revoke an API key
export async function DELETE(request: NextRequest) {
  try {
    const identity = getAuthIdentity(request);
    const url = new URL(request.url);
    const keyId = url.searchParams.get("key_id") || url.searchParams.get("id");

    if (!keyId) {
      return NextResponse.json({ error: "key_id parameter is required" }, { status: 400, headers: corsHeaders });
    }

    const revoked = await revokeUserApiKey({
      keyId,
      userId: identity.userId,
      walletAddress: identity.walletAddress,
    });

    if (!revoked) {
      return NextResponse.json({ error: "Key not found or unauthorized to revoke" }, { status: 404, headers: corsHeaders });
    }

    return NextResponse.json({ success: true, message: "API key successfully revoked" }, { headers: corsHeaders });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500, headers: corsHeaders });
  }
}
