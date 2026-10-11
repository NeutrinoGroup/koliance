import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  "https://kjsggytvrmpkmlytkdri.supabase.co";

// SUPABASE_SERVICE_ROLE_KEY must NEVER have NEXT_PUBLIC_ prefix to prevent public client-side leak.
// It bypasses Supabase Row Level Security (RLS) for trusted backend server-side operations only.
const serviceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "sb_service_role_secret_koliance";

export const supabaseServer = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});
