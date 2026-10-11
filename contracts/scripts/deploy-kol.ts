import { network } from "hardhat";

async function main() {
  const { viem, networkName } = await network.getOrCreate();
  const [deployer] = await viem.getWalletClients();

  console.log(`\n[DEPLOY] Preparing KolToken deployment on network [${networkName}]...`);
  console.log(`[DEPLOY] Deployer account: ${deployer.account.address}`);

  const publicClient = await viem.getPublicClient();
  const balance = await publicClient.getBalance({ address: deployer.account.address });
  console.log(`[BALANCE] Native balance: ${balance} wei (${Number(balance) / 1e18} native tokens)`);

  if (balance === 0n) {
    console.warn("[WARN] Deployer account native balance is 0. Please fund testnet tokens first.");
  }

  const kolToken = await viem.deployContract("KolToken");
  console.log(`\n[SUCCESS] KolToken deployed successfully!`);
  console.log(`[ADDRESS] Contract address: ${kolToken.address}`);
  console.log(`[NAME] Token name: kol`);
  console.log(`[SYMBOL] Token symbol: KOL`);
  console.log(`[DECIMALS] Decimals: 18`);
  console.log(`[SUPPLY] Max supply: 2^30 (${2n ** 30n} KOL)`);
  console.log(`\n[EXPLORER] View on Monad Explorer: https://testnet.monadexplorer.com/address/${kolToken.address}\n`);
}

main().catch((error) => {
  console.error("[ERROR] Deployment failed:", error);
  process.exitCode = 1;
});
