/**
 * The Google OAuth callback: where it lands, how it is told apart from the
 * GitHub one, and the single exchange that turns its `code` into a profile.
 *
 * Why this module exists (issue #34, second round - the first round's fix,
 * `docs/changes/049`, was not enough):
 *
 * The first round made the navbar *derive* the signed-in account from
 * `localStorage` and notified every subscriber through
 * `writeAccountState`. That closes the read half. It does not close the write
 * half, and the write half is what the user is actually watching:
 *
 *   `NavAuthBadges.handleGoogleLogin` (the non-Privy branch) sends the browser
 *   to Google with `redirect_uri=https://koliance.oodai.space` - the site
 *   **root**, because that is the URI registered with Google. Google therefore
 *   returns the user to `/?code=...&scope=...` no matter which page they
 *   started from. On the root page the code is read by `AgentCardTerminal`
 *   (`:137`), which assumes every `?code=` is a GitHub one, switches to the
 *   GitHub tab, and leaves `GoogleAuthWall` - the only component that ever
 *   called `POST /api/auth/google/exchange` - unmounted. Nobody performs the
 *   exchange, so no profile is ever written, so the navbar renders "Sign In"
 *   for a user who has just finished signing in with Google.
 *
 * So the exchange cannot belong to a component that is mounted on one tab of
 * one page. It belongs to the callback itself, and it is performed by
 * `GoogleAuthCallback` (mounted once in `src/app/layout.tsx`, so it runs on
 * whichever page Google lands on).
 *
 * What is deliberately NOT here: the redirect URI. It must be byte-identical
 * in the authorization request and in the token exchange (Google rejects a
 * mismatch), so both read the one constant in `src/lib/authConfig.ts`.
 */

import { OAUTH_REDIRECT_URI } from "@/lib/authConfig";
import { writeAccountState } from "@/lib/authState";

/**
 * The profile `POST /api/auth/google/exchange` answers with.
 *
 * Moved here from `GoogleAuthWall.tsx` because this module is what produces
 * one: the shape and the exchange that fills it are one fact, and splitting
 * them is how a field gets added on one side only.
 */
export interface GoogleProfile {
  googleId: string;
  email: string;
  emailVerified: boolean;
  name: string;
  picture?: string | null;
  bio?: string | null;
  walletAddress?: string | null;
  trustTier: string;
  creditAllowanceUSD: number;
  synthetic?: boolean;
}

/** The route that exchanges the code. One spelling, one caller-side constant. */
export const GOOGLE_EXCHANGE_ENDPOINT = "/api/auth/google/exchange";

/**
 * Google appends the granted scopes to the redirect URI, and the scopes it
 * appends are `googleapis.com` URLs. GitHub's callback carries no `scope`
 * parameter at all, so this is the discriminator between the two `?code=`
 * flows - and it is the same test `GoogleAuthWall` has always used
 * (`:117`), kept identical on purpose: two callers disagreeing about what a
 * Google callback looks like is how one of them ends up handling the other's
 * code.
 */
export function isGoogleOAuthCallback(params: URLSearchParams): boolean {
  const code = params.get("code");
  const scope = params.get("scope");
  return Boolean(code && scope && scope.includes("googleapis"));
}

export type GoogleCallbackParse =
  | { kind: "google"; code: string }
  | { kind: "other"; reason: "no-code" | "not-google" };

/**
 * What the current URL is, from the callback handler's point of view.
 *
 * A discriminated result rather than `string | null` so a caller cannot read
 * "this is a GitHub callback" and "there is no callback at all" as the same
 * answer - the two call for different behaviour (leave it alone vs. do
 * nothing), and collapsing them is what produced the mis-routing above.
 */
export function parseGoogleCallback(params: URLSearchParams): GoogleCallbackParse {
  if (!params.get("code")) return { kind: "other", reason: "no-code" };
  if (!isGoogleOAuthCallback(params)) return { kind: "other", reason: "not-google" };
  return { kind: "google", code: params.get("code") as string };
}

/**
 * Exchanges the authorization code and returns the profile. Throws on refusal,
 * carrying the route's own message when it sent one.
 *
 * Both callers (`GoogleAuthCallback` and `GoogleAuthWall`) go through this, so
 * the two cannot disagree about the redirect URI, the body shape, or what
 * counts as a failure. The wall keeps its own UI state on top; what it does not
 * keep is a second copy of the request.
 */
export async function exchangeGoogleCode(
  code: string,
  walletAddress?: string | null
): Promise<GoogleProfile> {
  const res = await fetch(GOOGLE_EXCHANGE_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      code,
      redirect_uri: OAUTH_REDIRECT_URI,
      wallet_address: walletAddress || undefined,
    }),
  });

  const data = (await res.json()) as { error?: string; profile?: GoogleProfile };
  if (!res.ok || data.error) {
    throw new Error(data.error || "Google 认证授权失败");
  }
  if (!data.profile) {
    throw new Error("Google 认证授权响应缺少 profile");
  }
  return data.profile;
}

/**
 * Writes a completed sign-in through the one channel that notifies every
 * consumer. Separate from the exchange so the write is a single fact as well:
 * a caller that fetched a profile and forgot to store it is exactly the
 * half-fix this round is closing.
 */
export function recordGoogleProfile(profile: GoogleProfile): void {
  writeAccountState("google", profile);
}
