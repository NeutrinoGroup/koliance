import { describe, it, expect } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { QuantumBootLoader } from "../src/components/QuantumBootLoader";

describe("QuantumBootLoader Minimalist Layout", () => {
  it("renders chain identifier badge and clean percentage without status or telemetry text", () => {
    const html = renderToString(React.createElement(QuantumBootLoader));

    // Verify chain header exists
    expect(html).toContain("KOLIANCE BOOT // CHAIN 10143");

    // Verify leading zero text is not padded (starts at 0%)
    expect(html).toContain("0%");
    expect(html).not.toContain("000%");

    // Verify all marked text elements have been completely removed
    expect(html).not.toContain("ESTABLISHING EIP-712 SESSION BUS");
    expect(html).not.toContain("INITIALIZING MONAD PARALLEL RUNTIME");
    expect(html).not.toContain("MEM: 0x8F94 // ALLOCATED");
    expect(html).not.toContain("10,000 TPS ENGINE");
  });
});
