import { useState } from "react";
import type { TrackerSettings } from "@/lib/types";
import { formatMins } from "@/lib/format";

interface SettingsPanelProps {
  settings: TrackerSettings;
  onSave: (s: TrackerSettings) => void;
  onClose: () => void;
}

export default function SettingsPanel({ settings, onSave, onClose }: SettingsPanelProps) {
  const [intervalSec, setIntervalSec] = useState(settings.intervalSec);
  const [goalMinutes, setGoalMinutes] = useState(settings.goalMinutes);
  const [autoCheckin, setAutoCheckin] = useState<"on" | "off">(settings.autoCheckin);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Ρυθμίσεις"
        className="bg-slate-900 border border-slate-700 rounded-xl p-5 max-w-md w-full space-y-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-base font-bold text-slate-100">⚙️ Ρυθμίσεις</h3>

        <div>
          <label className="block text-xs mb-1 text-slate-400" htmlFor="set-interval">
            Συχνότητα ελέγχου (λεπτά)
          </label>
          <select
            id="set-interval"
            className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-sm text-slate-200"
            value={intervalSec / 60}
            onChange={(e) => setIntervalSec(Number(e.target.value) * 60)}
          >
            <option value={1}>κάθε 1 λεπτό</option>
            <option value={2}>κάθε 2 λεπτά</option>
            <option value={3}>κάθε 3 λεπτά</option>
            <option value={5}>κάθε 5 λεπτά</option>
          </select>
        </div>

        <div>
          <label className="block text-xs mb-1 text-slate-400" htmlFor="set-goal">
            Ημερήσιος στόχος: {formatMins(goalMinutes)}
          </label>
          <input
            id="set-goal"
            type="range"
            min={60}
            max={720}
            step={30}
            value={goalMinutes}
            onChange={(e) => setGoalMinutes(Number(e.target.value))}
            className="w-full accent-indigo-500"
          />
        </div>

        <div>
          <span className="block text-xs mb-1 text-slate-400">
            Τι μετράει αν δεν απαντήσεις μέσα σε 10 δευτερόλεπτα:
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setAutoCheckin("on")}
              className={`flex-1 text-xs font-bold py-2 rounded border transition ${
                autoCheckin === "on"
                  ? "bg-emerald-600/20 border-emerald-500 text-emerald-300"
                  : "bg-slate-800 border-slate-700 text-slate-400"
              }`}
            >
              ✅ ON (Deep Work)
            </button>
            <button
              onClick={() => setAutoCheckin("off")}
              className={`flex-1 text-xs font-bold py-2 rounded border transition ${
                autoCheckin === "off"
                  ? "bg-rose-600/20 border-rose-500 text-rose-300"
                  : "bg-slate-800 border-slate-700 text-slate-400"
              }`}
            >
              ❌ OFF (Χάζεμα)
            </button>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Τα αυτόματα ON μετρώνται πάντα ξεχωριστά για διαφάνεια στο ιστορικό.
          </p>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <button
            onClick={onClose}
            className="text-xs px-3 py-2 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
          >
            Ακύρωση
          </button>
          <button
            onClick={() => onSave({ intervalSec, goalMinutes, autoCheckin })}
            className="text-xs px-3 py-2 rounded bg-indigo-600 hover:bg-indigo-500 font-bold text-white transition"
          >
            Αποθήκευση
          </button>
        </div>
      </div>
    </div>
  );
}
