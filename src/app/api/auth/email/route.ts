import { NextRequest, NextResponse } from "next/server";
import { corsHeadersFor } from "@/lib/cors";
import { createSessionToken } from "@/lib/session";
import {
  syncUserToDatabase,
  registerEmailPassword,
  verifyEmailPassword,
  isEmailRegistered,
} from "@/lib/db";

const CORS_METHODS = "POST, OPTIONS";

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeadersFor(request, CORS_METHODS) });
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: NextRequest) {
  const corsHeaders = corsHeadersFor(request, CORS_METHODS);
  try {
    let body: {
      action?: unknown;
      email?: unknown;
      password?: unknown;
      name?: unknown;
    };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400, headers: corsHeaders });
    }

    const action = body.action === "register" ? "register" : "login";

    const rawEmail = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    if (!rawEmail || !EMAIL_REGEX.test(rawEmail)) {
      return NextResponse.json(
        { error: "请输入有效的邮箱地址 (如 user@example.com)" },
        { status: 400, headers: corsHeaders }
      );
    }

    const rawPassword = typeof body.password === "string" ? body.password : "";
    if (!rawPassword || rawPassword.length < 6) {
      return NextResponse.json(
        { error: "密码长度不得少于 6 位" },
        { status: 400, headers: corsHeaders }
      );
    }

    if (action === "register") {
      const regRes = registerEmailPassword(rawEmail, rawPassword);
      if (!regRes.success) {
        return NextResponse.json(
          { error: regRes.error || "注册失败，该邮箱可能已被占用" },
          { status: 400, headers: corsHeaders }
        );
      }
    } else {
      // login action
      const verifyRes = verifyEmailPassword(rawEmail, rawPassword);
      if (!verifyRes.success) {
        return NextResponse.json(
          { error: verifyRes.error || "邮箱或密码错误，请重试" },
          { status: 401, headers: corsHeaders }
        );
      }
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
