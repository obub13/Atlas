// ─── Progress: everything the Progress tab shows, derived from the log ────────
// Pure functions over the same flat training log the generator uses. Nothing
// here is stored; the database holds only what was logged.
import { MUSCLES, EXERCISES } from "./data.js";
import { SKILLS } from "./skills.js";
import { weekStart } from "./week.js";

const DAY = 864e5;
const WEEK = 7 * DAY;
const sessionKey = (e) => e.sessionId || `${new Date(e.at).toDateString()}|${e.source || "plan"}`;
const nameOf = (id) => EXERCISES.find((e) => e.id === id)?.name || id;

/** Round, readable axis ticks covering [lo, hi]. */
export function niceTicks(lo, hi, count = 3) {
  const span = Math.max(hi - lo, 1e-9);
  const raw = span / Math.max(1, count - 1);
  const mag = 10 ** Math.floor(Math.log10(raw));
  // smallest round step that keeps the tick count at most count + 1
  const steps = [0.1, 0.2, 0.25, 0.5, 1, 2, 2.5, 5, 10, 20].map((m) => m * mag);
  const step = steps.find((st) => Math.ceil(hi / st) - Math.floor(lo / st) + 1 <= count + 1) || 20 * mag;
  const start = Math.floor(lo / step) * step, end = Math.ceil(hi / step) * step;
  const out = [];
  for (let v = start; v <= end + step / 2; v += step) out.push(+v.toFixed(6));
  return out;
}

/** Headline numbers. */
export function summary(log, now = Date.now()) {
  const sessions = new Map();
  for (const e of log) {
    const k = sessionKey(e);
    if (!sessions.has(k)) sessions.set(k, { at: e.at, source: e.source || "plan" });
    else sessions.get(k).at = Math.min(sessions.get(k).at, e.at);
  }
  const all = [...sessions.values()];
  const ws = weekStart(now);
  const thisWeek = all.filter((s) => s.at >= ws);
  // streak: consecutive weeks with at least one session, counting back from
  // this week (an empty week so far doesn't break it — it isn't over yet)
  const weeksWith = new Set(all.map((s) => Math.floor((weekStart(s.at) - ws) / WEEK)));
  let streak = 0, w = weeksWith.has(0) ? 0 : -1;
  while (weeksWith.has(w)) { streak++; w--; }
  const since30 = now - 30 * DAY;
  const sets30 = log.filter((e) => e.at >= since30).reduce((t, e) => t + (e.sets || 0), 0);
  return {
    sessions: all.length,
    thisWeek: thisWeek.length,
    thisWeekPlan: thisWeek.filter((s) => s.source !== "quick").length,
    thisWeekQuick: thisWeek.filter((s) => s.source === "quick").length,
    streakWeeks: streak,
    sets30,
  };
}

/** Which metric shows progress for a movement: load if it's loaded, hold time if timed, else reps. */
function metricFor(points) {
  if (points.some((p) => p.load != null && p.load > 0)) return "load";
  if (points.some((p) => p.holdSecs)) return "hold";
  return "reps";
}
const valueOf = (p, metric) => (metric === "load" ? p.load : metric === "hold" ? p.holdSecs : p.reps ? p.reps[1] : null);

/** Every movement that's been logged, most-trained first, with how it's moved. */
export function exercisesLogged(log) {
  const by = new Map();
  for (const e of log) {
    if (String(e.exerciseId).startsWith("skill:")) continue;
    if (!by.has(e.exerciseId)) by.set(e.exerciseId, []);
    by.get(e.exerciseId).push(e);
  }
  return [...by.entries()].map(([id, list]) => {
    const s = liftSeries(log, id);
    return { id, name: nameOf(id), sessions: s.points.length, lastAt: list[list.length - 1].at, metric: s.metric, change: s.change };
  }).sort((a, b) => b.sessions - a.sessions || b.lastAt - a.lastAt);
}

/** One movement over time: one point per session it was done in. */
export function liftSeries(log, exerciseId) {
  const bySession = new Map();
  for (const e of log) {
    if (e.exerciseId !== exerciseId) continue;
    bySession.set(sessionKey(e), e); // last write in a session wins
  }
  const raw = [...bySession.values()].sort((a, b) => a.at - b.at)
    .map((e) => ({ at: e.at, load: e.load ?? null, reps: e.reps || null, holdSecs: e.holdSecs || null, sets: e.sets, feel: e.feel || null, source: e.source || "plan", format: e.format || "sets" }));
  const metric = metricFor(raw);
  const points = raw.map((p) => ({ ...p, value: valueOf(p, metric) })).filter((p) => p.value != null);
  const unit = metric === "load" ? "kg" : metric === "hold" ? "s" : "reps";
  let change = null;
  if (points.length >= 2) {
    const a = points[0].value, b = points[points.length - 1].value;
    change = { from: a, to: b, delta: +(b - a).toFixed(1), pct: a ? Math.round(((b - a) / a) * 100) : null, since: points[0].at,
      // double progression climbs reps before load — show it so a flat weight line isn't read as "no progress"
      fromReps: points[0].reps, toReps: points[points.length - 1].reps };
  }
  return { id: exerciseId, name: nameOf(exerciseId), metric, unit, points, change };
}

/** Day grid for the last `weeks` weeks, Monday-first columns. */
export function calendar(log, weeks = 12, now = Date.now()) {
  const start = weekStart(now) - (weeks - 1) * WEEK;
  const days = [];
  for (let i = 0; i < weeks * 7; i++) {
    const d = new Date(start); d.setDate(d.getDate() + i); d.setHours(0, 0, 0, 0);
    days.push({ date: d.getTime(), plan: 0, quick: 0, sets: 0, labels: new Set(), future: d.getTime() > now });
  }
  const index = new Map(days.map((d, i) => [new Date(d.date).toDateString(), i]));
  const seen = new Set();
  for (const e of log) {
    const i = index.get(new Date(e.at).toDateString());
    if (i == null) continue;
    const d = days[i];
    d.sets += e.sets || 0;
    const k = sessionKey(e);
    if (!seen.has(k)) { seen.add(k); if (e.source === "quick") d.quick++; else d.plan++; }
    if (e.label) d.labels.add(e.label);
  }
  return { start, weeks, days: days.map((d) => ({ ...d, labels: [...d.labels] })) };
}

/** Sets per muscle per week (direct + half for secondaries), oldest week first. */
export function weeklyVolumeSeries(log, weeks = 8, now = Date.now()) {
  const ws = weekStart(now);
  const cols = Array.from({ length: weeks }, (_, i) => ({ start: ws - (weeks - 1 - i) * WEEK, muscles: {} }));
  for (const e of log) {
    const w = Math.floor((weekStart(e.at) - cols[0].start) / WEEK);
    if (w < 0 || w >= weeks) continue;
    const [primary, ...secondary] = e.muscles || [];
    const m = cols[w].muscles;
    if (primary) m[primary] = (m[primary] || 0) + (e.sets || 0);
    for (const s of secondary) m[s] = (m[s] || 0) + (e.sets || 0) * 0.5;
  }
  const order = Object.keys(MUSCLES);
  const used = order.filter((m) => cols.some((c) => c.muscles[m] > 0));
  return { weeks: cols.map((c) => ({ start: c.start, muscles: Object.fromEntries(Object.entries(c.muscles).map(([k, v]) => [k, +v.toFixed(1)])) })), muscles: used };
}

/** Skill ladders: which stage, reached when. */
export function skillTimeline(log) {
  const out = [];
  for (const [id, skill] of Object.entries(SKILLS)) {
    const entries = log.filter((e) => e.ladder === `skill:${id}`).sort((a, b) => a.at - b.at);
    if (!entries.length) continue;
    const stages = skill.stages.map((st, i) => {
      const hits = entries.filter((e) => e.stageName === st.name);
      return { index: i, name: st.name, firstAt: hits[0]?.at ?? null, lastAt: hits.at(-1)?.at ?? null, sessions: hits.length, best: hits.some((h) => h.feel === "easy") };
    });
    const current = entries.at(-1).stageName;
    out.push({ id, name: skill.name, current, currentIndex: Math.max(0, stages.findIndex((s) => s.name === current)), stages, sessions: entries.length });
  }
  return out;
}
