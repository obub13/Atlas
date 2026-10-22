// ─── Looking back at a day, and doing it again ────────────────────────────────
// sessionsOnDay: everything logged on one calendar date (in the person's own
// calendar), grouped into sessions with their exercises in the order done.
// repeatSession: turns a past session into a session you can run today — the
// same movements, the same number of sets, with today's targets: progression
// where the move has been rated, otherwise exactly what you did last time.
import { EXERCISES, STRETCHES, MUSCLES } from "./data.js";
import { inventoryOf, available, resolveExercise, needsLabel, progressionFor, restFor, deriveLimits, warmupFor } from "./generator.js";
import { dateKey, fallbackCalendar } from "./calendar.js";
import { nameOf } from "./progress.js";

const TRANSITION = 12;
const slotOrder = (a, b) => (a.slot === "skill") - (b.slot === "skill") || (+a.slot || 0) - (+b.slot || 0) || a.at - b.at;

/** Sessions logged on a calendar date ("2026-10-16"), oldest first. */
export function sessionsOnDay(log, day, cal = fallbackCalendar(), customs = [], profile = null) {
  const inv = profile ? inventoryOf(profile) : null;
  // a library move reads as it does for your kit ("Kettlebell Shrug", not "Dumbbell Shrug")
  const named = (id) => { const lib = inv && EXERCISES.find((x) => x.id === id); return lib ? resolveExercise(lib, inv).name : nameOf(id, customs); };
  const by = new Map();
  for (const e of log) {
    if (dateKey(e.at, cal) !== day) continue;
    const k = e.sessionId || `${day}|${e.source || "plan"}`;
    if (!by.has(k)) by.set(k, { id: k, at: e.at, label: e.label || null, source: e.source || "plan", format: e.format || "sets", dayKey: e.dayKey || null, entries: [] });
    const s = by.get(k);
    s.at = Math.min(s.at, e.at);
    if (!s.label && e.label) s.label = e.label;
    s.entries.push(e);
  }
  return [...by.values()].sort((a, b) => a.at - b.at).map((s) => {
    const entries = [...s.entries].sort(slotOrder);
    const moves = entries.map((e) => {
      const skill = String(e.exerciseId).startsWith("skill:");
      return {
        exerciseId: e.exerciseId, skill,
        name: skill ? (e.stageName || String(e.exerciseId).split(":").slice(2).join(":")) : named(e.exerciseId),
        sets: e.sets, reps: e.reps || null, holdSecs: e.holdSecs || null, load: e.load ?? null, feel: e.feel || null, muscles: e.muscles || [],
      };
    });
    return { ...s, entries, moves, sets: moves.reduce((t, m) => t + (m.sets || 0), 0), repeatable: moves.some((m) => !m.skill) };
  });
}

/** A custom move as an exercise the session runner understands. */
function customExercise(id, customs, entry) {
  const c = customs.find((x) => x.id === id);
  const muscles = (entry?.muscles || []).filter((m) => MUSCLES[m]);
  const primary = c?.primary || muscles[0] || "core";
  return {
    id, name: c?.name || nameOf(id, customs), primary, secondary: (c?.secondary || muscles.slice(1)).filter((m) => m !== primary && MUSCLES[m]),
    compound: false, loadable: true, skill: 1, pattern: "iso", timed: !!(c?.timed || (entry && entry.holdSecs && !entry.reps)),
    needs: [], custom: true, tip: "Your own move — same form cues as last time.", needsLabel: entry?.load ? "Your kit" : "Bodyweight",
  };
}

/**
 * Build today's version of a past session.
 * @returns a workout shaped like buildWorkout's, plus { repeatOf, skipped }
 */
export function repeatSession(session, profile, log, { customs = [], sessionId = null } = {}) {
  const inv = inventoryOf(profile);
  const limits = deriveLimits(profile);
  const circuit = session.format === "circuit";
  const skipped = [];
  const items = [];
  for (const e of [...session.entries].sort(slotOrder)) {
    if (String(e.exerciseId).startsWith("skill:")) continue;
    const lib = EXERCISES.find((x) => x.id === e.exerciseId);
    if (lib && !available(lib, inv)) { skipped.push({ name: nameOf(lib.id), why: `needs ${needsLabel(lib, inv).toLowerCase()}` }); continue; }
    const ex = lib ? { ...resolveExercise(lib, inv) } : customExercise(e.exerciseId, customs, e);
    const p = progressionFor(ex, profile, log, inv);
    // nothing rated yet → repeat exactly what was done; rated → today's progression
    const same = p.isFirst;
    const reps = ex.timed ? null : same ? (e.reps || p.reps) : p.reps;
    const holdSecs = ex.timed ? (same ? (e.holdSecs || p.holdSecs) : p.holdSecs) : null;
    const load = same ? (e.load ?? p.load ?? null) : p.load ?? e.load ?? null;
    items.push({ e, ex, presc: p, reps, holdSecs, load, same });
  }
  if (!items.length) return null;

  const circuitRest = circuit ? Math.round((15 * limits.restMult) / 5) * 5 : 0;
  const roundRest = circuit ? Math.round(((profile.goal === "strength" ? 90 : 60) * limits.restMult) / 5) * 5 : 0;
  const rounds = circuit ? Math.max(1, Math.round(items.reduce((t, x) => t + x.e.sets, 0) / items.length)) : null;

  const exercises = items.map(({ e, ex, presc, reps, holdSecs, load, same }, i) => {
    const sets = circuit ? rounds : Math.max(1, Math.min(10, e.sets || 3));
    return {
      ...ex, slot: i, role: i === 0 ? "anchor" : "accessory",
      sets, setsArr: Array(sets).fill(0), reps: reps ? [...reps] : null, holdSecs,
      load: ex.loadable ? load : null, loadable: !!ex.loadable && load != null, loadUnit: ex.loadUnit || "total",
      rest: circuit ? circuitRest : restFor(ex, profile, limits.restMult),
      coachNote: same ? `Same as last time: ${sets} × ${holdSecs ? `${holdSecs}s` : reps ? (reps[0] === reps[1] ? reps[0] : `${reps[0]}–${reps[1]}`) : ""}${load ? ` @ ${load} kg` : ""}.` : presc.note,
      isFirst: false, deload: !!presc.deload, prev: presc.prev || null, weights: presc.weights || null, atMax: !!presc.atMax,
    };
  });

  const muscles = [...new Set(exercises.flatMap((x) => [x.primary]))];
  const warmup = warmupFor(muscles, profile);
  const stretches = muscles.map((m) => ({ muscle: m, ...STRETCHES[m] })).filter((s) => s.name);
  const work = (x) => x.holdSecs || ((x.reps ? (x.reps[0] + x.reps[1]) / 2 : 10) * 3.5);
  const workSecs = circuit
    ? rounds * exercises.reduce((t, x) => t + work(x) + circuitRest, 0) + (rounds - 1) * roundRest
    : exercises.reduce((t, x) => t + x.sets * (work(x) + x.rest + TRANSITION), 0);
  const estMinutes = Math.max(1, Math.round((warmup.reduce((t, w) => t + w.secs, 0) + workSecs + stretches.length * 35) / 60));

  const label = `${session.label || "Workout"} — again`;
  return {
    id: Date.now(), variant: 0, format: circuit ? "circuit" : "sets", rounds, circuitRest, roundRest,
    block: { index: 0, week: 1 }, skill: null, muscles, trained: muscles,
    coverage: [], deferred: [], light: [], oversubscribed: false, capacityAreas: exercises.length, deferredDetail: [], noGear: [], outOfTime: [],
    warmup, warmupSkipped: profile.warmup === false, exercises, stretches, estMinutes, budgetMinutes: estMinutes,
    totalSets: exercises.reduce((t, x) => t + x.sets, 0), goal: profile.goal, ageNote: null, balance: null,
    mode: "quick", focus: null, focusLabel: label, label, seed: null, ceilingNote: null,
    repeatOf: { id: session.id, at: session.at, label: session.label || null, source: session.source },
    skipped, sessionId,
  };
}
