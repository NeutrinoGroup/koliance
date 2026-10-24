import { NextRequest, NextResponse } from "next/server";
import { corsHeadersFor } from "@/lib/cors";
import { getSessionIdentity, SessionConfigError, type SessionIdentity } from "@/lib/session";
import { listDirectMessages, createDirectMessage, type DirectMessageType } from "@/lib/directMessagesDb";

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

// GET: Retrieve message history with a peer (?peer=0x... or ?recipient=0x...)
export async function GET(request: NextRequest) {
  const cors = corsHeadersFor(request, METHODS);
  try {
    const auth = authenticate(request, cors);
    if ("response" in auth) return auth.response;
    const { userId, walletAddress } = auth.identity;
    const currentId = walletAddress || userId;

    const url = new URL(request.url);
    const peer = url.searchParams.get("peer") || url.searchParams.get("recipient");
    if (!peer) {
      return NextResponse.json({ error: "peer parameter is required" }, { status: 400, headers: cors });
    }

    const limitParam = url.searchParams.get("limit");
    const limit = limitParam ? Math.min(100, Math.max(1, parseInt(limitParam, 10))) : 50;

    const messages = await listDirectMessages(currentId, peer, limit);
    return NextResponse.json({ success: true, messages }, { headers: cors });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500, headers: cors });
  }
}

// POST: Send direct message
export async function POST(request: NextRequest) {
  const cors = corsHeadersFor(request, METHODS);
  try {
    const auth = authenticate(request, cors);
    if ("response" in auth) return auth.response;
    const { userId, walletAddress } = auth.identity;
    const currentId = walletAddress || userId;

    let body: {
      recipient?: unknown;
      msg_type?: unknown;
      content?: unknown;
      attachment_url?: unknown;
      metadata?: unknown;
    };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400, headers: cors });
    }

    const { recipient, msg_type = "TEXT", content = "", attachment_url, metadata } = body;

    if (typeof recipient !== "string" || !recipient.trim()) {
      return NextResponse.json({ error: "recipient is required" }, { status: 400, headers: cors });
    }

    if (currentId.toLowerCase() === recipient.trim().toLowerCase()) {
      return NextResponse.json({ error: "Cannot send a direct message to yourself" }, { status: 400, headers: cors });
    }

    const validTypes = new Set(["TEXT", "IMAGE", "TRANSFER_RECEIPT", "GIFT"]);
    const resolvedType = typeof msg_type === "string" && validTypes.has(msg_type) ? (msg_type as DirectMessageType) : "TEXT";

    // Attachment payload size check: maximum 200KB for Base64 payload
    if (typeof attachment_url === "string" && attachment_url.length > 200 * 1024) {
      return NextResponse.json({ error: "Image attachment exceeds 200KB limit" }, { status: 400, headers: cors });
    }

    const res = await createDirectMessage({
      sender_id: currentId,
      recipient_id: recipient.trim(),
      msg_type: resolvedType,
      content: typeof content === "string" ? content : "",
      attachment_url: typeof attachment_url === "string" ? attachment_url : null,
      metadata: typeof metadata === "object" && metadata !== null ? (metadata as Record<string, unknown>) : {},
    });

    if (!res.success) {
      return NextResponse.json({ error: res.error }, { status: 400, headers: cors });
    }

    return NextResponse.json({ success: true, message: res.message }, { headers: cors });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500, headers: cors });
  }
}
