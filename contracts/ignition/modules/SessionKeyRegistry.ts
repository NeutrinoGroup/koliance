import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import PerpStackModule from "./PerpStack";

/**
 * Deploys SessionKeyRegistry and wires it with PositionManager.
 *
 * Wiring calls:
 *   1. PositionManager.setSessionKeyRegistry(registry) - enables agent delegation checks
 *   2. registry.setSpendConsumer(PositionManager)     - authorises manager to charge spends
 *
 *   npx hardhat ignition deploy ignition/modules/SessionKeyRegistry.ts --network monadTestnet
 */
export default buildModule("SessionKeyRegistryModule", (m) => {
  const { positionManager } = m.useModule(PerpStackModule);
  const sessionKeyRegistry = m.contract("SessionKeyRegistry");

  m.call(positionManager, "setSessionKeyRegistry", [sessionKeyRegistry]);
  m.call(sessionKeyRegistry, "setSpendConsumer", [positionManager]);

  return { sessionKeyRegistry };
});
