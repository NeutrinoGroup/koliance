import { supabaseServer } from "@/lib/supabaseServer";
import { isValidWalletAddress } from "@/lib/session";
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
  status: "CLAIMABLE" | "WITHDRAWN" | "SPENT";
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

  // For single-claim actions (Anti-Sybil), force the official reward amount; caller cannot inflate it.
  const grantAmount = isSingleClaim
    ? DEFAULT_REWARD_AMOUNTS[actionType as RewardActionType]
    : amountKol !== undefined
      ? amountKol
      : DEFAULT_REWARD_AMOUNTS[actionType as RewardActionType] || 0;

  if (!Number.isFinite(grantAmount) || grantAmount <= 0) {
    return { reward: null, alreadyClaimed: false, error: "Reward amount must be a finite number greater than 0" };
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
        if (!Number.isFinite(amt) || amt <= 0) continue;
        if (r.status !== "SPENT") {
          total += amt;
        }
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
      const amt = Number(r.amount_kol) || 0;
      if (!Number.isFinite(amt) || amt <= 0) return;
      list.push(r);
      if (r.status !== "SPENT") {
        total += amt;
      }
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
 * Send a P2P reward gift / red packet to a friend.
 * Deducts from sender's existing claimable balance and credits recipient.
 * Zero token inflation (strictly internal circulation).
 */
export async function sendRewardGift(
  senderId: string,
  recipientId: string,
  amountKol: number
): Promise<{ success: boolean; giftRecord?: UserRewardRecord; error?: string }> {
  if (!senderId || !recipientId) {
    return { success: false, error: "Sender and recipient are required" };
  }

  const normSender = senderId.toLowerCase();
  const normRecipient = recipientId.toLowerCase();

  if (normSender === normRecipient) {
    return { success: false, error: "Cannot send a gift to yourself" };
  }

  if (!Number.isFinite(amountKol) || amountKol <= 0) {
    return { success: false, error: "Gift amount must be a positive number" };
  }

  const roundedAmount = Number(amountKol.toFixed(4));
  const senderSummary = await getUserRewards(normSender);

  if (senderSummary.totalClaimableKol < roundedAmount) {
    return {
      success: false,
      error: `Insufficient claimable KOL balance. Available: ${senderSummary.totalClaimableKol} KOL, requested: ${roundedAmount} KOL.`,
    };
  }

  // 1. Deduct from sender's claimable records in Supabase
  let remainingToDeduct = roundedAmount;
  try {
    const { data: senderRecords, error: fetchError } = await supabaseServer()
      .from("user_rewards")
      .select("*")
      .eq("user_id", normSender)
      .eq("status", "CLAIMABLE")
      .order("created_at", { ascending: true });

    if (!fetchError && Array.isArray(senderRecords) && senderRecords.length > 0) {
      for (const rec of senderRecords) {
        if (remainingToDeduct <= 0) break;
        const recAmt = Number(rec.amount_kol) || 0;
        if (recAmt <= remainingToDeduct) {
          remainingToDeduct = Number((remainingToDeduct - recAmt).toFixed(4));
          await supabaseServer()
            .from("user_rewards")
            .update({ status: "SPENT" })
            .eq("id", rec.id);
        } else {
          const newAmt = Number((recAmt - remainingToDeduct).toFixed(4));
          remainingToDeduct = 0;
          await supabaseServer()
            .from("user_rewards")
            .update({ amount_kol: newAmt })
            .eq("id", rec.id);
          break;
        }
      }
    }
  } catch (err) {
    console.warn("[RewardsDb] Supabase gift deduction notice (checking memory store):", err);
  }

  // 2. Deduct in memory store
  let memRemaining = roundedAmount;
  for (const rec of memoryRewards.values()) {
    if (memRemaining <= 0) break;
    if (rec.user_id.toLowerCase() === normSender && rec.status === "CLAIMABLE") {
      if (rec.amount_kol <= memRemaining) {
        memRemaining = Number((memRemaining - rec.amount_kol).toFixed(4));
        rec.status = "SPENT";
      } else {
        rec.amount_kol = Number((rec.amount_kol - memRemaining).toFixed(4));
        memRemaining = 0;
        break;
      }
    }
  }

  // 3. Credit recipient with GIFT record
  const giftId = `rew_${crypto.randomBytes(12).toString("hex")}`;
  const now = new Date().toISOString();

  const recipientRecord: UserRewardRecord = {
    id: giftId,
    user_id: normRecipient,
    action_type: "GIFT",
    amount_kol: roundedAmount,
    status: "CLAIMABLE",
    created_at: now,
  };

  try {
    const { data, error } = await supabaseServer()
      .from("user_rewards")
      .insert(recipientRecord)
      .select()
      .single();

    if (!error && data) {
      return { success: true, giftRecord: data as UserRewardRecord };
    }
  } catch (err) {
    console.warn("[RewardsDb] Supabase gift credit notice (falling back to memory store):", err);
  }

  memoryRewards.set(giftId, recipientRecord);
  return { success: true, giftRecord: recipientRecord };
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
  if (!isValidWalletAddress(toWalletAddress)) {
    return { success: false, withdrawnKol: 0, error: "Invalid target 0x wallet address" };
  }

  const normUser = userId.toLowerCase();
  const summary = await getUserRewards(normUser);

  if (!Number.isFinite(summary.totalClaimableKol) || summary.totalClaimableKol < MIN_WITHDRAW_THRESHOLD_KOL) {
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
