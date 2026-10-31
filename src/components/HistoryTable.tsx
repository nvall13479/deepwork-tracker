import { formatMins } from "@/lib/format";
import type { DailyHistoryRecord } from "@/lib/types";

interface HistoryTableProps {
  history: DailyHistoryRecord[];
  goalMinutes: number;
  onDelete: (id: number) => void;
}

export default function HistoryTable({ history, goalMinutes, onDelete }: HistoryTableProps) {
  return (
    <section className="bg-slate-900 border border-slate-800 p-5 rounded-xl space-y-3">
      <h3 className="text-sm font-semibold text-indigo-400 border-b border-slate-800 pb-2 flex justify-between items-center">
        <span>📅 Ιστορικό Προηγούμενων Ημερών</span>
        <span className="text-xs text-slate-500 font-normal">Τελευταίες {history.length || 10} ημέρες</span>
      </h3>

      {history.length === 0 ? (
        <p className="text-xs text-slate-500 italic">Δεν υπάρχει ακόμα αποθηκευμένο ιστορικό.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-800/50 text-slate-400 uppercase">
              <tr>
                <th className="p-2.5 rounded-l">Ημερομηνία</th>
                <th className="p-2.5">Deep Work</th>
                <th className="p-2.5">Score</th>
                <th className="p-2.5">Στόχος ({formatMins(goalMinutes)})</th>
                <th className="p-2.5 text-right rounded-r">Ενέργειες</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {history.map((rec) => (
                <tr key={rec.id} className="hover:bg-slate-800/30 transition">
                  <td className="p-2.5 font-mono text-slate-200">{rec.date}</td>
                  <td className="p-2.5 font-bold text-emerald-400">
                    {formatMins(rec.pure_deep_work_minutes)}
                  </td>
                  <td className="p-2.5 font-mono text-indigo-400">{rec.productivity_score}%</td>
                  <td className="p-2.5">
                    {rec.goal_achieved ? (
                      <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 rounded font-bold">
                        ✅ Επιτεύχθηκε
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 bg-slate-800 text-slate-400 border border-slate-700 rounded">
                        ❌ Εκτός στόχου
                      </span>
                    )}
                  </td>
                  <td className="p-2.5 text-right">
                    <button
                      onClick={() => onDelete(rec.id)}
                      aria-label={`Διαγραφή εγγραφής ${rec.date}`}
                      className="px-2 py-1 bg-rose-950 hover:bg-rose-900 text-rose-300 border border-rose-800 rounded transition"
                      title="Διαγραφή εγγραφής"
                    >
                      🗑️
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
