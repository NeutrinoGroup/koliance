import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { network } from "hardhat";

describe("KolToken (kol / ICON)", async function () {
  const { viem } = await network.getOrCreate();
  const testClient = await viem.getTestClient();
  const [ownerClient, minerClient, recipientClient] = await viem.getWalletClients();

  it("Should have correct token metadata and max supply", async function () {
    const kolToken = await viem.deployContract("KolToken");

    const name = await kolToken.read.name();
    const symbol = await kolToken.read.symbol();
    const decimals = await kolToken.read.decimals();
    const maxSupply = await kolToken.read.MAX_SUPPLY();

    assert.equal(name, "kol");
    assert.equal(symbol, "KOL");
    assert.equal(decimals, 18);
    // 2^30 * 10^18
    const expectedMaxSupply = (2n ** 30n) * (10n ** 18n);
    assert.equal(maxSupply, expectedMaxSupply);
  });

  it("Should claim block rewards based on elapsed time", async function () {
    const kolToken = await viem.deployContract("KolToken");

    // 前进 10 秒
    await testClient.increaseTime({ seconds: 10 });
    await testClient.mine({ blocks: 1 });

    const minerContract = await viem.getContractAt(
      "KolToken",
      kolToken.address,
      { client: { wallet: minerClient } }
    );

    await minerContract.write.claimBlockReward();

    const minerBalance = await kolToken.read.balanceOf([minerClient.account.address]);
    const totalSupply = await kolToken.read.totalSupply();

    assert.ok(minerBalance > 0n, "Miner should receive rewards");
    assert.equal(minerBalance, totalSupply);
  });

  it("Should support standard ERC20 transfer and allowance", async function () {
    const kolToken = await viem.deployContract("KolToken");

    // 先前进时间并 claim 一些代币
    await testClient.increaseTime({ seconds: 100 });
    await testClient.mine({ blocks: 1 });

    const minerContract = await viem.getContractAt(
      "KolToken",
      kolToken.address,
      { client: { wallet: minerClient } }
    );
    await minerContract.write.claimBlockReward();

    const initialMinerBalance = await kolToken.read.balanceOf([minerClient.account.address]);
    assert.ok(initialMinerBalance > 1000n);

    // 转账 1000 个 wei 到 recipient
    const sendAmount = 1000n;
    await minerContract.write.transfer([recipientClient.account.address, sendAmount]);

    const recipientBalance = await kolToken.read.balanceOf([recipientClient.account.address]);
    const afterMinerBalance = await kolToken.read.balanceOf([minerClient.account.address]);

    assert.equal(recipientBalance, sendAmount);
    assert.equal(afterMinerBalance, initialMinerBalance - sendAmount);
  });

  it("Should calculate accurate cross-epoch piecewise halving and respect minReward protection", async function () {
    const kolToken = await viem.deployContract("KolToken");

    const rateEra0 = await kolToken.read.rewardRatePerSecondForEra([0n]);
    const rateEra1 = await kolToken.read.rewardRatePerSecondForEra([1n]);
    assert.equal(rateEra1, rateEra0 / 2n, "Era 1 rate should be halved from Era 0");

    const halvingPeriod = await kolToken.read.HALVING_PERIOD();
    const startTime = await kolToken.read.startTime();

    // Cross-epoch reward: 730 days of Era 0 + 10 days of Era 1
    const t0 = startTime;
    const t1 = startTime + halvingPeriod + 10n * 86400n;
    const calculatedReward = await kolToken.read.calculateReward([t0, t1]);

    const expectedEra0 = halvingPeriod * rateEra0;
    const expectedEra1 = 10n * 86400n * rateEra1;
    assert.equal(calculatedReward, expectedEra0 + expectedEra1, "Cross-epoch reward should match piecewise sum");

    // Advance 5 seconds and test front-running protection (minReward)
    await testClient.increaseTime({ seconds: 5 });
    await testClient.mine({ blocks: 1 });

    const minerContract = await viem.getContractAt(
      "KolToken",
      kolToken.address,
      { client: { wallet: minerClient } }
    );

    // Call with exorbitant minReward to verify rejection
    let reverted = false;
    try {
      await minerContract.write.claimBlockReward([10n ** 30n]);
    } catch (err: any) {
      reverted = true;
      assert.ok(String(err).includes("Reward below minimum"));
    }
    assert.ok(reverted, "Should reject claim if reward is below minReward");
  });

  it("Should transition currentEra on-chain across 730 days and claim halved block reward", async function () {
    const kolToken = await viem.deployContract("KolToken");
    const halvingPeriod = await kolToken.read.HALVING_PERIOD();

    assert.equal(await kolToken.read.currentEra(), 0n);

    // Fast-forward 730 days + 100 seconds to cross into Era 1
    await testClient.increaseTime({ seconds: Number(halvingPeriod) + 100 });
    await testClient.mine({ blocks: 1 });

    assert.equal(await kolToken.read.currentEra(), 1n);

    const minerContract = await viem.getContractAt(
      "KolToken",
      kolToken.address,
      { client: { wallet: minerClient } }
    );

    await minerContract.write.claimBlockReward();

    const minerBalance = await kolToken.read.balanceOf([minerClient.account.address]);
    const rateEra0 = await kolToken.read.rewardRatePerSecondForEra([0n]);
    const rateEra1 = await kolToken.read.rewardRatePerSecondForEra([1n]);

    // Expected reward includes full Era 0 plus the elapsed seconds in Era 1
    assert.ok(minerBalance >= halvingPeriod * rateEra0 + 100n * rateEra1);
  });
});
