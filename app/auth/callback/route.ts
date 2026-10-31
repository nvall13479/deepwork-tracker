"use server";

import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { cookieOptions } from "@/lib/supabase-server";
import { makeSupabase } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") || "/";

  if (code) {
    try {
      const client = makeSupabase();
      const { data, error } = await client.auth.exchangeCodeForSession(code);
      if (!error && data.session) {
        const jar = await cookies();
        jar.set("dw_access", data.session.access_token, cookieOptions);
        jar.set("dw_refresh", data.session.refresh_token, cookieOptions);
        return NextResponse.redirect(new URL(next, url.origin));
      }
    } catch {
      /* λήγει στο login screen */
    }
  }

  return NextResponse.redirect(new URL("/?auth_error=1", url.origin));
}
