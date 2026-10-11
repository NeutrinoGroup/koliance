import { createConfig as createPrivyWagmiConfig } from "@privy-io/wagmi";
import { createConfig as createStandardWagmiConfig, http, injected } from "wagmi";
import { monadTestnet } from "./contract";

/**
 * Wagmi configuration for Privy-integrated mode.
 * Automatically provisions connectors for external wallets (MetaMask, Rabby, WalletConnect)
 * as well as Privy MPC embedded wallets.
 */
export const privyWagmiConfig = createPrivyWagmiConfig({
  chains: [monadTestnet],
  transports: {
    [monadTestnet.id]: http("https://testnet-rpc.monad.xyz"),
  },
});

/**
 * Fallback Wagmi configuration for standalone / direct-injected mode
 * when NEXT_PUBLIC_PRIVY_APP_ID is not yet configured.
 */
export const fallbackWagmiConfig = createStandardWagmiConfig({
  chains: [monadTestnet],
  connectors: [injected()],
  transports: {
    [monadTestnet.id]: http("https://testnet-rpc.monad.xyz"),
  },
});
