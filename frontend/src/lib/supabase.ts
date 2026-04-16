import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/**
 * Supabase browser client singleton.
 * Uses @supabase/ssr createBrowserClient so the session is persisted in
 * cookies (in addition to localStorage), making it readable by the edge
 * middleware for server-side auth gating.
 * When env vars are missing (e.g. during static build), a placeholder
 * client is created that will fail at runtime — this is intentional so
 * the build succeeds and auth errors surface only when the page is used.
 */
export const supabase: SupabaseClient =
  supabaseUrl && supabaseAnonKey
    ? createBrowserClient(supabaseUrl, supabaseAnonKey)
    : createBrowserClient("https://placeholder.supabase.co", "placeholder");
