// ─── Rows ↔ app model ─────────────────────────────────────────────────────────
// The engine works on a flat, in-memory training log (one entry per exercise
// per session). The database normalises it into sessions + exercise_logs.
// This module is the only place that knows both shapes. Pure, no I/O.

import { canonicalId } from "../engine/logparse.js";

const iso = (ms) => new Date(ms).toISOString();
const ms = (s) => (s ? Date.parse(s) : Date.now());

/* ── profile ───────────────────────────────────────────────────────────────── */
const SETTINGS_KEYS = ["age", "height", "weight", "level", "goal", "equipment", "inventory", "customGear",
  "skill", "excluded", "sessionMinutes", "daysPerWeek", "quickPrefs", "customExercises", "weights"];

export function profileFromRow(row) {
  if (!row) return null;
  const settings = row.settings && typeof row.settings === "object" ? row.settings : {};
  return {
    name: row.display_name || "",
    profile: { ...settings, blockStarted: ms(row.block_started) },
    selected: Array.isArray(row.selected) ? row.selected : [],
    onboarded: !!row.onboarded,
  };
}

export function profileToRow(userId, { name, profile, selected, onboarded }) {
  const settings = {};
  for (const k of SETTINGS_KEYS) if (profile[k] !== undefined) settings[k] = profile[k];
  return {
    user_id: userId,
    display_name: String(name || "").slice(0, 40),
    settings,
    selected: [...selected].slice(0, 20),
    onboarded: !!onboarded,
    block_started: iso(profile.blockStarted || Date.now()),
  };
}

/* ── training log ──────────────────────────────────────────────────────────── */
export const entryKey = (e) => `${e.sessionId}|${e.slot}`;

/** Sessions + logs → the engine's flat log, oldest first. */
export function entriesFromRows(sessions, logs) {
  const byId = new Map(sessions.map((s) => [s.id, s]));
  return logs
    .map((l) => {
      const s = byId.get(l.session_id) || {};
      return {
        // a custom move the library has since learned reads as the library move
        exerciseId: canonicalId(l.exercise_id),
        ladder: l.ladder ?? null,
        rank: l.rank ?? null,
        stageName: l.stage_name ?? null,
        sets: l.sets,
        reps: l.reps_min != null && l.reps_max != null ? [l.reps_min, l.reps_max] : null,
        holdSecs: l.hold_secs ?? null,
        load: l.load_kg == null ? null : +l.load_kg,
        feel: l.feel ?? null,
        muscles: l.muscles || [],
        at: ms(l.logged_at),
        source: s.source || "plan",
        format: s.format || "sets",
        sessionId: l.session_id,
        slot: String(l.slot),
        label: s.label ?? null,
        dayKey: s.day_key ?? null,
      };
    })
    // same instant (a whole session finished at once) → keep session order, then slot order
    .sort((a, b) => a.at - b.at || (a.sessionId < b.sessionId ? -1 : a.sessionId > b.sessionId ? 1 : 0) || slotOrder(a.slot) - slotOrder(b.slot));
}

const slotOrder = (s) => (/^\d+$/.test(s) ? +s : 1000);

export function sessionRowFromEntries(entries) {
  const first = entries.reduce((a, b) => (b.at < a.at ? b : a));
  return {
    id: first.sessionId,
    source: ["quick", "manual"].includes(first.source) ? first.source : "plan",
    format: first.format === "circuit" ? "circuit" : "sets",
    label: first.label ? String(first.label).slice(0, 80) : null,
    day_key: first.dayKey ? String(first.dayKey).slice(0, 300) : null,
    started_at: iso(first.at),
  };
}

const int = (v, lo, hi) => (v == null || Number.isNaN(+v) ? null : Math.max(lo, Math.min(hi, Math.round(+v))));

export function logRowFromEntry(e) {
  return {
    session_id: e.sessionId,
    slot: String(e.slot),
    exercise_id: String(e.exerciseId).slice(0, 80),
    ladder: e.ladder || null,
    rank: e.rank == null ? null : int(e.rank, -32768, 32767),
    stage_name: e.stageName || null,
    sets: int(e.sets, 0, 20) ?? 0,
    reps_min: e.reps ? int(e.reps[0], 0, 200) : null,
    reps_max: e.reps ? int(e.reps[1], 0, 200) : null,
    hold_secs: int(e.holdSecs, 0, 3600),
    load_kg: e.load == null ? null : Math.max(0, +(+e.load).toFixed(2)),
    feel: ["easy", "right", "hard"].includes(e.feel) ? e.feel : null,
    muscles: (e.muscles || []).slice(0, 20),
    logged_at: iso(e.at),
  };
}

/** Fingerprint of what the database holds for an entry (and its session). */
const print = (e) => JSON.stringify([logRowFromEntry(e), e.source, e.format, e.label, e.dayKey]);

/**
 * What changed between the last synced log and the current one.
 * Only entries with a sessionId and slot are syncable (every entry this app writes has both).
 * @returns {{ sessions: object[], logs: object[], removedAll: boolean, snapshot: Map }}
 */
export function diffLog(prevSnapshot, log) {
  const snapshot = new Map();
  const changed = [];
  for (const e of log) {
    if (!e.sessionId || e.slot == null) continue;
    const k = entryKey(e), p = print(e);
    snapshot.set(k, p);
    if (prevSnapshot.get(k) !== p) changed.push(e);
  }
  const removedAll = prevSnapshot.size > 0 && snapshot.size === 0;
  const sessionIds = [...new Set(changed.map((e) => e.sessionId))];
  const sessions = sessionIds.map((id) => sessionRowFromEntries(log.filter((e) => e.sessionId === id)));
  return { sessions, logs: changed.map(logRowFromEntry), removedAll, snapshot };
}

export const snapshotOf = (log) => diffLog(new Map(), log).snapshot;

/** RFC 4122 v4 — crypto.randomUUID where available, getRandomValues otherwise. */
export function uuid() {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  const b = new Uint8Array(16);
  if (c && c.getRandomValues) c.getRandomValues(b); else for (let i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256);
  b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
