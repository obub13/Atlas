// ─── The weekly split: what you picked, spread across the days you train ──────
// Picking muscles on the body map sets the FOCUS for the week. One session
// can't train fourteen areas properly, so the week is split into days —
// Push / Pull / Legs, Upper / Lower, Full body… whichever arrangement covers
// everything you picked, as often as your time allows, without overloading a
// session or hitting the same big muscles on back-to-back days.
//
// The search is exhaustive and deterministic: every sequence of day types
// (6 types, up to 6 days → 46,656 candidates) is scored, the best one wins.
import { MUSCLES } from "./data.js";
import { buildWorkout, dayCapacity } from "./generator.js";

export const FAMILIES = {
  push: ["chest", "frontDelts", "triceps"],
  pull: ["lats", "traps", "rearDelts", "biceps", "forearms"],
  legs: ["quads", "hamstrings", "glutes", "calves"],
};
export const TRUNK = ["abs", "core"];

const P = ["chest", "frontDelts", "triceps"], L = ["lats", "traps", "rearDelts", "biceps", "forearms"];
const Q = ["quads", "calves"], H = ["hamstrings", "glutes"];
// Day templates a coach would actually write. Legs can split into a quad day
// and a hinge day when one leg session can't hold all of them.
const DAY_TYPES = [
  { id: "push",  muscles: P },
  { id: "pull",  muscles: L },
  { id: "legs",  muscles: [...Q, ...H] },
  { id: "quad",  muscles: Q },
  { id: "hinge", muscles: H },
  { id: "upper", muscles: [...P, ...L] },
  { id: "full",  muscles: [...P, ...L, ...Q, ...H] },
  { id: "fullQ", muscles: [...P, ...L, ...Q] },
  { id: "fullH", muscles: [...P, ...L, ...H] },
  { id: "rest",  muscles: [] },
];

/** How much of a session a muscle takes. Minor muscles mostly ride on compounds. */
export const weightOf = (m) => (MUSCLES[m]?.tier === "major" ? 1 : 0.5);

// diminishing returns on frequency: twice a week beats once; four times adds little
const FREQ_VALUE = [-4, 1, 1.6, 1.8, 1.85, 1.85, 1.85];

const ARMS = ["biceps", "triceps", "forearms"];
function labelFor(type, muscles, sel) {
  const limbs = muscles.filter((m) => !TRUNK.includes(m));
  const trunk = muscles.some((m) => TRUNK.includes(m));
  const has = (list) => limbs.some((m) => list.includes(m));
  const legs = [...Q, ...H];
  let base;
  if (!limbs.length) base = trunk ? "Core" : "Rest";
  else if (limbs.every((m) => ARMS.includes(m)) && limbs.length >= 2) base = "Arms";
  else if (limbs.length <= 2) base = limbs.map((m) => MUSCLES[m].label).join(" & ");
  else if (has(P) && has(L) && has(legs)) base = "Full Body";
  else if (has(P) && has(L)) base = "Upper";
  else if (has(legs) && !has(P) && !has(L)) {
    const upperPicked = [...sel].some((m) => P.includes(m) || L.includes(m));
    base = limbs.every((m) => Q.includes(m)) ? "Quads" : limbs.every((m) => H.includes(m)) ? "Hinge" : upperPicked ? "Lower" : "Legs";
  } else if (has(P) && !has(L) && !has(legs)) base = "Push";
  else if (has(L) && !has(P) && !has(legs)) base = "Pull";
  else base = [has(P) && "Push", has(L) && "Pull", has(legs) && "Legs"].filter(Boolean).join(" + ");
  return trunk && limbs.length ? `${base} + Core` : base;
}

/**
 * Split a selection into a week.
 * @returns {{ days: {index,key,type,label,muscles}[], restDays:number, freq:Object, capacity:number,
 *             trainingDays:number, selected:string[] }}
 */
export function planWeek(profile, selected, log = [], { validate = true, keep = 14 } = {}) {
  const sel = new Set([...selected].filter((m) => MUSCLES[m]));
  const N = Math.max(1, Math.min(7, +profile.daysPerWeek || 3));
  const C = dayCapacity(profile);
  const famMuscles = Object.fromEntries(Object.entries(FAMILIES).map(([f, ms]) => [f, ms.filter((m) => sel.has(m))]));
  const trunk = TRUNK.filter((m) => sel.has(m));
  const anyLimb = Object.values(famMuscles).some((ms) => ms.length);

  const order = Object.keys(MUSCLES);
  const filtered = DAY_TYPES.map((t) => t.muscles.filter((m) => sel.has(m)));
  // collapse types that look the same for this selection (e.g. every leg type when no legs are picked)
  const types = [];
  const seenKeys = new Set();
  filtered.forEach((ms, i) => {
    const k = ms.join(",");
    if (seenKeys.has(k)) return;
    seenKeys.add(k);
    types.push({ id: DAY_TYPES[i].id, muscles: ms });
  });

  const overlap = (a, b) => a.filter((m) => b.includes(m) && !TRUNK.includes(m)).reduce((t, m) => t + weightOf(m), 0);

  const evaluate = (seq) => {
    const days = seq.map((t) => [...t.muscles]);
    const load = days.map((d) => d.reduce((t, m) => t + weightOf(m), 0));
    const active = days.map((d, i) => (d.length ? i : -1)).filter((i) => i >= 0);
    // trunk work rides along on the lightest days, spaced apart
    const tfTarget = Math.min(active.length, N >= 4 ? 3 : 2);
    for (const m of trunk) {
      const chosen = [];
      for (let k = 0; k < tfTarget; k++) {
        // the first time in the week is a must; repeats only where the day has room
        const pool = active.filter((i) => !chosen.includes(i) && (k === 0 || load[i] + weightOf(m) <= C));
        if (!pool.length) break;
        pool.sort((a, b) => {
          const adjA = chosen.some((c) => Math.abs(c - a) === 1) ? 1 : 0, adjB = chosen.some((c) => Math.abs(c - b) === 1) ? 1 : 0;
          return adjA - adjB || load[a] - load[b] || a - b;
        });
        chosen.push(pool[0]);
        days[pool[0]].push(m);
        load[pool[0]] += weightOf(m);
      }
    }
    const freq = {};
    days.forEach((d) => d.forEach((m) => { freq[m] = (freq[m] || 0) + 1; }));
    let score = 0;
    for (const m of sel) {
      const f = freq[m] || 0;
      score += weightOf(m) * FREQ_VALUE[Math.min(f, 6)];
      if (f > 3) score -= 0.6 * weightOf(m) * (f - 3); // more than 3×/week is recovery debt, not progress
    }
    // an overloaded session quietly drops work — that has to cost more than the frequency it buys
    for (const l of load) score -= 1.6 * Math.max(0, l - C);
    // back-to-back days on the same muscles (likely from 4 days a week up)
    if (N >= 4) for (let i = 1; i < days.length; i++) score -= 0.45 * overlap(days[i], days[i - 1]);
    // an unused day is a little wasteful if it could have helped
    score -= 0.12 * (N - active.length);
    // recognisable structure: fewer distinct day types
    score -= 0.04 * new Set(seq.filter((t) => t.muscles.length).map((t) => t.id)).size;
    return { score, days, load, freq };
  };

  /* Arrange a multiset of days: biggest first, then always the day that shares
     least with the one before it; rest days go last. */
  const arrange = (picks) => {
    const train = picks.filter((t) => t.muscles.length), rest = picks.filter((t) => !t.muscles.length);
    const out = [];
    const pool = [...train].sort((a, b) => b.muscles.length - a.muscles.length);
    while (pool.length) {
      let bi = 0;
      if (out.length) {
        const prev = out[out.length - 1].muscles;
        let bs = Infinity;
        pool.forEach((t, i) => { const o = overlap(t.muscles, prev); if (o < bs - 1e-9) { bs = o; bi = i; } });
      }
      out.push(pool.splice(bi, 1)[0]);
    }
    return [...out, ...rest];
  };

  let best = null;
  if (sel.size && !anyLimb) {
    // core only: a few short sessions with rest between beats daily grinding
    const n = Math.min(N, 3);
    best = { seq: Array.from({ length: N }, (_, i) => (i < n ? { id: "core", muscles: trunk } : { id: "rest", muscles: [] })),
      days: Array.from({ length: N }, (_, i) => (i < n ? [...trunk] : [])), freq: Object.fromEntries(trunk.map((m) => [m, n])) };
  } else if (sel.size) {
    const picks = [];
    const walk = (start, k) => {
      if (k === N) {
        const seq = arrange(picks);
        const r = evaluate(seq);
        const key = r.days.map((d) => [...d].sort().join(",")).join("|");
        if (!top.some((t) => t.key === key)) {
          top.push({ ...r, seq, key });
          top.sort((a, b) => b.score - a.score);
          if (top.length > keep) top.pop();
        }
        return;
      }
      for (let i = start; i < types.length; i++) { picks.push(types[i]); walk(i, k + 1); picks.pop(); }
    };
    const top = [];
    walk(0, 0);
    best = top[0];
    // The heuristic ranks; the real generator decides. Build every day of the
    // few best candidates and keep the one that leaves nothing untrained.
    if (validate && top.length > 1) {
      const rank = { none: 0, light: 1, indirect: 2, direct: 3 };
      let bestReal = null;
      for (const cand of top) {
        const plan = finalize(cand);
        const cov = weekCoverage(profile, plan, log);
        const missW = cov.missing.reduce((t, m) => t + weightOf(m), 0);
        const quality = plan.selected.reduce((t, m) => t + weightOf(m) * rank[cov.status[m].level], 0);
        const real = -10 * missW + quality + 0.25 * cand.score;
        if (!bestReal || real > bestReal.real + 1e-9) bestReal = { real, cand, plan, cov };
      }
      return { ...bestReal.plan, coverage: bestReal.cov };
    }
  }

  const plan = finalize(best);
  return validate ? { ...plan, coverage: weekCoverage(profile, plan, log) } : plan;

  function finalize(best) {
    const days = [];
    if (best && N <= 3) {
      // with rest days between sessions order is free: read it the way a coach writes it
      const pref = ["upper", "push", "full", "fullQ", "fullH", "pull", "legs", "quad", "hinge"];
      const rank = (t) => (pref.indexOf(t.id) < 0 ? 99 : pref.indexOf(t.id));
      const train = best.seq.map((t, i) => i).filter((i) => best.days[i].length);
      let start = train[0];
      for (const i of train) if (rank(best.seq[i]) < rank(best.seq[start])) start = i;
      const rot = (arr) => [...arr.slice(start), ...arr.slice(0, start)];
      best = { ...best, seq: rot(best.seq), days: rot(best.days) };
    }
    if (best) {
      best.days.forEach((ms, i) => {
        if (!ms.length) return;
        const muscles = [...ms].sort((a, b) => order.indexOf(a) - order.indexOf(b));
        days.push({ index: days.length, key: muscles.join(","), type: best.seq[i].id, muscles, label: labelFor(best.seq[i], muscles, sel) });
      });
    }
    // number repeated labels whose muscles differ: Full Body A / Full Body B
    const groups = {};
    days.forEach((d) => { (groups[d.label] = groups[d.label] || []).push(d); });
    for (const list of Object.values(groups)) {
      const keys = [...new Set(list.map((d) => d.key))];
      if (keys.length > 1) list.forEach((d) => { d.label = `${d.label} ${String.fromCharCode(65 + keys.indexOf(d.key))}`; });
    }

    return {
      days,
      trainingDays: days.length,
      restDays: N - days.length,
      freq: best ? best.freq : {},
      capacity: C,
      selected: [...sel],
      name: splitName(days),
    };
  }
}

function splitName(days) {
  if (!days.length) return "No plan yet";
  const labels = days.map((d) => d.label.replace(/ \+ Core$/, "").replace(/ [AB]$/, ""));
  const uniq = [...new Set(labels)];
  if (uniq.length === 1) return days.length > 1 ? `${uniq[0]} ×${days.length}` : uniq[0];
  const cycle = labels.slice(0, uniq.length).join(" / ");
  return labels.length === uniq.length * 2 && labels.join() === [...labels.slice(0, uniq.length), ...labels.slice(0, uniq.length)].join()
    ? `${cycle} ×2` : labels.join(" / ");
}

/**
 * Build every day of the week once and report, per selected muscle, how it is
 * actually covered — directly, through compounds, or not at all this week.
 * This is the honest answer to "does my week train everything I picked?".
 */
export function weekCoverage(profile, plan, log = []) {
  const status = {}; // muscle → { level: "direct"|"indirect"|"light"|"none", days: [index] }
  const rank = { none: 0, light: 1, indirect: 2, direct: 3 };
  const noGear = new Set();
  for (const m of plan.selected) status[m] = { level: "none", days: [] };
  for (const d of plan.days) {
    const w = buildWorkout(profile, new Set(d.muscles), log, {});
    if (!w) continue;
    w.noGear.forEach((m) => noGear.add(m));
    for (const c of w.coverage) {
      if (!status[c.muscle]) continue;
      const lvl = c.status === "direct" ? "direct" : c.status === "indirect" ? "indirect" : c.status === "light" ? "light" : "none";
      if (lvl !== "none") status[c.muscle].days.push(d.index);
      if (rank[lvl] > rank[status[c.muscle].level]) status[c.muscle].level = lvl;
    }
  }
  const missing = plan.selected.filter((m) => status[m].level === "none" && !noGear.has(m));
  return { status, noGear: [...noGear], missing };
}

/** Monday 00:00 of the current week, local time. */
export function weekStart(now = Date.now()) {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  const dow = (d.getDay() + 6) % 7; // Mon=0
  d.setDate(d.getDate() - dow);
  return d.getTime();
}

/** Which plan days are done this week, and which one is up next. */
export function weekProgress(plan, log, now = Date.now()) {
  const since = weekStart(now);
  const doneKeys = new Set(log.filter((e) => (e.source || "plan") === "plan" && e.at >= since && e.dayKey).map((e) => e.dayKey));
  const done = plan.days.map((d) => doneKeys.has(d.key));
  const next = done.indexOf(false);
  return { done, doneCount: done.filter(Boolean).length, next: next < 0 ? null : next, complete: plan.days.length > 0 && next < 0 };
}
