import { supabaseServer } from "@/lib/supabaseServer";
import crypto from "crypto";

export interface ApiKeyRecord {
  id: string;
  user_id: string;
  wallet_address: string;
  name: string;
  key_prefix: string;
  key_hash: string;
  tier: string;
  remaining_quota: number;
  free_claims_left: number;
  rate_limit_rpm: number;
  status: "ACTIVE" | "REVOKED";
  scopes: string[];
  created_at: string;
  updated_at: string;
  last_used_at?: string | null;
}

export interface CreatedApiKeyResult {
  key: ApiKeyRecord;
  raw_key: string; // Plaintext key returned only once upon creation
}

// In-memory fallback cache when Supabase database is offline or in local test environment
const memoryApiKeys = new Map<string, ApiKeyRecord>();

function hashKey(rawKey: string): string {
  return crypto.createHash("sha256").update(rawKey).digest("hex");
}

export function generateSecureKey(): { rawKey: string; keyPrefix: string; keyHash: string } {
  const randomHex = crypto.randomBytes(24).toString("hex");
  const rawKey = `kol_live_${randomHex}`;
  const keyPrefix = `${rawKey.slice(0, 14)}...${rawKey.slice(-4)}`;
  const keyHash = hashKey(rawKey);
  return { rawKey, keyPrefix, keyHash };
}

/**
 * List API keys for a specific registered user ID or wallet address
 */
export async function listUserApiKeys(params: {
  userId?: string | null;
  walletAddress?: string | null;
}): Promise<ApiKeyRecord[]> {
  const { userId, walletAddress } = params;
  if (!userId && !walletAddress) return [];

  try {
    let query = supabaseServer.from("api_keys").select("*");
    if (userId && walletAddress) {
      query = query.or(`user_id.eq.${userId},wallet_address.eq.${walletAddress.toLowerCase()}`);
    } else if (userId) {
      query = query.eq("user_id", userId);
    } else if (walletAddress) {
      query = query.eq("wallet_address", walletAddress.toLowerCase());
    }

    const { data, error } = await query.order("created_at", { ascending: false });

    if (!error && Array.isArray(data) && data.length > 0) {
      return data as ApiKeyRecord[];
    }
  } catch (err) {
    console.warn("[ApiKeyDb] Supabase query notice (falling back to memory store):", err);
  }

  // Fallback to memory store
  const results: ApiKeyRecord[] = [];
  memoryApiKeys.forEach((rec) => {
    const matchUser = userId && rec.user_id === userId;
    const matchWallet = walletAddress && rec.wallet_address.toLowerCase() === walletAddress.toLowerCase();
    if (matchUser || matchWallet) {
      results.push(rec);
    }
  });

  return results.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

/**
 * Create a new user API key and persist to the api_keys ("api-key") table
 */
export async function createUserApiKey(params: {
  userId: string;
  walletAddress: string;
  name?: string;
  tier?: string;
  rateLimitRpm?: number;
  scopes?: string[];
}): Promise<CreatedApiKeyResult> {
  const { rawKey, keyPrefix, keyHash } = generateSecureKey();
  const keyId = `key_${crypto.randomBytes(8).toString("hex")}`;
  const now = new Date().toISOString();

  const record: ApiKeyRecord = {
    id: keyId,
    user_id: params.userId,
    wallet_address: params.walletAddress.toLowerCase(),
    name: params.name?.trim() || "Default API Key",
    key_prefix: keyPrefix,
    key_hash: keyHash,
    tier: params.tier || "STARTER_FREE",
    remaining_quota: 100,
    free_claims_left: 3,
    rate_limit_rpm: params.rateLimitRpm || 60,
    status: "ACTIVE",
    scopes: params.scopes || ["trade:perp", "pay:micropayment", "query:proof"],
    created_at: now,
    updated_at: now,
    last_used_at: null,
  };

  try {
    // Attempt persist to Supabase "api_keys" table
    const { data, error } = await supabaseServer
      .from("api_keys")
      .insert(record)
      .select()
      .single();

    if (!error && data) {
      memoryApiKeys.set(record.id, data as ApiKeyRecord);
      return {
        key: data as ApiKeyRecord,
        raw_key: rawKey,
      };
    }

    if (error) {
      console.warn("[ApiKeyDb] Insert error in Supabase api_keys table, writing to memory store:", error.message);
    }
  } catch (err) {
    console.warn("[ApiKeyDb] Exception during api_keys insert:", err);
  }

  // Fallback to memory store
  memoryApiKeys.set(record.id, record);
  return {
    key: record,
    raw_key: rawKey,
  };
}

/**
 * Revoke or delete an API key belonging to the user
 */
export async function revokeUserApiKey(params: {
  keyId: string;
  userId?: string | null;
  walletAddress?: string | null;
}): Promise<boolean> {
  const { keyId, userId, walletAddress } = params;

  try {
    let query = supabaseServer.from("api_keys").update({ status: "REVOKED", updated_at: new Date().toISOString() }).eq("id", keyId);
    if (userId) {
      query = query.eq("user_id", userId);
    }
    const { error } = await query;
    if (!error) {
      const existing = memoryApiKeys.get(keyId);
      if (existing) {
        existing.status = "REVOKED";
        existing.updated_at = new Date().toISOString();
      }
      return true;
    }
  } catch (err) {
    console.warn("[ApiKeyDb] Exception revoking key from Supabase:", err);
  }

  // Fallback in memory
  const existing = memoryApiKeys.get(keyId);
  if (existing) {
    const isOwner =
      (!userId || existing.user_id === userId) &&
      (!walletAddress || existing.wallet_address.toLowerCase() === walletAddress.toLowerCase());
    if (isOwner) {
      existing.status = "REVOKED";
      existing.updated_at = new Date().toISOString();
      return true;
    }
  }
  return false;
}
