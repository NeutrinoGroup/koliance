"use client";

import React, { createContext, useContext, useState, ReactNode } from "react";
import { PrivyProvider, usePrivy, User } from "@privy-io/react-auth";
import { WagmiProvider as PrivyWagmiProvider } from "@privy-io/wagmi";
import {
  WagmiProvider as FallbackWagmiProvider,
  useAccount,
  useDisconnect,
  useConnect,
} from "wagmi";
import { injected } from "wagmi/connectors";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { privyWagmiConfig, fallbackWagmiConfig } from "@/lib/wagmi";
import { monadTestnet } from "@/lib/contract";
import type { WalletOnlyLoginOptions } from "@/lib/walletLogin";

export interface KolianceAuthContextValue {
  isPrivyEnabled: boolean;
  ready: boolean;
  authenticated: boolean;
  user: User | null;
  address: `0x${string}` | null;
  isConnected: boolean;
  /**
   * Starts a session. Accepts an optional override of the login modal's
   * methods, so a caller can open it restricted to the wallet rail
   * (`WALLET_ONLY_LOGIN_OPTIONS`) instead of the full method list.
   */
  login: (options?: WalletOnlyLoginOptions) => void;
  logout: () => Promise<void>;
  /**
   * Privy only: opens the wallet-connect modal **for an already authenticated
   * user**, i.e. it links a wallet to the current account. It is not a way to
   * start a session - see `resolveWalletRailAction` in `@/lib/walletLogin` for
   * the dispatch that keeps those two apart.
   */
  connectWallet?: () => void;
  linkWallet?: () => void;
  linkGoogle?: () => void;
  linkGithub?: () => void;
}

const KolianceAuthContext = createContext<KolianceAuthContextValue>({
  isPrivyEnabled: false,
  ready: true,
  authenticated: false,
  user: null,
  address: null,
  isConnected: false,
  login: () => {},
  logout: async () => {},
});

export function useKolianceAuth() {
  return useContext(KolianceAuthContext);
}

/**
 * Bridge component when Privy is active
 */
function PrivyAuthBridge({ children }: { children: ReactNode }) {
  const {
    ready,
    authenticated,
    user,
    login,
    logout: privyLogout,
    connectWallet,
    linkWallet,
    linkGoogle,
    linkGithub,
  } = usePrivy();
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();

  const handleLogout = async () => {
    disconnect();
    await privyLogout();
  };

  const contextValue: KolianceAuthContextValue = {
    isPrivyEnabled: true,
    ready,
    authenticated,
    user,
    address: (address || (user?.wallet?.address as `0x${string}`) || null) as `0x${string}` | null,
    isConnected: isConnected || !!user?.wallet?.address,
    login,
    logout: handleLogout,
    connectWallet,
    linkWallet,
    linkGoogle,
    linkGithub,
  };

  return (
    <KolianceAuthContext.Provider value={contextValue}>
      {children}
    </KolianceAuthContext.Provider>
  );
}

/**
 * Fallback bridge component when Privy App ID is not yet configured
 */
function FallbackAuthBridge({ children }: { children: ReactNode }) {
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const { connect } = useConnect();

  const handleLogin = () => {
    if (typeof window !== "undefined" && !(window as any).ethereum) {
      alert("Please install MetaMask, Rabby, or configure NEXT_PUBLIC_PRIVY_APP_ID for social logins.");
      return;
    }
    connect({ connector: injected() });
  };

  const handleLogout = async () => {
    disconnect();
  };

  const contextValue: KolianceAuthContextValue = {
    isPrivyEnabled: false,
    ready: true,
    authenticated: isConnected,
    user: null,
    address: (address || null) as `0x${string}` | null,
    isConnected,
    login: handleLogin,
    logout: handleLogout,
  };

  return (
    <KolianceAuthContext.Provider value={contextValue}>
      {children}
    </KolianceAuthContext.Provider>
  );
}

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  const rawPrivyAppId = process.env.NEXT_PUBLIC_PRIVY_APP_ID || "";
  // Privy strictly validates that appId is a string of length 25
  const isPrivyEnabled = typeof rawPrivyAppId === "string" && rawPrivyAppId.length === 25;

  if (isPrivyEnabled) {
    return (
      <PrivyProvider
        appId={rawPrivyAppId}
        config={{
          appearance: {
            theme: "dark",
            accentColor: "#836EF9",
            logo: "/brand-icon.png",
            walletList: [
              "metamask",
              "rabby_wallet",
              "rainbow",
              "coinbase_wallet",
              "wallet_connect",
            ],
          },
          loginMethods: ["wallet", "google", "github", "email"],
          embeddedWallets: {
            ethereum: {
              createOnLogin: "users-without-wallets",
            },
          },
          defaultChain: monadTestnet,
          supportedChains: [monadTestnet],
        }}
      >
        <QueryClientProvider client={queryClient}>
          <PrivyWagmiProvider config={privyWagmiConfig}>
            <PrivyAuthBridge>{children}</PrivyAuthBridge>
          </PrivyWagmiProvider>
        </QueryClientProvider>
      </PrivyProvider>
    );
  }

  // Graceful fallback for local development or when NEXT_PUBLIC_PRIVY_APP_ID is not set
  return (
    <QueryClientProvider client={queryClient}>
      <FallbackWagmiProvider config={fallbackWagmiConfig}>
        <FallbackAuthBridge>{children}</FallbackAuthBridge>
      </FallbackWagmiProvider>
    </QueryClientProvider>
  );
}
