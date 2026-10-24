import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  resolveWalletRailAction,
  walletRailLabel,
  walletSessionLoginOptions,
  WALLET_ONLY_LOGIN_OPTIONS,
  type WalletRailCapabilities,
} from "@/lib/walletLogin";

/**
 * Issue #30: a pure-wallet user could not get in.
 *
 * What this file can and cannot reach, stated up front so the green below is
 * not read as more than it is:
 *
 *  - **Reachable**: the dispatch decision (`resolveWalletRailAction`), the
 *    argument handed to Privy's `login` (`walletSessionLoginOptions`), and the
 *    labels. These are the parts that were wrong and that a regression would
 *    silently re-break.
 *  - **NOT reachable**: an actual click, an actual Privy modal, and an actual
 *    wallet connection. `vitest.config.mts` runs `environment: "node"` with no
 *    DOM, and Privy needs a live app id plus a browser extension. The real
 *    device path is therefore recorded as UNVERIFIED in `docs/changes/052`;
 *    nothing in this file claims otherwise.
 *
 * The positive cases pin the behaviour #30 asked for. The falsification block
 * pins the *defect*: a guard that only asserts the fixed shape cannot tell
 * "correct" from "the old code also happened to pass".
 */

const unauthenticated: WalletRailCapabilities = {
  authenticated: false,
  hasLinkWallet: true,
};

describe("wallet rail dispatch (issue #30)", () => {
  it("unauthenticated: the wallet click starts a session", () => {
    expect(resolveWalletRailAction(unauthenticated)).toBe("start-session");
  });

  it("authenticated + linkWallet: the wallet click attaches another wallet", () => {
    expect(
      resolveWalletRailAction({ authenticated: true, hasLinkWallet: true })
    ).toBe("link-to-existing");
  });

  it("reports 'none' rather than offering a button that does nothing", () => {
    // A session exists but the SDK exposes no linkWallet.
    expect(
      resolveWalletRailAction({ authenticated: true, hasLinkWallet: false })
    ).toBe("none");
  });

  it("the rail exists in BOTH provider branches", () => {
    // Provider mode must not be an input to this decision: the Privy branch has
    // a modal and the fallback branch an injected connect, but both can start a
    // session. Keying the rail on `isPrivyEnabled` is how a previous revision
    // removed the wallet button from the non-Privy branch entirely.
    expect(Object.keys(unauthenticated)).not.toContain("isPrivyEnabled");
    expect(resolveWalletRailAction({ authenticated: false, hasLinkWallet: false })).toBe(
      "start-session"
    );
  });
});

describe("the argument handed to login()", () => {
  it("Privy: the wallet-only override, which is what #30 asks for", () => {
    expect(walletSessionLoginOptions(true)).toEqual({ loginMethods: ["wallet"] });
  });

  it("fallback: undefined, so login() behaves exactly as before", () => {
    // The wagmi branch's `login` is an injected connect; it has no method list.
    // Passing the override there would be meaningless at best.
    expect(walletSessionLoginOptions(false)).toBeUndefined();
  });
});

/**
 * D3 falsification. Each case names the defect it would catch, and each was
 * measured to go red when that defect is injected (recorded in
 * `docs/changes/052`).
 */
describe("falsification: the defect #30 describes cannot come back unnoticed", () => {
  it("never routes an unauthenticated wallet click to linkWallet", () => {
    // Exactly the #30 shape: `linkWallet` is documented "For users who are
    // authenticated", so offering it with no session produces a button that
    // silently does nothing. Anyone reintroducing that ordering fails here.
    expect(resolveWalletRailAction(unauthenticated)).not.toBe("link-to-existing");
  });

  it("the unauthenticated label promises the wallet rail, not a Google detour", () => {
    for (const lang of ["en", "zh"] as const) {
      const label = walletRailLabel(false, lang);
      // It must name the wallet rail...
      expect(label).toMatch(lang === "en" ? /wallet/i : /钱包/);
      // ...and it must say the Google rail is not a prerequisite. A label that
      // dropped the negation would still name the wallet, so the negation is
      // asserted separately rather than inferred from the first assertion.
      expect(label).toMatch(lang === "en" ? /no google needed/i : /无需 Google/);
    }
  });

  it("the authenticated label is the link wording, not the sign-in wording", () => {
    // The two rails read differently on purpose; collapsing them back into one
    // string is how the conflation got in.
    expect(walletRailLabel(true, "en")).not.toBe(walletRailLabel(false, "en"));
    expect(walletRailLabel(true, "zh")).not.toBe(walletRailLabel(false, "zh"));
    expect(walletRailLabel(true, "en")).toMatch(/link/i);
  });

  it("the wallet-only override restricts the modal and adds nothing back", () => {
    expect(WALLET_ONLY_LOGIN_OPTIONS.loginMethods).toEqual(["wallet"]);
    expect(WALLET_ONLY_LOGIN_OPTIONS.loginMethods).not.toContain("google");
    expect(WALLET_ONLY_LOGIN_OPTIONS.loginMethods).not.toContain("github");
  });
});

/**
 * The dispatch being right is worth nothing if the component never calls it.
 * These read the source, which is the only way to reach wiring from a DOM-less
 * environment - and they carry a self-check first, because a wrong path would
 * otherwise make every assertion below pass over an empty string.
 *
 * The assertions match the **call**, not the identifier: an earlier revision
 * asserted `toContain("resolveWalletRailAction")`, which the `import` line
 * satisfied - so bypassing the dispatch inside the component left this file
 * entirely green. That was measured, and it is the reason these are regexes
 * anchored on `= resolveWalletRailAction(`.
 */
describe("wiring: the panel routes the wallet click through the dispatch", () => {
  const read = (rel: string) => readFileSync(resolve(import.meta.dirname, "..", rel), "utf8");
  const panel = read("src/components/NavAuthBadges.tsx");

  it("self-check: NavAuthBadges was really read", () => {
    expect(panel.length).toBeGreaterThan(1000);
    expect(panel).toContain("export function NavAuthBadges");
  });

  it("the rail is computed by the dispatch, not hardcoded", () => {
    expect(panel).toMatch(/const walletRail = resolveWalletRailAction\(\{/);
  });

  it("login() receives the provider-appropriate override", () => {
    expect(panel).toMatch(/privyLogin\(walletSessionLoginOptions\(isPrivyEnabled\)\)/);
  });

  it("wallet binding surface is gated on link-to-existing after login and wired to its handler", () => {
    // Under concise auth rules, unauthenticated panel is purely Google/GitHub/Email.
    // Wallet binding appears exclusively after logging in as link-to-existing.
    expect(panel).toContain('walletRail === "link-to-existing"');
    expect(panel.match(/onClick=\{handleWalletRail\}/g)?.length).toBeGreaterThanOrEqual(1);
  });

  it("the wallet rail is no longer wired to the page's generic connect", () => {
    // The old handler closed the panel and called `onConnectWallet`, which on
    // the home page is `authLogin()` with every method - the behaviour #30
    // reports. The prop is still accepted for callers that pass it.
    expect(panel).not.toContain("onConnectWallet?.()");
  });
});

describe("wiring: the console's login buttons", () => {
  const consoleSrc = readFileSync(
    resolve(import.meta.dirname, "..", "src/components/DeveloperConsole.tsx"),
    "utf8"
  );

  it("pass no argument to authLogin", () => {
    // Was `onClick={authLogin}`, which handed React's click event to the SDK as
    // the options object - inert before this change, a live bug once the
    // options type was widened. `tsc` rejects it now; this keeps the two call
    // sites explicit for the next edit that widens the type again.
    expect(consoleSrc.length).toBeGreaterThan(1000); // self-check
    expect(consoleSrc).not.toContain("onClick={authLogin}");
    expect(consoleSrc.match(/onClick=\{\(\) => authLogin\(\)\}/g)?.length).toBe(2);
  });
});
