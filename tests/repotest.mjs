// The data layer against a local Supabase stand-in: real supabase-js, real
// HTTP, real Postgres + RLS. Sign-up, profile, training log round-trips,
// idempotent retries, offline outbox that survives a "reload", one bad row
// not blocking the queue, pagination past 1,000 rows, per-user isolation.
import { createClient } from "@supabase/supabase-js";
import { startFakeSupabase } from "./fake-supabase.mjs";
import { createRepo } from "../src/data/repo.js";
import { createOutbox } from "../src/data/outbox.js";
import { uuid } from "../src/data/mapping.js";
import { upsertEntry } from "../src/engine/history.js";
import { buildWorkout } from "../src/engine/generator.js";

let failures = 0;
const ok = (c, m) => { if (!c) { failures++; console.log("  ❌ " + m); } else console.log("  ✓ " + m); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (fn, ms = 4000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn()) return true; await wait(40); } return false; };
const memStore = () => { const m = new Map(); return { get: (k) => (m.has(k) ? JSON.parse(m.get(k)) : null), set: (k, v) => m.set(k, JSON.stringify(v)), raw: m }; };

const fake = await startFakeSupabase();
const mkClient = () => createClient(fake.url, fake.anonKey, { auth: { persistSession: false, autoRefreshToken: false } });

// ── outbox unit behaviour (no server) ────────────────────────────────────────
{
  const sent = [];
  let failMode = null;
  const send = async (kind, rows) => {
    if (failMode === "transient") throw new Error("network");
    if (rows.some((r) => r?.bad)) throw Object.assign(new Error("rejected"), { permanent: true });
    sent.push([kind, rows.length]);
  };
  const store = memStore();
  let st = null;
  const ob = createOutbox({ key: "t", send, store, onStatus: (s) => { st = s; } });
  ob.enqueue({ kind: "session", key: "session:1", row: { id: 1 } });
  ob.enqueue({ kind: "log", key: "log:1|0", row: { n: 1 } });
  ob.enqueue({ kind: "log", key: "log:1|1", row: { n: 2 } });
  ob.enqueue({ kind: "log", key: "log:1|0", row: { n: 3 } }); // coalesces
  await until(() => st?.pending === 0);
  ok(JSON.stringify(sent) === JSON.stringify([["session", 1], ["log", 2]]), "outbox: session first, then both logs in one batch; re-rating coalesced");
  failMode = "transient";
  ob.enqueue({ kind: "log", key: "log:1|2", row: { n: 4 } });
  await until(() => st?.state === "waiting");
  ok(st.state === "waiting" && st.pending === 1, "outbox: a network failure waits and retries instead of dropping the write");
  ok(store.get("t").ops.length === 1, "outbox: the waiting write is persisted on the device");
  failMode = null; ob.kick();
  await until(() => st?.pending === 0);
  ok(st.pending === 0, "outbox: back online → drained");
  ob.enqueue({ kind: "log", key: "log:1|3", row: { bad: true } });
  ob.enqueue({ kind: "log", key: "log:1|4", row: { n: 5 } });
  await until(() => st?.pending === 0);
  ok(st.dead === 1 && st.state === "error" && sent.at(-1)[1] === 1, "outbox: a rejected row is parked, the good one behind it still saves");
  ob.stop();
}

// ── sign up + empty account ──────────────────────────────────────────────────
const A = mkClient();
const up = await A.auth.signUp({ email: "ofek@example.com", password: "squat-1234", options: { data: { display_name: "Ofek" } } });
ok(!up.error && up.data.session, "sign-up returns a session");
const uidA = up.data.user.id;
const storeA = memStore();
let statusA = null;
let repo = createRepo(A, uidA, { store: storeA, onStatus: (s) => { statusA = s; } });
let model = await repo.load();
ok(model.name === "Ofek" && model.log.length === 0 && !model.onboarded, "a new account loads with its name and an empty log");

// ── profile ──────────────────────────────────────────────────────────────────
const profile = { age: 31, height: 174, weight: 57, level: "intermediate", goal: "muscle", equipment: "bw",
  inventory: ["wall", "chair", "table", "towel", "kettlebell", "pullupbar"], customGear: [], skill: "lsit", excluded: [],
  sessionMinutes: 30, daysPerWeek: 3, quickPrefs: { focus: "core", minutes: 20 }, blockStarted: Date.now() - 9 * 864e5 };
repo.saveProfile({ name: "Ofek", profile, selected: new Set(["chest", "lats"]), onboarded: true });
await until(() => statusA?.pending === 0);
let row = (await fake.query("select * from public.profiles where user_id = $1", [uidA])).rows[0];
ok(row.onboarded && row.settings.skill === "lsit" && row.selected.join() === "chest,lats", "profile saved: settings, selection, onboarded");

// ── training log round-trip ──────────────────────────────────────────────────
const w = buildWorkout(profile, new Set(["chest", "frontDelts", "triceps"]), []);
const sid = uuid();
let log = [];
w.exercises.forEach((ex, i) => {
  log = upsertEntry(log, { exerciseId: ex.id, ladder: ex.ladder, rank: ex.rank, sets: ex.sets, reps: ex.reps, holdSecs: ex.holdSecs,
    load: ex.load, feel: i === 0 ? "easy" : "right", muscles: [ex.primary, ...ex.secondary], source: "plan", format: "sets",
    sessionId: sid, slot: i, label: "Push + Core", dayKey: "chest,frontDelts,triceps" });
});
repo.syncLog(log);
await until(() => statusA?.pending === 0);
const counts = async (uid) => (await fake.query("select (select count(*) from public.workout_sessions where user_id=$1)::int s, (select count(*) from public.exercise_logs where user_id=$1)::int l", [uid])).rows[0];
let c = await counts(uidA);
ok(c.s === 1 && c.l === w.exercises.length, `one session, ${w.exercises.length} exercise logs saved`);
log = upsertEntry(log, { ...log[0], feel: "hard" });
repo.syncLog(log);
await until(() => statusA?.pending === 0);
c = await counts(uidA);
ok(c.l === w.exercises.length, "re-rating a move updates its row — no duplicate");
const writesBefore = fake.stats.writes;
repo.syncLog(log);
await wait(150);
ok(fake.stats.writes === writesBefore, "syncing an unchanged log sends nothing");

const repo2 = createRepo(A, uidA, { store: memStore() });
model = await repo2.load();
const same = model.log.length === log.length && model.log.every((e, i) =>
  e.exerciseId === log[i].exerciseId && e.feel === log[i].feel && e.sets === log[i].sets &&
  JSON.stringify(e.reps) === JSON.stringify(log[i].reps) && e.load === log[i].load &&
  e.sessionId === sid && e.source === "plan" && e.dayKey === "chest,frontDelts,triceps" && e.label === "Push + Core");
if (!same) console.log(JSON.stringify(model.log.map(e=>[e.exerciseId,e.feel,e.sets,e.reps,e.load,e.at])), "\nvs", JSON.stringify(log.map(e=>[e.exerciseId,e.feel,e.sets,e.reps,e.load,e.at])));
ok(same, "a fresh device loads the identical training log (feel, sets, reps, load, session, day)");
ok(model.profile.skill === "lsit" && Math.abs(model.profile.blockStarted - profile.blockStarted) < 1000, "…and the identical profile");
repo2.stop();

// ── offline: logged in the basement, tab closed, reopened online ─────────────
fake.stats.down = true;
const sid2 = uuid();
const quickEntry = { exerciseId: "plank", sets: 3, reps: null, holdSecs: 45, load: null, feel: "right", muscles: ["core", "abs"],
  source: "quick", format: "circuit", sessionId: sid2, slot: 0, label: "Core & Abs", at: Date.now() };
log = upsertEntry(log, quickEntry);
repo.syncLog(log);
await until(() => statusA?.state === "waiting");
ok(statusA.state === "waiting" && statusA.pending >= 2, "server down → the single session waits in the outbox");
repo.stop(); // the tab closes

const reopened = createRepo(A, uidA, { store: storeA }); // same device storage
model = await reopened.load();
ok(model.offline && model.log.some((e) => e.sessionId === sid2), "reopened while still down: loads from the device cache with the unsent session on top");
fake.stats.down = false;
reopened.kick();
await until(() => reopened.status().pending === 0);
c = await counts(uidA);
ok(c.s === 2 && c.l === w.exercises.length + 1, "connection back → the offline session reaches the database exactly once");
reopened.stop();

// ── a rejected row doesn't block the rest ────────────────────────────────────
const B = mkClient();
const upB = await B.auth.signUp({ email: "b@example.com", password: "deadlift-99", options: { data: { display_name: "B" } } });
const uidB = upB.data.user.id;
const repoB = createRepo(B, uidB, { store: memStore() });
model = await repoB.load();
ok(model.log.length === 0 && model.name === "B", "a second user sees none of the first user's training");
let st2 = null;
const repoB2 = createRepo(B, uidB, { store: memStore(), onStatus: (s) => { st2 = s; } });
await repoB2.load();
// B tries to write into A's session id (as a buggy or malicious client would)
const hijack = { ...quickEntry, sessionId: sid, slot: 9, at: Date.now() };
const legit = { ...quickEntry, sessionId: uuid(), slot: 0, at: Date.now() + 1 };
repoB2.syncLog([hijack, legit]);
await until(() => st2?.pending === 0, 6000);
c = await counts(uidA);
const cb = await counts(uidB);
ok(c.l === w.exercises.length + 1, "B can't add rows to A's session (row-level security)");
ok(st2.dead >= 1 && cb.s === 1 && cb.l === 1, "the rejected write is parked; B's own session behind it still saves");
repoB.stop(); repoB2.stop();

// ── pagination past PostgREST's 1,000-row page ───────────────────────────────
await fake.query(`insert into public.workout_sessions (id, user_id, source, started_at) select gen_random_uuid(), $1, 'plan', now() - (g || ' hours')::interval from generate_series(1, 300) g`, [uidA]);
await fake.query(`insert into public.exercise_logs (session_id, slot, user_id, exercise_id, sets, feel, muscles, logged_at)
  select s.id, g::text, $1, 'pushup', 3, 'right', '{chest}', s.started_at from public.workout_sessions s, generate_series(0, 7) g where s.user_id = $1 and s.label is null and s.source = 'plan' and s.day_key is null and s.id <> $2`, [uidA, sid]);
const big = createRepo(A, uidA, { store: memStore() });
model = await big.load();
c = await counts(uidA);
ok(model.log.length === c.l && c.l > 2000, `loads every row, not just the first 1,000 (${model.log.length} of ${c.l})`);
big.stop();

// ── reset ────────────────────────────────────────────────────────────────────
const r3 = createRepo(A, uidA, { store: memStore() });
await r3.load();
r3.resetAll();
await until(() => r3.status().pending === 0);
c = await counts(uidA);
ok(c.s === 0 && c.l === 0, "reset deletes every session and log for this user");
ok((await counts(uidB)).l === 1, "…and nothing of anyone else's");
r3.stop();

// ── wrong password ───────────────────────────────────────────────────────────
const bad = await mkClient().auth.signInWithPassword({ email: "ofek@example.com", password: "nope" });
ok(!!bad.error, "a wrong password is refused");

await fake.close();
console.log(failures ? `\n❌ ${failures} FAILURES` : "\n✅ data layer contract holds");
process.exit(failures ? 1 : 0);
