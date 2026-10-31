import {
  MAX_MINUTES_PER_CHECKIN,
  type DailyHistoryRecord,
  type TrackerData,
} from "./types";

export interface CheckinResult {
  data: TrackerData;
  countedMinutes: number;
}

export function computeElapsedMinutes(
  lastCheckAt: number | null,
  now: number,
  intervalSec: number,
): number {
  if (lastCheckAt === null || !Number.isFinite(lastCheckAt)) {
    return Math.min(
      MAX_MINUTES_PER_CHECKIN,
      Math.max(1, Math.round(intervalSec / 60)),
    );
  }
  const elapsed = Math.round((now - lastCheckAt) / 60000);
  if (elapsed < 0) return 0;
  return Math.min(elapsed, MAX_MINUTES_PER_CHECKIN);
}

export function applyCheckin(
  prev: TrackerData,
  opts: { isOff: boolean; category: string; now: number; isAuto?: boolean },
): CheckinResult {
  const { isOff, category, now, isAuto = false } = opts;
  const session = prev.currentSession;
  const minutes = computeElapsedMinutes(session.lastCheckAt, now, prev.settings.intervalSec);

  const updated: TrackerData = { ...prev };
  const newSession = { ...session, lastCheckAt: now };

  if (minutes <= 0) {
    return { data: updated, countedMinutes: 0 };
  }

  if (isOff) {
    updated.dailyOffMinutes = prev.dailyOffMinutes + minutes;
    updated.dailyOffCategories = {
      ...prev.dailyOffCategories,
      [category]: (prev.dailyOffCategories[category] || 0) + minutes,
    };
    newSession.offMinutes = session.offMinutes + minutes;
    newSession.offCategories = {
      ...session.offCategories,
      [category]: (session.offCategories[category] || 0) + minutes,
    };
    updated.currentOffStreak = prev.currentOffStreak + minutes;
  } else {
    updated.dailyOnMinutes = prev.dailyOnMinutes + minutes;
    updated.dailyOnCategories = {
      ...prev.dailyOnCategories,
      [category]: (prev.dailyOnCategories[category] || 0) + minutes,
    };
    newSession.onMinutes = session.onMinutes + minutes;
    newSession.onCategories = {
      ...session.onCategories,
      [category]: (session.onCategories[category] || 0) + minutes,
    };
    updated.currentOffStreak = 0;
    if (isAuto) {
      updated.dailyAutoOnMinutes = prev.dailyAutoOnMinutes + minutes;
    }
  }

  updated.currentSession = newSession;
  return { data: updated, countedMinutes: minutes };
}

export function dayHasActivity(d: TrackerData): boolean {
  return d.dailyOnMinutes > 0 || d.dailyOffMinutes > 0;
}

export function computeScore(onMinutes: number, offMinutes: number): number {
  const total = onMinutes + offMinutes;
  if (total <= 0) return 0;
  return Number(((onMinutes / total) * 100).toFixed(1));
}

export function buildHistoryRow(
  d: TrackerData,
  date: string,
): Omit<DailyHistoryRecord, "id"> {
  return {
    date,
    pure_deep_work_minutes: d.dailyOnMinutes,
    productivity_score: computeScore(d.dailyOnMinutes, d.dailyOffMinutes),
    goal_achieved: d.dailyOnMinutes >= d.settings.goalMinutes,
  };
}

export function goalProgressPct(onMinutes: number, goalMinutes: number): number {
  if (goalMinutes <= 0) return 0;
  return Math.min(100, (onMinutes / goalMinutes) * 100);
}

export function remainingGoalMinutes(onMinutes: number, goalMinutes: number): number {
  return Math.max(0, goalMinutes - onMinutes);
}
