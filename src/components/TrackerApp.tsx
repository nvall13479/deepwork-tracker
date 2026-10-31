"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { signOut as clearSessionCookies } from "../../app/actions";
import { useAuth } from "@/hooks/useAuth";
import { todayLocal } from "@/lib/dates";
import {
  CATEGORIES,
  HISTORY_COLUMNS,
  defaultTrackerData,
  migrateData,
  type DailyHistoryRecord,
  type TrackerData,
  type TrackerSettings,
} from "@/lib/types";
import {
  applyCheckin,
  buildHistoryRow,
  dayHasActivity,
} from "@/lib/tracker";
import { claimPrimaryTab } from "@/lib/tabs";
import { saveLocalCache, loadLocalCache } from "@/lib/localCache";
import { playChime, requestNotificationPermission, notify } from "@/lib/notify";
import SetupScreen from "@/components/SetupScreen";
import Banner from "@/components/Banner";
import ConfirmDialog from "@/components/ConfirmDialog";
import GoalBanner from "@/components/GoalBanner";
import StatsGrid from "@/components/StatsGrid";
import CountdownBar from "@/components/CountdownBar";
import CheckinModal from "@/components/CheckinModal";
import CategoryBreakdown from "@/components/CategoryBreakdown";
import HistoryTable from "@/components/HistoryTable";
import SettingsPanel from "@/components/SettingsPanel";
import LoginScreen from "@/components/LoginScreen";

const AUTO_CHECKIN_SEC = 10;
const TICK_MS = 1000;
const MAX_SAVE_RETRIES = 5;

interface ConfirmState {
  title: string;
  message: string;
  danger?: boolean;
  action: () => void;
}

export default function TrackerApp({ serverUser }: { serverUser: User | null }) {
  const router = useRouter();
  const user = useAuth(serverUser);
  const uid = user?.id ?? "";
  const [data, setData] = useState<TrackerData>(() => defaultTrackerData(""));
  const [history, setHistory] = useState<DailyHistoryRecord[]>([]);
  const [mounted, setMounted] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [secLeft, setSecLeft] = useState(0);
  const [showPrompt, setShowPrompt] = useState(false);
  const [autoTimeoutLeft, setAutoTimeoutLeft] = useState(AUTO_CHECKIN_SEC);
  const [selectedCategory, setSelectedCategory] = useState(CATEGORIES[0].value);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [secondaryTab, setSecondaryTab] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  const [sessionElapsedSec, setSessionElapsedSec] = useState(0);
  const [loadOk, setLoadOk] = useState(false);

  const dataRef = useRef(data);
  const categoryRef = useRef(selectedCategory);
  const promptOpenRef = useRef(false);
  const autoDeadlineRef = useRef<number | null>(null);
  const rolloverBusyRef = useRef(false);
  const rolloverRetryAtRef = useRef(0);
  const saveRetryRef = useRef(0);

  useEffect(() => {
    dataRef.current = data;
  }, [data]);
  useEffect(() => {
    categoryRef.current = selectedCategory;
  }, [selectedCategory]);
  useEffect(() => {
    promptOpenRef.current = showPrompt;
  }, [showPrompt]);

  const refreshHistory = useCallback(async () => {
    if (!supabase) return;
    const { data: rows, error } = await supabase
      .from("daily_history")
      .select(HISTORY_COLUMNS)
      .eq("user_id", uid)
      .order("date", { ascending: false })
      .limit(10);
    if (!error && rows) setHistory(rows as DailyHistoryRecord[]);
  }, [uid]);

  const persistDay = useCallback(
    async (d: TrackerData, date: string): Promise<boolean> => {
      if (!supabase) return false;
      const { error } = await supabase
        .from("daily_history")
        .upsert({ ...buildHistoryRow(d, date), user_id: uid }, { onConflict: "user_id,date" });
      if (error) {
        console.error("History upsert error:", error);
        setHistoryError(
          `Η ημέρα ${date} δεν αρχειοθετήθηκε (${error.message}) — οι μετρητές δεν μηδενίστηκαν, θα προσπαθήσει ξανά.`,
        );
        return false;
      }
      setHistoryError(null);
      await refreshHistory();
      return true;
    },
    [refreshHistory, uid],
  );

  const closePrompt = useCallback(() => {
    promptOpenRef.current = false;
    setShowPrompt(false);
    setAutoTimeoutLeft(AUTO_CHECKIN_SEC);
  }, []);

  const handleRollover = useCallback(async () => {
    if (rolloverBusyRef.current) return;
    if (Date.now() < rolloverRetryAtRef.current) return;
    rolloverBusyRef.current = true;
    try {
      const d = dataRef.current;
      const today = todayLocal();
      if (d.lastDate === today) return;
      if (dayHasActivity(d)) {
        const ok = await persistDay(d, d.lastDate || today);
        if (!ok) {
          rolloverRetryAtRef.current = Date.now() + 15000;
          return;
        }
      }
      const fresh = defaultTrackerData(today);
      fresh.settings = d.settings;
      if (supabase && uid) {
        const { data: todayRec } = await supabase
          .from("daily_history")
          .select(HISTORY_COLUMNS)
          .eq("user_id", uid)
          .eq("date", today)
          .maybeSingle();
        if (todayRec) fresh.dailyOnMinutes = todayRec.pure_deep_work_minutes || 0;
      }
      if (d.isSessionActive) {
        closePrompt();
        fresh.isSessionActive = true;
        const now = Date.now();
        fresh.currentSession.startedAt = now;
        fresh.currentSession.lastCheckAt = now;
        autoDeadlineRef.current = now + fresh.settings.intervalSec * 1000;
        setSecLeft(fresh.settings.intervalSec);
      }
      setData(fresh);
    } finally {
      rolloverBusyRef.current = false;
    }
  }, [persistDay, closePrompt, uid]);

  const handleCheckin = useCallback((isOff: boolean, isAuto = false) => {
    const now = Date.now();
    const prev = dataRef.current;
    const { data: next } = applyCheckin(prev, {
      isOff,
      category: categoryRef.current,
      now,
      isAuto,
    });
    dataRef.current = next;
    setData(next);
    promptOpenRef.current = false;
    setShowPrompt(false);
    setAutoTimeoutLeft(AUTO_CHECKIN_SEC);
    autoDeadlineRef.current = now + next.settings.intervalSec * 1000;
    setSecLeft(next.settings.intervalSec);
  }, []);

  // 1. Αρχική φόρτωση (μόνο με auth user): own state + migration legacy δεδομένων
  useEffect(() => {
    const load = async () => {
      setMounted(true);
      if (!supabase || !uid) return;
      const today = todayLocal();
      try {
        const [logRes, todayRes] = await Promise.all([
          supabase.from("productivity_logs").select("data").eq("user_id", uid).maybeSingle(),
          supabase
            .from("daily_history")
            .select(HISTORY_COLUMNS)
            .eq("user_id", uid)
            .eq("date", today)
            .maybeSingle(),
        ]);

        if (logRes.error) throw new Error(logRes.error.message);
        if (todayRes.error) console.error("Today history lookup failed:", todayRes.error);

        // Εφάπαξ παραλαβή legacy (pre-auth, user_id null) δεδομένων από τον παλιό tracker
        if (!logRes.data) {
          const { data: legacyBlob } = await supabase
            .from("productivity_logs")
            .select("data")
            .is("user_id", null)
            .eq("id", 1)
            .maybeSingle();
          if (legacyBlob) {
            const { error: claimErr } = await supabase
              .from("productivity_logs")
              .upsert({ user_id: uid, data: legacyBlob.data ?? legacyBlob }, { onConflict: "user_id" });
            if (!claimErr) {
              await supabase.from("productivity_logs").delete().is("user_id", null);
              logRes.data = { data: legacyBlob.data };
            }
          }
        }
        const { data: legacyHist } = await supabase
          .from("daily_history")
          .select(HISTORY_COLUMNS)
          .is("user_id", null)
          .limit(500);
        if (legacyHist && legacyHist.length > 0) {
          const { error: histClaimErr } = await supabase.from("daily_history").upsert(
            legacyHist.map((r) => ({
              date: r.date,
              pure_deep_work_minutes: r.pure_deep_work_minutes,
              productivity_score: r.productivity_score,
              goal_achieved: r.goal_achieved,
              user_id: uid,
            })),
            { onConflict: "user_id,date" },
          );
          if (!histClaimErr) {
            await supabase.from("daily_history").delete().is("user_id", null);
          }
        }
        setLoadOk(true);

        let d = migrateData(logRes.data?.data ?? null, today);
        const todayRec = todayRes.data;

        if (d.lastDate !== today) {
          let archived = true;
          if (dayHasActivity(d)) {
            archived = await persistDay(d, d.lastDate);
            if (!archived) rolloverRetryAtRef.current = Date.now() + 15000;
          }
          if (archived) {
            const fresh = defaultTrackerData(today);
            fresh.settings = d.settings;
            if (todayRec) fresh.dailyOnMinutes = todayRec.pure_deep_work_minutes || 0;
            if (d.isSessionActive) {
              closePrompt();
              fresh.isSessionActive = true;
              const now = Date.now();
              fresh.currentSession.startedAt = now;
              fresh.currentSession.lastCheckAt = now;
              autoDeadlineRef.current = now + fresh.settings.intervalSec * 1000;
              setSecLeft(fresh.settings.intervalSec);
            }
            d = fresh;
          }
        } else if (d.dailyOnMinutes === 0 && todayRec) {
          d.dailyOnMinutes = todayRec.pure_deep_work_minutes || 0;
        }

        if (d.isSessionActive && d.currentSession.lastCheckAt) {
          autoDeadlineRef.current =
            d.currentSession.lastCheckAt + d.settings.intervalSec * 1000;
        }

        setData(d);
        setLoadError(null);
        await refreshHistory();
      } catch (e) {
        console.error("Cloud load failed:", e);
        setLoadError(
          "Αποτύχησε η ανάγνωση από το cloud — φορτώθηκε τοπικό αντίγραφο ασφαλείας. Η εφαρμογή είναι σε read-only μέχρι να επανασυνδεθείς.",
        );
        const cached = loadLocalCache();
        const d = migrateData(cached, todayLocal());
        setData(d);
      }
      setIsLoaded(true);
    };
    load();
  }, [persistDay, refreshHistory, closePrompt, uid]);

  // 2. Multi-tab lock: μόνο ένα tab γράφει/μετράει
  useEffect(() => {
    let active = true;
    let release: (() => void) | null = null;
    claimPrimaryTab((secondary) => {
      if (active) setSecondaryTab(secondary);
    }).then((r) => {
      if (active) {
        release = r;
      } else {
        r();
      }
    });
    return () => {
      active = false;
      release?.();
    };
  }, []);

  // 3. Tick loop: countdown, prompt, auto check-in, live rollover — όλα από timestamps
  useEffect(() => {
    if (!mounted || !isLoaded || secondaryTab) return;
    const tick = () => {
      const d = dataRef.current;
      const now = Date.now();

      if (d.lastDate && d.lastDate !== todayLocal()) {
        void handleRollover();
        return;
      }

      if (!d.isSessionActive) {
        setSecLeft(0);
        setSessionElapsedSec(0);
        if (promptOpenRef.current) {
          promptOpenRef.current = false;
          setShowPrompt(false);
        }
        return;
      }

      if (d.currentSession.startedAt) {
        setSessionElapsedSec(Math.floor((now - d.currentSession.startedAt) / 1000));
      }

      if (autoDeadlineRef.current === null) {
        const anchor = d.currentSession.lastCheckAt ?? now;
        autoDeadlineRef.current = anchor + d.settings.intervalSec * 1000;
      }

      const remaining = autoDeadlineRef.current - now;
      if (!promptOpenRef.current) {
        setSecLeft(Math.max(0, Math.ceil(remaining / 1000)));
        if (remaining <= 0) {
          autoDeadlineRef.current = now + AUTO_CHECKIN_SEC * 1000;
          promptOpenRef.current = true;
          setShowPrompt(true);
          setAutoTimeoutLeft(AUTO_CHECKIN_SEC);
          playChime();
          notify(
            "🧠 Deep Work Check-in",
            `Έλεγχος! Αυτόματο ${d.settings.autoCheckin.toUpperCase()} σε ${AUTO_CHECKIN_SEC} δευτερόλεπτα.`,
          );
        }
      } else {
        const autoLeft = Math.ceil(remaining / 1000);
        setAutoTimeoutLeft(Math.max(0, autoLeft));
        if (autoLeft <= 0) {
          handleCheckin(d.settings.autoCheckin === "off", true);
        }
      }
    };
    tick();
    const id = setInterval(tick, TICK_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [mounted, isLoaded, secondaryTab, handleRollover, handleCheckin]);

  // 4. Save στο cloud με retry + localStorage mirror — ΜΟΝΟ μετά auth + επιτυχημένο read
  useEffect(() => {
    if (!mounted || !isLoaded || !loadOk || !uid || secondaryTab || !supabase) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    saveLocalCache(data);

    const attempt = async () => {
      if (cancelled || !supabase) return;
      const { error } = await supabase
        .from("productivity_logs")
        .upsert({ user_id: uid, data }, { onConflict: "user_id" });
      if (cancelled) return;
      if (error) {
        setSaveError("Σύνδεση με το cloud χάλασε — γίνεται αυτόματη επανπροσπάθεια.");
        if (saveRetryRef.current < MAX_SAVE_RETRIES) {
          const delay = Math.min(30000, 2000 * Math.pow(2, saveRetryRef.current));
          saveRetryRef.current += 1;
          timer = setTimeout(attempt, delay);
        }
      } else {
        saveRetryRef.current = 0;
        setSaveError(null);
      }
    };
    attempt();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [data, mounted, isLoaded, loadOk, secondaryTab, uid]);

  // --- Handlers (απαγορεύονται σε secondary tab) ---

  const handleStartSession = () => {
    if (secondaryTab) return;
    requestNotificationPermission();
    const now = Date.now();
    setData((prev) => ({
      ...prev,
      isSessionActive: true,
      currentSession: {
        onMinutes: 0,
        offMinutes: 0,
        onCategories: {},
        offCategories: {},
        startedAt: now,
        lastCheckAt: now,
      },
    }));
    autoDeadlineRef.current = now + dataRef.current.settings.intervalSec * 1000;
    setSecLeft(dataRef.current.settings.intervalSec);
  };

  const handlePauseSession = () => {
    if (secondaryTab) return;
    setData((prev) => ({ ...prev, isSessionActive: false }));
    autoDeadlineRef.current = null;
  };

  const handleResumeSession = () => {
    if (secondaryTab) return;
    const now = Date.now();
    setData((prev) => ({
      ...prev,
      isSessionActive: true,
      currentSession: { ...prev.currentSession, lastCheckAt: now },
    }));
    autoDeadlineRef.current = now + dataRef.current.settings.intervalSec * 1000;
    setSecLeft(dataRef.current.settings.intervalSec);
  };

  const handleEndSession = () => {
    if (secondaryTab) return;
    setData((prev) => ({ ...prev, isSessionActive: false }));
    autoDeadlineRef.current = null;
    promptOpenRef.current = false;
    setShowPrompt(false);
  };

  const handleEndDay = () => {
    if (secondaryTab) return;
    setConfirmState({
      title: "Τέλος Ημέρας",
      message:
        "Θέλεις να τερματίσεις ολόκληρη τη σημερινή ημέρα και να την αποθηκεύσεις στο ιστορικό;",
      danger: true,
      action: async () => {
        setConfirmState(null);
        const today = todayLocal();
        if (!dayHasActivity(dataRef.current) && !dataRef.current.isSessionActive) {
          return;
        }
        const archived = await persistDay(dataRef.current, today);
        if (!archived) return;
        const fresh = defaultTrackerData(today);
        fresh.settings = dataRef.current.settings;
        setData(fresh);
        autoDeadlineRef.current = null;
      },
    });
  };

  const handleDeleteHistory = (id: number) => {
    if (secondaryTab) return;
    setConfirmState({
      title: "Διαγραφή εγγραφής",
      message: "Είσαι σίγουρος ότι θέλεις να διαγράψεις αυτή την εγγραφή από το ιστορικό;",
      danger: true,
      action: async () => {
        setConfirmState(null);
        if (!supabase) return;
        const { error } = await supabase.from("daily_history").delete().eq("id", id);
        if (error) {
          console.error("Supabase delete error:", error);
          setSaveError("Το ιστορικό δεν μπόρεσε να διαγραφεί — έλεγξε τη σύνδεση.");
        } else {
          await refreshHistory();
        }
      },
    });
  };

  const handleSaveSettings = (s: TrackerSettings) => {
    if (secondaryTab) return;
    setData((prev) => ({ ...prev, settings: s }));
    setShowSettings(false);
    if (dataRef.current.isSessionActive && !promptOpenRef.current) {
      const now = Date.now();
      autoDeadlineRef.current = now + s.intervalSec * 1000;
      setSecLeft(s.intervalSec);
    }
  };

  const handleLogout = async () => {
    if (secondaryTab) return;
    setConfirmState({
      title: "Αποσύνδεση",
      message: "Θέλεις να αποσυνδεθείς; Τα δεδομένα μένουν αποθηκευμένα στον λογαριασμό σου.",
      danger: true,
      action: async () => {
        setConfirmState(null);
        await supabase?.auth.signOut();
        await clearSessionCookies();
        router.replace("/");
        router.refresh();
      },
    });
  };

  // --- Render ---

  if (!isSupabaseConfigured) return <SetupScreen />;
  if (!user) return <LoginScreen />;
  if (!mounted || !isLoaded) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center font-sans">
        <div className="text-sm text-slate-400 animate-pulse">Φόρτωση Deep Work Tracker...</div>
      </main>
    );
  }

  const totalElapsed = sessionElapsedSec;

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-6 font-sans">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex justify-between items-center border-b border-slate-800 pb-4 gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-indigo-400">⚡ Deep Work Tracker</h1>
            <p className="text-xs text-slate-400">Κράτα την εστίασή σου στο 100%</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {!data.isSessionActive ? (
              <button
                onClick={
                  data.currentSession.startedAt ? handleResumeSession : handleStartSession
                }
                className="text-xs px-4 py-1.5 font-bold rounded bg-emerald-600 hover:bg-emerald-500 text-white transition shadow-lg"
              >
                {data.currentSession.startedAt ? "▶️ Συνέχεια Συνεδρίας" : "▶️ Έναρξη Συνεδρίας"}
              </button>
            ) : (
              <>
                <button
                  onClick={handlePauseSession}
                  className="text-xs px-3 py-1.5 font-bold rounded bg-amber-600 hover:bg-amber-500 text-white transition"
                >
                  ⏸️ Παύση
                </button>
                <button
                  onClick={handleEndSession}
                  className="text-xs px-3 py-1.5 font-bold rounded bg-slate-700 hover:bg-slate-600 text-slate-200 transition"
                >
                  ⏹️ Τέλος Συνεδρίας
                </button>
              </>
            )}
            <button
              onClick={handleEndDay}
              className="text-xs px-3 py-1.5 bg-rose-900/60 hover:bg-rose-800 text-rose-200 border border-rose-700 font-bold rounded transition"
            >
              🌙 Τέλος Ημέρας
            </button>
            <button
              onClick={() => setShowSettings(true)}
              aria-label="Ρυθμίσεις"
              className="text-xs px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded border border-slate-700 transition"
            >
              ⚙️
            </button>
            <button
              onClick={handleLogout}
              aria-label="Αποσύνδεση"
              title={user.email ?? "Αποσύνδεση"}
              className="text-xs px-3 py-1.5 bg-slate-800 hover:bg-rose-900/70 rounded border border-slate-700 transition"
            >
              🚪
            </button>
          </div>
        </div>

        {secondaryTab && (
          <Banner
            tone="warning"
            message="Ο tracker τρέχει ήδη σε άλλη καρτέλα — αυτή η καρτέλα είναι read-only."
          />
        )}
        {loadError && (
          <Banner tone="warning" message={loadError} actionLabel="Επαναφόρτωση" onAction={() => window.location.reload()} />
        )}
        {historyError && !secondaryTab && (
          <Banner
            tone="error"
            message={historyError}
            actionLabel="Απόπειρα ξανά"
            onAction={() => {
              setHistoryError(null);
              rolloverRetryAtRef.current = 0;
            }}
          />
        )}
        {saveError && !secondaryTab && (
          <Banner tone="error" message={saveError} />
        )}

        <GoalBanner
          onMinutes={data.dailyOnMinutes}
          goalMinutes={data.settings.goalMinutes}
          autoMinutes={data.dailyAutoOnMinutes}
        />

        {showPrompt && data.isSessionActive && !secondaryTab && (
          <CheckinModal
            autoTimeoutLeft={autoTimeoutLeft}
            autoDefault={data.settings.autoCheckin}
            intervalSec={data.settings.intervalSec}
            selectedCategory={selectedCategory}
            offStreakMinutes={data.currentOffStreak}
            onSelectCategory={setSelectedCategory}
            onCheckin={(isOff) => handleCheckin(isOff, false)}
          />
        )}

        <StatsGrid
          dailyOnMinutes={data.dailyOnMinutes}
          dailyOffMinutes={data.dailyOffMinutes}
          sessionOnMinutes={data.currentSession.onMinutes}
        />

        <CountdownBar
          active={data.isSessionActive && !showPrompt && !secondaryTab}
          secLeft={secLeft}
          intervalSec={data.settings.intervalSec}
        />

        {data.isSessionActive && totalElapsed > 0 && (
          <p className="text-xs text-slate-500 text-center">
            Συνεδρία σε εξέλιξη: {Math.floor(totalElapsed / 60)} λεπτά πραγματικού χρόνου
          </p>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <CategoryBreakdown
            tone="on"
            title="✅ Ημερήσιο Αναλυτικό ON"
            emptyLabel="Καμία καταγραφή ακόμα ⏱️"
            categories={data.dailyOnCategories}
          />
          <CategoryBreakdown
            tone="off"
            title="❌ Ημερήσιο Αναλυτικό OFF"
            emptyLabel="Καμία καταγραφή ακόμα 👍"
            categories={data.dailyOffCategories}
          />
        </div>

        <HistoryTable history={history} goalMinutes={data.settings.goalMinutes} onDelete={handleDeleteHistory} />
      </div>

      {showSettings && (
        <SettingsPanel
          settings={data.settings}
          onSave={handleSaveSettings}
          onClose={() => setShowSettings(false)}
        />
      )}
      {confirmState && (
        <ConfirmDialog
          title={confirmState.title}
          message={confirmState.message}
          danger={confirmState.danger}
          onConfirm={confirmState.action}
          onCancel={() => setConfirmState(null)}
        />
      )}
    </main>
  );
}
