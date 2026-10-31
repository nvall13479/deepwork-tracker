"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [authError, setAuthError] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      setAuthError(new URLSearchParams(window.location.search).has("auth_error"));
    }, 0);
    return () => clearTimeout(t);
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!supabase || !isSupabaseConfigured) return;
    setBusy(true);
    setMessage(null);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
        });
        if (error) {
          setMessage({ tone: "err", text: error.message });
        } else {
          const { data } = await supabase.auth.getSession();
          if (data.session) {
            router.replace("/");
            router.refresh();
          } else {
            setMessage({
              tone: "ok",
              text: "Ο λογαριασμός δημιουργήθηκε! Έλεγξε το email σου για τον σύνδεσμο επιβεβαίωσης και μετά κάνε login.",
            });
            setMode("login");
          }
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          setMessage({ tone: "err", text: error.message });
        } else {
          router.replace("/");
          router.refresh();
        }
      }
    } finally {
      setBusy(false);
    }
  };

  return (
      <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6 font-sans">
      <form
        onSubmit={submit}
        className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4 shadow-xl"
      >
        <div className="text-center space-y-1">
          <h1 className="text-xl font-bold text-indigo-400">⚡ Deep Work Tracker</h1>
          <p className="text-xs text-slate-400">
            {mode === "login" ? "Σύνδεση στον λογαριασμό σου" : "Δημιουργία λογαριασμού"}
          </p>
        </div>

        {authError && (
          <p className="text-xs bg-amber-950/60 border border-amber-700 text-amber-200 rounded p-2">
            Ο σύνδεσμος επιβεβαίωσης δεν λειτούργησε (ίσως έληξε). Δοκίμασε ξανά.
          </p>
        )}
        {message && (
          <p
            className={`text-xs rounded p-2 border ${
              message.tone === "ok"
                ? "bg-emerald-950/60 border-emerald-700 text-emerald-200"
                : "bg-rose-950/60 border-rose-700 text-rose-200"
            }`}
          >
            {message.text}
          </p>
        )}

        <div className="space-y-2">
          <label className="block text-xs text-slate-400" htmlFor="login-email">
            Email
          </label>
          <input
            id="login-email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="dw-input"
            placeholder="you@example.com"
          />
        </div>

        <div className="space-y-2">
          <label className="block text-xs text-slate-400" htmlFor="login-pass">
            Κωδικός
          </label>
          <input
            id="login-pass"
            type="password"
            required
            minLength={8}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="dw-input"
            placeholder="τουλάχιστον 8 χαρακτήρες"
          />
        </div>

        <button
          type="submit"
          disabled={busy}
          className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 font-bold py-2.5 rounded-lg text-white text-sm transition"
        >
          {busy
            ? "Περιμένετε..."
            : mode === "login"
              ? "Σύνδεση"
              : "Εγγραφή"}
        </button>

        <button
          type="button"
          onClick={() => {
            setMode(mode === "login" ? "signup" : "login");
            setMessage(null);
          }}
          className="w-full text-xs text-slate-400 hover:text-slate-200 transition"
        >
          {mode === "login"
            ? "Δεν έχεις λογαριασμό; Εγγραφή"
            : "Έχεις ήδη λογαριασμό; Σύνδεση"}
        </button>
      </form>
    </main>
  );
}
