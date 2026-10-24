"use client";

import { clearSessionTokens } from "@/lib/sessionClient";
import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Github,
  Gamepad2,
  ChevronDown,
  CheckCircle2,
  LogOut,
  ExternalLink,
  Sparkles,
  ShieldCheck,
  User,
  Edit3,
  LogIn,
  Wallet,
  Send,
  Copy,
  Link2,
  Coins,
} from "lucide-react";
import Image from "next/image";
import { createPublicClient, formatEther } from "viem";
import { GOOGLE_CLIENT_ID, OAUTH_REDIRECT_URI } from "@/lib/authConfig";
import { EditProfileModal, UserProfileData } from "@/components/EditProfileModal";
import { TransferModal } from "@/components/TransferModal";
import { RewardCelebrationModal } from "@/components/RewardCelebrationModal";
import { monadTestnet, monadRpcTransport, KOL_TOKEN_ADDRESS, KOL_TOKEN_ABI } from "@/lib/contract";

import { truncateAddress } from "@/lib/utils";
import { useKolianceAuth } from "@/components/Providers";
import { useKolianceAccount } from "@/components/KolianceAuthProvider";
import {
  resolveWalletRailAction,
  walletRailLabel,
  walletSessionLoginOptions,
} from "@/lib/walletLogin";
import { useLanguage } from "@/lib/i18n";
import {
  AccountIdentity,
  effectiveWalletAddress,
  googleRowKey,
  heldUnlinkedIdentity,
  mergeIdentity,
  releaseUnlinkedIdentity,
  storedGoogleRow,
  writeAccountState,
} from "@/lib/authState";

interface NavAuthBadgesProps {
  walletAddress?: string | null;
  balance?: string;
  onConnectWallet?: () => void;
  onDisconnectWallet?: () => void;
}

/**
 * A `User` from Privy reduced to the fields the navbar renders.
 *
 * The shape is read off the SDK's own types, not inferred:
 * `Google = { subject, email, name }` and `Github = { subject, username, name,
 * email }` - there is no `id` beyond the Privy DID and no picture field at all,
 * which is why the previous version's `privyUser.google.picture` was always
 * `undefined` and its `privyUser.id` was a DID rather than the `googleId` the
 * rest of the app keys on.
 *
 * `subject` (the Google `sub` claim) is used as the id so a Privy sign-in and a
 * direct OAuth sign-in resolve to the same account instead of two.
 */
function privyIdentityFromUser(
  user: {
    id: string;
    google?: { subject: string; email: string; name: string | null } | null;
    github?: { subject: string; username: string | null; name: string | null } | null;
    wallet?: { address: string } | null;
  } | null,
  connectedWallet?: string | null
): AccountIdentity | null {
  if (!user) return null;
  if (user.google) {
    return {
      name: user.google.name || user.google.email || user.google.subject,
      email: user.google.email,
      // Google has no picture field on the Privy account; the exchange route is
      // the only source of an avatar URL, so this stays null rather than
      // rendering a placeholder as though it were a fetched image.
      picture: null,
    };
  }
  if (user.github) {
    return {
      name: user.github.username || user.github.name || user.github.subject,
      email: "",
      picture: null,
    };
  }
  // Wallet-only sign-in: identifiable, but with no name or e-mail to show.
  const address = connectedWallet || user.wallet?.address || null;
  if (address) {
    return { name: truncateAddress(address), email: "", picture: null };
  }
  return null;
}

export function NavAuthBadges({
  walletAddress,
  balance = "0.00",
  onConnectWallet,
  onDisconnectWallet,
}: NavAuthBadgesProps) {
  const {
    isPrivyEnabled,
    // Named for the Privy session specifically: the wallet rail below and the
    // Google/GitHub link paths all ask "is there already a session?", and this
    // is the provider's own answer to that.
    authenticated: privyAuthenticated,
    user: privyUser,
    login: privyLogin,
    logout: privyLogout,
    linkWallet,
    linkGoogle,
    linkGithub,
  } = useKolianceAuth();
  const { state, unlink, signOut } = useKolianceAccount();
  const { lang, t } = useLanguage();

  /**
   * Issue #30. A wallet click has two different meanings and they must not be
   * conflated: with no session it has to *create* one (the pure-wallet user's
   * only way in), and only once a session exists may it *attach* a wallet to
   * it. `linkWallet` is the second meaning - Privy documents it as "For users
   * who are authenticated" - so offering it first is what left non-Google users
   * with a wallet button that could not do anything.
   */
  const walletRail = resolveWalletRailAction({
    authenticated: privyAuthenticated,
    hasLinkWallet: Boolean(linkWallet),
  });

  const handleWalletRail = () => {
    setDropdownOpen(false);
    switch (walletRail) {
      case "link-to-existing":
        linkWallet?.();
        return;
      case "start-session":
        // Wallet rail first, and named first: the modal opens on the wallets,
        // with Google/GitHub still reachable behind it for anyone who wants the
        // credit boost. `walletSessionLoginOptions` yields `undefined` in the
        // non-Privy branch, where `login()` is an injected connect and has no
        // method list to override. This is the change #30 asks for.
        privyLogin(walletSessionLoginOptions(isPrivyEnabled));
        return;
      case "none":
        return;
    }
  };

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [transferCurrency, setTransferCurrency] = useState<"KOL" | "MON">("KOL");
  const [kolBalance, setKolBalance] = useState("0.00");
  const [copied, setCopied] = useState(false);
  const [rewardModalState, setRewardModalState] = useState<{
    isOpen: boolean;
    amount: number;
    actionType: string;
  }>({ isOpen: false, amount: 0, actionType: "WALLET_BIND" });

  useEffect(() => {
    const handleRewardEvent = (e: Event) => {
      const customEvent = e as CustomEvent<{ amount: number; actionType: string }>;
      if (customEvent.detail && customEvent.detail.amount > 0) {
        setRewardModalState({
          isOpen: true,
          amount: customEvent.detail.amount,
          actionType: customEvent.detail.actionType || "WALLET_BIND",
        });
      }
    };
    window.addEventListener("koliance:reward", handleRewardEvent);
    return () => window.removeEventListener("koliance:reward", handleRewardEvent);
  }, []);

  // Derived per render from the shared account state, never captured into
  // component state. This is the fix for issue #34: `useKolianceAccount` is
  // notified by the same write the OAuth wall performs, so a profile written
  // after this component mounted still reaches this render.
  const { google: googleUser, github: githubUser, steam: steamUser } = state;
  const privyIdentity = privyIdentityFromUser(privyUser, walletAddress);
  const identity = mergeIdentity(state, privyIdentity);

  // Fetch KOL Token balance for the connected wallet
  useEffect(() => {
    if (!walletAddress) {
      setKolBalance("0.00");
      return;
    }
    const fetchBalance = async () => {
      try {
        const client = createPublicClient({
          chain: monadTestnet,
          transport: monadRpcTransport(),
        });
        const bal = await client.readContract({
          address: KOL_TOKEN_ADDRESS,
          abi: KOL_TOKEN_ABI,
          functionName: "balanceOf",
          args: [walletAddress as `0x${string}`],
        });
        setKolBalance(parseFloat(formatEther(bal)).toFixed(4));
      } catch (err) {
        console.error("Failed to load KOL balance in navbar:", err);
      }
    };
    fetchBalance();
    const interval = setInterval(fetchBalance, 30000);
    return () => clearInterval(interval);
  }, [walletAddress]);

  // Bridge the Privy user into the shared store so every consumer of
  // `useKolianceAccount` sees it, not just this component.
  //
  // Termination, and why it no longer rests on a string comparison. This effect
  // both reads `state.google` and writes it, so React re-runs it once the write
  // notifies its own subscriber. The comparison below is made against the row
  // **as stored**, so the same identity short-circuits whatever spelling the
  // writer used: the exchange route stores `googleId` / `trustTier`, while
  // `EditProfileModal` and this component store differently-spelled rows, and
  // comparing the *derived* objects would have found them unequal and looped
  // forever (the parent adds a credit allowance on every one of those renders).
  // `writeAccountState` additionally refuses to write when the stored bytes are
  // unchanged, so the effect's own write is the last one it hears about.
  //
  // The guard is bound to the stored row on purpose, and so is the row this
  // effect writes: both name the identity the same way (`googleId` = the Privy
  // `subject`). A guard that keys one identity while the write stores another
  // cannot terminate - that is the §4.3 loop seen from the other side, and it is
  // why the two spellings are asserted together in `tests/auth-state.test.ts`.
  //
  // Two things stop the bridge from re-creating a row the user removed:
  //  - `signingOut`, raised by `handleSignOut` before it clears the rows and
  //    lowered only once `privyLogout()` has resolved. Without it the clear
  //    re-ran this effect while `privyUser` was still populated, the effect
  //    wrote the profile straight back, and the next reload showed a signed-in
  //    navbar over a signed-out Privy session;
  //  - `heldUnlinkedIdentity()`, the hold the unlink button raises. Clearing the
  //    row is not enough on its own on the Google rail, because nothing here
  //    ends the session: `privyUser` still carries the account, so this effect
  //    would put the row back and the user's own removal would be undone in the
  //    same tick (see `src/lib/authState.ts` for the hold's termination).
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    if (!privyUser?.google && !privyUser?.github) return;
    if (signingOut) return;
    if (heldUnlinkedIdentity() !== null) return;
    // The subject is the identity, on either rail, and the write below is
    // guarded on it. The stored row alone used to decide this: the guard read
    // `stored ? … : null` off `state.google`, which is null in exactly the case
    // the effect exists to fix, so "the account is there" and "the store already
    // has it" were the same test.
    const subject = privyUser.google?.subject ?? privyUser.github?.subject;
    const alreadyStored =
      subject !== undefined &&
      googleRowKey(storedGoogleRow()) === `did:koliance:google:${subject}`;
    if (alreadyStored) return;
    if (privyUser.google) {
      writeAccountState("google", {
        googleId: privyUser.google.subject,
        name: privyUser.google.name || privyUser.google.email,
        email: privyUser.google.email,
        // Unknown without the exchange route; `undefined` leaves the
        // allowance at its default rather than inventing a number.
        trustTier: "GOOGLE VERIFIED (PRIVY)",
      });
    }
  }, [privyUser, state.google, signingOut]);

  /**
   * Unlinking one rail, as the user's decision. Every caller below goes through
   * this, and this goes through the provider's `unlink` - which calls
   * `unlinkRail`, removing the row **and holding its identity** until the session
   * ends (see `src/lib/authState.ts` for the hold's own termination).
   *
   * Without the hold the removal is a no-op in the Privy configuration, which is
   * the bug this closes (F7): `unlink()` cleared `koliance_google_profile` while
   * `privyUser` still carried the Google account, the bridge effect above re-ran
   * on the changed `state.google` and wrote the row straight back - so the user
   * clicked "解除", watched the row disappear, and found it back on the next
   * render or reload.
   *
   * Note where the fix is **not**: not in this component. The writer that has to
   * be stopped is the bridge effect, and a fix that only told *that* effect to
   * behave would leave the next writer - a re-mount, a second tab, a future
   * component - free to put the row back. So the hold bites in
   * `writeAccountState`, the one channel every writer already passes through.
   *
   * Unlike Sign Out this deliberately does **not** end the Privy session: the
   * button says "unlink Google", not "log out", and ending the session would take
   * the wallet and every other rail with it. That is also why the hold needs its
   * own termination rather than reusing `signingOut` - see `heldUnlinkedIdentity`.
   */
  const handleUnlink = (rail: "google" | "github" | "steam") => unlink(rail);

  // 1. Google 1-Click Login Trigger (Native Official Google OAuth 2.0)
  //
  // Decoupled from Privy: direct connection to accounts.google.com ensures
  // 100% reliable login without third-party SDK domain whitelist/origin restrictions.
  const handleGoogleLogin = () => {
    releaseUnlinkedIdentity();
    const clientId =
      process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || GOOGLE_CLIENT_ID;
    const redirectUri = encodeURIComponent(OAUTH_REDIRECT_URI);
    const scope = encodeURIComponent("openid email profile");
    const state_ = encodeURIComponent(
      JSON.stringify({
        origin: window.location.origin,
        path: window.location.pathname || "/",
        timestamp: Date.now(),
      })
    );
    window.location.href = `https://accounts.google.com/o/oauth2/auth?response_type=code&client_id=${clientId}&redirect_uri=${redirectUri}&scope=${scope}&state=${state_}&access_type=offline&prompt=consent`;
    if (privyAuthenticated && privyUser && linkGoogle) { linkGoogle(); return; } privyLogin();
  };

  // 2. GitHub 1-Click Login Trigger (Privy-aware with OAuth fallback)
  const handleGithubLogin = () => {
    releaseUnlinkedIdentity();
    if (isPrivyEnabled) {
      if (privyAuthenticated && privyUser && linkGithub) {
        linkGithub();
        return;
      }
      privyLogin();
      return;
    }
    // Server route sets the httpOnly CSRF nonce cookie, then redirects to GitHub.
    const qs = new URLSearchParams({ path: window.location.pathname || "/" });
    window.location.href = `/api/auth/github/start?${qs.toString()}`;
  };

  // 3. Steam OpenID 2.0 1-Click Redirect
  const handleSteamLogin = () => {
    releaseUnlinkedIdentity();
    const returnUrl = encodeURIComponent(`${window.location.origin}/agentcard`);
    const realm = encodeURIComponent(window.location.origin);
    window.location.href = `https://steamcommunity.com/openid/login?openid.ns=http://specs.openid.net/auth/2.0&openid.mode=checkid_setup&openid.return_to=${returnUrl}&openid.realm=${realm}&openid.identity=http://specs.openid.net/auth/2.0/identifier_select&openid.claimed_id=http://specs.openid.net/auth/2.0/identifier_select`;
  };

  // Sandbox Demo Login for Testing (Explicitly synthetic with 0 credit allocation)
  const handleInstantGoogleDemo = () => {
    writeAccountState("google", {
      googleId: "109842839210492819283",
      email: "alexander.dev@google.com",
      emailVerified: false,
      synthetic: true,
      name: "Alexander (Demo Synthetic)",
      picture: "https://lh3.googleusercontent.com/a/default-user=s96-c",
      walletAddress: walletAddress || "0x89205A3A3b2A69De6Dbf7f01ED13B2108B2c43e7",
      trustTier: "UNVERIFIED SYNTHETIC DEMO",
      creditAllowanceUSD: 0,
    });
    setDropdownOpen(false);
  };

  // Sign Out: one intent, so the navbar cannot end up half signed in (a cleared
  // Privy session over a Google row still rendering an avatar). Unlinking a
  // single rail stays on its own button below.
  //
  // Order is load-bearing. Clearing the rows first fired the bridge effect while
  // `privyUser` was still populated, and the effect wrote the profile back - the
  // sign-out was undone in the same tick and survived the next reload. So:
  //
  //   1. `signingOut` is raised first, which closes the bridge for the duration;
  //   2. the Privy session is ended and **awaited**;
  //   3. only then are the rows cleared, with the gate still up.
  //
  // The gate is lowered in `finally`, not on the success path: a rejected
  // `privyLogout()` must not leave the navbar permanently unable to reflect a
  // fresh sign-in.
  //
  // `releaseUnlinkedIdentity()` is called first for the same reason the gate is:
  // Sign Out ends the session, and a hold raised by an earlier unlink only exists
  // to outlast the session (`src/lib/authState.ts`). Left standing, it would
  // refuse the rows of the *next* sign-in, which is the wedge that makes a hold
  // worse than the defect it fixes.
  const handleSignOut = async () => {
    setDropdownOpen(false);
    setSigningOut(true);
    releaseUnlinkedIdentity();
    try {
      if (isPrivyEnabled) {
        await privyLogout();
      }
      // Last, and only after the session is really gone - a local-only failure
      // here would otherwise leave the user cleared out but still signed in.
      signOut();
      clearSessionTokens(); // issue #35: drop server-signed session tokens too
    } finally {
      setSigningOut(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Active wallet is either bound wallet or connected wallet
  const effectiveWallet = effectiveWalletAddress(state, walletAddress);

  return (
    <div className="relative">
      {/* Top-Right Account Button (Solid, 100% Opaque High-End Tech Dark) */}
      <button
        onClick={() => setDropdownOpen(!dropdownOpen)}
        className="flex items-center gap-2 px-3 py-1.5 sm:py-2 rounded-md bg-[#141824] hover:bg-[#1a2032] border border-white/20 hover:border-blue-400 text-xs font-mono text-white transition-all select-none shadow-lg active:scale-95 group"
      >
        {/* User Avatar */}
        <div className="w-6 h-6 rounded-md overflow-hidden border border-blue-400 shadow-[0_0_8px_rgba(59,130,246,0.5)] relative bg-[#1c2438] flex items-center justify-center shrink-0">
          {identity?.picture ? (
            <Image
              src={identity.picture}
              alt={identity.name || "User Avatar"}
              width={24}
              height={24}
              unoptimized
              className="w-full h-full object-cover"
            />
          ) : (
            <User className="w-3.5 h-3.5 text-blue-300" />
          )}
        </div>

        {/* User Identity / Display Name */}
        <div className="flex flex-col text-left leading-tight">
          <span className="font-sans font-semibold text-white text-xs truncate max-w-[85px] sm:max-w-[110px]">
            {identity ? identity.name : t("auth.to_login")}
          </span>
          <span className="text-[9px] font-mono text-slate-300 flex items-center gap-1">
            {effectiveWallet ? (
              <span className="text-emerald-400 font-semibold">{truncateAddress(effectiveWallet)}</span>
            ) : identity ? (
              <span className="truncate max-w-[110px]">{identity.email || t("auth.verified")}</span>
            ) : (
              <span>{t("auth.connect_wallet")}</span>
            )}
          </span>
        </div>

        {/* Small Action indicator */}
        <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-[#222a42] text-slate-200 border border-white/20 group-hover:bg-blue-600 group-hover:text-white transition hidden sm:inline">
          {identity ? t("auth.edit_profile") : t("auth.to_login")}
        </span>

        <ChevronDown className="w-3.5 h-3.5 text-slate-400 ml-0.5 group-hover:text-white transition" />
      </button>

      {/* Floating Integrated Account & Profile Center (Solid 100% Opaque #101420 Container) */}
      <AnimatePresence>
        {dropdownOpen && (
          <>
            {/* Click-away backdrop to dismiss on both mobile and desktop */}
            <div
              className="fixed inset-0 z-40 bg-transparent"
              onClick={() => setDropdownOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -6 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -6 }}
              transition={{ duration: 0.15 }}
              className="fixed inset-x-3 top-14 sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-88 rounded-xl bg-[#101420] border border-white/25 p-3.5 shadow-[0_12px_40px_rgba(0,0,0,0.85)] z-50 text-white space-y-3 max-h-[85vh] overflow-y-auto"
            >
              {/* 1. User Header & Edit Profile Action */}
              <div className="p-3 rounded-lg bg-[#172036] border border-blue-500/40 space-y-2.5 shadow-md">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <div className="w-10 h-10 rounded-md overflow-hidden border border-blue-400 bg-[#1c2438] flex items-center justify-center shrink-0">
                      {identity?.picture ? (
                        <Image
                          src={identity.picture}
                          alt={identity.name || "User Avatar"}
                          width={40}
                          height={40}
                          unoptimized
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <User className="w-5 h-5 text-blue-300" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold text-white flex items-center gap-1">
                        <span className="truncate">
                          {identity ? identity.name : t("auth.developer_default")}
                        </span>
                        {identity && <CheckCircle2 className="w-3.5 h-3.5 text-blue-400 shrink-0" />}
                      </div>
                      <div className="text-[10px] font-mono text-slate-300 truncate">
                        {identity ? identity.email || t("auth.verified") : t("auth.google_unlinked")}
                      </div>
                    </div>
                  </div>

                  {/* Edit Profile or Login Action Button */}
                  {identity ? (
                    <button
                      onClick={() => {
                        setDropdownOpen(false);
                        setEditModalOpen(true);
                      }}
                      className="shrink-0 whitespace-nowrap px-2.5 py-1.5 rounded-md bg-blue-600 hover:bg-blue-500 border border-blue-400/50 text-[11px] font-mono text-white flex items-center gap-1 font-semibold transition shadow-md active:scale-95 cursor-pointer"
                    >
                      <Edit3 className="w-3 h-3 text-white" />
                      <span>{t("auth.edit_profile")}</span>
                    </button>
                  ) : (
                    <button
                      onClick={handleGoogleLogin}
                      className="shrink-0 whitespace-nowrap px-2.5 py-1.5 rounded-md bg-blue-600 hover:bg-blue-500 border border-blue-400/50 text-[11px] font-mono text-white flex items-center gap-1 font-semibold transition shadow-md active:scale-95 cursor-pointer"
                    >
                      <LogIn className="w-3 h-3 text-white" />
                      <span>{t("auth.to_login")}</span>
                    </button>
                  )}
                </div>

                {/* Sign Out: the counterpart to the Sign In button, and the only
                    control that clears every rail at once. */}
                {identity && (
                  <button
                    onClick={handleSignOut}
                    className="w-full py-1.5 rounded-md bg-[#2a1720] hover:bg-[#3d1f2d] border border-red-500/40 text-red-300 text-[11px] font-mono transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <LogOut className="w-3 h-3" />
                    <span>{t("auth.logout")}</span>
                  </button>
                )}

                {/* Bio summary if present */}
                {googleUser?.bio && (
                  <p className="text-[10px] text-slate-300 font-sans italic line-clamp-1 border-t border-white/10 pt-1.5">
                    &ldquo;{googleUser.bio}&rdquo;
                  </p>
                )}
              </div>

              {/* 2. Web3 Wallet & Onchain Transfer Section */}
              <div className="p-3 rounded-lg bg-[#151a28] border border-white/20 space-y-2.5 shadow-md">
                <div className="flex items-center justify-between text-xs font-mono gap-2">
                  <span className="text-white flex items-center gap-1.5 font-bold shrink-0 whitespace-nowrap">
                    <Wallet className="w-4 h-4 text-purple-400 shrink-0" />
                    <span>{t("auth.onchain_wallet")}</span>
                  </span>
                  <div className="flex items-center gap-1.5 flex-wrap justify-end">
                    {walletAddress ? (
                      <>
                        <span className="text-[10px] text-purple-300 font-bold bg-purple-950/60 border border-purple-500/50 px-2 py-0.5 rounded-md font-mono whitespace-nowrap">
                          {kolBalance} KOL
                        </span>
                        <span className="text-[10px] text-emerald-300 font-bold bg-emerald-950/60 border border-emerald-500/50 px-2 py-0.5 rounded-md font-mono whitespace-nowrap">
                          {balance} MON
                        </span>
                      </>
                    ) : (
                      <span className="text-[10px] text-slate-400 font-medium bg-slate-800/80 border border-white/10 px-2 py-0.5 rounded-md font-mono whitespace-nowrap">
                        {t("auth.wallet_unconnected")}
                      </span>
                    )}
                  </div>
                </div>

                {walletAddress ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between p-2 rounded-md bg-[#0d1018] border border-white/15 text-xs font-mono">
                      <span className="text-slate-100 font-semibold">{truncateAddress(walletAddress)}</span>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => copyToClipboard(walletAddress)}
                          className="text-[10px] px-1.5 py-0.5 rounded-md bg-[#20273c] hover:bg-[#2c3652] text-slate-200 hover:text-white transition flex items-center gap-1 border border-white/10 cursor-pointer"
                          title={t("auth.copy_address")}
                        >
                          {copied ? (
                            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                          <span>{copied ? t("auth.copied") : t("auth.copy")}</span>
                        </button>
                        <a
                          href={`${monadTestnet.blockExplorers.default.url}/address/${walletAddress}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[10px] p-1 rounded-md bg-[#20273c] hover:bg-[#2c3652] text-slate-200 hover:text-white transition border border-white/10"
                          title={t("auth.view_explorer")}
                        >
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </div>

                    {/* Wallet Action Buttons: Transfer KOL, Transfer MON & Disconnect */}
                    <div className="grid grid-cols-3 gap-1.5 pt-0.5">
                      <button
                        onClick={() => {
                          setTransferCurrency("KOL");
                          setDropdownOpen(false);
                          setTransferModalOpen(true);
                        }}
                        className="py-1.5 px-2 rounded-md bg-purple-600 hover:bg-purple-500 text-white text-[11px] font-mono font-semibold transition flex items-center justify-center gap-1 shadow-md active:scale-95 border border-purple-400/40 cursor-pointer"
                      >
                        <Coins className="w-3 h-3 text-purple-200" />
                        <span>{t("auth.transfer_kol")}</span>
                      </button>
                      <button
                        onClick={() => {
                          setTransferCurrency("MON");
                          setDropdownOpen(false);
                          setTransferModalOpen(true);
                        }}
                        className="py-1.5 px-2 rounded-md bg-emerald-700/80 hover:bg-emerald-600 text-white text-[11px] font-mono font-semibold transition flex items-center justify-center gap-1 shadow-md active:scale-95 border border-emerald-400/40 cursor-pointer"
                      >
                        <Send className="w-3 h-3 text-emerald-200" />
                        <span>{t("auth.transfer_mon")}</span>
                      </button>
                      <button
                        onClick={() => {
                          setDropdownOpen(false);
                          onDisconnectWallet?.();
                        }}
                        className="py-1.5 px-2 rounded-md bg-[#2a1720] hover:bg-[#3d1f2d] border border-red-500/40 text-red-300 text-[11px] font-mono transition flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <LogOut className="w-3 h-3" />
                        <span>{t("auth.disconnect")}</span>
                      </button>
                    </div>

                    {/* Issue #30: a wallet click means "attach a wallet to the
                        session I already have" only when there is a session.
                        With none, `linkWallet` is documented "For users who are
                        authenticated" and silently does nothing - so the entry
                        point moves to the unconnected block below, which starts
                        a session instead. */}
                    {walletRail === "link-to-existing" && (
                      <button
                        onClick={handleWalletRail}
                        className="w-full py-1 px-2 rounded-md bg-[#1a2134] hover:bg-[#25304a] text-slate-300 hover:text-white text-[10px] font-mono transition flex items-center justify-center gap-1 border border-white/10"
                      >
                        <Link2 className="w-3 h-3 text-purple-400" />
                        <span>{walletRailLabel(true, lang)}</span>
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-[11px] text-slate-300 font-sans">
                      {lang === "en"
                        ? "Connect your Monad wallet for on-chain transfers, asset staking, and credit endorsement. A wallet is enough to sign in - Google and GitHub are optional rails that raise your credit limit."
                        : "连接 Monad 钱包即可进行链上转账、资产抵押与信用背书。仅凭钱包即可登录——Google / GitHub 是可选的身份增强轨，只影响授信额度。"}
                    </p>
                    {/* Issue #30: the pure-wallet user's only way in. This used
                        to be wired to `onConnectWallet` (which on the home page
                        is the same full `login()`), so the wallet rail named
                        nothing and nobody without Google could get a session.
                        `handleWalletRail` starts one, wallet methods first. */}
                    {walletRail === "start-session" && (
                      <button
                        onClick={handleWalletRail}
                        className="w-full py-2 rounded-md bg-white hover:bg-slate-100 text-black font-semibold text-xs transition flex items-center justify-center gap-1.5 shadow-md active:scale-95 cursor-pointer"
                      >
                        <Wallet className="w-3.5 h-3.5 text-black" />
                        <span>{walletRailLabel(false, lang)}</span>
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* 3. Identity Credential Badges (Google, GitHub, Steam) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[11px] font-mono text-slate-200 px-0.5">
                  <span className="flex items-center gap-1 font-semibold">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{lang === "en" ? "Multi-Rail Credential Attestation" : "多轨身份背书与授信"}</span>
                  </span>
                  <span className="text-[9px] text-emerald-300 font-mono bg-emerald-950/60 px-1.5 py-0.5 rounded-md border border-emerald-500/30">
                    {lang === "en" ? "Credit Boost" : "额度增强"}
                  </span>
                </div>

                {/* Google Row */}
                <div className="p-2.5 rounded-lg bg-[#151a28] border border-white/15 flex items-center justify-between shadow-sm gap-2">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                      <path fill="#EA4335" d="M12 5c1.6 0 3 .6 4.1 1.6l3.1-3.1C17.3 1.8 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.4 9 5 12 5z" />
                      <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z" />
                      <path fill="#FBBC05" d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.3s.2-1.6.4-2.3L1.9 7.3C.7 9.7 0 12.3 0 15.1c0 2.8.7 5.4 1.9 7.8l3.7-2.9z" />
                      <path fill="#34A853" d="M12 23.2c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.4-6.4-5.2L1.9 16.2C3.7 20 7.5 23.2 12 23.2z" />
                    </svg>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold text-white flex items-center gap-1">
                        <span className="truncate">{lang === "en" ? "Google Identity" : "Google 认证"}</span>
                        {googleUser && <CheckCircle2 className="w-3 h-3 text-blue-400 shrink-0" />}
                      </div>
                      <div className="text-[10px] font-mono text-slate-300 truncate">
                        {googleUser
                          ? googleUser.synthetic
                            ? "[SYNTHETIC] 0 USD"
                            : googleUser.email
                          : "+$1,200 USD"}
                      </div>
                    </div>
                  </div>
                  {googleUser ? (
                    <button
                      onClick={() => handleUnlink("google")}
                      className="shrink-0 whitespace-nowrap text-[10px] font-mono px-2 py-1 rounded-md bg-[#2a1720] hover:bg-[#3d1f2d] text-red-300 border border-red-500/40 transition cursor-pointer"
                    >
                      {lang === "en" ? "Unlink" : "解除"}
                    </button>
                  ) : (
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={handleGoogleLogin}
                        className="shrink-0 whitespace-nowrap text-[10px] font-mono px-2.5 py-1 rounded-md bg-blue-600 hover:bg-blue-500 text-white font-bold transition shadow-sm cursor-pointer"
                      >
                        {t("auth.to_login")}
                      </button>
                      <button
                        onClick={handleInstantGoogleDemo}
                        title={t("auth.instant_demo")}
                        className="p-1 rounded-md bg-[#222a42] hover:bg-[#2c3652] text-slate-200 border border-white/10 cursor-pointer"
                      >
                        <Sparkles className="w-3 h-3 text-blue-300" />
                      </button>
                    </div>
                  )}
                </div>

                {/* GitHub Row */}
                <div className="p-2.5 rounded-lg bg-[#151a28] border border-white/15 flex items-center justify-between shadow-sm gap-2">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <Github className="w-4 h-4 text-white shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold text-white flex items-center gap-1">
                        <span className="truncate">GitHub BUIDL</span>
                        {githubUser && <CheckCircle2 className="w-3 h-3 text-indigo-400 shrink-0" />}
                      </div>
                      <div className="text-[10px] font-mono text-slate-300 truncate">
                        {githubUser ? `@${githubUser.username}` : "+$1,000 USD"}
                      </div>
                    </div>
                  </div>
                  {githubUser ? (
                    <button
                      onClick={() => handleUnlink("github")}
                      className="shrink-0 whitespace-nowrap text-[10px] font-mono px-2 py-1 rounded-md bg-[#2a1720] hover:bg-[#3d1f2d] text-red-300 border border-red-500/40 transition cursor-pointer"
                    >
                      {lang === "en" ? "Unlink" : "解除"}
                    </button>
                  ) : (
                    <button
                      onClick={handleGithubLogin}
                      className="shrink-0 whitespace-nowrap text-[10px] font-mono px-2.5 py-1 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition shadow-sm cursor-pointer"
                    >
                      {lang === "en" ? "Authorize" : "授权"}
                    </button>
                  )}
                </div>

                {/* Steam Row */}
                <div className="p-2.5 rounded-lg bg-[#151a28] border border-white/15 flex items-center justify-between shadow-sm gap-2">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <Gamepad2 className="w-4 h-4 text-cyan-400 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold text-white flex items-center gap-1">
                        <span className="truncate">{lang === "en" ? "Steam Gameplay" : "Steam 游戏时长"}</span>
                        {steamUser && <CheckCircle2 className="w-3 h-3 text-cyan-400 shrink-0" />}
                      </div>
                      <div className="text-[10px] font-mono text-slate-300 truncate">
                        {steamUser ? steamUser.personaName : "+$800 USD"}
                      </div>
                    </div>
                  </div>
                  {steamUser ? (
                    <button
                      onClick={() => handleUnlink("steam")}
                      className="shrink-0 whitespace-nowrap text-[10px] font-mono px-2 py-1 rounded-md bg-[#2a1720] hover:bg-[#3d1f2d] text-red-300 border border-red-500/40 transition cursor-pointer"
                    >
                      {lang === "en" ? "Unlink" : "解除"}
                    </button>
                  ) : (
                    <button
                      onClick={handleSteamLogin}
                      className="shrink-0 whitespace-nowrap text-[10px] font-mono px-2.5 py-1 rounded-md bg-cyan-600 hover:bg-cyan-500 text-white font-bold transition shadow-sm cursor-pointer"
                    >
                      {lang === "en" ? "Link Steam" : "绑定"}
                    </button>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="pt-1 flex items-center justify-between text-[10px] font-mono text-slate-400">
                <span>{lang === "en" ? "Koliance Unified Account & Asset Center" : "Koliance 统一账户与资产中心"}</span>
                <button
                  onClick={() => setDropdownOpen(false)}
                  className="hover:text-white transition cursor-pointer"
                >
                  {lang === "en" ? "Close" : "收起"}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Edit Profile Modal */}
      <EditProfileModal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        profile={{
          id: googleUser?.id || "did:koliance:guest",
          email: googleUser?.email || "developer@koliance.io",
          name: googleUser?.name || "开发者",
          picture: googleUser?.picture || null,
          bio: googleUser?.bio || "Koliance Web3 & AI Identity",
          walletAddress: googleUser?.walletAddress || walletAddress,
          trustTier: googleUser?.tier || "DEVELOPER",
          creditAllowanceUSD: googleUser?.creditAllowanceUSD ?? 1200,
        }}
        walletAddress={walletAddress}
        onProfileUpdated={(updated: UserProfileData) => {
          // Persist through the shared channel so the navbar, the walls and any
          // other consumer move together instead of only this component.
          writeAccountState("google", {
            googleId: updated.id.replace("did:koliance:google:", ""),
            name: updated.name,
            email: updated.email,
            picture: updated.picture,
            bio: updated.bio,
            walletAddress: updated.walletAddress,
            trustTier: updated.trustTier,
            creditAllowanceUSD: updated.creditAllowanceUSD,
          });
        }}
      />

      {/* Transfer Modal for Monad KOL & MON */}
      {effectiveWallet && (
        <TransferModal
          isOpen={transferModalOpen}
          onClose={() => setTransferModalOpen(false)}
          senderAddress={effectiveWallet}
          balance={balance}
          initialCurrency={transferCurrency}
        />
      )}

      {/* Universal Reward Celebration Modal */}
      <RewardCelebrationModal
        isOpen={rewardModalState.isOpen}
        onClose={() => setRewardModalState((prev) => ({ ...prev, isOpen: false }))}
        rewardAmount={rewardModalState.amount}
        actionType={rewardModalState.actionType}
      />
    </div>
  );
}

