import { useEffect } from "react";
import { CATEGORIES } from "@/lib/types";
import { formatMins } from "@/lib/format";

interface CheckinModalProps {
  autoTimeoutLeft: number;
  autoDefault: "on" | "off";
  intervalSec: number;
  selectedCategory: string;
  offStreakMinutes: number;
  onSelectCategory: (c: string) => void;
  onCheckin: (isOff: boolean, viaKeyboard: boolean) => void;
}

export default function CheckinModal({
  autoTimeoutLeft,
  autoDefault,
  intervalSec,
  selectedCategory,
  offStreakMinutes,
  onSelectCategory,
  onCheckin,
}: CheckinModalProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "1") onCheckin(false, true);
      else if (e.key === "2") onCheckin(true, true);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onCheckin]);

  const mins = Math.round(intervalSec / 60);

  return (
    <section
      role="alertdialog"
      aria-label="Έλεγχος παραγωγικότητας"
      className="bg-slate-900 border-2 border-amber-500/80 p-6 rounded-xl shadow-2xl space-y-4"
    >
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-amber-400">⚠️ Έλεγχος Παραγωγικότητας!</h2>
        <span className="text-xs px-2.5 py-1 bg-amber-500/20 border border-amber-500/40 text-amber-300 font-mono font-bold rounded-full">
          ⏱️ Αυτόματο {autoDefault.toUpperCase()} σε {autoTimeoutLeft}s
        </span>
      </div>
      <p className="text-sm text-slate-300">Πού ξόδεψες τα τελευταία {mins} λεπτά;</p>

      <div>
        <label className="block text-xs mb-1 text-slate-400" htmlFor="category-select">
          Κατηγορία/Εφαρμογή:
        </label>
        <select
          id="category-select"
          value={selectedCategory}
          onChange={(e) => onSelectCategory(e.target.value)}
          className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
        >
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4 pt-2">
        <button
          onClick={() => onCheckin(false, false)}
          className="bg-emerald-600 hover:bg-emerald-500 font-bold py-3 rounded-lg text-white transition"
        >
          ✅ ON Schedule (Deep Work)
          <span className="block text-xs font-normal text-emerald-200">πλήκτρο [1]</span>
        </button>
        <button
          onClick={() => onCheckin(true, false)}
          className="bg-rose-600 hover:bg-rose-500 font-bold py-3 rounded-lg text-white transition"
        >
          ❌ OFF Schedule (Χάζεμα)
          <span className="block text-xs font-normal text-rose-200">πλήκτρο [2]</span>
          {offStreakMinutes > 0 && (
            <span className="block text-xs font-normal">Streak: {formatMins(offStreakMinutes)}</span>
          )}
        </button>
      </div>
    </section>
  );
}
