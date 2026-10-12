"use client";

import { useEffect, useState } from "react";
import { AlertCircle } from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import {
  exchangeGoogleCode,
  parseGoogleCallback,
  recordGoogleProfile,
} from "@/lib/googleAuth";

/**
 * Completes a Google sign-in wherever Google lands, once, for the whole app.
 *
 * Issue #34, second round. `GoogleAuthWall` was the only component that ever
 * exchanged the authorization code, and it is mounted on one tab of one page
 * (`AgentCardTerminal`, tab "google"). Google returns the user to the
 * registered redirect URI - the site **root** - so on the way back the wall is
 * usually not mounted at all, the code is never exchanged, no profile is
 * written, and the navbar renders "Sign In" over a user who has just signed in.
 * That is the symptom the user still sees after `docs/changes/049`.
 *
 * Mounted in `src/app/layout.tsx` rather than on a page, because "which page
 * Google returns to" is decided by the registered redirect URI, not by where
 * the user clicked. A handler on the root page would work today and break the
 * day someone registers a deeper redirect URI; a handler in the layout is
 * indifferent to it.
 *
 * Three things this component is careful about:
 *
 *  1. **It only claims Google's code.** `?code=` is also how GitHub comes back,
 *     and `AgentCardTerminal` reads that same parameter for its own flow. The
 *     test is `isGoogleOAuthCallback` (Google appends a `googleapis.com` scope,
 *     GitHub does not), so this handler leaves a GitHub callback untouched
 *     instead of spending its code against the wrong route.
 *  2. **An authorization code is single-use.** React Strict Mode runs mount
 *     effects twice in development, and a re-mount would run this one again.
 *     The exchange is therefore guarded by the code itself, at module scope,
 *     so a second attempt over the same code cannot happen - and a second
 *     attempt would not merely be wasteful: Google refuses a replayed code, so
 *     the user would be shown an error for a sign-in that had already
 *     succeeded.
 *  3. **It says so when it fails.** A silent catch here would leave the user
 *     with a navbar that says "Sign In" and no explanation - the exact defect
 *     being fixed, now with a stack trace nobody sees. The route's own message
 *     is surfaced, in the same fixed pill the rest of the chrome uses.
 */
let claimedCode: string | null = null;

export function GoogleAuthCallback() {
  const { lang } = useLanguage();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [synced, setSynced] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const url = new URL(window.location.href);
    const parsed = parseGoogleCallback(url.searchParams);
    if (parsed.kind !== "google") return;

    // Claimed before the first `await`: two runs in the same tick (Strict
    // Mode's double mount) both reach this line, and only the first one wins.
    if (claimedCode === parsed.code) return;
    claimedCode = parsed.code;

    // The code and the granted scopes come off the address bar *before* the
    // exchange, not after. If the exchange is slow the user can click through
    // the app and lose the query string; and a code left in the address bar
    // after it has been spent is a reload away from being replayed.
    url.searchParams.delete("code");
    url.searchParams.delete("scope");
    url.searchParams.delete("authuser");
    url.searchParams.delete("prompt");
    url.searchParams.delete("state");
    window.history.replaceState({}, document.title, url.toString());

    let cancelled = false;
    exchangeGoogleCode(parsed.code)
      .then((profile) => {
        if (cancelled) return;
        recordGoogleProfile(profile);
        setSynced(true);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setErrorMsg(err instanceof Error ? err.message : String(err));
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (errorMsg === null && !synced) return null;

  return (
    <div className="fixed top-16 left-1/2 -translate-x-1/2 z-[60] px-3">
      {errorMsg !== null ? (
        <div
          role="alert"
          className="max-w-md flex items-center gap-2 px-3 py-2 rounded-md bg-[#2a1720] border border-red-500/40 text-red-200 text-xs font-mono shadow-[0_12px_40px_rgba(0,0,0,0.6)]"
        >
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>
            {lang === "en" ? "Google sign-in did not complete: " : "Google 登录未完成："}
            {errorMsg}
          </span>
        </div>
      ) : (
        <div className="max-w-md flex items-center gap-2 px-3 py-2 rounded-md bg-[#101b17] border border-emerald-500/40 text-emerald-200 text-xs font-mono shadow-[0_12px_40px_rgba(0,0,0,0.6)]">
          <span>
            {lang === "en"
              ? "Google identity verified. Account linked."
              : "Google 身份验证通过，账户已绑定。"}
          </span>
        </div>
      )}
    </div>
  );
}
