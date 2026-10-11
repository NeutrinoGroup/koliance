import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

/**
 * Deploys ONLY SessionKeyRegistry — no perp stack, no wiring.
 *
 * The AgentCard delegation demo (EIP-712 grant, per-tx cap, daily cap,
 * frequency limit, revoke) needs nothing else: `authorizeSpend` is the agent's
 * own entry point and does not require a spend consumer. Use
 * `SessionKeyRegistry.ts` instead when the registry must be wired to a
 * PositionManager.
 *
 *   npx hardhat ignition deploy ignition/modules/SessionKeyRegistryStandalone.ts --network monadTestnet
 */
export default buildModule("SessionKeyRegistryStandaloneModule", (m) => {
  const sessionKeyRegistry = m.contract("SessionKeyRegistry");
  return { sessionKeyRegistry };
});
