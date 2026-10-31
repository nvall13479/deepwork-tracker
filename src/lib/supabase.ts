import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

const isBrowser = typeof window !== "undefined";

type CookieSetter = (name: string, value: string) => void;

let singleton: SupabaseClient | null = null;

export function makeSupabase(onAuthCookie?: CookieSetter): SupabaseClient {
  if (!isSupabaseConfigured) {
    throw new Error("Supabase env vars are not set");
  }
  if (isBrowser && onAuthCookie) {
    const wrapped: CookieSetter = onAuthCookie;
    return createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: "deepwork-auth",
        storage: {
          getItem: (k: string) => window.localStorage.getItem(k),
          setItem: (k: string, v: string) => {
            window.localStorage.setItem(k, v);
            if (k === "deepwork-auth") {
              let parsed: { access_token?: string; refresh_token?: string } | null = null;
              try {
                parsed = JSON.parse(v);
              } catch {
                /* ignore */
              }
              wrapped("dw_access", parsed?.access_token || "");
              wrapped("dw_refresh", parsed?.refresh_token || "");
            }
          },
          removeItem: (k: string) => {
            window.localStorage.removeItem(k);
            if (k === "deepwork-auth") {
              wrapped("dw_access", "");
              wrapped("dw_refresh", "");
            }
          },
        },
      },
    });
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: isBrowser,
      autoRefreshToken: isBrowser,
      detectSessionInUrl: isBrowser,
      storageKey: "deepwork-auth",
    },
  });
}

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? isBrowser
    ? (() => {
        singleton ??= makeSupabase((name, value) => {
          document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${
            value ? 60 * 60 * 24 * 30 : 0
          }; samesite=lax`;
        });
        return singleton;
      })()
    : null
  : null;
