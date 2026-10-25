import { supabaseServer } from "@/lib/supabaseServer";
import crypto from "crypto";
import {
  loadPersistentCollection,
  savePersistentRecord,
  savePersistentCollection,
} from "@/lib/storagePersistence";
// Issue #35 P0-5: the unused anon client with a hard-coded project URL and
// publishable key was removed; there are no credential fallbacks in this file.

export interface DbUserRecord {
  id: string;
  email: string;
  name: string;
  picture?: string | null;
  bio?: string | null;
  wallet_address?: string | null;
  trust_tier: string;
  credit_allowance_usd: number;
  steam_id?: string | null;
  github_username?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface PublicUserSearchResult {
  id: string;
  name: string;
  email: string;
  picture: string | null;
  wallet_address: string | null;
  trust_tier: string;
  github_username?: string | null;
}

// Persistent user cache with disk backing for durability across server restarts
const memoryUsers = loadPersistentCollection<DbUserRecord>("users");
const emailCredentials = loadPersistentCollection<{ email: string; passwordHash: string; salt: string }>("credentials");

// Seed default platform accounts so auto-discovery always has active users
function initDefaultSeedUsers() {
  if (memoryUsers.size === 0) {
    const seed1: DbUserRecord = {
      id: "did:koliance:email:developer@koliance.io",
      email: "developer@koliance.io",
      name: "Koliance Core Dev",
      picture: "https://api.dicebear.com/7.x/bottts/svg?seed=koliance-dev",
      bio: "Official Koliance Protocol Core Engineering & Security",
      wallet_address: "0x89205A3A3b2A69De6Dbf7f01ED13B2108B2c43e7",
      trust_tier: "CORE PROTOCOL STEWARD",
      credit_allowance_usd: 5000,
      created_at: new Date(Date.now() - 86400000 * 5).toISOString(),
    };
    const seed2: DbUserRecord = {
      id: "did:koliance:email:monad.trader@koliance.io",
      email: "monad.trader@koliance.io",
      name: "Monad Alpha Trader",
      picture: "https://api.dicebear.com/7.x/bottts/svg?seed=monad-trader",
      bio: "High frequency algorithmic trader on Monad Perp DEX",
      wallet_address: "0x6b6b83ff4e1f8009b9dbe6f46ad4e75f33f98a02",
      trust_tier: "VERIFIED HIGH FREQUENCY TRADER",
      credit_allowance_usd: 2500,
      created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
    };
    memoryUsers.set(seed1.id, seed1);
    memoryUsers.set(seed2.id, seed2);
    savePersistentCollection("users", memoryUsers);
  }
}
initDefaultSeedUsers();

export function resetMemoryUsersForTests(): void {
  memoryUsers.clear();
  emailCredentials.clear();
  initDefaultSeedUsers();
}

/** Hash password with salt using standard Node.js crypto */
function hashPassword(password: string, salt: string): string {
  return crypto.createHmac("sha256", salt).update(password).digest("hex");
}

export function registerEmailPassword(email: string, password: string): { success: boolean; error?: string } {
  const normEmail = email.trim().toLowerCase();
  if (emailCredentials.has(normEmail)) {
    return { success: false, error: "该邮箱已被注册，请直接登录" };
  }
  const salt = crypto.randomBytes(16).toString("hex");
  const passwordHash = hashPassword(password, salt);
  const credRecord = { email: normEmail, passwordHash, salt };
  emailCredentials.set(normEmail, credRecord);
  savePersistentRecord("credentials", normEmail, credRecord, emailCredentials);
  return { success: true };
}

export function verifyEmailPassword(email: string, password: string): { success: boolean; error?: string } {
  const normEmail = email.trim().toLowerCase();
  const creds = emailCredentials.get(normEmail);
  if (!creds) {
    return { success: false, error: "该邮箱尚未注册或密码不正确，请先注册" };
  }
  const computedHash = hashPassword(password, creds.salt);
  if (computedHash !== creds.passwordHash) {
    return { success: false, error: "密码不正确，请重试" };
  }
  return { success: true };
}

export function isEmailRegistered(email: string): boolean {
  const normEmail = email.trim().toLowerCase();
  return emailCredentials.has(normEmail);
}

/**
 * Finds user by ID, email, wallet address, name, or github username
 */
export async function findUserByIdentifier(identifier: string): Promise<DbUserRecord | null> {
  const norm = (identifier || "").trim().toLowerCase();
  if (!norm) return null;
  initDefaultSeedUsers();

  for (const u of memoryUsers.values()) {
    if (
      u.id.toLowerCase() === norm ||
      (u.email && u.email.toLowerCase() === norm) ||
      (u.wallet_address && u.wallet_address.toLowerCase() === norm) ||
      (u.name && u.name.toLowerCase() === norm) ||
      (u.github_username && u.github_username.toLowerCase() === norm)
    ) {
      return u;
    }
  }

  try {
    const { data } = await supabaseServer()
      .from("users")
      .select("*")
      .or(`id.eq.${norm},email.eq.${norm},wallet_address.eq.${norm},name.ilike.${norm}`)
      .limit(1)
      .maybeSingle();
    if (data) return data as DbUserRecord;
  } catch {}

  return null;
}

/**
 * Upsert user profile to database using server-side service role client.
 *
 * Security:
 * - When called by untrusted user workflows (isTrustedRatingWorkflow = false),
 *   `trust_tier` and `credit_allowance_usd` are STRIPPED and preserved from existing
 *   database records (or set to default unverified tier).
 * - Only trusted server rating workflows (e.g. Google OAuth exchange, ZK verification)
 *   can modify `trust_tier` and `credit_allowance_usd`.
 */
export async function syncUserToDatabase(
  user: Partial<DbUserRecord> & { id: string; email: string; name: string },
  isTrustedRatingWorkflow: boolean = false
) {
  try {
    let trustTier = user.trust_tier;
    let creditAllowance = user.credit_allowance_usd;

    // Security Gate: Strip privilege fields from user-controlled updates
    if (!isTrustedRatingWorkflow) {
      const existing = await fetchUserFromDatabase({ id: user.id });
      if (existing) {
        trustTier = existing.trust_tier;
        creditAllowance = existing.credit_allowance_usd;
      } else {
        trustTier = "GOOGLE VERIFIED CITIZEN";
        creditAllowance = 600;
      }
    }

    const payload: DbUserRecord = {
      id: user.id,
      email: user.email,
      name: user.name,
      picture: user.picture || null,
      bio: user.bio || "Koliance Web3 & AI Identity",
      wallet_address: user.wallet_address || null,
      trust_tier: trustTier || "GOOGLE VERIFIED CITIZEN",
      credit_allowance_usd: creditAllowance !== undefined ? creditAllowance : 600,
      steam_id: user.steam_id || null,
      github_username: user.github_username || null,
      updated_at: new Date().toISOString(),
    };

    memoryUsers.set(payload.id, payload);
    savePersistentRecord("users", payload.id, payload, memoryUsers);

    const { data, error } = await supabaseServer()
      .from("users")
      .upsert(payload, { onConflict: "id" })
      .select()
      .single();

    if (error) {
      console.warn("[Database] User upsert notice (fallback to payload):", error.message);
      return payload;
    }
    return data;
  } catch (err) {
    console.warn("[Database] Exception during syncUserToDatabase:", err);
    return user;
  }
}

/**
 * Search registered public users by username, email, or wallet address.
 * When query is empty, returns recommended registered users for auto-discovery.
 * Only returns safe public fields (id, name, email, picture, wallet_address, trust_tier).
 */
export async function searchPublicUsers(
  query: string,
  excludeUserId?: string
): Promise<PublicUserSearchResult[]> {
  const clean = (query || "").trim().replace(/[%,()]/g, "");
  const isDiscovery = clean.length === 0;

  const lowerQ = clean.toLowerCase();
  const excludeNorm = (excludeUserId || "").toLowerCase();

  try {
    let queryBuilder = supabaseServer()
      .from("users")
      .select("id, name, email, picture, wallet_address, trust_tier, github_username");

    if (!isDiscovery) {
      queryBuilder = queryBuilder.or(
        `name.ilike.%${clean}%,email.ilike.%${clean}%,wallet_address.ilike.%${clean}%,github_username.ilike.%${clean}%`
      );
    }

    const { data, error } = await queryBuilder.limit(20);

    if (!error && Array.isArray(data) && data.length > 0) {
      return (data as PublicUserSearchResult[]).filter((u) => {
        const uid = (u.id || "").toLowerCase();
        const uemail = (u.email || "").toLowerCase();
        const uwallet = (u.wallet_address || "").toLowerCase();
        return uid !== excludeNorm && uemail !== excludeNorm && uwallet !== excludeNorm;
      });
    }
  } catch (err) {
    console.warn("[Database] Supabase user search notice (falling back to memory):", err);
  }

  // Fallback to in-memory users (ensuring seeds and recent users are discovered)
  initDefaultSeedUsers();
  const matches: PublicUserSearchResult[] = [];
  memoryUsers.forEach((u) => {
    const uid = (u.id || "").toLowerCase();
    const uemail = (u.email || "").toLowerCase();
    const uwallet = (u.wallet_address || "").toLowerCase();
    const uname = (u.name || "").toLowerCase();
    const ugh = (u.github_username || "").toLowerCase();

    if (uid === excludeNorm || uemail === excludeNorm || uwallet === excludeNorm) {
      return;
    }

    if (
      isDiscovery ||
      uname.includes(lowerQ) ||
      uemail.includes(lowerQ) ||
      uwallet.includes(lowerQ) ||
      ugh.includes(lowerQ)
    ) {
      matches.push({
        id: u.id,
        name: u.name,
        email: u.email,
        picture: u.picture || null,
        wallet_address: u.wallet_address || null,
        trust_tier: u.trust_tier,
        github_username: u.github_username || null,
      });
    }
  });

  return matches.slice(0, 20);
}

/**
 * Fetch user profile by ID using server-side client.
 *
 * Security:
 * - Arbitrary queries by email or wallet address without an explicit user ID
 *   are disallowed to prevent user enumeration and unauthorized data harvesting.
 */
export async function fetchUserFromDatabase(params: { id?: string; email?: string; wallet?: string }) {
  try {
    // Security: Disallow arbitrary email or wallet lookups without authenticated user id
    if (!params.id) {
      if (params.email || params.wallet) {
        console.warn("[Database Security] Disallowed arbitrary lookup by email or wallet without user id.");
      }
      return null;
    }

    const { data, error } = await supabaseServer()
      .from("users")
      .select("*")
      .eq("id", params.id)
      .maybeSingle();

    if (error || !data) return null;
    return data as DbUserRecord;
  } catch {
    return null;
  }
}
