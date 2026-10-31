"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function CallbackPage() {
  const router = useRouter();
  const ranRef = useRef(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    const finish = () => {
      router.replace("/");
      router.refresh();
    };

    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const client = supabase;

    if (!client) {
      queueMicrotask(() => setFailed(true));
      return;
    }

    const { data: sub } = client.auth.onAuthStateChange((_e, session) => {
      if (session) finish();
    });

    const attempt = async () => {
      const { data: existing } = await client.auth.getSession();
      if (existing.session) {
        finish();
        return;
      }
      if (code) {
        const { error } = await client.auth.exchangeCodeForSession(code);
        if (!error) return;
      }
      setTimeout(() => setFailed(true), 5000);
    };
    void attempt();

    return () => sub.subscription.unsubscribe();
  }, [router]);

  if (failed) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center gap-4 font-sans">
        <p className="text-sm text-amber-300">
          Ο σύνδεσμος δεν μπόρεσε να ολοκληρωθεί (ίσως έχει λήξει ή χρησιμοποιηθεί).
        </p>
        <button
          onClick={() => {
            router.replace("/");
          }}
          className="text-xs px-4 py-2 rounded bg-indigo-600 hover:bg-indigo-500 font-bold text-white transition"
        >
          Επιστροφή στη σελίδα σύνδεσης
        </button>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center font-sans">
      <div className="text-sm text-slate-400 animate-pulse">Ολοκλήρωση σύνδεσης...</div>
    </main>
  );
}
