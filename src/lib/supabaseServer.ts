import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Server-side Supabase client (service role, bypasses RLS).
 *
 * Issue #35 P0-5: there are NO hard-coded fallbacks any more. The old code
 * silently fell back to a committed project URL and a placeholder service key,
 * which hid misconfiguration. Missing configuration now throws on first use
 * with a clear message (callers in db.ts / apiKeyDb.ts catch it and degrade
 * explicitly, logging the reason).
 *
 * Required env (server only; SUPABASE_SERVICE_ROLE_KEY must NEVER carry the
 * NEXT_PUBLIC_ prefix):
 *   SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL)
 *   SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SERVICE_KEY)
 */
export class SupabaseConfigError extends Error {}

let client: SupabaseClient | null = null;

export function supabaseServer(): SupabaseClient {
  if (client) return client;
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  const missing = [!url && "SUPABASE_URL", !key && "SUPABASE_SERVICE_ROLE_KEY"].filter(Boolean);
  if (missing.length > 0) {
    throw new SupabaseConfigError(`Supabase is not configured: missing ${missing.join(", ")}`);
  }
  client = createClient(url as string, key as string, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}

/** Test hook: drop the cached client so env changes take effect. */
export function resetSupabaseServerForTests(): void {
  client = null;
}
