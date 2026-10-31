-- Deep Work Tracker — RLS Επιλογή Β (Supabase Auth + ανά-χρήστη δεδομένα)
-- Idempotent: τρέξε ολόκληρο στο SQL Editor. Εφαρμόζεται ΜΟΝΟ ΑΦΟΥ created
-- τον λογαριασμό σου app → αλλιώς το legacy claim γίνεται στην πρώτη είσοδο.
--
-- Προαπαιτούμενο dashboard: Authentication → URL Configuration → Redirect URLs:
--   πρόσθεσε  http://localhost:3001/auth/callback  (και το παραγωγικό URL αργότερα)

-- 1) user_id στήλες + indexes
alter table public.productivity_logs add column if not exists user_id uuid;
alter table public.daily_history add column if not exists user_id uuid;

create unique index if not exists productivity_logs_user_key
  on public.productivity_logs (user_id);

-- το global date UNIQUE CONSTRAINT αντικαθίσταται από ανά-χρήστη μοναδικότητα
alter table public.daily_history drop constraint if exists daily_history_date_key;
drop index if exists public.daily_history_date_key;
create unique index if not exists daily_history_user_date_key
  on public.daily_history (user_id, date);

-- 2) productivity_logs: το id παύει να είναι global identifier
alter table public.productivity_logs drop constraint if exists productivity_logs_pkey;
alter table public.productivity_logs alter column id drop not null;

-- 3) RLS on + policies (καθαρισμός A)
alter table public.productivity_logs enable row level security;
alter table public.daily_history enable row level security;

drop policy if exists "tracker_rw" on public.productivity_logs;
drop policy if exists "history_rw" on public.daily_history;

create policy own_tracker on public.productivity_logs
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- εφάπαξ παραλαβή legacy (pre-auth, user_id null) δεδομένων από τον πρώτο συνδεδεμένο
create policy legacy_tracker_select on public.productivity_logs
  for select to authenticated using (user_id is null);
create policy legacy_tracker_delete on public.productivity_logs
  for delete to authenticated using (user_id is null);

create policy own_history on public.daily_history
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy legacy_history_select on public.daily_history
  for select to authenticated using (user_id is null);
create policy legacy_history_delete on public.daily_history
  for delete to authenticated using (user_id is null);
