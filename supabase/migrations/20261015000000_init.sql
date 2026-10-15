-- ─── Atlas Trainer · schema v1 ────────────────────────────────────────────────
-- One person per auth user. Three tables:
--   profiles          settings the generator needs (stats, level, goal, gear, schedule)
--   workout_sessions  one row per workout, plan or single session
--   exercise_logs     one row per exercise in a session — the training log
--
-- The training log is the source of truth: weekly volume, progression targets
-- and every progress chart are DERIVED from exercise_logs, never stored.
--
-- Ids are generated on the device (crypto.randomUUID), so a workout logged
-- offline can be retried any number of times: every write is an upsert on a
-- key the device already knows, and a retry can never create a duplicate.
--
-- Security: row-level security on every table. A signed-in user can read and
-- write only rows whose user_id is their own; the anon key alone sees nothing.


-- ── profiles ──────────────────────────────────────────────────────────────────
create table public.profiles (
  user_id       uuid primary key references auth.users (id) on delete cascade,
  display_name  text not null default '' check (char_length(display_name) <= 40),
  settings      jsonb not null default '{}'::jsonb check (jsonb_typeof(settings) = 'object'),
  selected      text[] not null default '{}' check (cardinality(selected) <= 20),
  onboarded     boolean not null default false,
  block_started timestamptz not null default now(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
comment on column public.profiles.settings is
  'age, height, weight, level, goal, inventory, customGear, skill, excluded, sessionMinutes, daysPerWeek, quickPrefs';

-- ── workout_sessions ─────────────────────────────────────────────────────────
create table public.workout_sessions (
  id          uuid primary key,                                   -- generated on the device
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  source      text not null check (source in ('plan', 'quick')),
  format      text not null default 'sets' check (format in ('sets', 'circuit')),
  label       text check (char_length(label) <= 80),
  day_key     text check (char_length(day_key) <= 300),           -- which plan day it was (null for single sessions)
  started_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index workout_sessions_user_started on public.workout_sessions (user_id, started_at desc);

-- ── exercise_logs ────────────────────────────────────────────────────────────
create table public.exercise_logs (
  session_id  uuid not null references public.workout_sessions (id) on delete cascade,
  slot        text not null check (char_length(slot) <= 16),     -- position in the session; re-rating overwrites
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  exercise_id text not null check (char_length(exercise_id) <= 80),
  ladder      text check (char_length(ladder) <= 40),
  rank        smallint,
  stage_name  text check (char_length(stage_name) <= 80),
  sets        smallint not null check (sets between 0 and 20),
  reps_min    smallint check (reps_min between 0 and 200),
  reps_max    smallint check (reps_max between 0 and 200),
  hold_secs   smallint check (hold_secs between 0 and 3600),
  load_kg     numeric(6, 2) check (load_kg >= 0),
  feel        text check (feel in ('easy', 'right', 'hard')),  -- null = done but not rated
  muscles     text[] not null default '{}' check (cardinality(muscles) <= 20),
  logged_at   timestamptz not null default now(),
  primary key (session_id, slot)
);
create index exercise_logs_user_time on public.exercise_logs (user_id, logged_at desc);
create index exercise_logs_user_exercise on public.exercise_logs (user_id, exercise_id, logged_at);

-- ── updated_at ───────────────────────────────────────────────────────────────
create or replace function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();
create trigger workout_sessions_touch before update on public.workout_sessions
  for each row execute function public.touch_updated_at();

-- ── a profile row appears the moment someone signs up ────────────────────────
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (user_id, display_name)
  values (new.id, left(coalesce(new.raw_user_meta_data ->> 'display_name', ''), 40))
  on conflict (user_id) do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();
-- runs only as a trigger; nobody calls it through the API
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- ── row-level security: your rows, nobody else's ─────────────────────────────
alter table public.profiles         enable row level security;
alter table public.workout_sessions enable row level security;
alter table public.exercise_logs    enable row level security;

create policy "own profile" on public.profiles
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "own sessions" on public.workout_sessions
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- A log row must belong to you AND hang off one of your own sessions —
-- foreign keys are checked without RLS, so this closes the gap.
create policy "own logs" on public.exercise_logs
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.workout_sessions s
                where s.id = session_id and s.user_id = (select auth.uid()))
  );
