export interface CategoryMap {
  [key: string]: number;
}

export interface SessionData {
  onMinutes: number;
  offMinutes: number;
  onCategories: CategoryMap;
  offCategories: CategoryMap;
  startedAt: number | null;
  lastCheckAt: number | null;
}

export interface TrackerSettings {
  intervalSec: number;
  goalMinutes: number;
  autoCheckin: "on" | "off";
}

export interface TrackerData {
  version: number;
  lastDate: string;
  isSessionActive: boolean;
  dailyOnMinutes: number;
  dailyOffMinutes: number;
  dailyAutoOnMinutes: number;
  dailyOnCategories: CategoryMap;
  dailyOffCategories: CategoryMap;
  currentSession: SessionData;
  currentOffStreak: number;
  settings: TrackerSettings;
}

export interface DailyHistoryRecord {
  id: number;
  date: string;
  pure_deep_work_minutes: number;
  productivity_score: number;
  goal_achieved: boolean;
}

export const STORAGE_VERSION = 2;
export const DEFAULT_SETTINGS: TrackerSettings = {
  intervalSec: 120,
  goalMinutes: 300,
  autoCheckin: "on",
};

export const MAX_MINUTES_PER_CHECKIN = 5;

export const CATEGORIES: { value: string; label: string }[] = [
  { value: "VS Code / Προγραμματισμός", label: "VS Code / Προγραμματισμός" },
  { value: "Browsing / Έρευνα", label: "Browsing / Έρευνα" },
  { value: "YouTube", label: "YouTube" },
  { value: "Social Media", label: "Social Media (FB, Insta, TikTok)" },
  { value: "AI Tools (Gemini/ChatGPT)", label: "AI Tools (Gemini, ChatGPT)" },
  { value: "Λοιπές Εφαρμογές", label: "Λοιπές Εφαρμογές" },
];

export const HISTORY_COLUMNS =
  "id,date,pure_deep_work_minutes,productivity_score,goal_achieved";

export function defaultSession(): SessionData {
  return {
    onMinutes: 0,
    offMinutes: 0,
    onCategories: {},
    offCategories: {},
    startedAt: null,
    lastCheckAt: null,
  };
}

export function defaultTrackerData(lastDate: string): TrackerData {
  return {
    version: STORAGE_VERSION,
    lastDate,
    isSessionActive: false,
    dailyOnMinutes: 0,
    dailyOffMinutes: 0,
    dailyAutoOnMinutes: 0,
    dailyOnCategories: {},
    dailyOffCategories: {},
    currentSession: defaultSession(),
    currentOffStreak: 0,
    settings: { ...DEFAULT_SETTINGS },
  };
}

export function migrateData(raw: unknown, today: string): TrackerData {
  const base = defaultTrackerData(today);
  if (!raw || typeof raw !== "object") return base;
  const r = raw as Record<string, unknown>;
  const merged: TrackerData = {
    ...base,
    ...(r as Partial<TrackerData>),
    version: STORAGE_VERSION,
    settings: {
      ...DEFAULT_SETTINGS,
      ...((r.settings as Partial<TrackerSettings>) || {}),
    },
  };
  const sRaw = (r.currentSession as Partial<SessionData>) || {};
  merged.currentSession = {
    ...defaultSession(),
    onMinutes: numOr(sRaw.onMinutes, 0),
    offMinutes: numOr(sRaw.offMinutes, 0),
    onCategories: (sRaw.onCategories as CategoryMap) || {},
    offCategories: (sRaw.offCategories as CategoryMap) || {},
    startedAt: sRaw.startedAt ?? null,
    lastCheckAt: sRaw.lastCheckAt ?? null,
  };
  merged.lastDate = typeof r.lastDate === "string" ? r.lastDate : today;
  merged.dailyOnMinutes = numOr(r.dailyOnMinutes, 0);
  merged.dailyOffMinutes = numOr(r.dailyOffMinutes, 0);
  merged.dailyAutoOnMinutes = numOr(r.dailyAutoOnMinutes, 0);
  merged.currentOffStreak = numOr(r.currentOffStreak, 0);
  merged.isSessionActive = Boolean(r.isSessionActive);
  return merged;
}

export function numOr(v: unknown, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}
