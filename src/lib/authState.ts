/**
 * The navigation bar's view of "who is signed in".
 *
 * Why this module exists (issue #34, root cause read off the source):
 *
 * `NavAuthBadges` used to own three `useState` blobs that were filled by
 * `syncAuthState()`, which ran exactly twice in a page's life - once on mount
 * and once on a `storage` event. That first effect carried `[]` as its
 * dependency list (the old `NavAuthBadges.tsx:167-172`), so the Google OAuth
 * path could not reach it:
 *
 *   1. `NavAuthBadges.handleGoogleLogin` leaves the page
 *      (`accounts.google.com/o/oauth2/auth?...`) or, with Privy configured,
 *      calls `linkGoogle()`/`login()`, which leaves the page too.
 *   2. The browser comes back to the app - a full document load. The navbar
 *      mounts and reads `localStorage` BEFORE the exchange has run, so it
 *      reads `null` and renders "Sign In".
 *   3. `GoogleAuthWall.handleExchangeCode` then writes
 *      `koliance_google_profile` - but by then the mount effect is long done.
 *
 * The `storage` event cannot close that gap: the HTML spec fires it only in
 * *other* documents of the same origin, never in the one that wrote the value,
 * so the tab that signs in never hears its own write. Everything the wall can
 * do locally (`setProfile`, `setSyncSuccess`, `onProfileSynced`) updates the
 * wall's own subtree, which is not the navbar.
 *
 * So the account state has to stop being a snapshot taken at mount and become a
 * value derived from its source of record. This file is that derivation, kept
 * free of React: `NavAuthBadges` computes it on every render, and
 * `KolianceAuthProvider` re-renders on every write, because a login must be
 * visible to every subscriber at once rather than to whichever component
 * happened to make the call.
 *
 * Two of the symptoms in issue #34 have their own line here:
 *  - the avatar ("头像"): the profile read path dropped `picture` entirely
 *    (the comment at the old `NavAuthBadges.tsx:95` even said so: "Auth states
 *    stored in localStorage"), so even a late-arriving profile could never
 *    render a face.
 *  - the "Sign In" button (issue #34's `:539`): it lived in the identity-badge
 *    list inside the dropdown, gated on `googleUser`, and therefore rendered
 *    "Sign In" for a signed-in wallet-only user as well.
 */

/**
 * The single record of record for a signed-in identity. `localStorage` still
 * holds these, one key per rail, but reads go through `readAccountState` and
 * writes through `writeAccountState` so the two can never drift apart.
 */
export interface AccountState {
  google: GoogleAccount | null;
  github: GithubAccount | null;
  steam: SteamAccount | null;
}

export interface GoogleAccount {
  id: string;
  name: string;
  email: string;
  picture: string | null;
  bio: string | null;
  walletAddress: string | null;
  tier: string;
  creditAllowanceUSD: number;
  synthetic: boolean;
}

export interface GithubAccount {
  username: string;
  avatarUrl: string | null;
  tier: string;
}

export interface SteamAccount {
  steamId: string;
  personaName: string;
}

/**
 * The flat identity `NavAuthBadges` renders: the name, the e-mail and the face.
 * No id: nothing renders one, and carrying a half-normalised id (raw `subject`
 * for Google, a DID for the rest) would invite a second identity convention
 * alongside `GoogleAccount.id`.
 */
export interface AccountIdentity {
  name: string;
  email: string;
  picture: string | null;
}

export const EMPTY_ACCOUNT_STATE: AccountState = {
  google: null,
  github: null,
  steam: null,
};

/** The single write channel. Every writer of identity state goes through this. */
export const STORAGE_KEYS = {
  google: "koliance_google_profile",
  github: "koliance_github_user",
  steam: "koliance_steam_id",
} as const;

/**
 * Fired on `window` by every write. `storage` is not an option: the spec fires
 * it in other documents only, so the signing-in tab never receives its own.
 * One event, one channel - no per-field constants to drift apart.
 */
export const ACCOUNT_STATE_EVENT = "koliance-account-changed";

function asString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

/**
 * Reads a JSON blob without throwing. `localStorage` is user-writable and has
 * held a bare string for GitHub at least once (`GitHubDevWall` used to store
 * `data.stats.username` raw), so a `JSON.parse` failure is an expected input,
 * not an exception path.
 */
function readJson(raw: string | null): Record<string, unknown> | null {
  if (raw === null) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

/**
 * Accepts either a JSON string or an already-parsed record, because both
 * arrive here: `localStorage.getItem` returns a string, while an in-memory
 * profile (the navbar's own demo row, or a refreshed Privy user) is an object.
 */
function coerceRecord(raw: unknown): Record<string, unknown> | null {
  if (typeof raw === "string") return readJson(raw);
  if (typeof raw === "object" && raw !== null) return raw as Record<string, unknown>;
  return null;
}

/**
 * Builds the Google half from the exchange route's profile
 * (`src/app/api/auth/google/exchange/route.ts`, which emits `googleId` / `name` /
 * `email` / `picture` / `bio` / `walletAddress` / `trustTier` /
 * `creditAllowanceUSD` / `synthetic`) or from the synthetic demo row written by
 * the navbar's own demo button.
 *
 * The DB-shaped aliases (`trust_tier`, `wallet_address`, `credit_allowance_usd`,
 * `id` in place of `googleId`) are accepted because more than one writer has
 * produced rows in that shape - `EditProfileModal` rewrites the cached row on
 * every save, and the navbar's synthetic demo row spells the fields the database
 * way. Reading only the exchange route's spelling would silently un-link a
 * returning user whose stored profile predates this fix, i.e. reproduce issue
 * #34 by another route.
 *
 * `credit_allowance_usd` was the one column with no alias while its neighbours
 * had one (`001_init_and_composite_indexes.sql:92`, and `DbUserRecord` in
 * `src/lib/db.ts` uses that spelling). A row read straight out of the database -
 * `GET /api/user/profile` selects `*` - therefore arrived with a `$600` default
 * in place of the real allowance, and the number is not cosmetic: the navbar
 * renders it and `AgentCardTerminal` adds it to the card's credit limit.
 * `synthetic` is folded in for the same reason the others were: `select("*")`
 * hands back column names, not JSON keys.
 */
export function googleAccountFromProfile(raw: unknown): GoogleAccount | null {
  const g = coerceRecord(raw);
  if (!g) return null;

  const googleId = asString(g.googleId);
  const email = asString(g.email);
  // Precedence preserved from the pre-fix read path: a stored `id` (already a
  // DID once a row has round-tripped) wins, otherwise one is built from
  // `googleId`. `EditProfileModal` authenticates with `Bearer ${profile.id}`
  // and strips this exact prefix back off, so the spelling is load-bearing.
  const id =
    asString(g.id) ??
    (googleId !== null
      ? `did:koliance:google:${googleId}`
      : email !== null
        ? `did:koliance:google:${email}`
        : null);
  // A row with no id and no email identifies nobody; treating it as a signed-in
  // account would be the same class of defect as the stale "Sign In" button.
  if (id === null) return null;

  const name = asString(g.name) ?? email ?? "Koliance Developer";
  return {
    id,
    name,
    email: email ?? "",
    picture: asString(g.picture),
    bio: asString(g.bio),
    walletAddress: asString(g.walletAddress) ?? asString(g.wallet_address),
    tier: asString(g.trustTier) ?? asString(g.trust_tier) ?? "GOOGLE VERIFIED CITIZEN",
    // `0` is a real value here (the synthetic demo is granted exactly 0), so the
    // default must not swallow it. Both spellings are read for the same reason
    // as `wallet_address` above and in the same order.
    creditAllowanceUSD:
      typeof g.creditAllowanceUSD === "number"
        ? g.creditAllowanceUSD
        : typeof g.credit_allowance_usd === "number"
          ? g.credit_allowance_usd
          : 600,
    synthetic: g.synthetic === true || g.synthetic === 1,
  };
}

export function githubAccountFromStorage(raw: string | null): GithubAccount | null {
  const trimmed = raw === null ? null : raw.trim();
  if (trimmed === null || trimmed === "") return null;

  // Plain string form: the username itself.
  if (!trimmed.startsWith("{")) {
    return { username: trimmed, avatarUrl: null, tier: "BUIDLER" };
  }

  const gh = readJson(trimmed);
  if (!gh) return null;
  const username = asString(gh.username) ?? asString(gh.login);
  if (username === null) return null;
  return {
    username,
    avatarUrl: asString(gh.avatarUrl) ?? asString(gh.avatar_url),
    tier: asString(gh.buidlTier) ?? "BUIDLER",
  };
}

export function steamAccountFromStorage(raw: string | null): SteamAccount | null {
  const steamId = raw === null ? null : raw.trim();
  if (steamId === null || steamId === "") return null;
  return { steamId, personaName: `Steam:${steamId.slice(-6)}` };
}

/**
 * The Google row exactly as it sits in the store, un-normalised.
 *
 * `readAccountState().google` has already been through
 * `googleAccountFromProfile`, so it carries `id` and `tier` - field names the
 * store may never have contained (a row written by the exchange route has
 * `googleId` and `trustTier`). A bridge that has to decide "is the stored row
 * already the one I would write?" therefore cannot compare against it: it would
 * be comparing a derived row with a differently-spelled one, and the two are
 * never equal.
 *
 * Structurally: comparing two differently-spelled derived rows cannot terminate
 * the loop it is meant to guard, because the inequality it produces is caused by
 * the comparison itself rather than by the store having changed.
 */
export function storedGoogleRow(): Record<string, unknown> | null {
  if (typeof window === "undefined") return null;
  try {
    return coerceRecord(localStorage.getItem(STORAGE_KEYS.google));
  } catch {
    return null;
  }
}

/**
 * The identity a stored row is recognised by, in the same spelling as `GoogleAccount.id`.
 *
 * `googleId` is read before `id`, and here that order IS load-bearing (unlike in
 * `googleAccountFromProfile`, where the two agree for every row a writer
 * produces). A row can carry both and have them disagree - `EditProfileModal`
 * spreads a `UserProfileData` (which carries a derived `id`) next to a
 * recomputed `googleId`. Reading `id` first would make the bridge treat such a
 * row as a *different* account, overwrite it, and discard the user's edit.
 */
export function googleRowKey(row: Record<string, unknown> | null): string | null {
  if (!row) return null;
  const googleId = asString(row.googleId);
  if (googleId !== null) return `did:koliance:google:${googleId}`;
  const id = asString(row.id);
  if (id !== null) return id;
  const email = asString(row.email);
  return email !== null ? `did:koliance:google:${email}` : null;
}

/**
 * The whole signed-in state, derived from `localStorage` on every call.
 *
 * Called during render rather than from an effect on purpose: during hydration
 * on the client, `localStorage` already holds the value written before the
 * redirect, so the first client render is already correct. An effect would
 * produce one render of stale state, which is the defect being fixed.
 */
export function readAccountState(): AccountState {
  if (typeof window === "undefined") return EMPTY_ACCOUNT_STATE;
  try {
    return {
      google: googleAccountFromProfile(localStorage.getItem(STORAGE_KEYS.google)),
      github: githubAccountFromStorage(localStorage.getItem(STORAGE_KEYS.github)),
      steam: steamAccountFromStorage(localStorage.getItem(STORAGE_KEYS.steam)),
    };
  } catch {
    // Safari private mode and similar throw on access rather than returning
    // null. An unreadable store is "signed out", never an exception.
    return EMPTY_ACCOUNT_STATE;
  }
}

/**
 * The single write channel. `null` removes the key; an object is stored as JSON.
 *
 * A write whose stored bytes would not change is not an event, and this is
 * load-bearing rather than an optimisation. Several effects both depend on the
 * account state and write it (the Privy bridge in `NavAuthBadges` is the live
 * one). For such an effect the notification it causes is the one it waits for,
 * so "notify on every call" makes the effect re-arm itself; termination then
 * rests entirely on the effect's own equality test, which is exactly the kind
 * of guard that looks like it works and silently does not (D3).
 *
 * Comparing the bytes that would be stored settles it one layer down, where it
 * cannot be defeated by the write it is meant to stop:
 *  - it does not depend on the previous row having come from the same writer,
 *    which is the hole in an equality test on the derived object (a stored `id`
 *    written by `EditProfileModal` never equals the one the bridge derives);
 *  - it does not depend on field order or on absent fields, because both sides
 *    are produced by the same `JSON.stringify` of the value's own shape;
 *  - it holds even if a caller's guard is rewritten or deleted later.
 *
 * Equality is deliberately byte equality of the stored form: if the bytes
 * differ, the store really did change, and a subscriber is owed the news.
 */
export function writeAccountState<K extends keyof typeof STORAGE_KEYS>(
  rail: K,
  value: unknown
): void {
  if (typeof window === "undefined") return;
  try {
    const key = STORAGE_KEYS[rail];

    // What this call would leave in the store; `null` means "no key at all".
    let next: string | null;
    if (value === null || value === undefined) {
      next = null;
    } else if ((rail === "github" || rail === "steam") && typeof value === "string") {
      // Kept as a bare string: `GitHubDevWall` reads this key with
      // `loadProfile(cachedUser)`, which takes the raw username, and a stored
      // JSON object would be handed to the GitHub API as a username.
      next = value;
    } else {
      next = JSON.stringify(value);
    }

    // The no-op guard. Read straight off the store rather than off `state`, so
    // it sees what a reload would see.
    if (localStorage.getItem(key) === next) return;

    if (next === null) localStorage.removeItem(key);
    else localStorage.setItem(key, next);

    // Same-tab notification. Does not throw when SSR-guarded above.
    window.dispatchEvent(new Event(ACCOUNT_STATE_EVENT));
  } catch {
    // Quota or private mode: the write is the user's intent but not a crash.
  }
}

/**
 * The flat identity `NavAuthBadges` renders: a Google profile when there is
 * one, the GitHub rail otherwise, and nothing at all when neither is present.
 *
 * The Privi bridge is not consulted here - it is passed in as `privyIdentity`
 * by the caller, which builds it from the reviewed fields of a `Privy User`
 * (see `privyIdentityFromUser` in `src/components/NavAuthBadges.tsx`).
 */
export function mergeIdentity(
  state: AccountState,
  privyIdentity: AccountIdentity | null
): AccountIdentity | null {
  if (privyIdentity) return privyIdentity;
  if (state.google) {
    return {
      name: state.google.name,
      email: state.google.email,
      picture: state.google.picture,
    };
  }
  if (state.github) {
    return {
      name: state.github.username,
      // The GitHub rail authenticates a username, not an address; the navbar
      // shows the rail name rather than an e-mail it does not have.
      email: "",
      picture: state.github.avatarUrl,
    };
  }
  return null;
}

/**
 * The wallet the account is bound to, preferring the connected wallet.
 *
 * Both spellings of the bound address are folded into `GoogleAccount` by
 * `googleAccountFromProfile`, so this only has to pick between the live
 * connection and the record.
 */
export function effectiveWalletAddress(
  state: AccountState,
  connectedWallet: string | null | undefined
): string | null {
  if (connectedWallet) return connectedWallet;
  return state.google?.walletAddress ?? null;
}
