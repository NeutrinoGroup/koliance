import { NextRequest, NextResponse } from "next/server";
import { syncUserToDatabase, fetchUserFromDatabase } from "@/lib/db";

import { corsHeadersFor } from "@/lib/cors";
import { getSessionIdentity, isValidWalletAddress } from "@/lib/session";

const CORS_METHODS = "GET, POST, PUT, OPTIONS";

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeadersFor(request, CORS_METHODS) });
}

/**
 * Issue #35 P0-3: the bearer value used to BE the user id ("the house number
 * is the key"). The caller's id now comes only from a verified session token
 * (src/lib/session.ts); X-User-Id and the koliance_user_id cookie are ignored.
 */
function getAuthenticatedUserId(request: NextRequest): string | null {
  try {
    return getSessionIdentity(request)?.userId ?? null;
  } catch (err) {
    console.error("[Profile] session verification unavailable:", err);
    return null;
  }
}

// GET: Fetch user profile (authenticated users can only view their own profile)
export async function GET(request: NextRequest) {
  const corsHeaders = corsHeadersFor(request, CORS_METHODS);
  try {
    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    const email = url.searchParams.get("email");
    const wallet = url.searchParams.get("wallet");

    // Security Check: Disallow arbitrary queries by email or wallet
    if (email || wallet) {
      return NextResponse.json(
        { error: "Arbitrary queries by email or wallet are disallowed. Please query by authenticated user id." },
        { status: 400, headers: corsHeaders }
      );
    }

    const authUserId = getAuthenticatedUserId(request);
    if (!authUserId) {
      return NextResponse.json(
        { error: "Authentication required to view user profile" },
        { status: 401, headers: corsHeaders }
      );
    }

    const targetId = id || authUserId;

    // Security Check: Only allow user to view their own profile
    if (id && id !== authUserId) {
      return NextResponse.json(
        { error: "Forbidden: You may only view your own profile" },
        { status: 403, headers: corsHeaders }
      );
    }

    const user = await fetchUserFromDatabase({ id: targetId });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404, headers: corsHeaders });
    }

    return NextResponse.json({ success: true, user }, { headers: corsHeaders });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500, headers: corsHeaders });
  }
}

// POST / PUT: Update user profile
export async function POST(request: NextRequest) {
  const corsHeaders = corsHeadersFor(request, CORS_METHODS);
  try {
    const authUserId = getAuthenticatedUserId(request);
    if (!authUserId) {
      return NextResponse.json(
        { error: "Authentication required to update user profile" },
        { status: 401, headers: corsHeaders }
      );
    }

    const body = await request.json();
    const { id, email, name, picture, bio, wallet_address, steam_id, github_username } = body;

    if (!id || !email) {
      return NextResponse.json(
        { error: "Missing required user identity (id, email)" },
        { status: 400, headers: corsHeaders }
      );
    }

    // Security Check: User can only update their own profile
    if (id !== authUserId) {
      return NextResponse.json(
        { error: "Forbidden: You may only update your own profile" },
        { status: 403, headers: corsHeaders }
      );
    }

    if (wallet_address && !isValidWalletAddress(wallet_address)) {
      return NextResponse.json(
        { error: "wallet_address must be 0x followed by 40 hex characters" },
        { status: 400, headers: corsHeaders }
      );
    }

    // Security: Note that trust_tier and credit_allowance_usd are stripped
    // and cannot be modified by user-controlled profile updates (isTrustedRatingWorkflow = false)
    const updatedUser = await syncUserToDatabase(
      {
        id,
        email,
        name: name || email.split("@")[0],
        picture: picture || null,
        bio: bio || null,
        wallet_address: wallet_address || null,
        steam_id: steam_id || null,
        github_username: github_username || null,
      },
      false
    );

    return NextResponse.json({ success: true, user: updatedUser }, { headers: corsHeaders });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500, headers: corsHeaders });
  }
}

export async function PUT(request: NextRequest) {
  return POST(request);
}
