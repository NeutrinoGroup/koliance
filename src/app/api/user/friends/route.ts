import { NextRequest, NextResponse } from "next/server";
import { corsHeadersFor } from "@/lib/cors";
import { getSessionIdentity, SessionConfigError, type SessionIdentity } from "@/lib/session";
import { listFriends, addFriend, removeFriend } from "@/lib/friendsDb";

const METHODS = "GET, POST, DELETE, OPTIONS";

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

// GET: List friends
export async function GET(request: NextRequest) {
  const cors = corsHeadersFor(request, METHODS);
  try {
    const auth = authenticate(request, cors);
    if ("response" in auth) return auth.response;
    const { userId } = auth.identity;

    const friends = await listFriends(userId);
    return NextResponse.json({ success: true, friends }, { headers: cors });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500, headers: cors });
  }
}

// POST: Add friend
export async function POST(request: NextRequest) {
  const cors = corsHeadersFor(request, METHODS);
  try {
    const auth = authenticate(request, cors);
    if ("response" in auth) return auth.response;
    const { userId } = auth.identity;

    let body: { friend_wallet?: unknown; friend_name?: unknown };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400, headers: cors });
    }

    const { friend_wallet, friend_name } = body;
    if (typeof friend_wallet !== "string") {
      return NextResponse.json({ error: "friend_wallet is required" }, { status: 400, headers: cors });
    }

    const res = await addFriend(userId, friend_wallet, typeof friend_name === "string" ? friend_name : undefined);
    if (!res.success) {
      return NextResponse.json({ error: res.error }, { status: 400, headers: cors });
    }

    return NextResponse.json({ success: true, friend: res.friend }, { headers: cors });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500, headers: cors });
  }
}

// DELETE: Remove friend
export async function DELETE(request: NextRequest) {
  const cors = corsHeadersFor(request, METHODS);
  try {
    const auth = authenticate(request, cors);
    if ("response" in auth) return auth.response;
    const { userId } = auth.identity;

    const url = new URL(request.url);
    let wallet = url.searchParams.get("wallet");
    if (!wallet) {
      try {
        const body = await request.json();
        wallet = body.friend_wallet;
      } catch {
        // query param preferred
      }
    }

    if (!wallet || typeof wallet !== "string") {
      return NextResponse.json({ error: "wallet is required" }, { status: 400, headers: cors });
    }

    const ok = await removeFriend(userId, wallet);
    return NextResponse.json({ success: ok }, { headers: cors });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500, headers: cors });
  }
}
