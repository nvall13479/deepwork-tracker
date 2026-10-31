# ⚡ Deep Work Tracker

Next.js app (App Router) για παρακολούθηση deep work: check-in ανά διαστημα (default 2΄),
κατηγορίες ON/OFF, ημερήσιος στόχος, αρχειοθέτηση ημέρας σε ιστορικό.
Διατηρεί το state στο **Supabase** ( μία γραμμή JSON) + **localStorage mirror**.

## Local setup

```bash
npm install
cp .env.example .env.local   # βάλε τα πραγματικά values
npm run dev                  # http://localhost:3000
```

Τα env values (Project URL + publishable key) βρίσκονται στο Supabase Dashboard →
Settings → General / API Keys.

**Προσοχή:** το publishable key client-side είναι public· χωρίς RLS, όποιος έχει το URL
μπορεί να αλλοιώσει τα δεδομένα. Δες `supabase/rls.sql` για την κλείδωμα.

## Supabase

Tables (βλ. `supabase/schema.sql`):

| table | ρόλος |
|-------|-------|
| `productivity_logs` | μία γραμμή id=1, `data jsonb` = ολόκληρη η κατάσταση tracker |
| `daily_history` | αρχειοθετημένες ημέρες — το upsert απαιτεί **unique index στο `date`** |

## Scripts

```bash
npm run dev         # development
npm run build       # production build
npm run lint        # eslint
npm run typecheck   # tsc --noEmit
npm test            # vitest (logic tests)
```

## Δομή

```
app/                  layout + page (client orchestrator)
src/lib/              tracker logic (pure, tested), supabase, dates, tabs, notify
src/components/       GoalBanner, CheckinModal, HistoryTable, SettingsPanel, ...
tests/unit/           vitest unit tests
supabase/             schema.sql, rls.sql
```

## Λειτουργία

- **Έναρξη συνεδρίας** → tick loop κάθε 1΄ υπολογίζει τον countdown από **timestamps**
  (όχι ticks): αν το tab παγώσει/frozen, το επόμενο check-in μετράει το πραγματικό
  elapsed (max 5΄). Έτσι δεν χάνεται χρόνος σε background tabs.
- **Check-in prompt** κάθε `intervalSec`: επιλέγεις κατηγορία· αν δεν απαντήσεις σε 10",
  εφαρμόζεται το ρυθμισμένο default (ON/OFF) — τα auto ON μετρώνται ξεχωριστά
  ("από τα Χ αυτόματα check-in").
- **Aλλαγή ημέρας**: live rollover ακόμα και με ανοιχτό tab (έλεγχος σε κάθε tick,
  τοπική ημερομηνία, όχι UTC).
- **Πολλαπλά tabs**: Web Locks — μόνο το πρώτο tab γράφει· τα υπόλοιπα read-only.
- **Cloud σφάλματα**: load failure → fallback σε τοπικό mirror (χωρίς overwrite του
  cloud)· save failure → banner + exponential backoff retry.

## Deployment

Ιδανικό: Vercel (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY στο project).
