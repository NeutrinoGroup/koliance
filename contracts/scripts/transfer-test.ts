import { network } from "hardhat";
import { parseEther, isAddress } from "viem";

async function main() {
  const contractAddress = process.env.KOL_CONTRACT_ADDRESS;
  const recipient = process.env.TARGET_RECIPIENT;
  const transferAmount = process.env.TRANSFER_AMOUNT || "1.0";

  if (!contractAddress || !isAddress(contractAddress)) {
    console.error("[ERROR] KOL_CONTRACT_ADDRESS environment variable must be set to a valid address!");
    process.exit(1);
  }

  const { viem, networkName } = await network.getOrCreate();
  const [sender] = await viem.getWalletClients();
  const publicClient = await viem.getPublicClient();

  console.log(`\n[NETWORK] Current network: ${networkName}`);
  console.log(`[ACCOUNT] Sender account: ${sender.account.address}`);
  console.log(`[CONTRACT] KolToken address: ${contractAddress}`);

  const kolToken = await viem.getContractAt("KolToken", contractAddress);

  // 1. Claim block reward
  console.log("\n[EXEC] Calling claimBlockReward()...");
  try {
    const claimTx = await kolToken.write.claimBlockReward();
    console.log(`[SUCCESS] Block reward claimed! Tx Hash: ${claimTx}`);
  } catch (err: any) {
    console.log(`[INFO] Claim skipped or not needed: ${err?.shortMessage || err?.message || err}`);
  }

  // 2. Query balances
  const tokenBal = await kolToken.read.balanceOf([sender.account.address]);
  const monBal = await publicClient.getBalance({ address: sender.account.address });
  console.log(`[BALANCE] Current MON: ${Number(monBal) / 1e18} MON`);
  console.log(`[BALANCE] Current ICON: ${Number(tokenBal) / 1e18} ICON`);

  // 3. Test transfers if recipient provided
  if (recipient && isAddress(recipient)) {
    console.log(`\n[TRANSFER] Target recipient: ${recipient}`);

    const tokenAmountWei = parseEther(transferAmount);
    if (tokenBal >= tokenAmountWei) {
      console.log(`[TRANSFER] Transferring ${transferAmount} ICON...`);
      const tx = await kolToken.write.transfer([recipient, tokenAmountWei]);
      console.log(`[SUCCESS] ICON transfer confirmed! Tx Hash: ${tx}`);
    } else {
      console.log(`[WARN] Insufficient ICON balance for ${transferAmount}, skipping.`);
    }

    const monSendAmount = parseEther("0.001");
    if (monBal > monSendAmount) {
      console.log(`[TRANSFER] Transferring 0.001 MON (Native Gas)...`);
      const monTx = await sender.sendTransaction({
        to: recipient,
        value: monSendAmount,
      });
      console.log(`[SUCCESS] MON native transfer confirmed! Tx Hash: ${monTx}`);
    }
  } else {
    console.log("\n[TIP] Set TARGET_RECIPIENT=0x... to test token transfers.");
  }
}

main().catch((error) => {
  console.error("[ERROR] Execution error:", error);
  process.exitCode = 1;
});
