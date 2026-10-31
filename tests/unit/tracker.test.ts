import { describe, expect, it } from "vitest";
import {
  applyCheckin,
  buildHistoryRow,
  computeElapsedMinutes,
  computeScore,
  dayHasActivity,
} from "../../src/lib/tracker";
import { defaultTrackerData, MAX_MINUTES_PER_CHECKIN } from "../../src/lib/types";
import { todayLocal } from "../../src/lib/dates";

const MIN = 60_000;

function activeData(overrides = {}) {
  const d = defaultTrackerData("2026-10-31");
  return {
    ...d,
    isSessionActive: true,
    currentSession: {
      ...d.currentSession,
      startedAt: 1_000_000,
      lastCheckAt: 1_000_000,
    },
    ...overrides,
  };
}

describe("computeElapsedMinutes", () => {
  it("χρησιμοποιεί default interval όταν δεν υπάρχει lastCheckAt (παλιά data)", () => {
    expect(computeElapsedMinutes(null, 500_000, 120)).toBe(2);
  });
  it("μετράει πραγματικό elapsed", () => {
    expect(computeElapsedMinutes(0, 3 * MIN, 120)).toBe(3);
  });
  it("εφαρμόζει cap όταν το tab ήταν frozen", () => {
    expect(computeElapsedMinutes(0, 60 * MIN, 120)).toBe(MAX_MINUTES_PER_CHECKIN);
  });
  it("0 για αρνητικό elapsed (π.χ. αλλαγή timezone/ρανιού)", () => {
    expect(computeElapsedMinutes(10 * MIN, 0, 120)).toBe(0);
  });
});

describe("applyCheckin", () => {
  it("ON: αυξάνει dailyOn, session on, categories, μηδενίζει streak", () => {
    const base = activeData({ currentOffStreak: 4, dailyOffMinutes: 4 });
    const { data, countedMinutes } = applyCheckin(base, {
      isOff: false,
      category: "VS Code",
      now: 1_000_000 + 2 * MIN,
    });
    expect(countedMinutes).toBe(2);
    expect(data.dailyOnMinutes).toBe(2);
    expect(data.currentSession.onMinutes).toBe(2);
    expect(data.dailyOnCategories["VS Code"]).toBe(2);
    expect(data.currentOffStreak).toBe(0);
    expect(data.currentSession.lastCheckAt).toBe(1_000_000 + 2 * MIN);
    expect(data.dailyOffMinutes).toBe(4);
  });
  it("OFF: αυξάνει dailyOff και streak", () => {
    const base = activeData();
    const { data } = applyCheckin(base, {
      isOff: true,
      category: "YouTube",
      now: 1_000_000 + 5 * MIN,
    });
    expect(data.dailyOffMinutes).toBe(MAX_MINUTES_PER_CHECKIN);
    expect(data.currentOffStreak).toBe(MAX_MINUTES_PER_CHECKIN);
    expect(data.dailyOnMinutes).toBe(0);
  });
  it("auto ON μετριέται και στο dailyAutoOnMinutes", () => {
    const base = activeData();
    const { data } = applyCheckin(base, {
      isOff: false,
      category: "VS Code",
      now: 1_000_000 + 2 * MIN,
      isAuto: true,
    });
    expect(data.dailyAutoOnMinutes).toBe(2);
  });
  it("auto OFF δεν πάει στα auto minutes", () => {
    const base = activeData();
    const { data } = applyCheckin(base, {
      isOff: true,
      category: "VS Code",
      now: 1_000_000 + 2 * MIN,
      isAuto: true,
    });
    expect(data.dailyAutoOnMinutes).toBe(0);
    expect(data.dailyOffMinutes).toBe(2);
  });
  it("0 λεπτά = καμία αλλαγή", () => {
    const base = activeData();
    const { data, countedMinutes } = applyCheckin(base, {
      isOff: false,
      category: "VS Code",
      now: 1_000_000,
    });
    expect(countedMinutes).toBe(0);
    expect(data.dailyOnMinutes).toBe(0);
  });
});

describe("computeScore", () => {
  it("0 όταν δεν υπάρχουν δεδομένα (όχι 100%)", () => {
    expect(computeScore(0, 0)).toBe(0);
  });
  it("σωστό ποσοστό", () => {
    expect(computeScore(150, 50)).toBe(75);
  });
});

describe("buildHistoryRow", () => {
  it("χρησιμοποιεί settings.goalMinutes", () => {
    const d = activeData({
      dailyOnMinutes: 300,
      dailyOffMinutes: 0,
      settings: { intervalSec: 120, goalMinutes: 300, autoCheckin: "on" },
    });
    const row = buildHistoryRow(d, "2026-10-31");
    expect(row).toEqual({
      date: "2026-10-31",
      pure_deep_work_minutes: 300,
      productivity_score: 100,
      goal_achieved: true,
    });
  });
});

describe("dayHasActivity", () => {
  it("false για άδεια μέρα", () => {
    expect(dayHasActivity(defaultTrackerData("2026-10-31"))).toBe(false);
  });
  it("true με λεπτά", () => {
    const d = defaultTrackerData("2026-10-31");
    expect(dayHasActivity({ ...d, dailyOnMinutes: 1 })).toBe(true);
  });
});

describe("todayLocal", () => {
  it("τοπική ημερομηνία (όχι UTC) — 23:30 τοπικά στις 31 = 31", () => {
    const d = new Date(2026, 9, 31, 23, 30);
    expect(todayLocal(d)).toBe("2026-10-31");
  });
  it("00:30 τοπικά την 1η = 1η, όχι η προηγούμενη", () => {
    const d = new Date(2026, 10, 1, 0, 30);
    expect(todayLocal(d)).toBe("2026-11-01");
  });
});
