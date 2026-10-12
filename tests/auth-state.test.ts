import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  ACCOUNT_STATE_EVENT,
  EMPTY_ACCOUNT_STATE,
  STORAGE_KEYS,
  effectiveWalletAddress,
  githubAccountFromStorage,
  googleAccountFromProfile,
  googleRowKey,
  mergeIdentity,
  readAccountState,
  steamAccountFromStorage,
  storedGoogleRow,
  writeAccountState,
} from "../src/lib/authState";

/**
 * Issue #34 - "after signing in with Google the interface shows no user
 * information (avatar / name / e-mail), and the header button still says
 * Sign In".
 *
 * The diagnosis, read off the pre-fix source rather than guessed:
 *
 *   The navbar derived its account state in a mount effect with `[]` as its
 *   dependency list (`NavAuthBadges.tsx:167-172` before this fix), and listened
 *   for the DOM `storage` event to refresh. Neither can observe the sign-in:
 *
 *     - the Google path leaves the document (a redirect, or Privy's own modal),
 *       so the navbar mounts on the way back with `localStorage` still empty;
 *     - `handleExchangeCode` writes the profile afterwards, in the same
 *       document;
 *     - `storage` is delivered to *other* documents only, so the document that
 *       wrote the value never receives it.
 *
 *   A wall-local `setProfile` / `setSyncSuccess` / `onProfileSynced` updates the
 *   wall's subtree, and the navbar is a sibling, not a descendant.
 *
 *   Two further symptoms in the same report have their own mechanical causes:
 *   the avatar could never render because the profile read path dropped
 *   `picture`, and "Sign In" was gated on the Google rail alone, so a
 *   signed-in wallet-only user saw it too.
 *
 * This suite is written against `src/lib/authState.ts` - the derivation the
 * navbar now performs on every render - so it is independent of the component's
 * internals and of any DOM. It runs in the `node` environment by faking the two
 * globals the module touches (`window`, `localStorage`) rather than by pulling
 * in a DOM library, which keeps it on the repo's existing test surface.
 *
 * A note on what the fake IS and IS NOT: `FakeEventTarget` below reproduces the
 * same-document delivery our own event provides. It deliberately does NOT
 * reproduce `storage`, because that event's cross-document-only delivery is the
 * defect, not something to emulate - test "the navbar's first render is already
 * correct" covers that direction instead.
 */

// ==================== THE BROWSER-LIKE FIXTURE ====================

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
  clear(): void {
    this.map.clear();
  }
  get length(): number {
    return this.map.size;
  }
  key(index: number): string | null {
    return [...this.map.keys()][index] ?? null;
  }
  /** Test-only: what a caller would see without going through the module. */
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
  /** The count a subscription assertion needs; the module never calls it. */
  listenerCount(type: string): number {
    return this.listeners.get(type)?.size ?? 0;
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
  vi.restoreAllMocks();
});

/** The profile `POST /api/auth/google/exchange` returns on success. */
const EXCHANGE_PROFILE = {
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

// ==================== THE DEFECT ====================

describe("issue #34 - a sign-in that completes after the navbar mounted", () => {
  it("is visible to a reader that runs after the write, not just at mount", () => {
    // Step 2 of the sequence: the navbar mounts on the way back from Google,
    // before the exchange route has answered.
    expect(readAccountState().google).toBeNull();

    // Step 3: the exchange finishes and the wall records the profile.
    writeAccountState("google", EXCHANGE_PROFILE);

    // The navbar's next render derives, so it sees the account. Under the old
    // design this read happened once at mount and never again.
    const state = readAccountState();
    expect(state.google).not.toBeNull();
    expect(state.google?.name).toBe("Ada Lovelace");
    expect(state.google?.email).toBe("ada@example.com");
  });

  it("notifies every subscriber in the writing document", () => {
    // The replacement for the `storage` listener. Asserted as a subscription
    // that fires, not as a source pattern, because the failure mode being fixed
    // was precisely a listener that existed and never ran.
    const onAccountChanged = vi.fn();
    windowStub.addEventListener(ACCOUNT_STATE_EVENT, onAccountChanged);

    writeAccountState("google", EXCHANGE_PROFILE);
    expect(onAccountChanged).toHaveBeenCalledTimes(1);

    // And unsubscribing is honoured, so a torn-down navbar does not accumulate
    // listeners across a session.
    windowStub.removeEventListener(ACCOUNT_STATE_EVENT, onAccountChanged);
    writeAccountState("github", "ada");
    expect(onAccountChanged).toHaveBeenCalledTimes(1);
  });

  it("carries the avatar URL, so the pill can render a face and not a glyph", () => {
    writeAccountState("google", EXCHANGE_PROFILE);
    const state = readAccountState();
    expect(state.google?.picture).toBe(EXCHANGE_PROFILE.picture);
    expect(mergeIdentity(state, null)?.picture).toBe(EXCHANGE_PROFILE.picture);
  });

  it("still resolves the bound wallet through the DB spelling of the field", () => {
    // `EditProfileModal` and rows that round-tripped through the database write
    // `wallet_address`; the exchange route writes `walletAddress`. A returning
    // user must not lose their bound wallet to the spelling difference.
    writeAccountState("google", { ...EXCHANGE_PROFILE, walletAddress: undefined, wallet_address: "0xAbC" });
    expect(effectiveWalletAddress(readAccountState(), null)).toBe("0xAbC");
    // A live connection wins over the record.
    expect(effectiveWalletAddress(readAccountState(), "0xLive")).toBe("0xLive");
  });
});

// ==================== THE OTHER TWO SYMPTOMS ====================

describe("issue #34 - the state the navbar shows once signed in", () => {
  it("shows the connected wallet even when no social rail is linked", () => {
    // The "Sign In" button was gated on the Google rail, so a wallet-only user
    // read as signed out. The wallet is an identity here, and the merge says so.
    const identity = mergeIdentity(EMPTY_ACCOUNT_STATE, {
      name: "0x8920...43e7",
      email: "",
      picture: null,
    });
    expect(identity?.name).toBe("0x8920...43e7");
  });

  it("prefers the live Privy identity over a stale stored row", () => {
    writeAccountState("google", { ...EXCHANGE_PROFILE, name: "Stored Name" });
    const identity = mergeIdentity(readAccountState(), {
      name: "Privy Name",
      email: "privy@example.com",
      picture: null,
    });
    expect(identity?.name).toBe("Privy Name");
    expect(identity?.email).toBe("privy@example.com");
  });

  it("falls back to the GitHub rail when there is no Google row", () => {
    writeAccountState("github", "ada-lovelace");
    const state = readAccountState();
    expect(state.google).toBeNull();
    expect(mergeIdentity(state, null)?.name).toBe("ada-lovelace");
  });

  it("is nothing at all when no rail is linked", () => {
    expect(mergeIdentity(readAccountState(), null)).toBeNull();
  });
});

// ==================== SIGN OUT (the counterpart) ====================

describe("sign out returns to the signed-out state", () => {
  it("clears the identity rows and the derived identity with them", () => {
    writeAccountState("google", EXCHANGE_PROFILE);
    writeAccountState("github", "ada-lovelace");
    writeAccountState("steam", "76561198000000000");
    expect(mergeIdentity(readAccountState(), null)).not.toBeNull();

    for (const rail of ["google", "github", "steam"] as const) {
      writeAccountState(rail, null);
    }

    expect(readAccountState()).toEqual(EMPTY_ACCOUNT_STATE);
    expect(mergeIdentity(readAccountState(), null)).toBeNull();
    // Removed, not blanked: a leftover empty string would parse to null anyway,
    // but a leftover row would resurrect the account on the next read.
    for (const key of Object.values(STORAGE_KEYS)) {
      expect(storage.raw(key)).toBeNull();
    }
  });

  it("unlinks one rail without touching the others", () => {
    writeAccountState("google", EXCHANGE_PROFILE);
    writeAccountState("github", "ada-lovelace");
    writeAccountState("google", null);
    const state = readAccountState();
    expect(state.google).toBeNull();
    expect(state.github?.username).toBe("ada-lovelace");
  });
});

// ==================== INPUT SHAPES (both writers, both eras) ====================

describe("the derivation accepts what the writers actually produce", () => {
  it("reads the exchange route's profile", () => {
    const account = googleAccountFromProfile(EXCHANGE_PROFILE);
    expect(account?.id).toBe(`did:koliance:google:${EXCHANGE_PROFILE.googleId}`);
    expect(account?.walletAddress).toBe(EXCHANGE_PROFILE.walletAddress);
    expect(account?.tier).toBe("GOOGLE VERIFIED CITIZEN");
  });

  it("reads a DB-shaped row (id / trust_tier / wallet_address)", () => {
    const account = googleAccountFromProfile({
      id: "did:koliance:google:42",
      email: "db@example.com",
      name: "DB Row",
      trust_tier: "GOOGLE VERIFIED CITIZEN",
      wallet_address: "0xDB",
    });
    expect(account?.id).toBe("did:koliance:google:42");
    expect(account?.tier).toBe("GOOGLE VERIFIED CITIZEN");
    expect(account?.walletAddress).toBe("0xDB");
  });

  it("keeps a zero credit allowance instead of replacing it with the default", () => {
    // The synthetic demo is granted exactly 0. `|| 600` would have printed a
    // $600 allowance on a row that is explicitly worth nothing.
    const account = googleAccountFromProfile({ ...EXCHANGE_PROFILE, creditAllowanceUSD: 0, synthetic: true });
    expect(account?.creditAllowanceUSD).toBe(0);
    expect(account?.synthetic).toBe(true);
  });

  it("refuses a row that identifies nobody", () => {
    // Asserting the negative is the point: a nameless row must read as signed
    // out, not as a signed-in account with blank fields.
    expect(googleAccountFromProfile({ name: "Nobody" })).toBeNull();
    expect(googleAccountFromProfile("not json")).toBeNull();
    expect(googleAccountFromProfile(null)).toBeNull();
  });

  it("reads the GitHub rail in both of its stored forms", () => {
    expect(githubAccountFromStorage("ada-lovelace")?.username).toBe("ada-lovelace");
    expect(githubAccountFromStorage('{"username":"ada","avatar_url":"https://x/a.png"}')).toEqual({
      username: "ada",
      avatarUrl: "https://x/a.png",
      tier: "BUIDLER",
    });
    expect(githubAccountFromStorage("   ")).toBeNull();
    expect(githubAccountFromStorage("{}")).toBeNull();
  });

  it("reads the Steam rail and derives its display name", () => {
    expect(steamAccountFromStorage("76561198000000000")).toEqual({
      steamId: "76561198000000000",
      personaName: "Steam:000000",
    });
    expect(steamAccountFromStorage("")).toBeNull();
  });

  it("treats an unreadable store as signed out rather than as an exception", () => {
    const throwing = {
      getItem: () => {
        throw new Error("SecurityError: localStorage is disabled");
      },
      setItem: () => {
        throw new Error("SecurityError: localStorage is disabled");
      },
      removeItem: () => {},
    };
    (globalThis as unknown as { localStorage: unknown }).localStorage = throwing;
    expect(readAccountState()).toEqual(EMPTY_ACCOUNT_STATE);
    expect(() => writeAccountState("google", EXCHANGE_PROFILE)).not.toThrow();
  });

  it("does nothing at all during server rendering", () => {
    // The layout is server-rendered first; touching `window` there would be a
    // crash, and returning a stale `localStorage` there would be a hydration
    // mismatch.
    delete (globalThis as unknown as { window?: unknown }).window;
    expect(readAccountState()).toEqual(EMPTY_ACCOUNT_STATE);
    expect(() => writeAccountState("google", EXCHANGE_PROFILE)).not.toThrow();
  });
});

// ==================== THE WRITE CHANNEL (mechanical guard, D3) ====================

const SRC_ROOT = resolve(import.meta.dirname, "../src");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.(ts|tsx)$/.test(full) ? [full] : [];
  });
}

/**
 * A direct access to one of the three identity keys is not a style violation -
 * it is the defect returning, in either direction.
 *
 * **Writes** (`setItem` / `removeItem`): `src/lib/authState.ts` is the only place
 * allowed to write these keys by name, because it is the only place that also
 * fires the notification. A component that calls
 * `localStorage.setItem("koliance_google_profile", …)` writes a value the navbar
 * has no reason to re-read: issue #34, exactly, with no test failure anywhere to
 * say so.
 *
 * **Reads** (`getItem`) are the other half of the same channel, and the half that
 * was still spelled out longhand after #34 was fixed (`GoogleAuthWall.tsx:60`,
 * `GitHubDevWall.tsx:80`, `AgentCardTerminal.tsx:184`). A read that goes through
 * `STORAGE_KEYS` cannot miss a rename of the key; a literal can, silently, and it
 * fails as "this visitor is signed out" rather than as an error.
 *
 * The single writer is identified as `src/lib/authState.ts` **or** as any file
 * that exports `writeAccountState` - never by "everything that matched came out
 * empty". An empty allow-list is what this guard returns when its pattern is
 * broken, so the test below asserts the writer was actually found.
 */
const DIRECT_ACCESS =
  /localStorage\.(setItem|removeItem|getItem)\(\s*["'](koliance_google_profile|koliance_github_user|koliance_steam_id)["']/;

function isTheSharedWriter(relativePath: string, source: string): boolean {
  return relativePath === "lib/authState.ts" || /export function writeAccountState\b/.test(source);
}

function directAccessOffenders(relative: (file: string) => string): string[] {
  return sourceFiles(SRC_ROOT)
    .filter((file) => {
      const source = readFileSync(file, "utf8");
      return DIRECT_ACCESS.test(source) && !isTheSharedWriter(relative(file), source);
    })
    .map(relative);
}

describe("the identity rows have exactly one writer", () => {
  it("read real content from every source file", () => {
    // Self-check: a wrong path or an empty walk would make the assertions below
    // pass over nothing at all.
    const files = sourceFiles(SRC_ROOT);
    expect(files.length, "the walk found no source files").toBeGreaterThan(30);
    const total = files.reduce((n, f) => n + readFileSync(f, "utf8").length, 0);
    expect(total, "the walk read no content").toBeGreaterThan(100_000);
    expect(files.map((f) => f.replace(/\\/g, "/"))).toContain(
      `${SRC_ROOT.replace(/\\/g, "/")}/lib/authState.ts`
    );
  });

  it("is src/lib/authState.ts, and no component", () => {
    const relative = (file: string) =>
      file.replace(/\\/g, "/").replace(`${SRC_ROOT.replace(/\\/g, "/")}/`, "");

    const writers = sourceFiles(SRC_ROOT).filter((file) =>
      isTheSharedWriter(relative(file), readFileSync(file, "utf8"))
    );
    // Without this, a relative-path or walk mistake empties `writers`, the
    // subtraction below yields nothing, and the guard reads as "clean" forever.
    expect(
      writers.map(relative).sort(),
      "the shared writer was not found - the guard below would pass vacuously"
    ).toEqual(["lib/authState.ts"]);

    const offenders = directAccessOffenders(relative);

    expect(
      offenders,
      `these files name an identity key behind the shared channel, so a sign-in they ` +
        `perform will not reach the navbar, or a rename of the key will silently miss ` +
        `them (issue #34): ${offenders.join(", ")}`
    ).toEqual([]);
  });

  it("has teeth on each of the three keys, in both directions", () => {
    // Negative control, per key and per direction. Without it, a typo in
    // DIRECT_ACCESS would report "no offenders" forever - indistinguishable from
    // a clean tree.
    const reintroduced = [
      `localStorage.setItem("koliance_google_profile", JSON.stringify(profile));`,
      `localStorage.setItem("koliance_github_user", data.stats.username);`,
      `localStorage.removeItem("koliance_steam_id");`,
      // The read half: this is the exact shape that was left in three components
      // after #34 was fixed.
      `const cached = localStorage.getItem("koliance_google_profile");`,
      `const cachedUser = localStorage.getItem("koliance_github_user");`,
      `const cached = localStorage.getItem("koliance_steam_id");`,
    ];
    for (const line of reintroduced) {
      expect(DIRECT_ACCESS.test(line), `the pattern misses: ${line}`).toBe(true);
    }
    // And it does not fire on a different key, in either direction.
    expect(DIRECT_ACCESS.test(`localStorage.getItem("koliance_google_profile")`)).toBe(true);
    expect(DIRECT_ACCESS.test(`localStorage.setItem("koliance_audit_log", "x")`)).toBe(false);
    expect(DIRECT_ACCESS.test(`localStorage.getItem("koliance_lang")`)).toBe(false);
    // A read through the shared constant is the shape the components now use,
    // and must not be flagged.
    expect(DIRECT_ACCESS.test(`localStorage.getItem(STORAGE_KEYS.google)`)).toBe(false);
  });

  it("is subscribed to by the provider that re-renders the tree", () => {
    // STRUCTURAL, and labelled as such. The subscription itself is React (a
    // `useEffect` calling `addEventListener`); this suite has no DOM, so it
    // cannot fire it. What this asserts is only that the one link the module
    // cannot check from inside itself - someone subscribing - is present.
    //
    // Bound, stated rather than left to be discovered: this reads a pattern, so
    // it cannot tell a working subscription from a broken one, and it would not
    // notice the listener being added and removed in the same effect. The
    // behavioural half is unverified here and is registered as a gap.
    const provider = readFileSync(join(SRC_ROOT, "components", "KolianceAuthProvider.tsx"), "utf8");
    expect(provider).toMatch(/addEventListener\(\s*ACCOUNT_STATE_EVENT/);
    expect(provider).toMatch(/removeEventListener\(\s*ACCOUNT_STATE_EVENT/);
    // And it is mounted above the page tree, or none of the above reaches a
    // navbar rendered as a child of the layout.
    const layout = readFileSync(join(SRC_ROOT, "app", "layout.tsx"), "utf8");
    expect(layout).toContain("<KolianceAuthProvider>");
  });
});

// ==================== THE ENTRY POINT (structural) ====================

const NAV = join(SRC_ROOT, "components", "NavAuthBadges.tsx");

describe("the Sign In entry point opens a session", () => {
  it("calls the session login before it offers to link an account", () => {
    // STRUCTURAL, and labelled as such. `handleGoogleLogin` is a closure inside
    // a React component; asserting its behaviour would need a renderer this
    // suite does not have. What is checkable without one is the ORDER, which is
    // the whole defect: `linkGoogle()` attaches a Google account to the CURRENT
    // user and creates no session, so a signed-out visitor who went through
    // Google came back to a navbar still saying "Sign In".
    //
    // Bound: this reads lines, so it cannot see control flow. A refactor that
    // kept both calls but reordered the branches at runtime would not be
    // caught. Behavioural coverage of the login entries is registered as a gap.
    const lines = readFileSync(NAV, "utf8").split(/\r?\n/);
    const start = lines.findIndex((line) => line.includes("const handleGoogleLogin"));
    expect(start, "handleGoogleLogin was not found by name").toBeGreaterThan(-1);
    const body = lines.slice(start, start + 25).join("\n");

    const loginAt = body.indexOf("privyLogin()");
    const linkAt = body.indexOf("linkGoogle()");
    expect(loginAt, "the Google entry point no longer offers a session login").toBeGreaterThan(-1);
    expect(linkAt, "the Google entry point no longer offers account linking").toBeGreaterThan(-1);
    // Linking is the guarded branch; the unguarded fall-through must be login.
    expect(body).toMatch(/if\s*\(privyAuthenticated[^)]*\)\s*\{\s*linkGoogle\(\);\s*return;\s*\}\s*privyLogin\(\);/);
  });

  it("clears every rail on Sign Out", () => {
    // The counterpart the issue asks for. Source-level for the same reason as
    // above; `signOut` itself is exercised behaviourally in this file.
    const source = readFileSync(NAV, "utf8");
    expect(source).toMatch(/signOut\(\)/);
    expect(source).toContain('t("auth.logout")');
  });
});

// ==================== THE TWO REGRESSIONS AN INDEPENDENT FALSIFIER FOUND ====================

describe("a repeated write is not news (the bridge's termination condition)", () => {
  it("stays silent when the stored bytes are unchanged, and only then", () => {
    const onAccountChanged = vi.fn();
    windowStub.addEventListener(ACCOUNT_STATE_EVENT, onAccountChanged);

    writeAccountState("google", EXCHANGE_PROFILE);
    expect(onAccountChanged).toHaveBeenCalledTimes(1);

    writeAccountState("google", EXCHANGE_PROFILE);
    expect(onAccountChanged).toHaveBeenCalledTimes(1);

    // A real change still notifies - the guard must not be a mute button.
    writeAccountState("google", { ...EXCHANGE_PROFILE, name: "Ada L." });
    expect(onAccountChanged).toHaveBeenCalledTimes(2);
  });

  it("stays silent when clearing a rail that holds nothing", () => {
    // A sign-out that clears three rails must not emit three notifications over
    // a store that already held none; that noise is what re-arms a subscribing
    // effect and is the class of defect being closed here.
    const onAccountChanged = vi.fn();
    windowStub.addEventListener(ACCOUNT_STATE_EVENT, onAccountChanged);
    writeAccountState("google", null);
    writeAccountState("github", null);
    writeAccountState("steam", null);
    expect(onAccountChanged).not.toHaveBeenCalled();
  });

  it("sees a value re-read from the store as unchanged", () => {
    // The property the bridge relies on: what it re-derives from the store
    // serialises to the same bytes it just wrote, so its own write is the last
    // one it hears about.
    writeAccountState("google", EXCHANGE_PROFILE);
    const stored = storage.raw(STORAGE_KEYS.google);
    expect(stored).toBe(JSON.stringify(EXCHANGE_PROFILE));
    writeAccountState("google", JSON.parse(stored as string));
    expect(storage.raw(STORAGE_KEYS.google)).toBe(stored);
  });
});

describe("the credit allowance survives the database spelling", () => {
  it("reads credit_allowance_usd from a row spelled the way select(*) returns it", () => {
    // `GET /api/user/profile` hands back the row under its column names
    // (`001_init_and_composite_indexes.sql:92`). Reading only the camelCase name
    // silently substituted the $600 default for the real allowance - and the
    // number is not cosmetic: the navbar renders it and `AgentCardTerminal`
    // adds it to the card's credit limit.
    const account = googleAccountFromProfile({
      id: "did:koliance:google:42",
      email: "db@example.com",
      trust_tier: "GOOGLE VERIFIED CITIZEN",
      credit_allowance_usd: 2500,
    });
    expect(account?.creditAllowanceUSD).toBe(2500);
  });

  it("prefers the JSON spelling when a row carries both", () => {
    const account = googleAccountFromProfile({ ...EXCHANGE_PROFILE, credit_allowance_usd: 9999 });
    expect(account?.creditAllowanceUSD).toBe(EXCHANGE_PROFILE.creditAllowanceUSD);
  });

  it("keeps a zero allowance that arrives in the database spelling", () => {
    const account = googleAccountFromProfile({
      ...EXCHANGE_PROFILE,
      creditAllowanceUSD: undefined,
      credit_allowance_usd: 0,
    });
    expect(account?.creditAllowanceUSD).toBe(0);
  });

  it("falls back to the documented default only when neither spelling is present", () => {
    const account = googleAccountFromProfile({ ...EXCHANGE_PROFILE, creditAllowanceUSD: undefined });
    expect(account?.creditAllowanceUSD).toBe(600);
  });

  it("folds the database's 1 for synthetic into the flag", () => {
    // `select("*")` yields column names, so a synthetic demo row read back from
    // the database arrived with `synthetic` false and would have rendered as a
    // real, credited identity.
    expect(googleAccountFromProfile({ ...EXCHANGE_PROFILE, synthetic: 1 })?.synthetic).toBe(true);
    expect(googleAccountFromProfile({ ...EXCHANGE_PROFILE, synthetic: true })?.synthetic).toBe(true);
    expect(googleAccountFromProfile({ ...EXCHANGE_PROFILE, synthetic: 0 })?.synthetic).toBe(false);
  });
});

describe("the Privy bridge recognises a stored row in either spelling", () => {
  it("gives the exchange route's row and a re-spelled row the same key", () => {
    // The bridge's previous termination test compared the DERIVED row's `id`
    // against a freshly built `did:koliance:google:<subject>`. The derivation
    // prefers a stored `id`, and `EditProfileModal` writes one alongside a
    // rewritten name - so the two disagreed, the test was always false, and the
    // effect re-ran on every write it made, each pass adding the allowance to
    // the card's credit limit again.
    writeAccountState("google", EXCHANGE_PROFILE);
    expect(googleRowKey(storedGoogleRow())).toBe(`did:koliance:google:${EXCHANGE_PROFILE.googleId}`);

    // Same identity, different name (the round-trip `EditProfileModal` performs).
    writeAccountState("google", { ...EXCHANGE_PROFILE, name: "Renamed By The Modal" });
    expect(googleRowKey(storedGoogleRow())).toBe(`did:koliance:google:${EXCHANGE_PROFILE.googleId}`);

    // A row that carries the derived `id` instead of `googleId` resolves the same.
    writeAccountState("google", {
      id: `did:koliance:google:${EXCHANGE_PROFILE.googleId}`,
      email: EXCHANGE_PROFILE.email,
    });
    expect(googleRowKey(storedGoogleRow())).toBe(`did:koliance:google:${EXCHANGE_PROFILE.googleId}`);
  });

  it("is null for an empty store and for a row that identifies nobody", () => {
    expect(storedGoogleRow()).toBeNull();
    expect(googleRowKey(null)).toBeNull();
    expect(googleRowKey({ name: "Nobody" })).toBeNull();
  });

  it("keys off googleId when a row carries a disagreeing id", () => {
    // `EditProfileModal` spreads a `UserProfileData` (whose `id` is derived) next
    // to a recomputed `googleId`, so the two CAN disagree in a real row. Keying
    // off `id` first would make the bridge read such a row as a different
    // account, overwrite it, and silently discard the user's edit.
    expect(
      googleRowKey({
        id: "did:koliance:google:stale-from-the-modal",
        googleId: "109842839210492819283",
        email: "ada@example.com",
      })
    ).toBe("did:koliance:google:109842839210492819283");
  });
});

describe("Sign Out sticks", () => {
  it("raises the gate before the rows are cleared, and releases it on failure too", () => {
    // STRUCTURAL, and labelled as such: `handleSignOut` is a closure inside a
    // React component and this suite has no renderer, so its timing cannot be
    // executed here. What is checkable is the ORDER, which is the whole fix.
    //
    // Bound: this reads lines, so it cannot see control flow. It also cannot
    // prove `privyLogout()` resolves before `signOut()` runs - only that the
    // `await` is written before it. Fail-to-pass in the other direction is
    // covered by the negative mutation recorded in `docs/changes/050`.
    const lines = readFileSync(NAV, "utf8").split(/\r?\n/);
    const start = lines.findIndex((line) => line.includes("const handleSignOut"));
    expect(start, "handleSignOut was not found by name").toBeGreaterThan(-1);
    const body = lines.slice(start, start + 40).join("\n");

    const gateAt = body.indexOf("setSigningOut(true)");
    const logoutAt = body.indexOf("await privyLogout()");
    const clearAt = body.indexOf("signOut()", gateAt + 1);
    expect(gateAt, "the sign-out gate is gone").toBeGreaterThan(-1);
    expect(logoutAt, "the Privy session is no longer ended").toBeGreaterThan(-1);
    expect(clearAt, "the local rows are no longer cleared").toBeGreaterThan(-1);
    expect(gateAt, "the gate must be raised before the session is ended").toBeLessThan(logoutAt);
    expect(logoutAt, "the rows must be cleared only after the session is gone").toBeLessThan(clearAt);
    // The gate is released on the failure path as well, or a rejected logout
    // would leave the navbar unable to reflect a later sign-in.
    expect(body).toMatch(/\}\s*finally\s*\{\s*setSigningOut\(false\);\s*\}/);
  });

  it("closes the bridge effect while signing out", () => {
    // The gate is what makes the clear above stick. Without it the bridge re-runs
    // on the cleared state while `privyUser` is still populated, writes the
    // profile straight back, and the next reload shows a signed-in navbar over a
    // signed-out Privy session - the half-signed-in state issue #34 named.
    const source = readFileSync(NAV, "utf8");
    expect(source).toMatch(/Bridge the Privy user/);
    expect(
      source,
      "the bridge must return early while signing out, and depend on the gate"
    ).toMatch(/if\s*\(signingOut\)\s*return;[\s\S]{0,1600}?\},\s*\[privyUser,\s*state\.google,\s*signingOut\]\);/);
  });
});
