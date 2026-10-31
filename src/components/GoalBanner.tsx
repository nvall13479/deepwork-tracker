import { formatMins } from "@/lib/format";
import { goalProgressPct, remainingGoalMinutes } from "@/lib/tracker";

interface GoalBannerProps {
  onMinutes: number;
  goalMinutes: number;
  autoMinutes: number;
}

export default function GoalBanner({ onMinutes, goalMinutes, autoMinutes }: GoalBannerProps) {
  const pct = goalProgressPct(onMinutes, goalMinutes);
  const remaining = remainingGoalMinutes(onMinutes, goalMinutes);
  const achieved = remaining <= 0;

  return (
    <section
      aria-label="Ημερήσιος στόχος"
      className="bg-gradient-to-r from-indigo-950 via-slate-900 to-slate-900 border border-indigo-500/30 p-5 rounded-xl space-y-3 shadow-lg"
    >
      <div className="flex justify-between items-center">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-indigo-400">
            🎯 Συνολικός Ημερήσιος Στόχος Deep Work ({formatMins(goalMinutes)})
          </span>
          <div className="text-2xl font-extrabold text-white mt-1">
            {formatMins(onMinutes)}{" "}
            <span className="text-sm font-normal text-slate-400">/ {formatMins(goalMinutes)}</span>
          </div>
          {autoMinutes > 0 && (
            <div className="text-xs text-slate-500 mt-0.5">
              από τα {formatMins(autoMinutes)} αυτόματα check-in
            </div>
          )}
        </div>
        <div className="text-right">
          {!achieved ? (
            <div>
              <span className="text-xs text-slate-400">Απομένουν ακόμη:</span>
              <div className="text-lg font-bold text-amber-400">{formatMins(remaining)}</div>
            </div>
          ) : (
            <span className="inline-block bg-emerald-500/20 text-emerald-300 text-xs px-3 py-1.5 rounded-full border border-emerald-500/50 font-bold">
              🎉 Ο στόχος επιτεύχθηκε!
            </span>
          )}
        </div>
      </div>

      <div className="w-full bg-slate-800 h-3 rounded-full overflow-hidden border border-slate-700/50">
        <div
          className="bg-gradient-to-r from-indigo-500 to-emerald-400 h-full transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </section>
  );
}
