import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { OAUTH_REDIRECT_URI } from "../src/lib/authConfig";
import {
  GOOGLE_EXCHANGE_ENDPOINT,
  exchangeGoogleCode,
  isGoogleOAuthCallback,
  parseGoogleCallback,
  recordGoogleProfile,
  type GoogleProfile,
} from "../src/lib/googleAuth";
import { STORAGE_KEYS, readAccountState } from "../src/lib/authState";

/**
 * Issue #34, second round - "after signing in with Google the account centre
 * still shows no user information and the Google row still says Sign In".
 *
 * The first round (`docs/changes/049`) fixed the *read* half: the navbar derives
 * its account state from `localStorage` and `writeAccountState` notifies it.
 * Every test in `tests/auth-state.test.ts` passes with that half correct.
 *
 * What the user is watching is the *write* half, and it never runs:
 *
 *   1. `NavAuthBadges.handleGoogleLogin` sends the browser to Google with
 *      `redirect_uri=<site root>` - the URI registered with Google, so the
 *      return trip always lands on `/`, whatever page the click came from;
 *   2. on `/`, `AgentCardTerminal:137` reads `?code=` and assumes it is
 *      GitHub's, switches tabs, and leaves `GoogleAuthWall` - the only
 *      component that exchanged a Google code - unmounted;
 *   3. no exchange runs, no profile is written, and the navbar renders
 *      "Sign In" over a user who has just signed in.
 *
 * So this suite pins three things, in the order they fail:
 *
 *   - the two `?code=` flows are told apart (a GitHub callback must not be
 *     spent against the Google route, or the reverse);
 *   - the exchange request carries the redirect URI that was used to *ask* for
 *     the code, because Google refuses the pair when they differ;
 *   - a completed exchange reaches the store through the one channel, which is
 *     what makes the navbar re-render.
 *
 * The component's own event chain (mount -> exchange -> store -> navbar text)
 * still needs a renderer and stays in GAP-73; what is bound here is every step
 * that does not.
 */

// ==================== FIXTURES ====================

class FakeStorage {
  private map = new Map<string, string>();
  getItem(key: string): string | null {
    return this.map.has(key) ? (this.map.get(key) as string) : null;
  }
  setItem(key: string, value: string): void {
    this.map.set(key, String(value));
  }
  removeItem(key: string): void {
    this.map.delete(key);
  }
  raw(key: string): string | null {
    return this.getItem(key);
  }
}

class FakeEventTarget {
  private listeners = new Map<string, Set<() => void>>();
  addEventListener(type: string, listener: () => void): void {
    const set = this.listeners.get(type) ?? new Set();
    set.add(listener);
    this.listeners.set(type, set);
  }
  removeEventListener(type: string, listener: () => void): void {
    this.listeners.get(type)?.delete(listener);
  }
  dispatchEvent(event: { type: string }): boolean {
    for (const listener of this.listeners.get(event.type) ?? []) listener();
    return true;
  }
}

let storage: FakeStorage;
let windowStub: FakeEventTarget;

beforeEach(() => {
  storage = new FakeStorage();
  windowStub = new FakeEventTarget();
  (globalThis as unknown as { window: unknown }).window = windowStub;
  (globalThis as unknown as { localStorage: unknown }).localStorage = storage;
});

afterEach(() => {
  delete (globalThis as unknown as { window?: unknown }).window;
  delete (globalThis as unknown as { localStorage?: unknown }).localStorage;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** What Google actually appends to the redirect URI. */
const GOOGLE_SCOPE =
  "openid email profile https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile";

/** What GitHub appends: a `code` and a `state`, and no `scope` at all. */
const GITHUB_STATE = "Zm9vYmFyYmF6cXV4Zm9vYmFyYmF6cXV4Zm9v.e30";

const EXCHANGE_PROFILE: GoogleProfile = {
  googleId: "109842839210492819283",
  email: "ada@example.com",
  emailVerified: true,
  name: "Ada Lovelace",
  picture: "https://lh3.googleusercontent.com/a/ada=s96-c",
  bio: "Analytical engines",
  walletAddress: "0x89205A3A3b2A69De6Dbf7f01ED13B2108B2c43e7",
  trustTier: "GOOGLE VERIFIED CITIZEN",
  creditAllowanceUSD: 600,
};

function googleCallbackParams(extra: Record<string, string> = {}): URLSearchParams {
  return new URLSearchParams({
    code: "4/0AY0e-g7google-code",
    scope: GOOGLE_SCOPE,
    authuser: "0",
    prompt: "consent",
    ...extra,
  });
}

function githubCallbackParams(): URLSearchParams {
  return new URLSearchParams({ code: "gho_github_code", state: GITHUB_STATE });
}

// ==================== THE TWO ?code= FLOWS ====================

describe("a Google callback is told apart from a GitHub one", () => {
  it("accepts Google's callback, which carries a googleapis scope", () => {
    expect(isGoogleOAuthCallback(googleCallbackParams())).toBe(true);
  });

  it("refuses GitHub's callback, which carries a state and no scope", () => {
    // This is the discriminator, and it is the whole of the mis-routing above:
    // drop the `scope` half of the test and every GitHub sign-in is claimed by
    // the Google handler (and vice versa), because both arrive as `?code=`.
    expect(isGoogleOAuthCallback(githubCallbackParams())).toBe(false);
  });

  it("refuses a scope that is not Google's", () => {
    // A `scope` parameter alone is not enough - it has to be Google's own
    // scopes, which are the only ones Google appends to a redirect.
    expect(isGoogleOAuthCallback(new URLSearchParams({ code: "x", scope: "repo read:user" }))).toBe(
      false
    );
  });

  it("refuses a URL with no code at all", () => {
    expect(isGoogleOAuthCallback(new URLSearchParams({ scope: GOOGLE_SCOPE }))).toBe(false);
    expect(isGoogleOAuthCallback(new URLSearchParams())).toBe(false);
    // The empty-string code is the shape a bare `?code=` produces, and it must
    // not be exchanged.
    expect(isGoogleOAuthCallback(new URLSearchParams({ code: "", scope: GOOGLE_SCOPE }))).toBe(false);
  });

  it("names which 'not a Google callback' it is, rather than answering one null", () => {
    // The two outcomes call for different behaviour - "leave this alone, it is
    // somebody else's flow" vs. "there is no callback here" - and collapsing
    // them is what let a Google code be read as a GitHub one.
    expect(parseGoogleCallback(googleCallbackParams())).toEqual({
      kind: "google",
      code: "4/0AY0e-g7google-code",
    });
    expect(parseGoogleCallback(githubCallbackParams())).toEqual({
      kind: "other",
      reason: "not-google",
    });
    expect(parseGoogleCallback(new URLSearchParams())).toEqual({
      kind: "other",
      reason: "no-code",
    });
  });

  it("reads the code out of the real URL Google returns, not just a bare parameter map", () => {
    // End to end through `new URL`, so the parse is exercised on the shape the
    // browser actually hands over (a query string with the scope percent-encoded).
    const url = new URL(
      "https://koliance.oodai.space/?code=4%2F0AY0e-g7x&scope=" +
        encodeURIComponent(GOOGLE_SCOPE) +
        "&authuser=0&prompt=consent"
    );
    expect(parseGoogleCallback(url.searchParams)).toEqual({
      kind: "google",
      code: "4/0AY0e-g7x",
    });
  });
});

// ==================== THE EXCHANGE REQUEST ====================

describe("the exchange carries the redirect URI the code was issued for", () => {
  function stubFetch(response: { ok: boolean; body: unknown }) {
    const fetchMock = vi.fn(async () => ({
      ok: response.ok,
      json: async () => response.body,
    }));
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }

  it("posts the code and the registered redirect URI", async () => {
    const fetchMock = stubFetch({ ok: true, body: { success: true, profile: EXCHANGE_PROFILE } });

    const profile = await exchangeGoogleCode("4/0AY0e-g7google-code", "0xWallet");

    expect(profile).toEqual(EXCHANGE_PROFILE);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [endpoint, init] = fetchMock.mock.calls[0] as unknown as [string, { body: string }];
    expect(endpoint).toBe(GOOGLE_EXCHANGE_ENDPOINT);

    const body = JSON.parse(init.body) as {
      code: string;
      redirect_uri: string;
      wallet_address?: string;
    };
    expect(body.code).toBe("4/0AY0e-g7google-code");
    // The load-bearing one. Google refuses the exchange unless this is
    // byte-identical to the `redirect_uri` in the authorization request, and
    // the pre-fix code spelled it out twice - once in `NavAuthBadges` and once
    // in `GoogleAuthWall`. A drift between the two is a sign-in that can never
    // complete, with no error anywhere until the user is back on the page.
    expect(body.redirect_uri).toBe(OAUTH_REDIRECT_URI);
    expect(body.wallet_address).toBe("0xWallet");
  });

  it("omits the wallet rather than sending an empty string", async () => {
    const fetchMock = stubFetch({ ok: true, body: { profile: EXCHANGE_PROFILE } });
    await exchangeGoogleCode("c", null);
    const body = JSON.parse(
      (fetchMock.mock.calls[0] as unknown as [string, { body: string }])[1].body
    ) as { wallet_address?: string };
    expect(body.wallet_address).toBeUndefined();
  });

  it("surfaces the route's own message instead of a generic one", async () => {
    stubFetch({ ok: false, body: { error: "Failed to exchange Google OAuth code" } });
    await expect(exchangeGoogleCode("c")).rejects.toThrow("Failed to exchange Google OAuth code");
  });

  it("refuses a 200 that carries no profile", async () => {
    // The pre-fix code did `setProfile(data.profile)` unguarded, so a route
    // that answered without one stored `undefined` under the identity key - a
    // row that identifies nobody, rendered as a signed-in account.
    stubFetch({ ok: true, body: { success: true } });
    await expect(exchangeGoogleCode("c")).rejects.toThrow("profile");
  });
});

// ==================== THE WRITE REACHES THE STORE ====================

describe("a completed sign-in reaches the one channel the navbar reads", () => {
  it("stores the profile so the next read sees the account", () => {
    expect(readAccountState().google).toBeNull();
    recordGoogleProfile(EXCHANGE_PROFILE);

    const account = readAccountState().google;
    expect(account).not.toBeNull();
    expect(account?.name).toBe("Ada Lovelace");
    expect(account?.email).toBe("ada@example.com");
    // The avatar, which the pre-#34 read path dropped entirely.
    expect(account?.picture).toBe(EXCHANGE_PROFILE.picture);
  });

  it("writes through the shared key, not a second spelling of it", () => {
    recordGoogleProfile(EXCHANGE_PROFILE);
    expect(storage.raw(STORAGE_KEYS.google)).toBe(JSON.stringify(EXCHANGE_PROFILE));
  });
});

// ==================== THE HANDLER IS MOUNTED WHERE IT CAN RUN ====================

const SRC_ROOT = resolve(import.meta.dirname, "../src");

function read(relative: string): string {
  return readFileSync(join(SRC_ROOT, relative), "utf8");
}

describe("the callback handler runs wherever Google lands", () => {
  it("is mounted in the root layout, not on a page", () => {
    // STRUCTURAL, and labelled as such. Whether React runs the effect needs a
    // renderer this suite does not have (GAP-73). What is checkable is the
    // placement, and the placement is the fix: the registered redirect URI is
    // the site root, so a handler that lives on one page is a handler that is
    // usually not mounted when the code arrives - which is exactly how the
    // first round's fix left the write half undone.
    const layout = read("app/layout.tsx");
    expect(layout).toContain("<GoogleAuthCallback />");
    // Inside the account provider, or the write it performs notifies a tree
    // that does not contain the navbar.
    expect(layout.indexOf("<KolianceAuthProvider>")).toBeLessThan(
      layout.indexOf("<GoogleAuthCallback />")
    );
  });

  it("is the only component that claims the code, and the others stand back", () => {
    // The other half of the mis-routing. `AgentCardTerminal` and
    // `GitHubDevWall` both read `?code=` for their own flows, and a Google
    // return lands on the same page as the first of them.
    for (const file of ["components/AgentCardTerminal.tsx", "components/GitHubDevWall.tsx"]) {
      const source = read(file);
      expect(source, `${file} no longer knows what a Google callback looks like`).toContain(
        "isGoogleOAuthCallback"
      );
      // Bound to the read it guards, so importing the predicate and not using
      // it does not satisfy this.
      expect(source, `${file} claims the Google code as its own`).toMatch(
        /if\s*\(\s*\w+\s*&&\s*!isGoogleOAuthCallback\(/
      );
    }
  });
});
