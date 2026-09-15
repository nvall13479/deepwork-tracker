"use client";

import React, { useState, useEffect } from "react";

interface CategoryMap {
  [key: string]: number;
}

interface TrackerData {
  onMinutes: number;
  offMinutes: number;
  currentOffStreak: number;
  onCategories: CategoryMap;
  offCategories: CategoryMap;
}

const CHECK_INTERVAL_SEC = 120; // 2 λεπτά

export default function Home() {
  const [data, setData] = useState<TrackerData>({
    onMinutes: 0,
    offMinutes: 0,
    currentOffStreak: 0,
    onCategories: { "Βραδινός Ύπνος": 480 },
    offCategories: {},
  });

  const [isActive, setIsActive] = useState<boolean>(true);
  const [timeLeft, setTimeLeft] = useState<number>(CHECK_INTERVAL_SEC);
  const [showPrompt, setShowPrompt] = useState<boolean>(false);
  const [selectedCategory, setSelectedCategory] = useState<string>("VS Code / Προγραμματισμός");

  // Φόρτωση δεδομένων από το localStorage
  useEffect(() => {
    const saved = localStorage.getItem("deepwork_data");
    if (saved) {
      try {
        setData(JSON.parse(saved));
      } catch (e) {
        console.error("Error loading data", e);
      }
    }
  }, []);

  // Αποθήκευση στο localStorage σε κάθε αλλαγή
  useEffect(() => {
    localStorage.setItem("deepwork_data", JSON.stringify(data));
  }, [data]);

  // Χρονόμετρο countdown 2 λεπτών
  useEffect(() => {
    if (!isActive || showPrompt) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          setShowPrompt(true);
          triggerNotification();
          return CHECK_INTERVAL_SEC;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isActive, showPrompt]);

  // Browser Notification
  const triggerNotification = () => {
    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "granted") {
        new Notification("🧠 Deep Work Check-in", {
          body: "Πέρασαν 2 λεπτά! Είσαι focus ή χαζεύεις;",
        });
      }
    }
  };

  const requestNotificationPermission = () => {
    if (typeof window !== "undefined" && "Notification" in window) {
      Notification.requestPermission();
    }
  };

  // Απάντηση στο Check-in (ON / OFF)
  const handleCheckin = (isOff: boolean) => {
    const intervalMins = CHECK_INTERVAL_SEC / 60;

    setData((prev) => {
      const updated = { ...prev };
      if (isOff) {
        updated.offMinutes += intervalMins;
        updated.currentOffStreak += intervalMins;
        updated.offCategories = {
          ...updated.offCategories,
          [selectedCategory]: (updated.offCategories[selectedCategory] || 0) + intervalMins,
        };
      } else {
        updated.onMinutes += intervalMins;
        updated.currentOffStreak = 0; // Μηδενισμός streak αν είσαι ON
        updated.onCategories = {
          ...updated.onCategories,
          [selectedCategory]: (updated.onCategories[selectedCategory] || 0) + intervalMins,
        };
      }
      return updated;
    });

    setShowPrompt(false);
    setTimeLeft(CHECK_INTERVAL_SEC);
  };

  const totalMinutes = data.onMinutes + data.offMinutes;
  const productivityScore =
    totalMinutes > 0 ? ((data.onMinutes / totalMinutes) * 100).toFixed(1) : "100.0";

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
              className="text-xs px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded border border-slate-700"
            >
              🔔 Ειδοποιήσεις
            </button>
            <button
              onClick={() => setIsActive(!isActive)}
              className={`text-xs px-4 py-1.5 font-bold rounded ${
                isActive ? "bg-amber-600 hover:bg-amber-700" : "bg-emerald-600 hover:bg-emerald-700"
              }`}
            >
              {isActive ? "Παύση" : "Έναρξη"}
            </button>
          </div>
        </div>

        {/* Check-in Modal Card */}
        {showPrompt && (
          <div className="bg-slate-900 border-2 border-amber-500/80 p-6 rounded-xl shadow-2xl space-y-4 animate-pulse">
            <h2 className="text-xl font-bold text-amber-400">⚠️ Έλεγχος Παραγωγικότητας!</h2>
            <p className="text-sm text-slate-300">
              Πού ξόδεψες τα τελευταία 2 λεπτά;
            </p>

            <div>
              <label className="block text-xs mb-1 text-slate-400">Κατηγορία/Εφαρμογή:</label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-sm text-slate-200"
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
                className="bg-emerald-600 hover:bg-emerald-500 font-bold py-3 rounded-lg text-white"
              >
                ✅ ON Schedule (Deep Work)
              </button>
              <button
                onClick={() => handleCheckin(true)}
                className="bg-rose-600 hover:bg-rose-500 font-bold py-3 rounded-lg text-white"
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

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl text-center">
            <span className="text-xs text-slate-400 font-semibold uppercase">Productivity Score</span>
            <div className="text-4xl font-extrabold text-indigo-400 my-2">{productivityScore}%</div>
            {data.currentOffStreak > 0 && (
              <span className="inline-block bg-rose-950 text-rose-300 text-xs px-2.5 py-1 rounded-full border border-rose-800 font-semibold">
                🔥 Streak Χαζέματος: {data.currentOffStreak}λ
              </span>
            )}
          </div>

          <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl text-center">
            <span className="text-xs text-slate-400 font-semibold uppercase">Χρόνος ON</span>
            <div className="text-3xl font-bold text-emerald-400 my-2">{formatMins(data.onMinutes)}</div>
            <span className="text-xs text-slate-500">Παραγωγικός / Ύπνος</span>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl text-center">
            <span className="text-xs text-slate-400 font-semibold uppercase">Χρόνος OFF</span>
            <div className="text-3xl font-bold text-rose-400 my-2">{formatMins(data.offMinutes)}</div>
            <span className="text-xs text-slate-500">Εκτός προγράμματος</span>
          </div>
        </div>

        {/* Countdown Bar */}
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-2">
          <div className="flex justify-between text-xs text-slate-400">
            <span>Επόμενος έλεγχος σε:</span>
            <span className="font-mono font-bold text-indigo-400">{formatTimer(timeLeft)}</span>
          </div>
          <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
            <div
              className="bg-indigo-500 h-full transition-all duration-1000"
              style={{ width: `${(timeLeft / CHECK_INTERVAL_SEC) * 100}%` }}
            ></div>
          </div>
        </div>

        {/* Category Breakdown */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-3">
            <h3 className="text-sm font-semibold text-emerald-400 border-b border-slate-800 pb-2">
              ✅ Αναλυτικός χρόνος ON
            </h3>
            <ul className="space-y-2 text-sm">
              {Object.entries(data.onCategories).map(([cat, mins]) => (
                <li key={cat} className="flex justify-between text-slate-300 border-b border-slate-800/50 pb-1">
                  <span>{cat}</span>
                  <span className="font-mono font-bold text-emerald-400">{formatMins(mins)}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-3">
            <h3 className="text-sm font-semibold text-rose-400 border-b border-slate-800 pb-2">
              ❌ Αναλυτικός χρόνος OFF
            </h3>
            <ul className="space-y-2 text-sm">
              {Object.entries(data.offCategories).length === 0 ? (
                <li className="text-slate-500 text-xs italic">Καμία καταγραφή ακόμα 👍</li>
              ) : (
                Object.entries(data.offCategories).map(([cat, mins]) => (
                  <li key={cat} className="flex justify-between text-slate-300 border-b border-slate-800/50 pb-1">
                    <span>{cat}</span>
                    <span className="font-mono font-bold text-rose-400">{formatMins(mins)}</span>
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>

      </div>
    </main>
  );
}