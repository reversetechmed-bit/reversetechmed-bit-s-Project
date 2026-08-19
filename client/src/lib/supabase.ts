import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const passwordRecoveryLinkOnLoad = typeof window !== "undefined" && new URLSearchParams(window.location.hash.replace(/^#/, "")).get("type") === "recovery";

export const supabase = createClient(
  url || "https://placeholder.supabase.co",
  anonKey || "placeholder-anon-key",
  { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } },
);

export const hasSupabaseConfiguration = Boolean(url && anonKey);
export const isPasswordRecoveryLink = () => passwordRecoveryLinkOnLoad;
