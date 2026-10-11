import { NextRequest, NextResponse } from "next/server";
import { syncUserToDatabase, fetchUserFromDatabase } from "@/lib/db";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-User-Id",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders });
}

function getAuthenticatedUserId(request: NextRequest): string | null {
  // 1. Authorization: Bearer <id>
  const authHeader = request.headers.get("authorization");
  if (authHeader) {
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (token) return token;
  }
  // 2. Custom header: X-User-Id
  const xUserId = request.headers.get("x-user-id");
  if (xUserId && xUserId.trim()) {
    return xUserId.trim();
  }
  // 3. Cookie session
  const cookieUser = request.cookies.get("koliance_user_id")?.value;
  if (cookieUser && cookieUser.trim()) {
    return cookieUser.trim();
  }
  return null;
}

// GET: Fetch user profile (authenticated users can only view their own profile)
export async function GET(request: NextRequest) {
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
