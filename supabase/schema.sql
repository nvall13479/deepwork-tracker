-- Deep Work Tracker — Schema (τα tables ήδη υπάρχουν στο project)
-- Το μοναδικό REQUIRED missing κομμάτι: unique index στο daily_history.date
-- (ο κώδικας κάνει upsert με on_conflict=date).

create table if not exists public.productivity_logs (
  id int primary key,
  data jsonb not null default '{}'::jsonb
);

create table if not exists public.daily_history (
  id int generated always as identity primary key,
  date date not null,
  pure_deep_work_minutes int not null default 0,
  productivity_score numeric not null default 0,
  goal_achieved boolean not null default false,
  created_at timestamptz not null default now(),
  sessions_count int not null default 1
);

create unique index if not exists daily_history_date_key on public.daily_history (date);
