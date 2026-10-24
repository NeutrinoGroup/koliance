import { NextRequest, NextResponse } from "next/server";
import { corsHeadersFor } from "@/lib/cors";
import { getSessionIdentity, SessionConfigError, type SessionIdentity, isValidWalletAddress } from "@/lib/session";
import { getUserRewards, recordUserReward, withdrawRewards, sendRewardGift, type RewardActionType } from "@/lib/rewardsDb";
import { createDirectMessage } from "@/lib/directMessagesDb";

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

// POST: Claim behavior reward, send P2P gift, or execute vault batch withdrawal
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
      recipient?: unknown;
    };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400, headers: cors });
    }

    const { action = "CLAIM_ACTION", action_type, amount_kol, to_wallet, recipient } = body;

    // 1. Vault Batch Withdrawal
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

    // 2. Send P2P Gift (Deducts from sender, credits recipient)
    if (action === "SEND_GIFT") {
      if (typeof recipient !== "string" || !recipient.trim()) {
        return NextResponse.json({ error: "recipient is required for gift" }, { status: 400, headers: cors });
      }
      const numAmt = typeof amount_kol === "number" ? amount_kol : parseFloat(String(amount_kol));
      if (!Number.isFinite(numAmt) || numAmt <= 0) {
        return NextResponse.json({ error: "Valid positive amount_kol is required" }, { status: 400, headers: cors });
      }

      const cleanRecipient = recipient.trim().toLowerCase();
      const giftRes = await sendRewardGift(targetId, cleanRecipient, numAmt);
      if (!giftRes.success) {
        return NextResponse.json({ error: giftRes.error }, { status: 400, headers: cors });
      }

      // Also create direct message with msg_type: GIFT
      await createDirectMessage({
        sender_id: targetId,
        recipient_id: cleanRecipient,
        msg_type: "GIFT",
        content: `Sent a ${numAmt} KOL Red Packet`,
        metadata: {
          amount: numAmt,
          sender: targetId,
          claimed: false,
        },
      });

      return NextResponse.json({ ...giftRes }, { headers: cors });
    }

    // 3. Record/claim an action reward
    if (typeof action_type !== "string") {
      return NextResponse.json({ error: "action_type is required" }, { status: 400, headers: cors });
    }

    // Prevent forging a GIFT minting out of thin air
    if (action_type === "GIFT") {
      return NextResponse.json(
        { error: "GIFT cannot be claimed directly; use action: 'SEND_GIFT' to send from an existing balance." },
        { status: 400, headers: cors }
      );
    }

    let parsedAmount = typeof amount_kol === "number" && Number.isFinite(amount_kol) && amount_kol > 0 ? amount_kol : undefined;

    // Apply sane upper bounds on self-reported action rewards
    if (action_type === "CARD_CASHBACK_10" && parsedAmount !== undefined) {
      parsedAmount = Math.min(parsedAmount, 10); // Max 10 KOL per micro-payment cashback
    }
    if (action_type === "STRIPE_TOPUP" && parsedAmount !== undefined) {
      parsedAmount = Math.min(parsedAmount, 1000); // Max 1000 KOL per deposit bonus
    }

    const result = await recordUserReward(targetId, action_type as RewardActionType, parsedAmount);

    if (result.alreadyClaimed) {
      return NextResponse.json(
        { success: false, alreadyClaimed: true, message: "Reward has already been claimed for this action." },
        { status: 409, headers: cors }
      );
    }

    if (!result.reward) {
      return NextResponse.json(
        { success: false, error: result.error || "Failed to record reward" },
        { status: 400, headers: cors }
      );
    }

    return NextResponse.json({ success: true, reward: result.reward }, { headers: cors });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500, headers: cors });
  }
}
