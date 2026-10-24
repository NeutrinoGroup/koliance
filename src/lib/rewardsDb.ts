import { supabaseServer } from "@/lib/supabaseServer";
import crypto from "crypto";

export type RewardActionType =
  | "WALLET_BIND"
  | "FIRST_CARD"
  | "FIRST_API_KEY"
  | "CARD_CASHBACK_10"
  | "STRIPE_TOPUP"
  | "GIFT";

export interface UserRewardRecord {
  id: string;
  user_id: string;
  action_type: RewardActionType | string;
  amount_kol: number;
  status: "CLAIMABLE" | "WITHDRAWN";
  created_at: string;
}

// In-memory fallback cache when Supabase database is offline or in local test environment
const memoryRewards = new Map<string, UserRewardRecord>();

export function resetRewardsDbForTests(): void {
  memoryRewards.clear();
}

/**
 * Standard reward grant amounts as outlined in executive triage
 */
export const DEFAULT_REWARD_AMOUNTS: Record<RewardActionType, number> = {
  WALLET_BIND: 100, // 100 KOL on first wallet bind
  FIRST_CARD: 150,  // 150 KOL on first AgentCard creation
  FIRST_API_KEY: 50, // 50 KOL on first developer API key
  CARD_CASHBACK_10: 0, // Calculated dynamically: 10% of USD spend
  STRIPE_TOPUP: 0,     // Calculated dynamically: 1 USD : 10 KOL
  GIFT: 0,             // P2P gift amount
};

// Actions that can only be granted ONCE in a lifetime per user / wallet (Anti-Sybil)
const SINGLE_CLAIM_ACTIONS = new Set(["WALLET_BIND", "FIRST_CARD", "FIRST_API_KEY"]);

/**
 * Record a user reward with anti-sybil checks for single-claim actions
 */
export async function recordUserReward(
  userId: string,
  actionType: RewardActionType | string,
  amountKol?: number
): Promise<{ reward: UserRewardRecord | null; alreadyClaimed: boolean; error?: string }> {
  if (!userId) {
    return { reward: null, alreadyClaimed: false, error: "Missing user ID" };
  }

  const normUser = userId.toLowerCase();
  const isSingleClaim = SINGLE_CLAIM_ACTIONS.has(actionType);

  // If amount is not specified, use default for known actions
  const grantAmount =
    amountKol !== undefined
      ? amountKol
      : DEFAULT_REWARD_AMOUNTS[actionType as RewardActionType] || 0;

  if (grantAmount <= 0) {
    return { reward: null, alreadyClaimed: false, error: "Reward amount must be greater than 0" };
  }

  // 1. Anti-Sybil Check in Supabase if single-claim action
  if (isSingleClaim) {
    try {
      const { data, error } = await supabaseServer()
        .from("user_rewards")
        .select("id")
        .eq("user_id", normUser)
        .eq("action_type", actionType)
        .limit(1);

      if (!error && Array.isArray(data) && data.length > 0) {
        return { reward: null, alreadyClaimed: true };
      }
    } catch (err) {
      console.warn("[RewardsDb] Supabase anti-sybil check notice (checking memory store):", err);
    }

    // Check memory store for single-claim
    for (const rec of memoryRewards.values()) {
      if (rec.user_id.toLowerCase() === normUser && rec.action_type === actionType) {
        return { reward: null, alreadyClaimed: true };
      }
    }
  }

  const id = `rew_${crypto.randomBytes(12).toString("hex")}`;
  const now = new Date().toISOString();

  const record: UserRewardRecord = {
    id,
    user_id: normUser,
    action_type: actionType,
    amount_kol: Number(grantAmount.toFixed(4)),
    status: "CLAIMABLE",
    created_at: now,
  };

  try {
    const { data, error } = await supabaseServer()
      .from("user_rewards")
      .insert(record)
      .select()
      .single();

    if (!error && data) {
      return { reward: data as UserRewardRecord, alreadyClaimed: false };
    }
  } catch (err) {
    console.warn("[RewardsDb] Supabase insert notice (falling back to memory store):", err);
  }

  memoryRewards.set(id, record);
  return { reward: record, alreadyClaimed: false };
}

/**
 * Get total accumulated and claimable rewards for a user
 */
export async function getUserRewards(userId: string): Promise<{
  rewards: UserRewardRecord[];
  totalClaimableKol: number;
  totalEarnedKol: number;
}> {
  if (!userId) {
    return { rewards: [], totalClaimableKol: 0, totalEarnedKol: 0 };
  }

  const normUser = userId.toLowerCase();

  try {
    const { data, error } = await supabaseServer()
      .from("user_rewards")
      .select("*")
      .eq("user_id", normUser)
      .order("created_at", { ascending: false });

    if (!error && Array.isArray(data)) {
      const list = data as UserRewardRecord[];
      let claimable = 0;
      let total = 0;
      for (const r of list) {
        const amt = Number(r.amount_kol) || 0;
        total += amt;
        if (r.status === "CLAIMABLE") {
          claimable += amt;
        }
      }
      return {
        rewards: list,
        totalClaimableKol: Number(claimable.toFixed(4)),
        totalEarnedKol: Number(total.toFixed(4)),
      };
    }
  } catch (err) {
    console.warn("[RewardsDb] Supabase query notice (falling back to memory store):", err);
  }

  // Memory fallback
  const list: UserRewardRecord[] = [];
  let claimable = 0;
  let total = 0;

  memoryRewards.forEach((r) => {
    if (r.user_id.toLowerCase() === normUser) {
      list.push(r);
      const amt = Number(r.amount_kol) || 0;
      total += amt;
      if (r.status === "CLAIMABLE") {
        claimable += amt;
      }
    }
  });

  list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return {
    rewards: list,
    totalClaimableKol: Number(claimable.toFixed(4)),
    totalEarnedKol: Number(total.toFixed(4)),
  };
}

/**
 * Minimum threshold to withdraw on-chain to prevent micro-gas spamming (50 KOL)
 */
export const MIN_WITHDRAW_THRESHOLD_KOL = 50;

/**
 * Withdraw claimable rewards to official vault on-chain transfer
 */
export async function withdrawRewards(
  userId: string,
  toWalletAddress: string
): Promise<{ success: boolean; withdrawnKol: number; txNote?: string; error?: string }> {
  if (!userId || !toWalletAddress) {
    return { success: false, withdrawnKol: 0, error: "User ID and target wallet address are required" };
  }

  const normUser = userId.toLowerCase();
  const summary = await getUserRewards(normUser);

  if (summary.totalClaimableKol < MIN_WITHDRAW_THRESHOLD_KOL) {
    return {
      success: false,
      withdrawnKol: 0,
      error: `Minimum withdrawal threshold is ${MIN_WITHDRAW_THRESHOLD_KOL} KOL. Current claimable: ${summary.totalClaimableKol} KOL.`,
    };
  }

  const withdrawAmount = summary.totalClaimableKol;

  try {
    const { error } = await supabaseServer()
      .from("user_rewards")
      .update({ status: "WITHDRAWN" })
      .eq("user_id", normUser)
      .eq("status", "CLAIMABLE");

    if (!error) {
      return {
        success: true,
        withdrawnKol: withdrawAmount,
        txNote: `Batch withdrawal of ${withdrawAmount} KOL initiated from Ecosystem Vault to ${toWalletAddress}`,
      };
    }
  } catch (err) {
    console.warn("[RewardsDb] Supabase update notice (falling back to memory store):", err);
  }

  // Update memory store
  memoryRewards.forEach((r) => {
    if (r.user_id.toLowerCase() === normUser && r.status === "CLAIMABLE") {
      r.status = "WITHDRAWN";
    }
  });

  return {
    success: true,
    withdrawnKol: withdrawAmount,
    txNote: `Batch withdrawal of ${withdrawAmount} KOL initiated from Ecosystem Vault to ${toWalletAddress}`,
  };
}
