import { supabaseServer } from "@/lib/supabaseServer";
import { createClient } from "@supabase/supabase-js";

// Public Supabase client for anon client-side operations (subject to RLS)
const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://kjsggytvrmpkmlytkdri.supabase.co";
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  "sb_publishable_bnZzhsY4gqOQc_2n3_wBUA_X622_pre";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

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

    const payload = {
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

    const { data, error } = await supabaseServer
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

    const { data, error } = await supabaseServer
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
