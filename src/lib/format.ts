export function formatMins(mins: number): string {
  const rounded = Math.round(mins);
  const h = Math.floor(rounded / 60);
  const m = rounded % 60;
  return h > 0 ? `${h}ώ ${m}λ` : `${m}λ`;
}

export function formatTimer(sec: number): string {
  const m = String(Math.floor(sec / 60)).padStart(2, "0");
  const s = String(Math.floor(sec) % 60).padStart(2, "0");
  return `${m}:${s}`;
}
