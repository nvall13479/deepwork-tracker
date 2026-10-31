import type { TrackerData } from "./types";

const STATE_KEY = "deepwor…e-v2";

export function saveLocalCache(data: TrackerData): void {
  try {
    localStorage.setItem(STATE_KEY, JSON.stringify(data));
  } catch {
    /* ignore */
  }
}

export function loadLocalCache(): unknown | null {
  try {
    const raw = localStorage.getItem(STATE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
