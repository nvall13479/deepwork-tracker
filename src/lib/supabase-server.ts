import { cookies } from "next/headers";
import { cache } from "react";
import type { User } from "@supabase/supabase-js";
import { isSupabaseConfigured, makeSupabase } from "./supabase";

export interface CookieOptions {
  path?: string;
  maxAge?: number;
  httpOnly?: boolean;
  sameSite?: "lax" | "strict" | "none";
}

export const cookieOptions: CookieOptions = {
  path: "/",
  maxAge: 60 * 60 * 24 * 30,
  httpOnly: true,
  sameSite: "lax",
};

export const removedOptions: CookieOptions = { path: "/", maxAge: 0 };

export async function getServerUser(): Promise<User | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const jar = await cookies();
    const access = jar.get("dw_access")?.value;
    const refresh = jar.get("dw_refresh")?.value;
    if (!access || !refresh) return null;
    const serverClient = makeSupabase();
    const { data, error } = await serverClient.auth.setSession({
      access_token: access,
      refresh_token: refresh,
    });
    if (error) return null;
    return data.user ?? null;
  } catch {
    return null;
  }
}

export const getUser = cache(getServerUser);
