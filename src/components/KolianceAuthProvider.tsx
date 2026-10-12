"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  ReactNode,
} from "react";
import {
  ACCOUNT_STATE_EVENT,
  AccountState,
  EMPTY_ACCOUNT_STATE,
  STORAGE_KEYS,
  readAccountState,
  unlinkRail,
  writeAccountState,
} from "@/lib/authState";

/**
 * App-wide writer and reader for the signed-in identity rows.
 *
 * Before this provider, `NavAuthBadges` kept its own copy and refreshed it from
 * a `window.addEventListener("storage", ...)` that the writing tab never fires
 * (the spec delivers `storage` to other documents only). The result was issue
 * #34: the wall wrote the profile, and the navbar - a sibling, not an ancestor
 * or descendant - kept rendering "Sign In" until something unrelated remounted
 * it.
 *
 * One provider, mounted above both, is what makes a write visible to every
 * consumer without a reload. It is deliberately separate from
 * `src/components/Providers.tsx`, which owns the Privy/Wagmi providers: this
 * one has no external dependency and does not need an app id, so the fallback
 * (no Privy) path gets the same account state.
 */
export interface KolianceAccountContextValue {
  state: AccountState;
  /** Re-reads the rows. The effect below does this on every change already. */
  reload: () => void;
  /**
   * Removes one rail as the user's decision: the row is cleared **and its
   * identity held** until a sign-in/sign-out releases it, so the session that
   * still carries it cannot write it back. Signing out of Google must not unlink
   * GitHub, which is why this is per-rail while `signOut` is not.
   */
  unlink: (rail: keyof typeof STORAGE_KEYS) => void;
  /** Clears every rail: what "Sign Out" means to the navbar. */
  signOut: () => void;
}

const KolianceAccountContext = createContext<KolianceAccountContextValue>({
  state: EMPTY_ACCOUNT_STATE,
  reload: () => {},
  unlink: () => {},
  signOut: () => {},
});

export function useKolianceAccount() {
  return useContext(KolianceAccountContext);
}

export function KolianceAuthProvider({ children }: { children: ReactNode }) {
  // Starts empty rather than seeded from `localStorage`: this component is
  // server-rendered for the first paint, where there is no `localStorage`, and
  // a client render that disagreed with that HTML would be a hydration error.
  // The effect below fills it in on mount.
  const [state, setState] = useState<AccountState>(EMPTY_ACCOUNT_STATE);

  useEffect(() => {
    const sync = () => setState(readAccountState());
    sync();

    // Two listeners, on purpose:
    //  - ACCOUNT_STATE_EVENT for writes from this document (all our writers
    //    dispatch it through `writeAccountState`), and for the wall's
    //    cross-component hint;
    //  - `storage` for writes from another tab, which the spec routes only
    //    there. Neither alone covers both directions.
    window.addEventListener(ACCOUNT_STATE_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(ACCOUNT_STATE_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const unlink = useCallback((rail: keyof typeof STORAGE_KEYS) => {
    // `unlinkRail`, not a bare `writeAccountState(rail, null)`: removing a rail
    // is the user's decision, and the identity it carried has to be held so the
    // session that still carries it cannot write it back (F7). Sign Out below
    // stays a plain clear, because it also ends that session.
    unlinkRail(rail);
  }, []);

  const signOut = useCallback(() => {
    writeAccountState("google", null);
    writeAccountState("github", null);
    writeAccountState("steam", null);
  }, []);

  const value = useMemo<KolianceAccountContextValue>(
    () => ({ state, reload: () => setState(readAccountState()), unlink, signOut }),
    [state, unlink, signOut]
  );

  return (
    <KolianceAccountContext.Provider value={value}>
      {children}
    </KolianceAccountContext.Provider>
  );
}
