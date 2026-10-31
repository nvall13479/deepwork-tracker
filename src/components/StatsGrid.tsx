import { formatMins } from "@/lib/format";
import { computeScore } from "@/lib/tracker";

interface StatsGridProps {
  dailyOnMinutes: number;
  dailyOffMinutes: number;
  sessionOnMinutes: number;
}

export default function StatsGrid({
  dailyOnMinutes,
  dailyOffMinutes,
  sessionOnMinutes,
}: StatsGridProps) {
  const score = computeScore(dailyOnMinutes, dailyOffMinutes);
  const cards = [
    {
      label: "Ημερήσιο Score",
      value: `${score}%`,
      sub: "Σύνολο Ημέρας",
      cls: "text-indigo-400",
    },
    {
      label: "Συνολικό ON Ημέρας",
      value: formatMins(dailyOnMinutes),
      sub: "Όλες οι Συνεδρίες",
      cls: "text-emerald-400",
    },
    {
      label: "Τρέχουσα Συνεδρία ON",
      value: formatMins(sessionOnMinutes),
      sub: "Ενεργή συνεδρία",
      cls: "text-emerald-300",
    },
    {
      label: "Συνολικό OFF Ημέρας",
      value: formatMins(dailyOffMinutes),
      sub: "Εκτός προγράμματος",
      cls: "text-rose-400",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      {cards.map((c) => (
        <div
          key={c.label}
          className="bg-slate-900 border border-slate-800 p-4 rounded-xl text-center"
        >
          <span className="text-xs text-slate-400 font-semibold uppercase">{c.label}</span>
          <div className={`text-3xl font-extrabold my-1 ${c.cls}`}>{c.value}</div>
          <span className="text-xs text-slate-500">{c.sub}</span>
        </div>
      ))}
    </div>
  );
}
