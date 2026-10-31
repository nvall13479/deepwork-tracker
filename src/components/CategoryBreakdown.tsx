import { formatMins } from "@/lib/format";
import type { CategoryMap } from "@/lib/types";

interface CategoryBreakdownProps {
  title: string;
  emptyLabel: string;
  categories: CategoryMap;
  tone: "on" | "off";
}

const TONE = {
  on: { heading: "text-emerald-400", value: "text-emerald-400" },
  off: { heading: "text-rose-400", value: "text-rose-400" },
};

export default function CategoryBreakdown({
  title,
  emptyLabel,
  categories,
  tone,
}: CategoryBreakdownProps) {
  const entries = Object.entries(categories || {}).sort((a, b) => b[1] - a[1]);
  const t = TONE[tone];
  return (
    <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-3">
      <h3 className={`text-sm font-semibold ${t.heading} border-b border-slate-800 pb-2`}>
        {title}
      </h3>
      <ul className="space-y-2 text-sm">
        {entries.length === 0 ? (
          <li className="text-slate-500 text-xs italic">{emptyLabel}</li>
        ) : (
          entries.map(([cat, mins]) => (
            <li
              key={cat}
              className="flex justify-between text-slate-300 border-b border-slate-800/50 pb-1"
            >
              <span>{cat}</span>
              <span className={`font-mono font-bold ${t.value}`}>{formatMins(mins)}</span>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
