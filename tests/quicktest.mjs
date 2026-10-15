// Contract for single sessions: right area, right gear, right length, fresh
// each time, and never a word about gear the person doesn't own.
import { buildQuickWorkout, QUICK_FOCUS, QUICK_MINUTES } from "../src/engine/quick.js";
import { inventoryOf, available, buildWorkout } from "../src/engine/generator.js";
import { EQUIP_PRESETS, LEVELS, GOALS } from "../src/engine/data.js";
import { appendEntry } from "../src/engine/history.js";
import { KITS, textViolations } from "./verify.mjs";

let failures = 0;
const fail = (m) => { failures++; if (failures <= 20) console.log("  ❌ " + m); };
const stats = { sessions: 0, exercises: 0, circuits: 0, fresh: 0, freshPossible: 0 };
let worstOver = 0;

for (const [kit, inv] of Object.entries(KITS)) {
  for (const level of Object.keys(LEVELS)) {
    for (const goal of Object.keys(GOALS)) {
      for (const f of QUICK_FOCUS) {
        for (const minutes of QUICK_MINUTES) {
          for (const format of ["circuit", "sets"]) {
            const profile = { age: 34, height: 178, weight: 80, level, goal, equipment: "bw", inventory: inv, customGear: [], sessionMinutes: 30, daysPerWeek: 3, skill: "lsit", excluded: [] };
            const I = inventoryOf(profile);
            const w = buildQuickWorkout(profile, { focus: f.id, minutes, format, seed: 17 }, []);
            stats.sessions++;
            const tag = `[${kit}/${level}/${goal}/${f.id}/${minutes}m/${format}]`;
            if (!w || !w.exercises.length) { fail(`${tag} empty session`); continue; }
            if (w.skill) fail(`${tag} single session carried the plan's skill block`);
            if (w.mode !== "quick") fail(`${tag} not marked as a single session`);
            // it trains what was asked for, and only that
            for (const e of w.exercises) {
              stats.exercises++;
              if (!f.muscles.includes(e.primary)) fail(`${tag} ${e.name} trains ${e.primary}, not part of ${f.label}`);
              if (!available(e, I)) fail(`${tag} ${e.name} needs gear the kit lacks`);
              for (const v of textViolations([e.name, e.tip, e.needsLabel, e.coachNote].join(" · "), I))
                fail(`${tag} "${e.name}" mentions ${v.word} without the gear`);
              if (e.load != null && !["dumbbells", "kettlebell", "barbell", "cable", "machines"].some((i) => I.has(i)))
                fail(`${tag} suggests ${e.load}kg with nothing to load`);
            }
            for (const wu of w.warmup) if (!available(wu, I)) fail(`${tag} warm-up ${wu.name} needs gear`);
            // it fits the clock you gave it
            const over = w.estMinutes - minutes;
            worstOver = Math.max(worstOver, over);
            if (over > 2) fail(`${tag} runs ${w.estMinutes} min for a ${minutes}-minute request`);
            // circuit structure is real: same rounds everywhere, short between-move rest
            if (format === "circuit") {
              stats.circuits++;
              if (!w.rounds || w.exercises.some((e) => e.sets !== w.rounds)) fail(`${tag} circuit with uneven rounds`);
              if (w.exercises.some((e) => e.rest > 25)) fail(`${tag} circuit rest over 25s between moves`);
              if (w.rounds < 2) fail(`${tag} circuit with fewer than 2 rounds`);
            }
            // volume ceiling holds per muscle
            const eff = {};
            for (const e of w.exercises) {
              eff[e.primary] = (eff[e.primary] || 0) + e.sets;
              for (const s of e.secondary) eff[s] = (eff[s] || 0) + e.sets * 0.5;
            }
            if (Object.values(eff).some((v) => v > 10)) fail(`${tag} over 10 effective sets on one muscle`);
            // a different seed gives a different workout when alternatives exist
            if (minutes === 20 && format === "circuit") {
              const w2 = buildQuickWorkout(profile, { focus: f.id, minutes, format, seed: 911 }, []);
              const ids = (x) => x.exercises.map((e) => e.id).sort().join();
              const pool = new Set();
              for (let s = 1; s <= 40; s++) buildQuickWorkout(profile, { focus: f.id, minutes, format, seed: s }, []).exercises.forEach((e) => pool.add(e.id));
              if (pool.size > w.exercises.length) {
                stats.freshPossible++;
                if (ids(w) !== ids(w2)) stats.fresh++;
              }
            }
          }
        }
      }
    }
  }
}

// the plan is untouched: building single sessions must not change what the plan builds
const plan = { age: 30, height: 175, weight: 75, level: "intermediate", goal: "muscle", equipment: "bw", inventory: EQUIP_PRESETS.min, customGear: [], sessionMinutes: 45, daysPerWeek: 3, skill: "lsit", excluded: [] };
const before = buildWorkout(plan, new Set(["chest", "lats"]), []).exercises.map((e) => e.id).join();
for (let s = 1; s < 50; s++) buildQuickWorkout(plan, { focus: "core", minutes: 15, seed: s }, []);
const after = buildWorkout(plan, new Set(["chest", "lats"]), []).exercises.map((e) => e.id).join();
if (before !== after) fail("building single sessions changed the plan's own session");


// logging: a circuit's "hard" (done on 15s breathers) must NOT move the plan's
// targets; a straight-sets single session is the same stimulus, so it does.
{
  const w = buildWorkout(plan, new Set(["chest", "lats"]), []);
  const ex = w.exercises[0];
  const entry = (feel, format) => ({ exerciseId: ex.id, ladder: ex.ladder, rank: ex.rank, sets: ex.sets, reps: ex.reps,
    holdSecs: ex.holdSecs, load: ex.load, feel, muscles: [ex.primary, ...ex.secondary], source: "quick", format });
  const presc = (log) => { const e = buildWorkout(plan, new Set(["chest", "lats"]), log).exercises.find((x) => x.id === ex.id); return e && JSON.stringify([e.reps, e.load, e.holdSecs, e.id, e.coachNote]); };
  let circuitLog = [];
  for (let i = 0; i < 3; i++) circuitLog = appendEntry(circuitLog, entry("hard", "circuit"));
  if (presc(circuitLog) !== presc([])) fail("circuit sets changed the plan's progression targets");
  const setsLog = appendEntry([], entry("easy", "sets"));
  if (presc(setsLog) === presc([])) fail("a straight-sets single session was ignored by progression");
  if (!circuitLog.every((e) => e.format === "circuit" && e.source === "quick")) fail("log entries lost their source/format");
}

// a short-because-capped session says why
{
  const w = buildQuickWorkout({ ...plan, inventory: ["wall", "chair", "table", "towel", "kettlebell", "pullupbar"] }, { focus: "core", minutes: 45, seed: 3 }, []);
  if (!w.ceilingNote) fail("a 45-min core session capped at ~" + w.estMinutes + " min gives no reason");
}

console.log(`checked ${stats.sessions} single sessions · ${stats.exercises} prescribed exercises · ${stats.circuits} circuits`);
console.log(`across ${Object.keys(KITS).length} kits × ${Object.keys(LEVELS).length} levels × ${Object.keys(GOALS).length} goals × ${QUICK_FOCUS.length} focuses × ${QUICK_MINUTES.length} lengths × 2 formats`);
console.log(`worst overrun vs requested minutes: ${worstOver > 0 ? "+" + worstOver : worstOver} min`);
console.log(`a new session differs from the last in ${stats.fresh} of ${stats.freshPossible} cases where the kit allows variety (${Math.round(100 * stats.fresh / Math.max(1, stats.freshPossible))}%)`);
if (stats.fresh / Math.max(1, stats.freshPossible) < 0.8) fail("new single sessions repeat the previous one too often");
console.log(failures ? `\n❌ ${failures} FAILURES` : "\n✅ single-session contract holds");
process.exitCode = failures ? 1 : 0;
