import { NextRequest, NextResponse } from "next/server";
import { corsHeadersFor } from "@/lib/cors";
import { getSessionIdentity, SessionConfigError, type SessionIdentity, isValidWalletAddress } from "@/lib/session";
import { getUserRewards, recordUserReward, withdrawRewards, type RewardActionType } from "@/lib/rewardsDb";

const METHODS = "GET, POST, OPTIONS";

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
      return {
        response: NextResponse.json(
          { error: "SESSION_NOT_CONFIGURED", message: err.message },
          { status: 503, headers: cors }
        ),
      };
    }
    throw err;
  }
  if (!identity) {
    return {
      response: NextResponse.json(
        {
          error: "UNAUTHORIZED",
          message: "A valid session token is required.",
        },
        { status: 401, headers: cors }
      ),
    };
  }
  return { identity };
}

// GET: Query user rewards ledger and claimable balance
export async function GET(request: NextRequest) {
  const cors = corsHeadersFor(request, METHODS);
  try {
    const auth = authenticate(request, cors);
    if ("response" in auth) return auth.response;
    const { userId, walletAddress } = auth.identity;
    const targetId = walletAddress || userId;

    const summary = await getUserRewards(targetId);
    return NextResponse.json({ success: true, ...summary }, { headers: cors });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500, headers: cors });
  }
}

// POST: Claim behavior reward or execute vault batch withdrawal
export async function POST(request: NextRequest) {
  const cors = corsHeadersFor(request, METHODS);
  try {
    const auth = authenticate(request, cors);
    if ("response" in auth) return auth.response;
    const { userId, walletAddress } = auth.identity;
    const targetId = walletAddress || userId;

    let body: {
      action?: unknown;
      action_type?: unknown;
      amount_kol?: unknown;
      to_wallet?: unknown;
    };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400, headers: cors });
    }

    const { action = "CLAIM_ACTION", action_type, amount_kol, to_wallet } = body;

    if (action === "WITHDRAW") {
      const targetWallet = typeof to_wallet === "string" ? to_wallet : walletAddress;
      if (!targetWallet || !isValidWalletAddress(targetWallet)) {
        return NextResponse.json(
          { error: "Valid 0x target wallet address is required for withdrawal" },
          { status: 400, headers: cors }
        );
      }
      const withdrawRes = await withdrawRewards(targetId, targetWallet);
      if (!withdrawRes.success) {
        return NextResponse.json({ error: withdrawRes.error }, { status: 400, headers: cors });
      }
      return NextResponse.json({ ...withdrawRes }, { headers: cors });
    }

    // Default: Record/claim an action reward
    if (typeof action_type !== "string") {
      return NextResponse.json({ error: "action_type is required" }, { status: 400, headers: cors });
    }

    const parsedAmount = typeof amount_kol === "number" && !isNaN(amount_kol) ? amount_kol : undefined;
    const result = await recordUserReward(targetId, action_type as RewardActionType, parsedAmount);

    if (result.alreadyClaimed) {
      return NextResponse.json(
        { success: false, alreadyClaimed: true, message: "Reward has already been claimed for this action." },
        { status: 409, headers: cors }
      );
    }

    return NextResponse.json({ success: true, reward: result.reward }, { headers: cors });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500, headers: cors });
  }
}
