/**
 * Server-side session tokens (issue #35 P0-1 / P0-3).
 *
 * The API routes used to accept "who you are" from whatever the caller wrote
 * into a header, cookie, query string or body. This module is the replacement:
 * a session token is minted ONLY by a route that has verified an identity
 * (Google OAuth exchange, or a wallet signature over a server-issued
 * challenge), and every protected route verifies the HMAC before trusting the
 * identity inside it.
 *
 * The repo does not use Supabase Auth (users never get a Supabase JWT), so
 * `supabase.auth.getUser()` has nothing to verify; this HMAC token is the
 * session mechanism that matches how users actually sign in here.
 *
 * Format: base64url(JSON payload) + "." + base64url(HMAC-SHA256(payload)).
 * Secret: KOLIANCE_SESSION_SECRET (>= 32 chars). No fallback: a missing secret
 * makes minting and verification fail closed.
 */
import crypto from "crypto";
import type { NextRequest } from "next/server";

export const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;
export const WALLET_CHALLENGE_TTL_SECONDS = 5 * 60;

const WALLET_RE = /^0x[0-9a-fA-F]{40}$/;

export function isValidWalletAddress(value: unknown): value is string {
  return typeof value === "string" && WALLET_RE.test(value);
}

export class SessionConfigError extends Error {}

function getSecret(): string {
  const secret = process.env.KOLIANCE_SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new SessionConfigError(
      "KOLIANCE_SESSION_SECRET is not configured (must be at least 32 characters)"
    );
  }
  return secret;
}

function b64url(buf: Buffer | string): string {
  return Buffer.from(buf).toString("base64url");
}

function sign(kind: string, body: string): string {
  return b64url(crypto.createHmac("sha256", getSecret()).update(`${kind}.${body}`).digest());
}

function seal(kind: string, payload: object): string {
  const body = b64url(JSON.stringify(payload));
  return `${body}.${sign(kind, body)}`;
}

function unseal(kind: string, token: string): Record<string, unknown> | null {
  if (typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  const [body, mac] = parts;
  const expected = Buffer.from(sign(kind, body));
  const got = Buffer.from(mac);
  if (expected.length !== got.length || !crypto.timingSafeEqual(expected, got)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (typeof payload !== "object" || payload === null) return null;
    if (typeof payload.exp !== "number" || payload.exp <= Math.floor(Date.now() / 1000)) return null;
    return payload as Record<string, unknown>;
  } catch {
    return null;
  }
}

export interface SessionIdentity {
  userId: string;
  /** Lower-cased wallet, present only when ownership was proven by signature. */
  walletAddress: string | null;
}

export function createSessionToken(identity: SessionIdentity, ttlSeconds = SESSION_TTL_SECONDS): string {
  const now = Math.floor(Date.now() / 1000);
  return seal("session", {
    sub: identity.userId,
    wallet: identity.walletAddress ? identity.walletAddress.toLowerCase() : null,
    iat: now,
    exp: now + ttlSeconds,
  });
}

export function verifySessionToken(token: string): SessionIdentity | null {
  const p = unseal("session", token);
  if (!p || typeof p.sub !== "string" || p.sub === "") return null;
  const wallet = isValidWalletAddress(p.wallet) ? p.wallet.toLowerCase() : null;
  return { userId: p.sub, walletAddress: wallet };
}

/**
 * The ONLY way an API route learns who the caller is: `Authorization: Bearer
 * <session token>`. Headers like X-User-Id / X-Wallet-Address, cookies, query
 * parameters and body fields are deliberately ignored.
 */
export function getSessionIdentity(request: NextRequest | Request): SessionIdentity | null {
  const header = request.headers.get("authorization");
  if (!header) return null;
  const m = /^Bearer\s+(.+)$/i.exec(header.trim());
  if (!m) return null;
  return verifySessionToken(m[1].trim());
}

// ---------------- wallet sign-in challenge ----------------

export function walletLoginMessage(address: string, nonce: string, issuedAt: string): string {
  return [
    "Koliance wants you to sign in with your wallet:",
    address.toLowerCase(),
    "",
    "This signature proves wallet ownership and costs no gas.",
    "",
    `Nonce: ${nonce}`,
    `Issued At: ${issuedAt}`,
  ].join("\n");
}

export function createWalletChallenge(address: string): { challenge: string; message: string } {
  const nonce = crypto.randomBytes(16).toString("hex");
  const issuedAt = new Date().toISOString();
  const exp = Math.floor(Date.now() / 1000) + WALLET_CHALLENGE_TTL_SECONDS;
  const challenge = seal("wallet-challenge", { addr: address.toLowerCase(), nonce, issuedAt, exp });
  return { challenge, message: walletLoginMessage(address, nonce, issuedAt) };
}

/** Returns the message the wallet must have signed, or null when the challenge is invalid/expired/for another address. */
export function expectedWalletMessage(challenge: string, address: string): string | null {
  const p = unseal("wallet-challenge", challenge);
  if (!p || p.addr !== address.toLowerCase()) return null;
  if (typeof p.nonce !== "string" || typeof p.issuedAt !== "string") return null;
  return walletLoginMessage(address, p.nonce, p.issuedAt);
}
