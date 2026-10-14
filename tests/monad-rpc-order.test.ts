import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { MONAD_RPC_URLS } from "@/lib/contract";

/**
 * Issue #50: `monad-testnet.drpc.org` answers `eth_chainId` but rejects
 * `eth_call` / `eth_blockNumber` with -32601 ("method does not exist"). Because
 * the read paths used `fallback([drpc, testnet-rpc])`, every contract read paid
 * one guaranteed-failed round-trip and the browser console filled with 400s.
 *
 * The defect was not a wrong number — it was a *list order* duplicated across
 * three components that had drifted from the (correct) one in `contract.ts`.
 * Nothing could see the drift. These two tests are the judge that was missing:
 * one pins the order at the SSOT, the other forbids the inline duplication that
 * let it drift.
 */

/** Every .ts/.tsx under src/, skipping node_modules and build output. */
function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".next") continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) sourceFiles(p, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
}

const RPC_HOST = "monad-testnet.drpc.org";

describe("issue #50 — Monad read RPC order", () => {
  it("lists testnet-rpc.monad.xyz first so eth_call never hits the drpc endpoint", () => {
    // The whole point of the fix: the endpoint that actually supports eth_call
    // is tried first. If this flips, every contract read regresses.
    expect(MONAD_RPC_URLS[0]).toBe("https://testnet-rpc.monad.xyz");
    expect(MONAD_RPC_URLS).toContain(`https://${RPC_HOST}`);
    // And it must still be reachable as a fallback, not deleted outright.
    expect(MONAD_RPC_URLS.indexOf(`https://${RPC_HOST}`)).toBeGreaterThan(0);
  });

  it("defines the Monad RPC endpoint set in exactly one place", () => {
    // The regression that caused #50 was three components re-declaring the list
    // inline. Reading the endpoint list from more than one file is the drift
    // vector, so assert the URL literal appears in exactly one source file:
    // the SSOT. Consumers call monadRpcTransport() instead.
    const files = sourceFiles("src");
    const withHost = files.filter((f) => readFileSync(f, "utf8").includes(RPC_HOST));

    // contract.ts declares it; that is the one. Anything else is a copy.
    const offenders = withHost.filter((f) => !f.endsWith(join("lib", "contract.ts")));
    expect(
      offenders,
      `Monad RPC endpoint list duplicated outside the SSOT — call monadRpcTransport() from src/lib/contract.ts instead: ${offenders.join(", ")}`,
    ).toEqual([]);
  });
});
