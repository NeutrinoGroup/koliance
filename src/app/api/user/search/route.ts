import { NextRequest, NextResponse } from "next/server";
import { corsHeadersFor } from "@/lib/cors";
import { getSessionIdentity, SessionConfigError, type SessionIdentity } from "@/lib/session";
import { searchPublicUsers } from "@/lib/db";

const METHODS = "GET, OPTIONS";

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

export async function GET(request: NextRequest) {
  const cors = corsHeadersFor(request, METHODS);
  try {
    const auth = authenticate(request, cors);
    if ("response" in auth) return auth.response;
    const { userId } = auth.identity;

    const url = new URL(request.url);
    const q = url.searchParams.get("q") || "";

    const users = await searchPublicUsers(q, userId);
    return NextResponse.json({ success: true, users }, { headers: cors });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500, headers: cors });
  }
}
