/**
 * Browser-side holder for the Koliance session token (issue #35).
 * The token is minted by /api/auth/google/exchange or /api/auth/wallet and
 * sent as `Authorization: Bearer <token>`; the server verifies it.
 */
export const SESSION_TOKEN_KEY = "koliance_session_token";
export const WALLET_SESSION_PREFIX = "koliance_wallet_session:";

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function getSessionToken(): string | null {
  return storage()?.getItem(SESSION_TOKEN_KEY) ?? null;
}

export function setSessionToken(token: string | null | undefined): void {
  const s = storage();
  if (!s) return;
  if (token) s.setItem(SESSION_TOKEN_KEY, token);
  else s.removeItem(SESSION_TOKEN_KEY);
}

export function getWalletSessionToken(wallet: string): string | null {
  return storage()?.getItem(WALLET_SESSION_PREFIX + wallet.toLowerCase()) ?? null;
}

export function clearSessionTokens(): void {
  const s = storage();
  if (!s) return;
  s.removeItem(SESSION_TOKEN_KEY);
  for (let i = s.length - 1; i >= 0; i--) {
    const k = s.key(i);
    if (k && k.startsWith(WALLET_SESSION_PREFIX)) s.removeItem(k);
  }
}

export function authHeaders(token: string | null | undefined): Record<string, string> {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * Proves ownership of `wallet` by signing a server-issued challenge and
 * returns a session token bound to it (cached per wallet).
 */
export async function ensureWalletSession(
  wallet: string,
  signMessage: (message: string) => Promise<string>
): Promise<string> {
  const cached = getWalletSessionToken(wallet);
  if (cached) return cached;
  const chRes = await fetch(`/api/auth/wallet?address=${encodeURIComponent(wallet)}`);
  const ch = await chRes.json();
  if (!chRes.ok) throw new Error(ch.error || "Failed to get wallet challenge");
  const signature = await signMessage(ch.message);
  const res = await fetch("/api/auth/wallet", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address: wallet, challenge: ch.challenge, signature }),
  });
  const data = await res.json();
  if (!res.ok || !data.sessionToken) throw new Error(data.error || "Wallet sign-in failed");
  storage()?.setItem(WALLET_SESSION_PREFIX + wallet.toLowerCase(), data.sessionToken);
  if (data.rewardGranted && typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("koliance:reward", { detail: data.rewardGranted }));
  }
  return data.sessionToken as string;
}

