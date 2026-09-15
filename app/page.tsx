"use client";

import React, { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";

interface CategoryMap {
  [key: string]: number;
}

interface SessionData {
  onMinutes: number;
  offMinutes: number;
  onCategories: CategoryMap;
  offCategories: CategoryMap;
}

interface TrackerData {
  lastDate?: string;
  isSessionActive: boolean;
  dailyOnMinutes: number;
  dailyOffMinutes: number;
  dailyOnCategories: CategoryMap;
  dailyOffCategories: CategoryMap;
  currentSession: SessionData;
  currentOffStreak: number;
}

interface DailyHistoryRecord {
  id: number;
  date: string;
  pure_deep_work_minutes: number;
  productivity_score: number;
  goal_achieved: boolean;
}

const CHECK_INTERVAL_SEC = 120; // 2 λεπτά
const GOAL_MINUTES = 300; // Στόχος 5 ώρες Deep Work (300 λεπτά)
const AUTO_CHECKIN_SEC = 10; // 10 δευτερόλεπτα διορία για απάντηση

const DEFAULT_TRACKER_DATA: TrackerData = {
  lastDate: new Date().toISOString().split("T")[0],
  isSessionActive: false,
  dailyOnMinutes: 0,
  dailyOffMinutes: 0,
  dailyOnCategories: {},
  dailyOffCategories: {},
  currentSession: {
    onMinutes: 0,
    offMinutes: 0,
    onCategories: {},
    offCategories: {},
  },
  currentOffStreak: 0,
};

export default function Home() {
  const [data, setData] = useState<TrackerData>(DEFAULT_TRACKER_DATA);
  const [history, setHistory] = useState<DailyHistoryRecord[]>([]);
  const [mounted, setMounted] = useState<boolean>(false);
  const [isLoaded, setIsLoaded] = useState<boolean>(false);
  const [timeLeft, setTimeLeft] = useState<number>(CHECK_INTERVAL_SEC);
  const [showPrompt, setShowPrompt] = useState<boolean>(false);
  const [autoTimeoutLeft, setAutoTimeoutLeft] = useState<number>(AUTO_CHECKIN_SEC);
  const [selectedCategory, setSelectedCategory] = useState<string>("VS Code / Προγραμματισμός");

  const selectedCategoryRef = useRef(selectedCategory);
  useEffect(() => {
    selectedCategoryRef.current = selectedCategory;
  }, [selectedCategory]);

  // Φόρτωση Ιστορικού
  const loadHistory = async () => {
    const { data: historyLogs, error } = await supabase
      .from("daily_history")
      .select("*")
      .order("date", { ascending: false })
      .limit(10);

    if (!error && historyLogs) {
      setHistory(historyLogs);
      return historyLogs;
    }
    return [];
  };

  // Διαγραφή Εγγραφής από το Ιστορικό
  const handleDeleteHistory = async (id: number) => {
    if (!confirm("Είσαι σίγουρος ότι θέλεις να διαγράψεις αυτή την εγγραφή από το ιστορικό;")) {
      return;
    }

    const { error } = await supabase
      .from("daily_history")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("❌ [Supabase Delete Error]:", error);
      alert("Σφάλμα κατά τη διαγραφή της εγγραφής.");
    } else {
      await loadHistory();
    }
  };

  // 1. Φόρτωση δεδομένων από το Supabase & Έλεγχος αλλαγής ημερομηνίας
  useEffect(() => {
    const loadDataFromCloud = async () => {
      setMounted(true);
      const today = new Date().toISOString().split("T")[0];

      // Πρώτα φορτώνουμε το ιστορικό
      const historyLogs = await loadHistory();
      const todayHistoryRecord = historyLogs.find((h: DailyHistoryRecord) => h.date === today);

      const { data: logs, error } = await supabase
        .from("productivity_logs")
        .select("data")
        .eq("id", 1)
        .single();

      let initialData: TrackerData = { ...DEFAULT_TRACKER_DATA, lastDate: today };

      if (!error && logs && logs.data) {
        const cloudData: TrackerData = {
          ...DEFAULT_TRACKER_DATA,
          ...logs.data,
          currentSession: {
            ...DEFAULT_TRACKER_DATA.currentSession,
            ...(logs.data.currentSession || {}),
          },
        };

        const lastDate = cloudData.lastDate || today;

        if (lastDate !== today) {
          // Αν η ημερομηνία άλλαξε, αποθηκεύουμε την προηγούμενη ημέρα
          await saveDayToHistory(cloudData, lastDate);

          // Αν υπάρχει ήδη εγγραφή για τη σημερινή μέρα στο ιστορικό, ανακτούμε τα λεπτά
          if (todayHistoryRecord) {
            initialData = {
              ...DEFAULT_TRACKER_DATA,
              lastDate: today,
              dailyOnMinutes: todayHistoryRecord.pure_deep_work_minutes || 0,
            };
          }
        } else {
          // Αν είναι η ίδια μέρα, κρατάμε τα cloud data, αλλά αν τα dailyOnMinutes είναι 0 και υπάρχει ιστορικό για σήμερα, παίρνουμε τις τιμές του ιστορικού
          initialData = cloudData;
          if (initialData.dailyOnMinutes === 0 && todayHistoryRecord) {
            initialData.dailyOnMinutes = todayHistoryRecord.pure_deep_work_minutes || 0;
          }
        }
      } else if (todayHistoryRecord) {
        // Αν δεν υπήρχε productivity_log αλλά υπάρχει ιστορικό για σήμερα
        initialData.dailyOnMinutes = todayHistoryRecord.pure_deep_work_minutes || 0;
      }

      setData(initialData);
      await supabase.from("productivity_logs").upsert({ id: 1, data: initialData });
      setIsLoaded(true);
    };

    loadDataFromCloud();
  }, []);

  // 2. Αποθήκευση στο Supabase σε κάθε αλλαγή
  useEffect(() => {
    if (mounted && isLoaded) {
      const saveDataToCloud = async () => {
        const today = new Date().toISOString().split("T")[0];
        const dataToSave = { ...data, lastDate: today };

        await supabase
          .from("productivity_logs")
          .upsert({ id: 1, data: dataToSave });
      };

      saveDataToCloud();
    }
  }, [data, mounted, isLoaded]);

  // 3. Χρονόμετρο countdown 2 λεπτών
  useEffect(() => {
    if (!mounted || !isLoaded || !data.isSessionActive || showPrompt) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          setShowPrompt(true);
          setAutoTimeoutLeft(AUTO_CHECKIN_SEC);
          triggerNotification();
          return CHECK_INTERVAL_SEC;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [mounted, isLoaded, data.isSessionActive, showPrompt]);

  // 4. Χρονόμετρο 10 δευτερολέπτων για Αυτόματο Check-in
  useEffect(() => {
    if (!showPrompt) return;

    const autoTimer = setInterval(() => {
      setAutoTimeoutLeft((prev) => {
        if (prev <= 1) {
          handleCheckin(false);
          return AUTO_CHECKIN_SEC;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(autoTimer);
  }, [showPrompt]);

  const triggerNotification = () => {
    try {
      const audioCtx = new (window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.type = "sine";
      osc.frequency.setValueAtTime(587.33, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.3);
    } catch (e) {
      console.error("Audio error", e);
    }

    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "granted") {
        const notif = new Notification("🧠 Deep Work Check-in", {
          body: "Πέρασαν 2 λεπτά! (Αυτόματο ON σε 10 δευτερόλεπτα)",
          requireInteraction: true,
        });

        notif.onclick = () => {
          window.focus();
          notif.close();
        };
      }
    }
  };

  const requestNotificationPermission = () => {
    if (typeof window !== "undefined" && "Notification" in window) {
      Notification.requestPermission();
    }
  };

  const handleCheckin = (isOff: boolean) => {
    const intervalMins = CHECK_INTERVAL_SEC / 60;
    const catToUse = selectedCategoryRef.current;

    setData((prev) => {
      const currentSess = prev.currentSession || DEFAULT_TRACKER_DATA.currentSession;
      const updated = { ...prev };

      if (isOff) {
        updated.dailyOffMinutes += intervalMins;
        updated.dailyOffCategories = {
          ...updated.dailyOffCategories,
          [catToUse]: (updated.dailyOffCategories[catToUse] || 0) + intervalMins,
        };
        updated.currentSession = {
          ...currentSess,
          offMinutes: currentSess.offMinutes + intervalMins,
          offCategories: {
            ...currentSess.offCategories,
            [catToUse]: (currentSess.offCategories[catToUse] || 0) + intervalMins,
          },
        };
        updated.currentOffStreak += intervalMins;
      } else {
        updated.dailyOnMinutes += intervalMins;
        updated.dailyOnCategories = {
          ...updated.dailyOnCategories,
          [catToUse]: (updated.dailyOnCategories[catToUse] || 0) + intervalMins,
        };
        updated.currentSession = {
          ...currentSess,
          onMinutes: currentSess.onMinutes + intervalMins,
          onCategories: {
            ...currentSess.onCategories,
            [catToUse]: (currentSess.onCategories[catToUse] || 0) + intervalMins,
          },
        };
        updated.currentOffStreak = 0;
      }
      return updated;
    });

    setShowPrompt(false);
    setTimeLeft(CHECK_INTERVAL_SEC);
  };

  const handleStartSession = () => {
    setData((prev) => ({
      ...prev,
      isSessionActive: true,
      currentSession: {
        onMinutes: 0,
        offMinutes: 0,
        onCategories: {},
        offCategories: {},
      },
    }));
    setTimeLeft(CHECK_INTERVAL_SEC);
  };

  const handlePauseSession = () => {
    setData((prev) => ({
      ...prev,
      isSessionActive: false,
    }));
  };

  const handleEndSession = () => {
    setData((prev) => ({
      ...prev,
      isSessionActive: false,
    }));
    setShowPrompt(false);
  };

  const saveDayToHistory = async (sessionData: TrackerData, sessionDate: string) => {
    const pureMins = sessionData.dailyOnMinutes || 0;
    const totalMins = pureMins + (sessionData.dailyOffMinutes || 0);
    const score = totalMins > 0 ? Number(((pureMins / totalMins) * 100).toFixed(1)) : 100;
    const isGoalAchieved = pureMins >= GOAL_MINUTES;

    await supabase.from("daily_history").upsert({
      date: sessionDate,
      pure_deep_work_minutes: pureMins,
      productivity_score: score,
      goal_achieved: isGoalAchieved,
    });

    await loadHistory();
  };

  const handleEndDay = async () => {
    if (!confirm("Είσαι σίγουρος ότι θέλεις να τερματίσεις ολόκληρη τη σημερινή ημέρα και να την αποθηκεύσεις στο ιστορικό;")) {
      return;
    }

    const today = new Date().toISOString().split("T")[0];
    await saveDayToHistory(data, today);

    const freshData: TrackerData = {
      ...DEFAULT_TRACKER_DATA,
      lastDate: today,
    };

    setData(freshData);
    await supabase.from("productivity_logs").upsert({ id: 1, data: freshData });
    alert("Η σημερινή ημέρα αποθηκεύτηκε στο ιστορικό!");
  };

  // --- ΥΠΟΛΟΓΙΣΜΟΙ ΔΕΔΟΜΕΝΩΝ & ΣΤΟΧΟΥ ---

  const pureDeepWorkMinutes = data.dailyOnMinutes || 0;
  const remainingGoalMinutes = Math.max(0, GOAL_MINUTES - pureDeepWorkMinutes);
  const goalProgressPct = Math.min(100, (pureDeepWorkMinutes / GOAL_MINUTES) * 100);

  const totalDailyMinutes = pureDeepWorkMinutes + (data.dailyOffMinutes || 0);
  const dailyProductivityScore =
    totalDailyMinutes > 0 ? ((pureDeepWorkMinutes / totalDailyMinutes) * 100).toFixed(1) : "100.0";

  const currentSessionOnMins = data.currentSession?.onMinutes || 0;

  const formatMins = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h > 0 ? `${h}ώ ${m}λ` : `${m}λ`;
  };

  const formatTimer = (sec: number) => {
    const m = String(Math.floor(sec / 60)).padStart(2, "0");
    const s = String(sec % 60).padStart(2, "0");
    return `${m}:${s}`;
  };

  if (!mounted || !isLoaded) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center font-sans">
        <div className="text-sm text-slate-400 animate-pulse">Φόρτωση Deep Work Tracker...</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-6 font-sans">
      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex justify-between items-center border-b border-slate-800 pb-4">
          <div>
            <h1 className="text-2xl font-bold text-indigo-400">⚡ Deep Work Tracker</h1>
            <p className="text-xs text-slate-400">Κράτα την εστίασή σου στο 100%</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={requestNotificationPermission}
              className="text-xs px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded border border-slate-700 transition"
            >
              🔔 Ειδοποιήσεις
            </button>
            
            {!data.isSessionActive ? (
              <button
                onClick={handleStartSession}
                className="text-xs px-4 py-1.5 font-bold rounded bg-emerald-600 hover:bg-emerald-500 text-white transition shadow-lg"
              >
                ▶️ Έναρξη Συνεδρίας
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
          </div>
        </div>

        {/* Target 5 Hours Deep Work Banner */}
        <div className="bg-gradient-to-r from-indigo-950 via-slate-900 to-slate-900 border border-indigo-500/30 p-5 rounded-xl space-y-3 shadow-lg">
          <div className="flex justify-between items-center">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-indigo-400">
                🎯 Συνολικός Ημερήσιος Στόχος Deep Work (5 ώρες)
              </span>
              <div className="text-2xl font-extrabold text-white mt-1">
                {formatMins(pureDeepWorkMinutes)} <span className="text-sm font-normal text-slate-400">/ 5ώ 0λ</span>
              </div>
            </div>
            <div className="text-right">
              {remainingGoalMinutes > 0 ? (
                <div>
                  <span className="text-xs text-slate-400">Απομένουν ακόμη:</span>
                  <div className="text-lg font-bold text-amber-400">{formatMins(remainingGoalMinutes)}</div>
                </div>
              ) : (
                <span className="inline-block bg-emerald-500/20 text-emerald-300 text-xs px-3 py-1.5 rounded-full border border-emerald-500/50 font-bold">
                  🎉 Ο στόχος επιτεύχθηκε!
                </span>
              )}
            </div>
          </div>

          <div className="w-full bg-slate-800 h-3 rounded-full overflow-hidden border border-slate-700/50">
            <div
              className="bg-gradient-to-r from-indigo-500 to-emerald-400 h-full transition-all duration-500"
              style={{ width: `${goalProgressPct}%` }}
            ></div>
          </div>
        </div>

        {/* Check-in Modal Card */}
        {showPrompt && data.isSessionActive && (
          <div className="bg-slate-900 border-2 border-amber-500/80 p-6 rounded-xl shadow-2xl space-y-4 animate-pulse">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold text-amber-400">⚠️ Έλεγχος Παραγωγικότητας!</h2>
              <span className="text-xs px-2.5 py-1 bg-amber-500/20 border border-amber-500/40 text-amber-300 font-mono font-bold rounded-full">
                ⏱️ Αυτόματο ON σε {autoTimeoutLeft}s
              </span>
            </div>
            <p className="text-sm text-slate-300">
              Πού ξόδεψες τα τελευταία 2 λεπτά;
            </p>

            <div>
              <label className="block text-xs mb-1 text-slate-400">Κατηγορία/Εφαρμογή:</label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
              >
                <option value="VS Code / Προγραμματισμός">VS Code / Προγραμματισμός</option>
                <option value="Browsing / Έρευνα">Browsing / Έρευνα</option>
                <option value="YouTube">YouTube</option>
                <option value="Social Media">Social Media (FB, Insta, TikTok)</option>
                <option value="AI Tools (Gemini/ChatGPT)">AI Tools (Gemini, ChatGPT)</option>
                <option value="Λοιπές Εφαρμογές">Λοιπές Εφαρμογές</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-2">
              <button
                onClick={() => handleCheckin(false)}
                className="bg-emerald-600 hover:bg-emerald-500 font-bold py-3 rounded-lg text-white transition"
              >
                ✅ ON Schedule (Deep Work)
              </button>
              <button
                onClick={() => handleCheckin(true)}
                className="bg-rose-600 hover:bg-rose-500 font-bold py-3 rounded-lg text-white transition"
              >
                ❌ OFF Schedule (Χάζεμα)
                {data.currentOffStreak > 0 && (
                  <span className="block text-xs font-normal">
                    (Streak: {data.currentOffStreak + 2}λ)
                  </span>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Current Session vs Daily Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl text-center">
            <span className="text-xs text-slate-400 font-semibold uppercase">Ημερήσιο Score</span>
            <div className="text-3xl font-extrabold text-indigo-400 my-1">{dailyProductivityScore}%</div>
            <span className="text-xs text-slate-500">Σύνολο Ημέρας</span>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl text-center">
            <span className="text-xs text-slate-400 font-semibold uppercase">Συνολικό ON Ημέρας</span>
            <div className="text-3xl font-bold text-emerald-400 my-1">{formatMins(data.dailyOnMinutes || 0)}</div>
            <span className="text-xs text-slate-500">Όλες οι Συνεδρίες</span>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl text-center">
            <span className="text-xs text-slate-400 font-semibold uppercase">Τρέχουσα Συνεδρία ON</span>
            <div className="text-3xl font-bold text-emerald-300 my-1">{formatMins(currentSessionOnMins)}</div>
            <span className="text-xs text-slate-500">Ενεργή συνεδρία</span>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl text-center">
            <span className="text-xs text-slate-400 font-semibold uppercase">Συνολικό OFF Ημέρας</span>
            <div className="text-3xl font-bold text-rose-400 my-1">{formatMins(data.dailyOffMinutes || 0)}</div>
            <span className="text-xs text-slate-500">Εκτός προγράμματος</span>
          </div>
        </div>

        {/* Countdown Bar */}
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-2">
          <div className="flex justify-between text-xs text-slate-400">
            <span>
              {data.isSessionActive ? "Επόμενος έλεγχος σε:" : "Η συνεδρία είναι σε παύση/αδράνεια."}
            </span>
            {data.isSessionActive && (
              <span className="font-mono font-bold text-indigo-400">{formatTimer(timeLeft)}</span>
            )}
          </div>
          <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-1000 ${
                data.isSessionActive ? "bg-indigo-500" : "bg-slate-700"
              }`}
              style={{ width: data.isSessionActive ? `${(timeLeft / CHECK_INTERVAL_SEC) * 100}%` : "0%" }}
            ></div>
          </div>
        </div>

        {/* Category Breakdown */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-3">
            <h3 className="text-sm font-semibold text-emerald-400 border-b border-slate-800 pb-2">
              ✅ Ημερήσιο Αναλυτικό ON
            </h3>
            <ul className="space-y-2 text-sm">
              {!data.dailyOnCategories || Object.entries(data.dailyOnCategories).length === 0 ? (
                <li className="text-slate-500 text-xs italic">Καμία καταγραφή ακόμα ⏱️</li>
              ) : (
                Object.entries(data.dailyOnCategories).map(([cat, mins]) => (
                  <li key={cat} className="flex justify-between text-slate-300 border-b border-slate-800/50 pb-1">
                    <span>{cat}</span>
                    <span className="font-mono font-bold text-emerald-400">{formatMins(mins)}</span>
                  </li>
                ))
              )}
            </ul>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-3">
            <h3 className="text-sm font-semibold text-rose-400 border-b border-slate-800 pb-2">
              ❌ Ημερήσιο Αναλυτικό OFF
            </h3>
            <ul className="space-y-2 text-sm">
              {!data.dailyOffCategories || Object.entries(data.dailyOffCategories).length === 0 ? (
                <li className="text-slate-500 text-xs italic">Καμία καταγραφή ακόμα 👍</li>
              ) : (
                Object.entries(data.dailyOffCategories).map(([cat, mins]) => (
                  <li key={cat} className="flex justify-between text-slate-300 border-b border-slate-800/50 pb-1">
                    <span>{cat}</span>
                    <span className="font-mono font-bold text-rose-400">{formatMins(mins)}</span>
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>

        {/* Daily History Section */}
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl space-y-3">
          <h3 className="text-sm font-semibold text-indigo-400 border-b border-slate-800 pb-2 flex justify-between items-center">
            <span>📅 Ιστορικό Προηγούμενων Ημερών</span>
            <span className="text-xs text-slate-500 font-normal">Τελευταίες 10 ημέρες</span>
          </h3>

          {history.length === 0 ? (
            <p className="text-xs text-slate-500 italic">Δεν υπάρχει ακόμα αποθηκευμένο ιστορικό.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-800/50 text-slate-400 uppercase">
                  <tr>
                    <th className="p-2.5 rounded-l">Ημερομηνία</th>
                    <th className="p-2.5">Deep Work</th>
                    <th className="p-2.5">Score</th>
                    <th className="p-2.5">Στόχος (5ώ)</th>
                    <th className="p-2.5 text-right rounded-r">Ενέργειες</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {history.map((rec) => (
                    <tr key={rec.id} className="hover:bg-slate-800/30 transition">
                      <td className="p-2.5 font-mono text-slate-200">{rec.date}</td>
                      <td className="p-2.5 font-bold text-emerald-400">{formatMins(rec.pure_deep_work_minutes)}</td>
                      <td className="p-2.5 font-mono text-indigo-400">{rec.productivity_score}%</td>
                      <td className="p-2.5">
                        {rec.goal_achieved ? (
                          <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 rounded font-bold">
                            ✅ Επιτεύχθηκε
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 bg-slate-800 text-slate-400 border border-slate-700 rounded">
                            ❌ Εκτός στόχου
                          </span>
                        )}
                      </td>
                      <td className="p-2.5 text-right">
                        <button
                          onClick={() => handleDeleteHistory(rec.id)}
                          className="px-2 py-1 bg-rose-950 hover:bg-rose-900 text-rose-300 border border-rose-800 rounded transition"
                          title="Διαγραφή εγγραφής"
                        >
                          🗑️
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </main>
  );
}