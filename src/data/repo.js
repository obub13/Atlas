// ─── Repository: the app's only door to Supabase ──────────────────────────────
// load()          profile + whole training history, with a local cache so the
//                 app still opens with no signal
// saveProfile()   queued upsert of the profile row
// syncLog(log)    diff against what's already saved → queued upserts of only
//                 the changed sessions and exercise logs
// resetAll()      queued delete of every session (logs cascade)
import { createOutbox } from "./outbox.js";
import {
  profileFromRow, profileToRow, entriesFromRows, diffLog, snapshotOf, entryKey,
} from "./mapping.js";

const PAGE = 1000;

/** Supabase/PostgREST errors that mean "your data was rejected" — retrying won't help. */
export function isPermanent(error) {
  if (!error) return false;
  const code = String(error.code || "");
  const status = +error.status || 0;
  if (/^(22|23|42)/.test(code)) return true;          // bad value, constraint, permission/RLS
  if (/^PGRST1\d\d$|^PGRST2\d\d$/.test(code)) return true; // request shape problems
  return [400, 403, 404, 409, 413, 422].includes(status);
}

const fail = (error) => {
  const e = new Error(error?.message || "Request failed");
  e.code = error?.code; e.status = error?.status; e.permanent = isPermanent(error);
  return e;
};

async function selectAll(client, table, order) {
  const out = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await client.from(table).select("*").order(order, { ascending: true }).range(from, from + PAGE - 1);
    if (error) throw fail(error);
    out.push(...data);
    if (data.length < PAGE) return out;
  }
}

const memoryStore = () => { const m = new Map(); return { get: (k) => m.get(k) ?? null, set: (k, v) => m.set(k, v) }; };
const localStore = () => {
  try { localStorage.setItem("atlas:probe", "1"); localStorage.removeItem("atlas:probe"); } catch { return memoryStore(); }
  return {
    get(k) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  };
};

export function createRepo(client, userId, { store = localStore(), onStatus = () => {}, timers } = {}) {
  const cacheKey = `atlas:cache:${userId}`;
  let snapshot = new Map();
  let lastProfileJson = null;

  async function send(kind, rows) {
    let res;
    if (kind === "profile") res = await client.from("profiles").upsert(rows[rows.length - 1], { onConflict: "user_id" });
    else if (kind === "session") res = await client.from("workout_sessions").upsert(rows, { onConflict: "id" });
    else if (kind === "log") res = await client.from("exercise_logs").upsert(rows, { onConflict: "session_id,slot" });
    else if (kind === "reset") res = await client.from("workout_sessions").delete().eq("user_id", userId);
    else if (kind === "deleteSession") {
      // one request per session; its exercise logs go with it (on delete cascade)
      for (const r of rows) {
        res = await client.from("workout_sessions").delete().eq("id", r.id);
        if (res.error) throw fail(res.error);
      }
      return;
    }
    else throw Object.assign(new Error(`unknown op ${kind}`), { permanent: true });
    if (res.error) throw fail(res.error);
  }

  const outbox = createOutbox({ key: `atlas:outbox:${userId}`, send, store, onStatus, timers });

  /** Apply writes that haven't reached the server yet on top of what it returned. */
  function overlay(model) {
    const ops = outbox.pending();
    if (!ops.length) return model;
    let { profileRow, sessions, logs } = model;
    const sById = new Map(sessions.map((s) => [s.id, s]));
    const lByKey = new Map(logs.map((l) => [`${l.session_id}|${l.slot}`, l]));
    for (const op of ops) {
      if (op.kind === "profile") profileRow = { ...profileRow, ...op.row };
      else if (op.kind === "reset") { sById.clear(); lByKey.clear(); }
      else if (op.kind === "session") sById.set(op.row.id, { ...(sById.get(op.row.id) || {}), ...op.row });
      else if (op.kind === "log") lByKey.set(`${op.row.session_id}|${op.row.slot}`, op.row);
      else if (op.kind === "deleteSession") {
        sById.delete(op.row.id);
        for (const k of [...lByKey.keys()]) if (k.startsWith(op.row.id + "|")) lByKey.delete(k);
      }
    }
    return { profileRow, sessions: [...sById.values()], logs: [...lByKey.values()] };
  }

  function toApp({ profileRow, sessions, logs }, offline) {
    const p = profileFromRow(profileRow) || { name: "", profile: {}, selected: [], onboarded: false };
    const log = entriesFromRows(sessions, logs);
    return { ...p, log, offline };
  }

  /** Load everything. Falls back to the last good copy on this device when offline. */
  async function load() {
    let model, offline = false;
    try {
      const prof = await client.from("profiles").select("*").eq("user_id", userId).maybeSingle();
      if (prof.error) throw fail(prof.error);
      let profileRow = prof.data;
      if (!profileRow) {
        // sign-up trigger missing or raced — create it ourselves
        const ins = await client.from("profiles").upsert({ user_id: userId }, { onConflict: "user_id" }).select().maybeSingle();
        if (ins.error) throw fail(ins.error);
        profileRow = ins.data || { user_id: userId, settings: {}, selected: [], onboarded: false };
      }
      const sessions = await selectAll(client, "workout_sessions", "started_at");
      const logs = await selectAll(client, "exercise_logs", "logged_at");
      model = { profileRow, sessions, logs };
      store.set(cacheKey, model);
    } catch (err) {
      const cached = store.get(cacheKey);
      if (!cached || err.permanent) throw err;
      model = cached; offline = true;
    }
    // what the server (or cache) has is the baseline; pending writes sit on top
    const serverApp = toApp(model, offline);
    snapshot = snapshotOf(serverApp.log);
    const app = toApp(overlay(model), offline);
    lastProfileJson = null;
    return app;
  }

  function saveProfile(data) {
    const row = profileToRow(userId, data);
    const json = JSON.stringify(row);
    if (json === lastProfileJson) return;
    lastProfileJson = json;
    outbox.enqueue({ kind: "profile", key: "profile", row });
  }

  function syncLog(log) {
    const d = diffLog(snapshot, log);
    if (d.removedAll) {
      outbox.enqueue({ kind: "reset", key: "reset", row: null });
    }
    for (const s of d.sessions) outbox.enqueue({ kind: "session", key: `session:${s.id}`, row: s });
    for (const l of d.logs) outbox.enqueue({ kind: "log", key: `log:${l.session_id}|${l.slot}`, row: l });
    snapshot = d.snapshot;
  }

  /** Delete one session and everything logged in it — on this device now, on the server when it can. */
  function deleteSession(id) {
    for (const k of [...snapshot.keys()]) if (k.startsWith(id + "|")) snapshot.delete(k);
    outbox.enqueue({ kind: "deleteSession", key: `delete:${id}`, row: { id }, drops: [`session:${id}`, `log:${id}|`] });
  }

  function resetAll() {
    outbox.enqueue({ kind: "reset", key: "reset", row: null });
    snapshot = new Map();
  }

  return {
    load, saveProfile, syncLog, resetAll, deleteSession,
    flush: outbox.flush, kick: outbox.kick, status: outbox.status, stop: outbox.stop,
    deadOps: outbox.deadOps, clearDead: outbox.clearDead,
    entryKey,
  };
}
