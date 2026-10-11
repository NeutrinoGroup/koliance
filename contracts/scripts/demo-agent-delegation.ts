/**
 * AgentCard delegation demo — real transactions on Monad testnet (10143).
 *
 *   cd contracts
 *   npx hardhat compile                       # the script reads the compiled ABI
 *   PRIVATE_KEY=0x... npx tsx scripts/demo-agent-delegation.ts
 *
 * Optional env:
 *   SESSION_KEY_REGISTRY   registry address (default: the standalone deployment below)
 *   KOLIANCE_ADDRESS       identity contract (default: Koliance core on 10143)
 *   RPC_URL                default https://testnet-rpc.monad.xyz
 *   CHAIN_ID               default 10143 (31337 for a local `npx hardhat node` rehearsal)
 *   AGENT_FUNDING_MON      MON sent to the fresh agent for gas (default 0.25)
 *   COLOR=1                ANSI colours (on automatically when stdout is a TTY)
 *
 * Flow (every step is a real transaction with an explorer link):
 *   1. Owner ("team wallet", PRIVATE_KEY) creates a fresh agent EOA and funds it with gas.
 *   2. The agent registers its AgentCard identity on Koliance.sol.
 *   3. The owner signs ONE EIP-712 AgentDelegation off chain: per-tx cap, daily
 *      cap, frequency limit (max payments per window), expiry.
 *   4. The owner anchors the grant on Koliance.sol (addTrust, proof = EIP-712 digest).
 *   5. The agent submits the signed grant (registerDelegation) and pays the gas.
 *   6. The agent makes small payments (authorizeSpend) that succeed.
 *   7. Over the per-tx cap      -> ExceededPerTxLimit   (reverted tx, on chain)
 *   8. One payment too many     -> ExceededRateLimit    (reverted tx, on chain)
 *   9. Window resets, the agent pays again, then crosses the daily budget
 *                               -> ExceededDailyLimit   (reverted tx, on chain)
 *  10. Owner revokes; the agent tries again -> DelegationIsRevoked (reverted tx)
 *
 * Rejected attempts are first simulated (to decode the custom error) and then
 * sent anyway with a fixed gas limit, so the rejection itself is a mined,
 * reverted transaction anyone can look up. No private key is ever printed.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  BaseError,
  ContractFunctionRevertedError,
  createPublicClient,
  createWalletClient,
  defineChain,
  formatEther,
  formatUnits,
  http,
  parseEther,
  type Abi,
  type Hex,
} from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

// ----------------------------------------------------------------- config

const RPC_URL = process.env.RPC_URL || "https://testnet-rpc.monad.xyz";
const REGISTRY = (process.env.SESSION_KEY_REGISTRY ||
  "0xCb7f48F455a19778fC75afb0564aaA88b64FA004") as Hex;
const KOLIANCE = (process.env.KOLIANCE_ADDRESS || "0x32fDd6B096EE14246b5b6971135286Bad01F4928") as Hex;
const EXPLORER = "https://testnet.monadvision.com";
const AGENT_FUNDING = parseEther(process.env.AGENT_FUNDING_MON || "0.25");

/** Amounts are USDC base units (6 decimals); the registry treats them as opaque. */
const E6 = 1_000_000n;
const MAX_PER_TX = 5n * E6; // $5 per payment
const DAILY_LIMIT = 12n * E6; // $12 per rolling 24h
const MAX_TX_PER_WINDOW = 3n; // at most 3 payments ...
const TX_WINDOW_SECONDS = 60n; // ... per 60 seconds
const REVERT_GAS = 150_000n; // fixed gas for deliberately rejected attempts

const CHAIN_ID = Number(process.env.CHAIN_ID || 10143);
const IS_LOCAL = CHAIN_ID === 31337;

const monadTestnet = defineChain({
  id: CHAIN_ID,
  name: IS_LOCAL ? "Local Hardhat chain" : "Monad Testnet",
  nativeCurrency: { name: "Monad", symbol: "MON", decimals: 18 },
  rpcUrls: { default: { http: [RPC_URL] } },
  blockExplorers: { default: { name: "MonadVision", url: EXPLORER } },
});

// ----------------------------------------------------------------- output

const COLOR = process.env.COLOR === "1" || (process.stdout.isTTY && process.env.COLOR !== "0");
const c = (code: string) => (s: string) => (COLOR ? `\x1b[${code}m${s}\x1b[0m` : s);
const bold = c("1");
const dim = c("2");
const green = c("32");
const red = c("31");
const cyan = c("36");
const yellow = c("33");

const usdStr = (v: bigint) => `$${formatUnits(v, 6)}`;
const short = (a: string) => `${a.slice(0, 6)}...${a.slice(-4)}`;
const txLink = (h: string) => `${EXPLORER}/tx/${h}`;
const now = () => new Date().toISOString().replace("T", " ").slice(0, 19) + " UTC";

const record: { step: string; hash: string; status: string }[] = [];

function banner(n: number, title: string) {
  console.log("");
  console.log(bold(cyan(`[STEP ${n}] ${title}`)));
}
function info(s: string) {
  console.log(`  ${s}`);
}
function ok(label: string, hash: string, extra = "") {
  record.push({ step: label, hash, status: "success" });
  console.log(`  ${green("[OK]")} ${label}${extra ? "  " + extra : ""}`);
  console.log(`       tx ${dim(txLink(hash))}`);
}
function rejected(label: string, error: string, hash?: string, extra = "") {
  if (hash) record.push({ step: label, hash, status: `reverted: ${error}` });
  console.log(`  ${red("[REJECTED]")} ${label}  ->  ${bold(red(error))}${extra ? "  " + extra : ""}`);
  if (hash) console.log(`       tx ${dim(txLink(hash))}  ${dim("(mined, status: reverted)")}`);
}

// ----------------------------------------------------------------- setup

const here = dirname(fileURLToPath(import.meta.url));
const artifact = JSON.parse(
  readFileSync(resolve(here, "../artifacts/contracts/perp/SessionKeyRegistry.sol/SessionKeyRegistry.json"), "utf8"),
);
const REGISTRY_ABI = artifact.abi as Abi;

const KOLIANCE_ABI = [
  {
    type: "function",
    name: "register",
    stateMutability: "nonpayable",
    inputs: [{ name: "metadataHash", type: "string" }],
    outputs: [],
  },
  {
    type: "function",
    name: "addTrust",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "action", type: "string" },
      { name: "proof", type: "bytes32" },
    ],
    outputs: [],
  },
] as const satisfies Abi;

const TYPES = {
  AgentDelegation: [
    { name: "user", type: "address" },
    { name: "agent", type: "address" },
    { name: "sessionKey", type: "address" },
    { name: "maxSpendPerTx", type: "uint256" },
    { name: "dailySpendLimit", type: "uint256" },
    { name: "maxTxPerWindow", type: "uint256" },
    { name: "txWindowSeconds", type: "uint256" },
    { name: "validUntil", type: "uint256" },
    { name: "nonce", type: "uint256" },
  ],
} as const;

const ownerKey = process.env.PRIVATE_KEY as Hex | undefined;
if (!ownerKey) {
  console.error("[ERROR] PRIVATE_KEY (owner / team wallet) is not set");
  process.exit(1);
}
const owner = privateKeyToAccount(ownerKey);

// A fresh agent EOA (pays gas, submits the grant, makes payments) and a fresh
// ephemeral session key (the address the delegation is bound to).
const agentKey = generatePrivateKey();
const agent = privateKeyToAccount(agentKey);
const sessionKey = privateKeyToAccount(generatePrivateKey()).address;
if (process.env.AGENT_KEY_FILE) {
  // Lets leftover agent gas be recovered later. Written 0600; never printed.
  writeFileSync(process.env.AGENT_KEY_FILE, `AGENT_PRIVATE_KEY=${agentKey}\nAGENT_ADDRESS=${agent.address}\n`, {
    mode: 0o600,
  });
}

const pub = createPublicClient({ chain: monadTestnet, transport: http(RPC_URL) });
const ownerWallet = createWalletClient({ account: owner, chain: monadTestnet, transport: http(RPC_URL) });
const agentWallet = createWalletClient({ account: agent, chain: monadTestnet, transport: http(RPC_URL) });

async function confirm(hash: Hex) {
  const r = await pub.waitForTransactionReceipt({ hash, timeout: 120_000 });
  return r;
}

/** Plain-English reading of the registry's custom errors, for the recording. */
function explain(name: string, args: readonly unknown[]): string {
  const a = args.map((x) => (typeof x === "bigint" ? x : 0n));
  switch (name) {
    case "ExceededPerTxLimit":
      return `amount ${usdStr(a[0])} > per-transaction cap ${usdStr(a[1])}`;
    case "ExceededRateLimit":
      return `${a[0]} of ${a[1]} payments already used in this ${a[2]}s window`;
    case "ExceededDailyLimit":
      return `${usdStr(a[1])} spent today + ${usdStr(a[0])} > daily cap ${usdStr(a[2])}`;
    case "DelegationIsRevoked":
      return "the owner revoked this session key";
    default:
      return "";
  }
}

function decodeRevert(err: unknown): string {
  if (err instanceof BaseError) {
    const rev = err.walk((e) => e instanceof ContractFunctionRevertedError) as ContractFunctionRevertedError | null;
    if (rev?.data?.errorName) {
      const args = rev.data.args ?? [];
      const why = explain(rev.data.errorName, args);
      return `${rev.data.errorName}${why ? `  (${why})` : ""}`;
    }
    return err.shortMessage;
  }
  return String(err);
}

/** A payment the agent expects to succeed. */
async function pay(label: string, amount: bigint) {
  const hash = await agentWallet.writeContract({
    address: REGISTRY,
    abi: REGISTRY_ABI,
    functionName: "authorizeSpend",
    args: [sessionKey, amount],
  });
  const r = await confirm(hash);
  if (r.status !== "success") throw new Error(`${label} unexpectedly reverted: ${hash}`);
  const [leftUsd, leftTx] = await Promise.all([
    pub.readContract({ address: REGISTRY, abi: REGISTRY_ABI, functionName: "remainingDailyAllowance", args: [sessionKey] }),
    pub.readContract({ address: REGISTRY, abi: REGISTRY_ABI, functionName: "remainingTxInWindow", args: [sessionKey] }),
  ]);
  ok(label, hash, dim(`| daily left ${usdStr(leftUsd as bigint)} | payments left this window ${leftTx}`));
}

/**
 * A payment the agent expects to be refused. Simulate first to decode the
 * custom error, then send it anyway with a fixed gas limit so the refusal is a
 * mined, reverted transaction on chain.
 */
async function payExpectReject(label: string, amount: bigint, expected: string) {
  let reason = "";
  try {
    await pub.simulateContract({
      account: agent,
      address: REGISTRY,
      abi: REGISTRY_ABI,
      functionName: "authorizeSpend",
      args: [sessionKey, amount],
    });
    throw new Error(`${label}: expected ${expected} but the simulation succeeded`);
  } catch (err) {
    reason = decodeRevert(err);
    if (!reason.startsWith(expected)) throw err;
  }
  if (IS_LOCAL) {
    // A local Hardhat node refuses to mine a transaction that reverts, so the
    // rehearsal stops at the decoded refusal. On Monad it is mined as reverted.
    rejected(label, reason);
    return;
  }
  const hash = await agentWallet.writeContract({
    address: REGISTRY,
    abi: REGISTRY_ABI,
    functionName: "authorizeSpend",
    args: [sessionKey, amount],
    gas: REVERT_GAS,
  });
  const r = await confirm(hash);
  if (r.status !== "reverted") throw new Error(`${label}: expected a reverted receipt, got ${r.status} (${hash})`);
  rejected(label, reason, hash);
}

const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

// ----------------------------------------------------------------- run

async function main() {
  const chainId = await pub.getChainId();
  const ownerBal = await pub.getBalance({ address: owner.address });

  console.log(bold(`KOLIANCE  //  AgentCard delegation on ${monadTestnet.name}`));
  console.log(dim(`run started ${now()}`));
  info(`network            ${monadTestnet.name} (chain ${chainId})`);
  info(`SessionKeyRegistry ${REGISTRY}  ${dim(`${EXPLORER}/address/${REGISTRY}`)}`);
  info(`Koliance identity  ${KOLIANCE}  ${dim(`${EXPLORER}/address/${KOLIANCE}`)}`);
  info(`owner (team wallet) ${owner.address}  balance ${formatEther(ownerBal)} MON`);
  if (chainId !== CHAIN_ID) throw new Error(`wrong chain ${chainId}, expected ${CHAIN_ID}`);

  // 1 ---------------------------------------------------------------------
  banner(1, "Create the agent and give it gas");
  info(`agent EOA          ${agent.address}  ${dim("(fresh key, generated for this run)")}`);
  info(`agent session key  ${sessionKey}  ${dim("(ephemeral; the delegation is bound to it)")}`);
  {
    const hash = await ownerWallet.sendTransaction({ to: agent.address, value: AGENT_FUNDING });
    const r = await confirm(hash);
    ok(`owner -> agent: ${formatEther(AGENT_FUNDING)} MON for gas`, hash);
    // Monad executes asynchronously: transaction admission checks balances a
    // few blocks behind the tip, so a just-funded account must wait briefly
    // before it can pay for its own gas.
    if (!IS_LOCAL) {
      while ((await pub.getBlockNumber()) < r.blockNumber + 4n) await sleep(500);
    }
  }

  // 2 ---------------------------------------------------------------------
  banner(2, "AgentCard identity: the agent registers on Koliance.sol");
  {
    const meta = `agentcard:v1:agent=${agent.address}:owner=${owner.address}`;
    const hash = await agentWallet.writeContract({ address: KOLIANCE, abi: KOLIANCE_ABI, functionName: "register", args: [meta] });
    const r = await confirm(hash);
    if (r.status !== "success") throw new Error("identity register reverted");
    ok(`register("${meta.slice(0, 40)}...")`, hash, dim("| event IdentityRegistered"));
  }

  // 3 ---------------------------------------------------------------------
  banner(3, "Owner signs ONE EIP-712 AgentDelegation (off chain, no gas)");
  const block = await pub.getBlock();
  const nonce = (await pub.readContract({
    address: REGISTRY,
    abi: REGISTRY_ABI,
    functionName: "userNonce",
    args: [owner.address],
  })) as bigint;
  const terms = {
    user: owner.address,
    agent: agent.address,
    sessionKey,
    maxSpendPerTx: MAX_PER_TX,
    dailySpendLimit: DAILY_LIMIT,
    maxTxPerWindow: MAX_TX_PER_WINDOW,
    txWindowSeconds: TX_WINDOW_SECONDS,
    validUntil: block.timestamp + 24n * 3600n,
    nonce,
  };
  const domain = { name: "Koliance", version: "1", chainId, verifyingContract: REGISTRY } as const;
  const signature = await owner.signTypedData({ domain, types: TYPES, primaryType: "AgentDelegation", message: terms });
  const digest = (await pub.readContract({
    address: REGISTRY,
    abi: REGISTRY_ABI,
    functionName: "delegationDigest",
    args: [
      terms.user,
      terms.agent,
      terms.sessionKey,
      terms.maxSpendPerTx,
      terms.dailySpendLimit,
      terms.maxTxPerWindow,
      terms.txWindowSeconds,
      terms.validUntil,
      terms.nonce,
    ],
  })) as Hex;
  info(`domain             Koliance v1, chain ${chainId}, verifyingContract ${short(REGISTRY)}`);
  info(`agent              ${terms.agent}`);
  info(`sessionKey         ${terms.sessionKey}`);
  info(`maxSpendPerTx      ${yellow(usdStr(terms.maxSpendPerTx))}`);
  info(`dailySpendLimit    ${yellow(usdStr(terms.dailySpendLimit))}`);
  info(`frequency limit    ${yellow(`${terms.maxTxPerWindow} payments / ${terms.txWindowSeconds}s`)}`);
  info(`validUntil         ${new Date(Number(terms.validUntil) * 1000).toISOString()}`);
  info(`nonce              ${terms.nonce}`);
  info(`EIP-712 digest     ${digest}`);
  info(`signature          ${signature.slice(0, 20)}...${signature.slice(-8)}  ${dim("(owner wallet)")}`);

  // 4 ---------------------------------------------------------------------
  banner(4, "Owner anchors the grant on Koliance.sol (trust record, proof = EIP-712 digest)");
  {
    const hash = await ownerWallet.writeContract({
      address: KOLIANCE,
      abi: KOLIANCE_ABI,
      functionName: "addTrust",
      args: [agent.address, "AUTHORIZE_AGENT", digest],
    });
    const r = await confirm(hash);
    if (r.status !== "success") throw new Error("addTrust reverted");
    ok(`addTrust(agent, "AUTHORIZE_AGENT", digest)`, hash, dim("| event TrustAdded"));
  }

  // 5 ---------------------------------------------------------------------
  banner(5, "Agent submits the signed grant on chain and pays the gas");
  {
    const hash = await agentWallet.writeContract({
      address: REGISTRY,
      abi: REGISTRY_ABI,
      functionName: "registerDelegation",
      args: [terms, signature],
    });
    const r = await confirm(hash);
    if (r.status !== "success") throw new Error("registerDelegation reverted");
    ok("registerDelegation(terms, ownerSignature)", hash, dim("| event DelegationRegistered"));
    const resetsAt = (await pub.readContract({
      address: REGISTRY,
      abi: REGISTRY_ABI,
      functionName: "txWindowResetsAt",
      args: [sessionKey],
    })) as bigint;
    info(dim(`frequency window open until ${new Date(Number(resetsAt) * 1000).toISOString()}`));
  }

  // 6 ---------------------------------------------------------------------
  banner(6, "Agent pays in small, fast steps (authorizeSpend)");
  await pay(`pay ${usdStr(2n * E6)}`, 2n * E6);
  await pay(`pay ${usdStr(3n * E6)}`, 3n * E6);

  // 7 ---------------------------------------------------------------------
  banner(7, "Per-transaction cap");
  await payExpectReject(`pay ${usdStr(6n * E6)} (cap ${usdStr(MAX_PER_TX)})`, 6n * E6, "ExceededPerTxLimit");

  // 8 ---------------------------------------------------------------------
  banner(8, `Frequency limit (${MAX_TX_PER_WINDOW} payments per ${TX_WINDOW_SECONDS}s)`);
  await pay(`pay ${usdStr(4n * E6)}  (3rd payment in this window)`, 4n * E6);
  await payExpectReject(`pay ${usdStr(1n * E6)}  (4th payment in this window)`, 1n * E6, "ExceededRateLimit");

  // 9 ---------------------------------------------------------------------
  banner(9, "Window resets; daily budget");
  {
    const resetsAt = (await pub.readContract({
      address: REGISTRY,
      abi: REGISTRY_ABI,
      functionName: "txWindowResetsAt",
      args: [sessionKey],
    })) as bigint;
    for (;;) {
      const t = (await pub.getBlock()).timestamp;
      if (t >= resetsAt + 1n) break;
      const left = Number(resetsAt + 1n - t);
      info(dim(`waiting for the frequency window to reset ... ${left}s`));
      if (IS_LOCAL) {
        // A local node only mines on demand; move its clock instead of waiting.
        await pub.request({ method: "evm_increaseTime", params: [left] } as never);
        await pub.request({ method: "evm_mine" } as never);
        continue;
      }
      await sleep(Math.min(left, 10) * 1000);
    }
    const leftTx = await pub.readContract({
      address: REGISTRY,
      abi: REGISTRY_ABI,
      functionName: "remainingTxInWindow",
      args: [sessionKey],
    });
    info(`window reset: ${leftTx} payments available again`);
  }
  await pay(`pay ${usdStr(3n * E6)}  (spent today ${usdStr(12n * E6)} of ${usdStr(DAILY_LIMIT)})`, 3n * E6);
  await payExpectReject(`pay ${usdStr(1n * E6)}  (would exceed the daily budget)`, 1n * E6, "ExceededDailyLimit");

  // 10 --------------------------------------------------------------------
  banner(10, "Owner revokes the delegation; the agent is cut off");
  {
    const hash = await ownerWallet.writeContract({
      address: REGISTRY,
      abi: REGISTRY_ABI,
      functionName: "revoke",
      args: [sessionKey],
    });
    const r = await confirm(hash);
    if (r.status !== "success") throw new Error("revoke reverted");
    ok("revoke(sessionKey)  (owner wallet)", hash, dim("| event DelegationRevoked"));
  }
  await payExpectReject(`pay ${usdStr(1n * E6)}  (after revoke)`, 1n * E6, "DelegationIsRevoked");

  // summary ---------------------------------------------------------------
  console.log("");
  console.log(bold(`SUMMARY  (all transactions are on ${monadTestnet.name}, chain ${chainId})`));
  for (const r of record) {
    const tag = r.status === "success" ? green("success ") : red("reverted");
    console.log(`  ${tag}  ${r.hash}  ${r.step}`);
  }
  const endBal = await pub.getBalance({ address: owner.address });
  console.log(dim(`owner balance after run: ${formatEther(endBal)} MON | run finished ${now()}`));
}

main().catch((err) => {
  console.error(red(`[ERROR] ${err instanceof Error ? err.message : String(err)}`));
  process.exit(1);
});
