// Programming-quality audit over the full level × goal × equipment × selection matrix.
import { buildWorkout } from "../src/engine/generator.js";
import { MUSCLES, PRESETS, LEVELS, GOALS, EQUIPMENT } from "../src/engine/data.js";

const SELECTIONS = [
  ...PRESETS.map((p) => ({ name: `preset:${p.id}`, muscles: p.muscles })),
  ...Object.keys(MUSCLES).map((m) => ({ name: `single:${m}`, muscles: [m] })),
  { name: "all14", muscles: Object.keys(MUSCLES) },
];
const rows = [];
for (const level of Object.keys(LEVELS))
  for (const goal of Object.keys(GOALS))
    for (const equipment of Object.keys(EQUIPMENT))
      for (const sel of SELECTIONS) {
        const profile = { age: 28, height: 175, weight: 75, level, goal, equipment, sessionMinutes: 45, daysPerWeek: 3 };
        const w = buildWorkout(profile, new Set(sel.muscles), []);
        if (!w) continue;
        const direct = Object.fromEntries(sel.muscles.map((m) => [m, 0]));
        const indirect = Object.fromEntries(sel.muscles.map((m) => [m, 0]));
        for (const ex of w.exercises) {
          if (ex.primary in direct) direct[ex.primary] += ex.sets;
          for (const s of ex.secondary) if (s in indirect) indirect[s] += ex.sets * 0.5;
        }
        const eff = (m) => (direct[m] || 0) + (indirect[m] || 0);
        const trainedM = w.trained || sel.muscles;
        const effVals = trainedM.map(eff);
        const workSecs = w.exercises.reduce((t, ex) => t + ex.sets * ((ex.holdSecs || 35) + ex.rest), 0);
        const warmSecs = w.warmup.reduce((t, x) => t + x.secs, 0);
        rows.push({
          name: `${level}/${goal}/${equipment} ${sel.name}`, n: sel.muscles.length,
          maxEff: effVals.length ? Math.max(...effVals) : 0,
          minEff: effVals.length ? Math.min(...effVals) : 99,
          deferred: w.deferred.length,
          realMin: Math.round((warmSecs + workSecs + w.stretches.length * 35) / 60),
          isoLongRest: w.exercises.filter((ex) => !ex.compound && !ex.timed && ex.rest >= 120).length,
          badRepLoad: w.exercises.filter((e) => !e.timed && !e.loadable && e.reps[0] < 6).length,
        });
      }
const pct = (n) => `${(100 * n / rows.length).toFixed(1)}%`;
const count = (f) => rows.filter(f).length;
console.log(`=== MATRIX: ${rows.length} configs ===\n`);
console.log("── VOLUME DOSING (target 4–10 effective sets per muscle per session)");
console.log(`  configs with a muscle OVER 10 sets (junk volume): ${count((r) => r.maxEff > 10)} (${pct(count((r) => r.maxEff > 10))})`);
console.log(`  configs with a muscle UNDER 4 sets (sub-threshold): ${count((r) => r.minEff < 4)} (${pct(count((r) => r.minEff < 4))})`);
console.log(`  configs with a muscle UNDER 2.5 sets (negligible):  ${count((r) => r.minEff < 2.5)} (${pct(count((r) => r.minEff < 2.5))})`);
console.log("\n── COVERAGE INTEGRITY");
console.log(`  configs deferring ≥1 selected muscle (DECLARED to the user, not hidden): ${count((r) => r.deferred > 0)} (${pct(count((r) => r.deferred > 0))})`);
console.log("\n── SESSION LENGTH");
console.log(`  configs over 75 min: ${count((r) => r.realMin > 75)} (${pct(count((r) => r.realMin > 75))})`);
console.log("\n── REST PERIODS");
console.log(`  configs prescribing ≥120s rest on isolation work: ${count((r) => r.isoLongRest > 0)} (${pct(count((r) => r.isoLongRest > 0))})`);
console.log("\n── REP PRESCRIPTION VS LOAD");
console.log(`  configs prescribing <6 reps on a movement that CANNOT be loaded: ${count((r) => r.badRepLoad > 0)}`);
