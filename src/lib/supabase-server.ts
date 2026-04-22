import { createClient } from "@supabase/supabase-js";

// Server-only client using service role key — bypasses RLS.
// NEVER import this in client components or expose to the browser.
const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim().replace(/\/rest\/v1\/?$/, "").replace(/\/$/, "");
const serviceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();

export const supabaseAdmin = createClient(
  supabaseUrl || "https://placeholder.supabase.co",
  serviceRoleKey || "placeholder",
  { auth: { persistSession: false } }
);
