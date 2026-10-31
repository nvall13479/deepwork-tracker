interface BannerProps {
  tone: "error" | "info" | "warning";
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

const TONES: Record<BannerProps["tone"], string> = {
  error: "bg-rose-950/70 border-rose-700 text-rose-200",
  info: "bg-slate-800/70 border-slate-600 text-slate-200",
  warning: "bg-amber-950/70 border-amber-700 text-amber-200",
};

export default function Banner({ tone, message, actionLabel, onAction }: BannerProps) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={`flex items-center justify-between gap-3 border rounded-xl px-4 py-2.5 text-sm ${TONES[tone]}`}
    >
      <span>{message}</span>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="shrink-0 text-xs font-bold px-3 py-1.5 rounded bg-white/10 hover:bg-white/20 border border-white/20 transition"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
