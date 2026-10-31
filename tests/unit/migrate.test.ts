import { describe, expect, it } from "vitest";
import { defaultTrackerData, migrateData, STORAGE_VERSION } from "../../src/lib/types";

describe("migrateData", () => {
  it("πλήρωσε default σε παλιά v1 blob (χωρίς settings/startedAt/lastCheckAt)", () => {
    const v1 = {
      lastDate: "2026-10-30",
      isSessionActive: true,
      dailyOnMinutes: 6,
      dailyOffMinutes: 2,
      dailyOnCategories: { "VS Code / Προγραμματισμός": 6 },
      dailyOffCategories: { "VS Code / Προγραμματισμός": 2 },
      currentSession: {
        onMinutes: 6,
        offMinutes: 2,
        onCategories: { "VS Code / Προγραμματισμός": 6 },
        offCategories: {},
      },
      currentOffStreak: 0,
    };
    const d = migrateData(v1, "2026-10-31");
    expect(d.version).toBe(STORAGE_VERSION);
    expect(d.lastDate).toBe("2026-10-30");
    expect(d.dailyOnMinutes).toBe(6);
    expect(d.dailyAutoOnMinutes).toBe(0);
    expect(d.settings).toEqual({ intervalSec: 120, goalMinutes: 300, autoCheckin: "on" });
    expect(d.currentSession.startedAt).toBeNull();
    expect(d.currentSession.lastCheckAt).toBeNull();
  });

  it("null/κατεστραμμένο input → fresh defaults με τη σημερινή ημερομηνία", () => {
    const d = migrateData(null, "2026-10-31");
    expect(d).toEqual(defaultTrackerData("2026-10-31"));
    expect(migrateData("junk", "2026-10-31").lastDate).toBe("2026-10-31");
  });

  it("διατηρεί έγκυρα πεδία και φιλτράρει μη-αριθμητικά τιμές", () => {
    const d = migrateData(
      { dailyOnMinutes: "10", dailyOffMinutes: 5, settings: { goalMinutes: 240 } },
      "2026-10-31",
    );
    expect(d.dailyOnMinutes).toBe(0); // string απορρίπτεται
    expect(d.dailyOffMinutes).toBe(5);
    expect(d.settings.goalMinutes).toBe(240);
    expect(d.settings.intervalSec).toBe(120);
  });
});
