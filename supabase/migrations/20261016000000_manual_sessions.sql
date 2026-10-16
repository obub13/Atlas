-- Workouts logged by hand (done without the app) are their own kind of session:
-- they count in history, volume and progression, never as a plan day.
alter table public.workout_sessions drop constraint workout_sessions_source_check;
alter table public.workout_sessions add constraint workout_sessions_source_check
  check (source in ('plan', 'quick', 'manual'));
