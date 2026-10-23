/**
 * Wire PositionManager and SessionKeyRegistry on Monad Testnet.
 *
 * Usage:
 *   cd contracts
 *   npx hardhat compile
 *   npx tsx scripts/wire-session-registry.ts
 *
 * Configurable environment variables:
 *   PRIVATE_KEY                  Transaction signer private key (defaults to contracts/.env)
 *   POSITION_MANAGER             PositionManager address (default Monad testnet deployment)
 *   SESSION_KEY_REGISTRY         SessionKeyRegistry address (default Monad testnet deployment)
 *   RPC_URL                      Monad testnet RPC (default: https://testnet-rpc.monad.xyz)
 *   CHAIN_ID                     Default 10143 (Monad Testnet)
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createPublicClient,
  createWalletClient,
  defineChain,
  formatEther,
  http,
  type Abi,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

const here = dirname(fileURLToPath(import.meta.url));

const pmArtifact = JSON.parse(
  readFileSync(resolve(here, "../artifacts/contracts/perp/PositionManager.sol/PositionManager.json"), "utf8")
);
const regArtifact = JSON.parse(
  readFileSync(resolve(here, "../artifacts/contracts/perp/SessionKeyRegistry.sol/SessionKeyRegistry.json"), "utf8")
);

const PM_ABI = pmArtifact.abi as Abi;
const REG_ABI = regArtifact.abi as Abi;

const RPC_URL = process.env.RPC_URL || "https://testnet-rpc.monad.xyz";
const CHAIN_ID = Number(process.env.CHAIN_ID || 10143);
const PM_ADDRESS = (process.env.POSITION_MANAGER || "0x82040c06da6efc60e9505f2efee0099e909b15c5") as Hex;
const REG_ADDRESS = (process.env.SESSION_KEY_REGISTRY || "0xCb7f48F455a19778fC75afb0564aaA88b64FA004") as Hex;

const monadTestnet = defineChain({
  id: CHAIN_ID,
  name: CHAIN_ID === 10143 ? "Monad Testnet" : `Chain ${CHAIN_ID}`,
  nativeCurrency: { name: "Monad", symbol: "MON", decimals: 18 },
  rpcUrls: { default: { http: [RPC_URL] } },
  blockExplorers: { default: { name: "MonadVision", url: "https://testnet.monadvision.com" } },
});

async function main() {
  console.log("[INFO] ==================================================");
  console.log("[INFO] Koliance On-Chain SessionKeyRegistry Wiring Tool");
  console.log("[INFO] ==================================================");
  console.log(`[INFO] Network: ${monadTestnet.name} (${CHAIN_ID})`);
  console.log(`[INFO] RPC URL: ${RPC_URL}`);
  console.log(`[INFO] PositionManager:    ${PM_ADDRESS}`);
  console.log(`[INFO] SessionKeyRegistry: ${REG_ADDRESS}`);

  const pub = createPublicClient({ chain: monadTestnet, transport: http(RPC_URL) });

  const currentChainId = await pub.getChainId();
  if (currentChainId !== CHAIN_ID) {
    throw new Error(`[ERROR] Connected chainId ${currentChainId} does not match expected ${CHAIN_ID}`);
  }

  // 1. Read current on-chain state
  const pmOwner = (await pub.readContract({
    address: PM_ADDRESS,
    abi: PM_ABI,
    functionName: "owner",
  })) as Hex;

  const currentPmRegistry = (await pub.readContract({
    address: PM_ADDRESS,
    abi: PM_ABI,
    functionName: "sessionKeyRegistry",
  })) as Hex;

  const regOwner = (await pub.readContract({
    address: REG_ADDRESS,
    abi: REG_ABI,
    functionName: "owner",
  })) as Hex;

  const currentSpendConsumer = (await pub.readContract({
    address: REG_ADDRESS,
    abi: REG_ABI,
    functionName: "spendConsumer",
  })) as Hex;

  console.log(`[INFO] PositionManager Owner:        ${pmOwner}`);
  console.log(`[INFO] PositionManager Registry:     ${currentPmRegistry}`);
  console.log(`[INFO] SessionKeyRegistry Owner:     ${regOwner}`);
  console.log(`[INFO] SessionKeyRegistry Consumer:  ${currentSpendConsumer}`);

  const isPmLinked = currentPmRegistry.toLowerCase() === REG_ADDRESS.toLowerCase();
  const isConsumerLinked = currentSpendConsumer.toLowerCase() === PM_ADDRESS.toLowerCase();
  const isCheckMode = process.argv.includes("--check");

  if (isPmLinked) {
    console.log(`[OK] PositionManager already wired to SessionKeyRegistry: ${currentPmRegistry}`);
  }
  if (isConsumerLinked) {
    console.log(`[OK] SessionKeyRegistry already has spendConsumer set to PositionManager: ${currentSpendConsumer}`);
  }

  if (isCheckMode) {
    console.log("[INFO] --------------------------------------------------");
    console.log("[INFO] Check Mode Verification Summary:");
    console.log(`[INFO] PositionManager.sessionKeyRegistry: ${currentPmRegistry} (${isPmLinked ? "[OK]" : "[PENDING]"})`);
    console.log(`[INFO] SessionKeyRegistry.spendConsumer:  ${currentSpendConsumer} (${isConsumerLinked ? "[OK]" : "[PENDING]"})`);
    if (!isPmLinked) {
      console.error("[ERROR] Check failed: PositionManager is not wired to SessionKeyRegistry.");
      process.exit(1);
    }
    console.log("[OK] PositionManager -> SessionKeyRegistry link verified on chain.");
    return;
  }

  const rawKey = process.env.PRIVATE_KEY;
  if (!rawKey) {
    console.log("[WARN] No PRIVATE_KEY configured in environment. Read-only inspection complete.");
    console.log("[INFO] --------------------------------------------------");
    console.log("[INFO] Current On-Chain Linkage Status:");
    console.log(`[INFO] PositionManager.sessionKeyRegistry: ${currentPmRegistry} (${isPmLinked ? "[OK]" : "[PENDING]"})`);
    console.log(`[INFO] SessionKeyRegistry.spendConsumer:  ${currentSpendConsumer} (${isConsumerLinked ? "[OK]" : "[PENDING]"})`);
    if (isPmLinked) {
      console.log("[OK] PositionManager -> SessionKeyRegistry is successfully linked!");
    } else {
      console.log("[WARN] PositionManager -> SessionKeyRegistry link is still pending.");
    }
    return;
  }

  if (isPmLinked && isConsumerLinked) {
    console.log("[OK] Both PositionManager and SessionKeyRegistry are already linked. No transactions needed.");
    return;
  }

  const formattedKey = (rawKey.startsWith("0x") ? rawKey : `0x${rawKey}`) as Hex;
  const signerAccount = privateKeyToAccount(formattedKey);
  const signerAddress = signerAccount.address;
  const balance = await pub.getBalance({ address: signerAddress });

  console.log(`[INFO] Signer Address: ${signerAddress} (Balance: ${formatEther(balance)} MON)`);

  const wallet = createWalletClient({
    account: signerAccount,
    chain: monadTestnet,
    transport: http(RPC_URL),
  });

  // 2. Wire PositionManager -> SessionKeyRegistry
  if (!isPmLinked) {
    if (signerAddress.toLowerCase() !== pmOwner.toLowerCase()) {
      console.log(
        `[WARN] Signer ${signerAddress} is NOT PositionManager owner (${pmOwner}). Skipping setSessionKeyRegistry.`
      );
    } else {
      console.log(`[INFO] Calling PositionManager.setSessionKeyRegistry(${REG_ADDRESS})...`);
      const hash = await wallet.writeContract({
        address: PM_ADDRESS,
        abi: PM_ABI,
        functionName: "setSessionKeyRegistry",
        args: [REG_ADDRESS],
      });
      console.log(`[INFO] Transaction broadcasted: ${hash}`);
      const receipt = await pub.waitForTransactionReceipt({ hash, timeout: 60_000 });
      if (receipt.status !== "success") {
        throw new Error(`[ERROR] Transaction reverted with status: ${receipt.status} (${hash})`);
      }
      console.log(`[SUCCESS] PositionManager.setSessionKeyRegistry confirmed in block ${receipt.blockNumber}`);
    }
  }

  // 3. Wire SessionKeyRegistry -> PositionManager spendConsumer
  if (!isConsumerLinked) {
    if (signerAddress.toLowerCase() !== regOwner.toLowerCase()) {
      console.log(
        `[WARN] Signer ${signerAddress} is NOT SessionKeyRegistry owner (${regOwner}). Skipping setSpendConsumer.`
      );
    } else {
      console.log(`[INFO] Calling SessionKeyRegistry.setSpendConsumer(${PM_ADDRESS})...`);
      const hash = await wallet.writeContract({
        address: REG_ADDRESS,
        abi: REG_ABI,
        functionName: "setSpendConsumer",
        args: [PM_ADDRESS],
      });
      console.log(`[INFO] Transaction broadcasted: ${hash}`);
      const receipt = await pub.waitForTransactionReceipt({ hash, timeout: 60_000 });
      if (receipt.status !== "success") {
        throw new Error(`[ERROR] Transaction reverted with status: ${receipt.status} (${hash})`);
      }
      console.log(`[SUCCESS] SessionKeyRegistry.setSpendConsumer confirmed in block ${receipt.blockNumber}`);
    }
  }

  // 4. Verify post-run state
  const finalPmRegistry = (await pub.readContract({
    address: PM_ADDRESS,
    abi: PM_ABI,
    functionName: "sessionKeyRegistry",
  })) as Hex;

  const finalSpendConsumer = (await pub.readContract({
    address: REG_ADDRESS,
    abi: REG_ABI,
    functionName: "spendConsumer",
  })) as Hex;

  console.log("[INFO] --------------------------------------------------");
  console.log("[INFO] Post-Wiring On-Chain Verification:");
  console.log(`[INFO] PositionManager.sessionKeyRegistry: ${finalPmRegistry}`);
  console.log(`[INFO] SessionKeyRegistry.spendConsumer:  ${finalSpendConsumer}`);
  if (finalPmRegistry.toLowerCase() === REG_ADDRESS.toLowerCase()) {
    console.log("[OK] PositionManager -> SessionKeyRegistry is successfully linked!");
  } else {
    console.log("[WARN] PositionManager -> SessionKeyRegistry link is still pending.");
  }
}

main().catch((err) => {
  console.error("[ERROR]", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
