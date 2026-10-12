/**
 * The wallet rail, and how a click on it dispatches.
 *
 * Issue #30 ("non-Google users cannot get in"): the account centre offered a
 * single entry point - `login()` with the full method list - and the wallet
 * button inside the panel was wired to `onConnectWallet`, which on the home
 * page is `authLogin()` too. So a pure-wallet user's path to a session ran
 * through the same modal as everyone else's, and the one Privy hook that names
 * "wallet" (`linkWallet`) is documented as *"For users who are authenticated"*
 * - calling it with no session does nothing useful.
 *
 * The dispatch below is small on purpose, and it is here rather than inline in
 * the component because it is the part that can actually be tested: this repo's
 * vitest runs in the `node` environment with no DOM, so a rendered click cannot
 * be exercised. What is testable is the **decision**, so the decision is what
 * this function is.
 */

/**
 * Privy's login-modal method list, narrowed to the one rail this file is about.
 *
 * Structurally identical to the subset of the SDK's own `loginMethods` union,
 * which is why it is assignable wherever the SDK is waiting for it - see
 * `WALLET_ONLY_LOGIN_OPTIONS` below.
 */
export type WalletLoginMethod = "wallet";

/** Options accepted by `KolianceAuthContextValue["login"]`. */
export interface WalletOnlyLoginOptions {
  loginMethods: WalletLoginMethod[];
}

/**
 * Handed to `login()` to open the modal restricted to the wallet rail.
 *
 * This is the SDK's own documented override - `@privy-io/react-auth`
 * `LoginModalOptions.loginMethods`: *"custom login methods to display in the
 * login modal. This will overwrite the value provider to the client config."*
 * It restricts the UI; it does not grant anything the provider config did not
 * already allow, so the Google/GitHub/Steam rails stay available everywhere
 * else. This module only narrows, it never widens.
 */
export const WALLET_ONLY_LOGIN_OPTIONS: WalletOnlyLoginOptions = {
  loginMethods: ["wallet"],
};

/**
 * The argument to hand to `login()` when the wallet rail is the one clicked.
 *
 * Two provider modes, and they are not interchangeable:
 *
 *  - **Privy** (`isPrivyEnabled`): pass the wallet-only override so the modal
 *    opens on the wallets. This is the change #30 asks for.
 *  - **Fallback** (`Providers`' wagmi branch, i.e. no `NEXT_PUBLIC_PRIVY_APP_ID`):
 *    there is no modal and no method list - `login()` is an injected connect -
 *    so the override would be meaningless and must NOT be passed. Returning
 *    `undefined` keeps that branch calling `login()` exactly as before; hiding
 *    the wallet button there instead would remove the only way in for a local
 *    dev with MetaMask, which is the same class of defect as #30 aimed at the
 *    other branch.
 */
export function walletSessionLoginOptions(
  isPrivyEnabled: boolean
): WalletOnlyLoginOptions | undefined {
  return isPrivyEnabled ? WALLET_ONLY_LOGIN_OPTIONS : undefined;
}

/**
 * Which rail a wallet click should take.
 *
 * `start-session` - there is no session, so the click must *create* one. This
 *   is the case issue #30 is about, and it is the case that has to work
 *   without going through Google.
 * `link-to-existing` - a session already exists, so the click attaches another
 *   wallet to it (Privy's `linkWallet`).
 * `none` - no wallet action is possible at all (a session exists but the SDK
 *   exposes no `linkWallet`). Callers must render no wallet action rather than
 *   a button that resolves to nothing.
 *
 * Deliberately **not** keyed on `isPrivyEnabled`: both provider branches can
 * start a session (Privy's modal, or the injected fallback), so provider mode
 * changes *which argument* `login` gets - see `walletSessionLoginOptions` - not
 * whether the rail exists.
 */
export type WalletRailAction = "start-session" | "link-to-existing" | "none";

export interface WalletRailCapabilities {
  /** A session already exists. */
  authenticated: boolean;
  /** Privy's `linkWallet` is reachable. */
  hasLinkWallet: boolean;
}

export function resolveWalletRailAction(caps: WalletRailCapabilities): WalletRailAction {
  if (caps.authenticated) {
    return caps.hasLinkWallet ? "link-to-existing" : "none";
  }
  // Unauthenticated. Starting a session is the *login* path, not the link path:
  // Privy's `linkWallet` is documented "For users who are authenticated" and
  // must not be offered here, because it silently does nothing and the failure
  // is invisible - the user just sees a button that does not respond.
  return "start-session";
}

/**
 * The label for the wallet rail, in the two languages the app ships.
 *
 * Deliberately not routed through `t()`: the account panel already holds the
 * long explanatory sentence in each language, and `t()` is not reachable from
 * here without dragging a React context into a pure module.
 */
export function walletRailLabel(authenticated: boolean, lang: "en" | "zh"): string {
  if (authenticated) {
    return lang === "en" ? "Link External Wallet" : "关联其他钱包";
  }
  return lang === "en" ? "Connect Wallet (no Google needed)" : "连接钱包（无需 Google）";
}
