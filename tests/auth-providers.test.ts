import { describe, it, expect } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { monadTestnet } from "../src/lib/contract";
import { privyWagmiConfig, fallbackWagmiConfig } from "../src/lib/wagmi";
import { Providers } from "../src/components/Providers";

describe("Privy and Wagmi configuration suite", () => {
  it("configures Monad Testnet properly in privyWagmiConfig", () => {
    expect(privyWagmiConfig).toBeDefined();
    expect(privyWagmiConfig.chains.some((c) => c.id === monadTestnet.id)).toBe(true);
    expect(monadTestnet.id).toBe(10143);
  });

  it("configures Monad Testnet properly in fallbackWagmiConfig", () => {
    expect(fallbackWagmiConfig).toBeDefined();
    expect(fallbackWagmiConfig.chains.some((c) => c.id === monadTestnet.id)).toBe(true);
  });

  it("renders Providers with fallback Wagmi when NEXT_PUBLIC_PRIVY_APP_ID is unset", () => {
    const html = renderToString(
      React.createElement(
        Providers,
        null,
        React.createElement("div", { id: "test-child" }, "Koliance Ready")
      )
    );
    expect(html).toContain("Koliance Ready");
    expect(html).toContain("test-child");
  });
});
