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

  it("renders Providers cleanly when NEXT_PUBLIC_PRIVY_APP_ID is set", () => {
    const original = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
    try {
      process.env.NEXT_PUBLIC_PRIVY_APP_ID = "cmv3auys401hu0fk1xbejcdfu";
      const html = renderToString(
        React.createElement(
          Providers,
          null,
          React.createElement("div", { id: "privy-child" }, "Privy Active")
        )
      );
      expect(html).toContain("Privy Active");
      expect(html).toContain("privy-child");
    } finally {
      process.env.NEXT_PUBLIC_PRIVY_APP_ID = original;
    }
  });
});
