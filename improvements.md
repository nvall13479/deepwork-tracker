# 💡 Deep Work Tracker — Προτάσεις Διορθώσεων & Βελτιώσεων

Ανάλυση του project (Next.js 16.3.5 + React 19 + Tailwind 4 + Supabase). Κατάσταση που επιβεβαιώθηκε τρέχοντας `npm run build` και `eslint`:

- Το **build αποτυγχάνει** χωρίς περιβαλλοντικές μεταβλητές Supabase (crash στο prerender).
- Η ESLint βγάζει **1 σφάλμα + 1 προειδοποίηση** (react-hooks).

---

## 🔴 Κρίσιμα Bugs (διορθώσεις προτεραιότητας)

### 1. Το build σπάει όταν λείπουν τα env vars
`src/lib/supabase.ts:3-6` — Το `createClient('', '')` ρίχνει exception κατά το prerender της σελίδας "/" και ολόκληρη η build αποτυγχάνει. Αυτό σημαίνει ότι το project **δεν μπορεί να γίνει deploy/CI** χωρίς ρυθμισμένα secrets.
**Διόρθωση:**
- Δημιουργία του client μόνο client-side (lazy) ή guard: αν λείπουν τα vars, εμφάνιση σελίδας ρύθμισης αντί για crash.
- Προσθήκη `.env.example` με `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

### 2. Ημερομηνία υπολογίζεται σε UTC, όχι τοπική ώρα
`app/page.tsx:109, 171, 353` — Το `new Date().toISOString().split("T")[0]` δίνει την **UTC** ημερομηνία. Στην Ελλάδα (UTC+2/+3) η μέρα κάνει flip στις 02:00/03:00 τα ξημερώματα, οπότε λεπτά που εργάστηκες π.χ. 00:30–02:00 μετρώνται στην προηγούμενη μέρα.
**Διόρθωση:** τοπική ημερομηνία, π.χ. `new Intl.DateTimeFormat("en-CA").format(new Date())` ή custom `getLocalDate()`.

### 3. Δεν γίνεται rollover αν η εφαρμογή μείνει ανοιχτή μετά τα μεσάνυχτα
Το logic αλλαγής ημερομηνίας τρέχει **μόνο στην αρχική φόρτωση** (`app/page.tsx:106-165`). Αν το tab είναι ανοιχτό κατά την αλλαγή μέρας, το effect `app/page.tsx:168-181` γράφει απλά `lastDate: today` **χωρίς να αρχειοθετήσει την προηγούμενη μέρα και χωρίς μηδενισμό** — τα λεπτά μεταφέρονται λανθασμένα στη νέα μέρα.
**Διόρθωση:** έλεγχος ημερομηνίας σε κάθε tick (ή με `visibilitychange`), αρχειοθέτηση της παλιάς μέρας και live reset των counters.

### 4. Χρονόμετρο με "ticks" αντί για πραγματικό χρόνο → χάνεται χρόνος
Τα 2 λεπτά μετρώνται ως σταθερό interval (`setInterval`, `app/page.tsx:184-200`). Οι browsers **κάνουν throttle** τους timers σε background tabs (1 το λεπτό, και "frozen tabs" μετά από ~5 λεπτά). Αν το tab είναι παρασκήνιο — το φυσιολογικό σενάριο deep work! — check-ins χάνονται, και κάθε check-in μετράει πάντα 2 λεπτά ανεξάρτητα του πραγματικού elapsed.
**Διόρθωση:** timestamp-based accounting — αποθήκευση `lastCheckinAt` και υπολογισμός των πραγματικών λεπτών που πέρασαν κατά το check-in (με cap, π.χ. 5 λεπτά, αν το tab ήταν frozen).

### 5. Απώλεια δεδομένων αν αποτύχει η ανάγνωση από Supabase
`app/page.tsx:123-160` — Η συνθήκη `if (!error && logs...)` μεταχειρίζεται **network error / transient failure** ως "δεν υπάρχουν δεδομένα", φορτώνει defaults (μηδενικά) και μετά το upsert στη γραμμή 160 **διαγράφει το cloud state**. Ένα refresh χωρίς σύνδεση ισοδυναμεί με χάσιμο της ημέρας.
**Διόρθωση:** διαχωρισμός "error" από "empty"; σε περίπτωση error να μη γράφουμε/μηδενίζουμε τίποτα, να δείχνουμε σφάλμα + retry, και να συνεχίζουμε από localStorage cache.

### 6. Δύο tabs/συσκευές διαγράφουν η μία τα δεδομένα της άλλης
Όλη η κατάσταση είναι μία γραμμή (`productivity_logs`, id=1) και κάθε tab κάνει full-blob upsert (`app/page.tsx:168-181`). Με δύο tabs ανοιχτά: διπλομετρήσεις και overwrite (last-writer-wins).
**Διόρθωση:** κλείδωμα tab (BroadcastChannel ή Web Locks API), ή server-side increments (RPC) αντί full-blob writes.

### 7. Λάθος score όταν αρχειοθετείται μέρα με 0 λεπτά
`app/page.tsx:335` — Αν `totalMins === 0`, το score γίνεται **100%**. Μια μέρα χωρίς καμία συνεδρία φαίνεται "τέλεια".
**Διόρθωση:** score `0` ή `null` όταν δεν υπάρχουν δεδομένα.

### 8. react-hooks: ESLint σφάλμα & race στα effects
`app/page.tsx:137` χρησιμοποιεί το `saveDayToHistory` που δηλώνεται στη γραμμή 332 (`react-hooks/immutability` error) + missing dependency warning στο effect (γραμμή 165).
**Διόρθωση:** αναδιάταξη/εξαγωγή των helper functions πριν τα effects (ή refs), ώστε το lint να περνάει clean.

---

## 🔐 Ασφάλεια & Supabase

### 9. RLS πιθανότατα απενεργοποιημένο — το anon key γράφει παντού
Η εφαρμογή διαβάζει/γράφει κατευθείαν με το **anon key** από τον client, σε hardcoded `id=1`. Οποιοσδήποτε γνωρίζει το project URL μπορεί να διαβάσει ή να αλλοιώσει/διαγράψει τα δεδομένα.
**Διόρθωση:**
- Enable **Row Level Security** με policies (τουλάχιστον select/insert/update μόνο για authenticated users).
- Προσθήκη **Supabase Auth** (magic link έστω) ή shared secret, και `user_id` column αντί global id=1.

### 10. Το schema δεν τεκμηριώνεται πουθενά
Δεν υπάρχει `schema.sql`/migrations στο repo, και το upsert στο `daily_history` (γραμμή 338) προϋποθέτει **unique constraint στο `date`** χωρίς να αναγράφεται.
**Διόρθωση:** migration files στο repo + οδηγίες στο README.

### 11. Σιωπηλή αποτυχία στις εγγραφές
Δεν ελέγχεται το `error` στα upsert/delete (`app/page.tsx:174-176, 338-343`). Αν αποτύχει η save, το μαθαίνεις μόνο όταν χάσεις δεδομένα.
**Διόρθωση:** error toast + retry queue in-memory (και offline queue όταν λείπει σύνδεση).

---

## 🧭 Product / UX

### 12. Το auto check-in κάνει default ON → φουσκώνει το deep work
`app/page.tsx:206-213` — Αν δεν απαντήσες μέσα σε 10", μετράει ως **Deep Work**. Τα στατιστικά βγουν "φουσκωμένα".
**Διόρθωση:** ρυθμιζόμενο default (ON/OFF), εμφανιζόμενο στο settings, και ξεχωριστό bucket "auto" check-ins για ειλικρινή stats.

### 13. Hardcoded στόχοι / κατηγορίες / interval
`GOAL_MINUTES=300`, `CHECK_INTERVAL_SEC=120` και η λίστα κατηγοριών (`app/page.tsx:502-507`) είναι hardcoded.
**Διόρθωση:** Settings panel (αποθηκευμένο στο cloud row) — ημερήσιος στόχος, interval, προσαρμόσιμες κατηγορίες ON/OFF με color coding.

### 14. confirm()/alert() αντί in-app UI
`app/page.tsx:88, 349, 363` — native dialogs που μπλοκάρουν τη διεπαφή, κακό UX, δεν ταιριάζουν με το theme.
**Διόρθωση:** custom modal (π.χ. `<dialog>`) + toast notifications.

### 15. Ιστορικό χωρίς analytics
Μόνο πίνακας 10 εγγραφών, χωρίς trends. Το "today" record αναζητάται μέσα στα 10 πιο πρόσφατα (`app/page.tsx:113`) — εύθραυστο.
**Διόρθωση:** ξεχωριστό query για τη σημερινή εγγραφή, weekly/monthly διαγράμματα (recharts), streaks ημερών-στόχων, category share.

### 16. Notification/audio bugs
- Νέο `AudioContext` σε κάθε ειδοποίηση, **ποτέ δεν κλείνει** (`app/page.tsx:221-231`) → memory leak, και το autoplay policy μπλοκάρει τον ήχο χωρίς user gesture.
- Το `requireInteraction` είναι deprecated.
- Το permission request είναι κρυμμένο σε κουμπί — καλύτερα να ζητιέται στην "Έναρξη Συνεδρίας".
**Διόρθωση:** ενιαίο AudioContext που κάνει resume στο πρώτο click, ειδοποιήσεις μέσω service worker/PWA για αξιόπιστα background notifications.

### 17. Προσβασιμότητα & γλώσσα
- `<html lang="en">` σε ελληνικό UI (`app/layout.tsx:26`).
- Metadata ακόμα "Create Next App" (`app/layout.tsx:15-18`).
- Emoji-only κουμπιά (🗑️) χωρίς `aria-label`, modal χωρίς focus trap.
**Διόρθωση:** `lang="el"`, σωστό title/description, aria labels, focus management στο check-in modal, keyboard shortcuts (π.χ. `1` = ON, `2` = OFF).

### 18. Μικροδιορθώσεις
- Magic `+2` στο display του streak (`app/page.tsx:525`) — να χρησιμοποιηθεί το πραγματικό elapsed.
- Νεκρή λογική/ονοματοδοσία: το `pureDeepWork` είναι πλέον απλά `dailyOnMinutes` (αφαιρέθηκε η sleep λογική) — καθαρισμός interfaces/comments.
- Το `handleEndDay` με ενεργή συνεδρία δεν τη σταματάει ορατά — να την κλείνει επίσης.
- Χρήσιμο: mirror της κατάστασης σε localStorage για instant load και offline resilience.

---

## 🏗️ Code Quality & Architecture

### 19. Μονόλιθος 677 γραμμών
Όλο το app είναι ένα αρχείο (`app/page.tsx`).
**Διόρθωση:**
- `app/hooks/useTracker.ts` (state machine + sync logic), `app/lib/types.ts`, `app/lib/dates.ts`.
- Components: `StatsGrid`, `CheckinModal`, `HistoryTable`, `GoalBanner`, `SettingsPanel`.
- Εξαγωγή pure Συναρτήσεις υπολογισμού (score, minutes, rollover) → testable.

### 20. Tests & CI
Κανένα test, καμία CI.
**Διόρθωση:** Vitest για μονάδες (ημερομηνία/rollover/score — θα έπιαναν τα bugs #2, #3, #4, #7), Playwright e2e για τη ροή συνεδρίας, GitHub Actions workflow (`lint` + `typecheck` + `test` + `build` με placeholder env).

### 21. Project hygiene
- `"lint": "eslint"` χωρίς path (`package.json:9`) — να γίνει `eslint .`.
- Πρόσθεσε `"typecheck": "tsc --noEmit"` script.
- README = create-next-app template — γράψε real README: setup, env vars, Supabase schema, deploy.
- Διαγραφή αχρησιμοποίητων template αρχείων (`public/*.svg`).
- `next.config.ts` άδειο — ρύθμιση `typedRoutes`/cache μόνο αν χρειαστεί.

---

## 🚀 Προτεινόμενη Σειρά Εργασιών

| Phase | Περιεχόμενο |
|-------|-------------|
| **1. Stop the bleeding** | #1 env/build, #5 data-loss on load error, #2 τοπική ημερομηνία, #3 live rollover, #8 lint |
| **2. Ορθή μέτρηση** | #4 timestamp accounting, #12 honest auto-checkin, #7 score fix, #11 write errors |
| **3. Ασφάλεια** | #9 RLS + auth, #10 schema in repo, #6 multi-tab lock |
| **4. Quality** | #19 refactor, #20 tests + CI, #21 README/scripts |
| **5. UX polish** | #13 settings, #14 in-app dialogs, #15 analytics/charts, #16/#17 notifications & a11y, PWA |

---

## ✅ Κατάσταση Υλοποίησης (2026-10-31)

| # | Item | Κατάσταση |
|---|------|-----------|
| 1 | Env/build crash | ✅ Guarded client + SetupScreen + `.env.example` |
| 2 | UTC ημερομηνία | ✅ `src/lib/dates.ts::todayLocal()` (tested) |
| 3 | Live rollover | ✅ Έλεγχος σε κάθε tick + `visibilitychange` |
| 4 | Timestamp accounting | ✅ `lastCheckAt`/`startedAt`, cap 5΄, pause/resume μερική συνεδρία (tested) |
| 5 | Data-loss on load error | ✅ Load error → localStorage mirror, χωρίς overwrite cloud + banner retry |
| 6 | Multi-tab | ✅ Web Locks — secondary tab read-only (οριακώς ελεγμένο σε browser) |
| 7 | Score 0-μερών | ✅ `computeScore(0,0)=0` (tested) |
| 8 | react-hooks lint | ✅ Pure `src/lib/tracker.ts`, 0 lint errors |
| 9 | RLS | ⚠️ Ετοιμο `supabase/rls.sql` (Επιλογή A/B) — **χρειάζεται εσύ να το τρέξεις** στο SQL Editor |
| 10 | Schema repo | ✅ `supabase/schema.sql` (+unique index date) |
| 11 | Write errors | ✅ Banner + exponential backoff retry (έως 5) |
| 12 | Honest auto check-ins | ✅ Ξεχωριστό `dailyAutoOnMinutes` εμφανές + ρυθμιζόμενο default |
| 13 | Settings | ✅ `SettingsPanel` (interval/goal/auto-default) στο `data.settings` |
| 14 | confirm/alert | ✅ `ConfirmDialog` modal |
| 15 | Analytics | ❌ Μ εκτός scope — μελλοντικά: διαγράμματα, streaks |
| 16 | Notifications | ✅ Ενιαίο AudioContext, permission στην Έναρξη, χωρίς deprecated option |
| 17 | a11y/lang/metadata | ✅ `lang="el"`, metadata, aria-labels, focus στο dialog, πλήκτρα 1/2 στο prompt |
| 18 | Μικρά | ✅ Streak από πραγματικό elapsed, resumed sessions, καθαρισμός naming |
| 19 | Refactor | ✅ 677→~520 γραμμές page + 12 modules/components (pure logic tested) |
| 20 | Tests/CI | ✅ Vitest 19 tests, GitHub Actions (lint+typecheck+test+build) |
| 21 | Hygiene | ✅ scripts (`lint .`, `typecheck`, `test`), real README, unused svgs διαγράφηκαν |

**Data migration:** το v1 cloud blob φορτώνεται αυτόματα με `migrateData()` — παλιές τιμές διατηρούνται, νέα πεδία παίρνουν defaults.
**Εκκρεμεί από εσένα:** τρέξε το `supabase/schema.sql` (unique index) και διάλεξε RLS Επιλογή A ή Β από `supabase/rls.sql`.
