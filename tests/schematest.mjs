// The real migration on a real Postgres (PGlite), with a stand-in for the bits
// of Supabase it relies on: the auth schema, auth.uid(), and the two API roles.
// Proves: profiles appear on sign-up, every table is owner-only, logs can't be
// attached to someone else's session, upserts are idempotent, bad data bounces.
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "fs";

const db = new PGlite();
let failures = 0;
const ok = (c, m) => { if (!c) { failures++; console.log("  ❌ " + m); } else console.log("  ✓ " + m); };
const rejects = async (fn, m) => { try { await fn(); ok(false, m + " (was allowed)"); } catch { ok(true, m); } };

// ── Supabase stand-in ────────────────────────────────────────────────────────
await db.exec(`
  create schema auth;
  create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}'::jsonb);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create role anon nologin;
  create role authenticated nologin;
  grant usage on schema public, auth to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
`);
// every migration, in order — exactly what the live project has applied
const MIGRATIONS = new URL("../supabase/migrations/", import.meta.url);
for (const f of readdirSync(MIGRATIONS).filter((f) => f.endsWith(".sql")).sort()) await db.exec(readFileSync(new URL(f, MIGRATIONS), "utf8"));
await db.exec(`
  grant select, insert, update, delete on all tables in schema public to anon, authenticated;
`);

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const S1 = "aaaaaaaa-0000-4000-8000-000000000001";
const S2 = "bbbbbbbb-0000-4000-8000-000000000002";

const as = async (uid) => {
  await db.exec("reset role");
  if (uid === "admin") return;
  await db.exec(uid ? "set role authenticated" : "set role anon");
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [uid || ""]);
};

// sign-up creates the profile
await as("admin");
await db.query("insert into auth.users (id, email, raw_user_meta_data) values ($1, 'ofek@example.com', '{\"display_name\":\"Ofek\"}'), ($2, 'b@example.com', '{}')", [A, B]);
const profs = await db.query("select user_id, display_name from public.profiles order by display_name desc");
ok(profs.rows.length === 2 && profs.rows[0].display_name === "Ofek", "a profile row is created on sign-up, with the display name");

// A sees only A
await as(A);
let r = await db.query("select user_id from public.profiles");
ok(r.rows.length === 1 && r.rows[0].user_id === A, "A sees only their own profile");
r = await db.query("update public.profiles set settings = '{\"age\":31}'::jsonb where user_id = $1", [B]);
ok(r.affectedRows === 0, "A can't change B's profile");
r = await db.query("update public.profiles set settings = '{\"age\":31,\"daysPerWeek\":3}'::jsonb, selected = '{chest,lats}' where user_id = $1", [A]);
ok(r.affectedRows === 1, "A updates their own profile");

// sessions
await db.query("insert into public.workout_sessions (id, source, format, label, day_key) values ($1, 'plan', 'sets', 'Push + Core', 'chest,frontDelts,triceps,abs')", [S1]);
r = await db.query("select user_id from public.workout_sessions where id = $1", [S1]);
ok(r.rows[0]?.user_id === A, "a session is owned by whoever wrote it (user_id defaults to auth.uid())");
await rejects(() => db.query("insert into public.workout_sessions (id, user_id, source) values (gen_random_uuid(), $1, 'plan')", [B]), "A can't write a session as B");

// logs + idempotent upsert
const upsert = (slot, feel, sets = 3) => db.query(`
  insert into public.exercise_logs (session_id, slot, exercise_id, sets, reps_min, reps_max, load_kg, feel, muscles)
  values ($1, $2, 'gobletsquat', $3, 8, 12, 20, $4, '{quads,glutes}')
  on conflict (session_id, slot) do update set sets = excluded.sets, feel = excluded.feel, load_kg = excluded.load_kg`, [S1, slot, sets, feel]);
await upsert("0", "easy");
await upsert("0", "right");
await upsert("0", "right");
r = await db.query("select count(*)::int as n, max(feel) as feel from public.exercise_logs where session_id = $1", [S1]);
ok(r.rows[0].n === 1 && r.rows[0].feel === "right", "retrying the same write never duplicates — re-rating overwrites");
await upsert("1", null, 2);
r = await db.query("select feel from public.exercise_logs where slot = '1'");
ok(r.rows[0].feel === null, "an unrated move can be logged");
await rejects(() => db.query("insert into public.exercise_logs (session_id, slot, exercise_id, sets, feel) values ($1, '9', 'x', 3, 'meh')", [S1]), "an unknown feel is rejected");
await rejects(() => db.query("insert into public.exercise_logs (session_id, slot, exercise_id, sets) values ($1, '8', 'x', 99)", [S1]), "an impossible set count is rejected");
await rejects(() => db.query("insert into public.workout_sessions (id, source) values (gen_random_uuid(), 'cardio')"), "an unknown session source is rejected");
await db.query("insert into public.workout_sessions (id, source, label) values (gen_random_uuid(), 'manual', 'Kettlebell core')");
ok(true, "a hand-logged (manual) session is accepted");

// B can't see or touch A's training
await as(B);
await db.query("insert into public.workout_sessions (id, source) values ($1, 'quick')", [S2]);
r = await db.query("select count(*)::int as n from public.exercise_logs");
ok(r.rows[0].n === 0, "B sees none of A's logs");
r = await db.query("select count(*)::int as n from public.workout_sessions");
ok(r.rows[0].n === 1, "B sees only B's sessions");
await rejects(() => db.query("insert into public.exercise_logs (session_id, slot, exercise_id, sets) values ($1, '5', 'x', 3)", [S1]), "B can't attach a log to A's session");
r = await db.query("delete from public.exercise_logs where session_id = $1", [S1]);
ok(r.affectedRows === 0, "B can't delete A's logs");

// A can't hang a log off B's session either
await as(A);
await rejects(() => db.query("insert into public.exercise_logs (session_id, slot, exercise_id, sets) values ($1, '0', 'x', 3)", [S2]), "A can't attach a log to B's session");

// the anon key alone sees nothing
await as(null);
for (const t of ["profiles", "workout_sessions", "exercise_logs"]) {
  r = await db.query(`select count(*)::int as n from public.${t}`);
  ok(r.rows[0].n === 0, `signed-out requests read nothing from ${t}`);
}
await rejects(() => db.query("insert into public.workout_sessions (id, source) values (gen_random_uuid(), 'plan')"), "signed-out requests can't write");

// deleting the account removes everything
await as("admin");
await db.query("delete from auth.users where id = $1", [A]);
r = await db.query("select (select count(*) from public.profiles where user_id = $1)::int + (select count(*) from public.workout_sessions where user_id = $1)::int + (select count(*) from public.exercise_logs where user_id = $1)::int as n", [A]);
ok(r.rows[0].n === 0, "deleting the user deletes their profile, sessions and logs");

console.log(failures ? `\n❌ ${failures} FAILURES` : "\n✅ schema + row-level security hold");
process.exitCode = failures ? 1 : 0;
