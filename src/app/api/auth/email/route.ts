import { NextRequest, NextResponse } from "next/server";
import { corsHeadersFor } from "@/lib/cors";
import { createSessionToken } from "@/lib/session";
import { syncUserToDatabase } from "@/lib/db";

const CORS_METHODS = "POST, OPTIONS";

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeadersFor(request, CORS_METHODS) });
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: NextRequest) {
  const corsHeaders = corsHeadersFor(request, CORS_METHODS);
  try {
    let body: { email?: unknown; name?: unknown };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400, headers: corsHeaders });
    }

    const rawEmail = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    if (!rawEmail || !EMAIL_REGEX.test(rawEmail)) {
      return NextResponse.json(
        { error: "请输入有效的邮箱地址 (如 user@example.com)" },
        { status: 400, headers: corsHeaders }
      );
    }

    const defaultName = rawEmail.split("@")[0];
    const rawName = typeof body.name === "string" && body.name.trim() ? body.name.trim() : defaultName;
    const cleanName = rawName.slice(0, 50);

    const kolianceUserId = `did:koliance:email:${rawEmail}`;
    const syncedDbUser = await syncUserToDatabase(
      {
        id: kolianceUserId,
        email: rawEmail,
        name: cleanName,
        picture: null,
        bio: "Koliance Web2.5 Instant Messaging User",
        wallet_address: null,
        trust_tier: "EMAIL VERIFIED CITIZEN",
        credit_allowance_usd: 600,
      },
      true
    );

    const sessionToken = createSessionToken({
      userId: kolianceUserId,
      walletAddress: null,
    });

    return NextResponse.json(
      {
        success: true,
        sessionToken,
        profile: {
          id: kolianceUserId,
          email: rawEmail,
          emailVerified: true,
          name: (syncedDbUser as any)?.name || cleanName,
          picture: (syncedDbUser as any)?.picture || null,
          bio: "Koliance Web2.5 Instant Messaging User",
          walletAddress: (syncedDbUser as any)?.wallet_address || null,
          trustTier: "EMAIL VERIFIED CITIZEN",
          creditAllowanceUSD: 600,
        },
      },
      { headers: corsHeaders }
    );
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: errorMsg },
      { status: 500, headers: corsHeaders }
    );
  }
}
