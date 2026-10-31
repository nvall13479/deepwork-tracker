export default function SetupScreen() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6 font-sans">
      <div className="max-w-lg w-full bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-3">
        <h1 className="text-xl font-bold text-amber-400">⚙️ Χρειάζεται ρύθμιση Supabase</h1>
        <p className="text-sm text-slate-300">
          Δεν βρέθηκαν οι περιβαλλοντικές μεταβλητές. Δημιούργησε αρχείο{" "}
          <code className="bg-slate-800 px-1 rounded">.env.local</code> στο root με:
        </p>
        <pre className="text-xs bg-slate-950 border border-slate-800 rounded p-3 overflow-x-auto text-slate-400">
{`NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<publishable key>`}
        </pre>
        <p className="text-xs text-slate-500">
          Μετά restart του dev server. Βλ. README.md για πλήρεις οδηγίες.
        </p>
      </div>
    </main>
  );
}
