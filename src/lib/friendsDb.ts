import { supabaseServer } from "@/lib/supabaseServer";
import { isValidWalletAddress } from "@/lib/session";
import crypto from "crypto";

export interface FriendRecord {
  id: string;
  user_id: string;
  friend_wallet: string;
  friend_name: string;
  created_at: string;
}

// In-memory fallback cache when Supabase database is offline or in local test environment
const memoryFriends = new Map<string, FriendRecord>();

export function resetFriendsDbForTests(): void {
  memoryFriends.clear();
}

/**
 * List all contacts / friends for a specific user ID
 */
export async function listFriends(userId: string): Promise<FriendRecord[]> {
  if (!userId) return [];

  try {
    const { data, error } = await supabaseServer()
      .from("friends")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (!error && Array.isArray(data)) {
      return data as FriendRecord[];
    }
  } catch (err) {
    console.warn("[FriendsDb] Supabase query notice (falling back to memory store):", err);
  }

  const results: FriendRecord[] = [];
  memoryFriends.forEach((rec) => {
    if (rec.user_id === userId) {
      results.push(rec);
    }
  });

  return results.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

/**
 * Add a friend to user's address book (supports 0x EVM address, email, or user identifier)
 */
export async function addFriend(
  userId: string,
  friendWallet: string,
  friendName?: string
): Promise<{ success: boolean; friend?: FriendRecord; error?: string }> {
  if (!userId) {
    return { success: false, error: "Missing user ID" };
  }

  const raw = (friendWallet || "").trim();
  const isWallet = isValidWalletAddress(raw);
  const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(raw);
  const isDid = raw.startsWith("did:");

  if (!isWallet && !isEmail && !isDid) {
    return { success: false, error: "Invalid 0x EVM wallet address, email, or user identifier" };
  }

  const normalizedWallet = raw.toLowerCase();
  const normalizedUser = userId.toLowerCase();
  if (
    normalizedUser === normalizedWallet ||
    normalizedUser.endsWith(`:${normalizedWallet}`) ||
    (normalizedUser.startsWith("did:koliance:") && normalizedUser.includes(normalizedWallet))
  ) {
    return { success: false, error: "Cannot add your own wallet address as a friend" };
  }

  let defaultName = `Friend-${normalizedWallet.slice(2, 6)}`;
  if (isEmail) {
    defaultName = normalizedWallet.split("@")[0];
  } else if (isDid) {
    defaultName = normalizedWallet.split(":").pop() || "User";
  }

  const name = (friendName && friendName.trim()) || defaultName;
  const id = `fr_${crypto.randomBytes(12).toString("hex")}`;
  const now = new Date().toISOString();

  const record: FriendRecord = {
    id,
    user_id: userId,
    friend_wallet: normalizedWallet,
    friend_name: name,
    created_at: now,
  };

  try {
    const { data, error } = await supabaseServer()
      .from("friends")
      .insert(record)
      .select()
      .single();

    if (!error && data) {
      return { success: true, friend: data as FriendRecord };
    }
    if (error && error.code === "23505") {
      return { success: false, error: "Friend already in address book" };
    }
  } catch (err) {
    console.warn("[FriendsDb] Supabase insert notice (falling back to memory store):", err);
  }

  // Check unique in memory
  for (const f of memoryFriends.values()) {
    if (f.user_id === userId && f.friend_wallet === normalizedWallet) {
      return { success: false, error: "Friend already in address book" };
    }
  }

  memoryFriends.set(id, record);
  return { success: true, friend: record };
}

/**
 * Remove a friend from user's address book
 */
export async function removeFriend(userId: string, friendWallet: string): Promise<boolean> {
  if (!userId || !friendWallet) return false;
  const normalizedWallet = friendWallet.toLowerCase();

  try {
    const { error } = await supabaseServer()
      .from("friends")
      .delete()
      .eq("user_id", userId)
      .eq("friend_wallet", normalizedWallet);

    if (!error) return true;
  } catch (err) {
    console.warn("[FriendsDb] Supabase delete notice (falling back to memory store):", err);
  }

  let foundKey: string | null = null;
  for (const [key, rec] of memoryFriends.entries()) {
    if (rec.user_id === userId && rec.friend_wallet === normalizedWallet) {
      foundKey = key;
      break;
    }
  }
  if (foundKey) {
    memoryFriends.delete(foundKey);
    return true;
  }
  return false;
}
