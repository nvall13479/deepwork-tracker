let audioCtx: AudioContext | null = null;

export function playChime(): void {
  try {
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    if (!audioCtx || audioCtx.state === "closed") {
      audioCtx = new Ctor();
    }
    const ctx = audioCtx;
    if (ctx.state === "suspended") {
      void ctx.resume();
    }
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(587.33, ctx.currentTime);
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc.start();
    osc.stop(ctx.currentTime + 0.35);
  } catch (e) {
    console.error("Audio error", e);
  }
}

export async function requestNotificationPermission(): Promise<void> {
  if (typeof window !== "undefined" && "Notification" in window) {
    if (Notification.permission === "default") {
      try {
        await Notification.requestPermission();
      } catch {
        /* ignore */
      }
    }
  }
}

export function notify(title: string, body: string): void {
  if (typeof window !== "undefined" && "Notification" in window) {
    if (Notification.permission === "granted") {
      try {
        new Notification(title, { body });
      } catch {
        /* ignore */
      }
    }
  }
}
