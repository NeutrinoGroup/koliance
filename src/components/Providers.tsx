"use client";

import React, { createContext, useContext, useState, ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

export interface KolianceAuthContextValue {
  isPrivyEnabled: boolean;
  ready: boolean;
  authenticated: boolean;
  user: any | null;
  address: `0x${string}` | null;
  isConnected: boolean;
  login: () => void;
  logout: () => Promise<void>;
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

  const contextValue: KolianceAuthContextValue = {
    isPrivyEnabled: false,
    ready: true,
    authenticated: false,
    user: null,
    address: null,
    isConnected: false,
    login: () => {
      if (typeof window !== "undefined" && !(window as any).ethereum) {
        alert("Please install MetaMask, Rabby, or an EVM-compatible Web3 wallet!");
      }
    },
    logout: async () => {},
  };

  return (
    <QueryClientProvider client={queryClient}>
      <KolianceAuthContext.Provider value={contextValue}>
        {children}
      </KolianceAuthContext.Provider>
    </QueryClientProvider>
  );
}
