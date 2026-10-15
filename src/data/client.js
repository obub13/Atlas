// ─── Supabase connection ──────────────────────────────────────────────────────
// Project URL + anon key come from the build (VITE_SUPABASE_URL /
// VITE_SUPABASE_ANON_KEY) or, if the build has none, from a one-time setup
// screen that keeps them on this device. The anon key is public by design:
// what protects the data is row-level security in the database, not the key.
import { createClient } from "@supabase/supabase-js";

const KEY = "atlas:supabase";

export function getConfig() {
  const env = (typeof import.meta !== "undefined" && import.meta.env) || {};
  if (env.VITE_SUPABASE_URL && env.VITE_SUPABASE_ANON_KEY) {
    return { url: env.VITE_SUPABASE_URL, anonKey: env.VITE_SUPABASE_ANON_KEY, source: "build" };
  }
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || "null");
    if (saved?.url && saved?.anonKey) return { ...saved, source: "device" };
  } catch {}
  return null;
}

export function validateConfig({ url, anonKey }) {
  const u = String(url || "").trim().replace(/\/+$/, "");
  const k = String(anonKey || "").trim();
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.(co|in)$/i.test(u) && !/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(u)) {
    return { error: "That doesn't look like a Supabase project URL (https://xxxx.supabase.co)." };
  }
  if (k.length < 20) return { error: "That anon key looks too short — copy the whole key." };
  if (/^sb_secret_/.test(k) || /service_role/.test(atobSafe(k.split(".")[1] || ""))) {
    return { error: "That's a secret key (service_role / sb_secret_) — it bypasses all security. Use the publishable or anon key." };
  }
  return { url: u, anonKey: k };
}

function atobSafe(s) {
  try { return atob(s.replace(/-/g, "+").replace(/_/g, "/")); } catch { return ""; }
}

export function saveConfig(cfg) {
  try { localStorage.setItem(KEY, JSON.stringify({ url: cfg.url, anonKey: cfg.anonKey })); } catch {}
}
export function clearConfig() {
  try { localStorage.removeItem(KEY); } catch {}
}

let client = null, clientFor = null;
export function getClient(cfg) {
  if (client && clientFor === cfg.url + cfg.anonKey) return client;
  client = createClient(cfg.url, cfg.anonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: "atlas:auth" },
  });
  clientFor = cfg.url + cfg.anonKey;
  return client;
}
