import { NextRequest, NextResponse } from "next/server";
import { verifyMessage } from "viem";
import { corsHeadersFor } from "@/lib/cors";
import {
  createSessionToken,
  createWalletChallenge,
  expectedWalletMessage,
  isValidWalletAddress,
  SessionConfigError,
} from "@/lib/session";

/**
 * Wallet sign-in (issue #35): proves wallet ownership with a signature over a
 * short-lived, server-signed challenge, then mints a session token bound to
 * that wallet. GET ?address= -> { message, challenge }; POST { address,
 * challenge, signature } -> { sessionToken }.
 */
const METHODS = "GET, POST, OPTIONS";

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeadersFor(request, METHODS) });
}

function configError(request: NextRequest, err: unknown) {
  const status = err instanceof SessionConfigError ? 503 : 500;
  return NextResponse.json(
    { error: err instanceof Error ? err.message : String(err) },
    { status, headers: corsHeadersFor(request, METHODS) }
  );
}

export async function GET(request: NextRequest) {
  const cors = corsHeadersFor(request, METHODS);
  const address = new URL(request.url).searchParams.get("address");
  if (!isValidWalletAddress(address)) {
    return NextResponse.json({ error: "address must be 0x followed by 40 hex characters" }, { status: 400, headers: cors });
  }
  try {
    return NextResponse.json(createWalletChallenge(address), { headers: cors });
  } catch (err) {
    return configError(request, err);
  }
}

export async function POST(request: NextRequest) {
  const cors = corsHeadersFor(request, METHODS);
  let body: { address?: unknown; challenge?: unknown; signature?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400, headers: cors });
  }
  const { address, challenge, signature } = body;
  if (!isValidWalletAddress(address) || typeof challenge !== "string" || typeof signature !== "string" || !/^0x[0-9a-fA-F]+$/.test(signature)) {
    return NextResponse.json({ error: "address, challenge and signature are required" }, { status: 400, headers: cors });
  }
  try {
    const message = expectedWalletMessage(challenge, address);
    if (!message) {
      return NextResponse.json({ error: "Challenge invalid or expired" }, { status: 401, headers: cors });
    }
    let ok = false;
    try {
      ok = await verifyMessage({ address: address as `0x${string}`, message, signature: signature as `0x${string}` });
    } catch {
      ok = false;
    }
    if (!ok) {
      return NextResponse.json({ error: "Signature does not match wallet" }, { status: 401, headers: cors });
    }
    const wallet = address.toLowerCase();
    const sessionToken = createSessionToken({ userId: `did:koliance:wallet:${wallet}`, walletAddress: wallet });

    // Behavior Incentive: award +100 KOL on first wallet bind (lifetime unique per 0x address)
    let rewardGranted: { amount: number; actionType: string } | null = null;
    try {
      const { recordUserReward } = await import("@/lib/rewardsDb");
      const rewardRes = await recordUserReward(wallet, "WALLET_BIND", 100);
      if (!rewardRes.alreadyClaimed && rewardRes.reward) {
        rewardGranted = { amount: 100, actionType: "WALLET_BIND" };
      }
    } catch (e) {
      console.warn("[Wallet Auth] Reward recording notice:", e);
    }

    return NextResponse.json(
      {
        success: true,
        sessionToken,
        userId: `did:koliance:wallet:${wallet}`,
        walletAddress: wallet,
        rewardGranted,
      },
      { headers: cors }
    );
  } catch (err) {
    return configError(request, err);
  }
}

