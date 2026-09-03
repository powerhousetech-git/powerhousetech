import { createClient, SupabaseClient } from "@supabase/supabase-js";

export function isDemoMode(): boolean {
  if (process.env.PS2_DEMO_MODE === "true") return true;
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return true;
  return false;
}

export function createServiceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Supabase service role credentials not configured");
  }
  return createClient(url, key);
}
