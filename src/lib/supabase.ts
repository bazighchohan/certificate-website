import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Server-only Supabase admin client (service role).
 * Never import this from a Client Component — the service role key bypasses RLS.
 */
let client: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (typeof window !== "undefined") {
    throw new Error("getSupabaseAdmin must only be used on the server.");
  }
  if (client) return client;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.");
  }

  client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}

/** Returns whether certificates are released. Throws on DB/config errors. */
export async function getReleased(): Promise<boolean> {
  const { data, error } = await getSupabaseAdmin()
    .from("settings")
    .select("released")
    .eq("id", true)
    .maybeSingle();
  if (error) throw error;
  return data?.released === true;
}
