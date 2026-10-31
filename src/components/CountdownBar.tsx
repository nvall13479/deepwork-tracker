import { formatTimer } from "@/lib/format";

interface CountdownBarProps {
  active: boolean;
  secLeft: number;
  intervalSec: number;
}

export default function CountdownBar({ active, secLeft, intervalSec }: CountdownBarProps) {
  const pct = active ? Math.max(0, Math.min(100, (secLeft / intervalSec) * 100)) : 0;
  return (
    <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-2">
      <div className="flex justify-between text-xs text-slate-400">
        <span>{active ? "Επόμενος έλεγχος σε:" : "Η συνεδρία είναι σε παύση/αδράνεια."}</span>
        {active && (
          <span className="font-mono font-bold text-indigo-400">{formatTimer(secLeft)}</span>
        )}
      </div>
      <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
        <div
          className={`h-full transition-all duration-1000 ${active ? "bg-indigo-500" : "bg-slate-700"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
