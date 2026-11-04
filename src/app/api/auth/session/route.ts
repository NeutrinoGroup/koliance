import { NextRequest, NextResponse } from "next/server";
import { corsHeadersFor } from "@/lib/cors";
import {
  createSessionToken,
  getSessionIdentity,
  isValidWalletAddress,
} from "@/lib/session";
import { syncUserToDatabase } from "@/lib/db";

const CORS_METHODS = "GET, POST, OPTIONS";

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeadersFor(request, CORS_METHODS) });
}

export async function GET(request: NextRequest) {
  const corsHeaders = corsHeadersFor(request, CORS_METHODS);
  try {
    const identity = getSessionIdentity(request);
    if (!identity) {
      return NextResponse.json(
        { success: false, error: "UNAUTHORIZED", message: "No valid session token provided" },
        { status: 401, headers: corsHeaders }
      );
    }
    return NextResponse.json({ success: true, identity }, { headers: corsHeaders });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500, headers: corsHeaders });
  }
}

export async function POST(request: NextRequest) {
  const corsHeaders = corsHeadersFor(request, CORS_METHODS);
  try {
    let body: {
      userId?: unknown;
      email?: unknown;
      name?: unknown;
      walletAddress?: unknown;
      picture?: unknown;
      githubUsername?: unknown;
      steamId?: unknown;
    };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400, headers: corsHeaders });
    }

    const rawEmail = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const rawWallet = typeof body.walletAddress === "string" && isValidWalletAddress(body.walletAddress)
      ? body.walletAddress.toLowerCase()
      : null;
    const rawId = typeof body.userId === "string" && body.userId.trim()
      ? body.userId.trim()
      : rawEmail
      ? `did:koliance:email:${rawEmail}`
      : rawWallet
      ? `did:koliance:wallet:${rawWallet}`
      : null;

    if (!rawId) {
      return NextResponse.json(
        { error: "At least one of userId, email, or walletAddress is required" },
        { status: 400, headers: corsHeaders }
      );
    }

    const defaultName = rawEmail ? rawEmail.split("@")[0] : rawWallet ? `User-${rawWallet.slice(2, 6)}` : "Koliance User";
    const name = typeof body.name === "string" && body.name.trim() ? body.name.trim().slice(0, 50) : defaultName;

    const syncedUser = await syncUserToDatabase(
      {
        id: rawId,
        email: rawEmail || `${rawId}@user.koliance.io`,
        name,
        wallet_address: rawWallet,
        picture: typeof body.picture === "string" ? body.picture : null,
        github_username: typeof body.githubUsername === "string" ? body.githubUsername : null,
        steam_id: typeof body.steamId === "string" ? body.steamId : null,
      },
      false
    );

    const sessionToken = createSessionToken({
      userId: rawId,
      walletAddress: rawWallet,
    });

    return NextResponse.json(
      {
        success: true,
        sessionToken,
        profile: syncedUser,
      },
      { headers: corsHeaders }
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500, headers: corsHeaders });
  }
}
