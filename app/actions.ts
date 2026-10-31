"use server";

import { cookies } from "next/headers";
import { removedOptions } from "@/lib/supabase-server";

export async function signOut() {
  const jar = await cookies();
  jar.set("dw_access", "", removedOptions);
  jar.set("dw_refresh", "", removedOptions);
}
