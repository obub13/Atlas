// ─── Training history ─────────────────────────────────────────────────────────
// The log is the only source of truth. Weekly volume, progression targets and
// stall detection are all DERIVED from it — never stored as mutable state.
// A correction to the same move in the same session replaces its entry. Persisting it is the repository's job (src/data/repo.js).

const DAY = 86400000;
const LOG_CAP = 20000; // the database keeps everything; this only guards memory

const entryOf = ({ exerciseId, ladder, rank, stageName, sets, reps, holdSecs, load, feel, muscles, at, source, format, sessionId, slot, label, dayKey }) => ({
  exerciseId, ladder: ladder || null, rank: rank || null, stageName: stageName || null,
  sets, reps: reps || null, holdSecs: holdSecs || null,
  load: load == null ? null : +load,
  feel: feel || null, muscles, at: at || Date.now(),
  source: source || "plan",
  format: format || "sets",
  sessionId: sessionId || null, slot: slot == null ? null : String(slot), label: label || null,
  dayKey: dayKey || null,
});

/** Append one finished exercise. Pure: returns the new log, never mutates. */
export function appendEntry(log, e) {
  return [...log, entryOf(e)].slice(-LOG_CAP);
}

/** Log one exercise of one session. Re-rating the same move in the same session
    replaces its entry instead of adding a second one (which would double-count
    its sets in the weekly volume). Pure. */
export function upsertEntry(log, e) {
  const next = entryOf(e);
  if (!next.sessionId || next.slot == null) return appendEntry(log, e);
  const i = log.findIndex((x) => x.sessionId === next.sessionId && x.slot === next.slot);
  if (i < 0) return [...log, next].slice(-LOG_CAP);
  const out = [...log];
  out[i] = { ...next, at: log[i].at };
  return out;
}

/* ── plan vs single sessions ──────────────────────────────────────────────── */
// A single session is real training: it is in the history, the volume and the
// lift progression. It is NOT part of the weekly routine: it never ticks off a
// plan day, never counts toward "3/3 done", never reshuffles the plan.
export const isQuick = (e) => e.source === "quick";
/** Anything that isn't a plan day: a single session, or a workout logged by hand. */
export const isOffPlan = (e) => e.source === "quick" || e.source === "manual";
export const planLog = (log) => log.filter((e) => !isOffPlan(e));

/** Session key — legacy entries without an id group by day + source. */
const keyOf = (e) => e.sessionId || `${new Date(e.at).toDateString()}|${e.source || "plan"}`;

/** Past sessions, newest first: what was done, when, and from which side. */
export function sessionHistory(log) {
  const by = new Map();
  for (const e of log) {
    const k = keyOf(e);
    if (!by.has(k)) by.set(k, { id: k, at: e.at, source: e.source || "plan", format: e.format || "sets", label: e.label, moves: 0, sets: 0, muscles: new Set(), rated: 0 });
    const s = by.get(k);
    s.at = Math.min(s.at, e.at);
    s.moves++; s.sets += e.sets || 0;
    if (e.feel) s.rated++;
    if (!s.label && e.label) s.label = e.label;
    (e.muscles || []).slice(0, 1).forEach((m) => s.muscles.add(m));
  }
  return [...by.values()].map((s) => ({ ...s, muscles: [...s.muscles] })).sort((a, b) => b.at - a.at);
}

/** Most recent entry for one exercise. */
export function lastFor(exerciseId, log) {
  for (let i = log.length - 1; i >= 0; i--) if (log[i].exerciseId === exerciseId) return log[i];
  return null;
}

/** Most recent entry anywhere in a bodyweight ladder (variations share progress). */
export function lastInLadder(ladder, log) {
  if (!ladder) return null;
  for (let i = log.length - 1; i >= 0; i--) if (log[i].ladder === ladder) return log[i];
  return null;
}

/** How many of the most recent entries for this exercise were logged as "hard". */
export function consecutiveHard(exerciseId, log) {
  let n = 0;
  for (let i = log.length - 1; i >= 0; i--) {
    if (log[i].exerciseId !== exerciseId) continue;
    if (log[i].feel === "hard") n++; else break;
  }
  return n;
}

/** Direct + indirect sets per muscle over the last `days`. */
export function weeklyVolume(days, log) {
  const since = Date.now() - days * DAY;
  const out = {};
  for (const e of log) {
    if (e.at < since) continue;
    const [primary, ...secondary] = e.muscles || [];
    if (primary) out[primary] = (out[primary] || 0) + e.sets;
    for (const s of secondary) out[s] = (out[s] || 0) + e.sets * 0.5;
  }
  return out;
}

/** Days since a muscle last received direct work. null = never. */
export function daysSince(muscle, log) {
  for (let i = log.length - 1; i >= 0; i--) {
    if ((log[i].muscles || [])[0] === muscle) return Math.floor((Date.now() - log[i].at) / DAY);
  }
  return null;
}

/** Sessions in the last `days` (one per sessionId; legacy entries one per day). */
export function sessionsInWindow(days, log) {
  const since = Date.now() - days * DAY;
  return new Set(log.filter((e) => e.at >= since).map(keyOf)).size;
}

export function totalSessions(log) {
  return new Set(log.map(keyOf)).size;
}

// ── Training block ───────────────────────────────────────────────────────────
// Anchor lifts stay fixed inside a block so load can actually be tracked.
// Blocks roll every 4 weeks; accessories rotate freely within them.
export function currentBlock(started) {
  const from = started || Date.now();
  const weeks = Math.floor((Date.now() - from) / (7 * DAY));
  return { started: from, index: Math.floor(weeks / 4), week: (weeks % 4) + 1 };
}

/** Stable string hash — picks anchor lifts deterministically, no RNG. */
export function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0);
}
