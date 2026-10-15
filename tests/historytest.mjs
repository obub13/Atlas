// Single sessions: in the history and the progression, never in the weekly routine.
import { upsertEntry, appendEntry, planLog, sessionHistory, sessionsInWindow, totalSessions, weeklyVolume } from "../src/engine/history.js";
import { buildWorkout } from "../src/engine/generator.js";
import { buildQuickWorkout } from "../src/engine/quick.js";
import { EQUIP_PRESETS } from "../src/engine/data.js";
import { KITS } from "./verify.mjs";

let failures = 0;
const ok = (c, m) => { if (!c) { failures++; console.log("  ❌ " + m); } else console.log("  ✓ " + m); };
const DAY = 864e5;
const entry = (w, i, kind, feel, extra = {}) => {
  const ex = w.exercises[i];
  return { exerciseId: ex.id, ladder: ex.ladder, rank: ex.rank, sets: ex.sets, reps: ex.reps, holdSecs: ex.holdSecs, load: ex.load,
    feel, muscles: [ex.primary, ...ex.secondary], source: kind, format: w.format, sessionId: extra.sessionId || `${kind}-1`, slot: i, label: extra.label || "x", at: extra.at };
};
const ids = (w) => w.exercises.map((e) => e.id).join();

// 1 · logging mechanics
{
  const p = { age: 31, height: 174, weight: 57, level: "intermediate", goal: "muscle", equipment: "min", inventory: [...EQUIP_PRESETS.min], customGear: [], sessionMinutes: 30, daysPerWeek: 3, skill: null, excluded: [] };
  const q = { ...buildQuickWorkout(p, { focus: "core", minutes: 20, seed: 5 }, []), sessionId: "quick-a" };
  let log = upsertEntry([], entry(q, 0, "quick", "easy", { sessionId: "quick-a" }));
  log = upsertEntry(log, entry(q, 0, "quick", "right", { sessionId: "quick-a" }));
  ok(log.length === 1 && log[0].feel === "right", "re-rating a move replaces its entry (no double-counted volume)");
  log = upsertEntry(log, entry(q, 1, "quick", null, { sessionId: "quick-a" }));
  ok(log.length === 2 && log[1].feel === null, "an unrated move can be logged as done");
  const plan = buildWorkout(p, new Set(["chest", "frontDelts", "triceps"]), []);
  log = upsertEntry(log, entry(plan, 0, "plan", "right", { sessionId: "plan-a", label: "Push" }));
  ok(totalSessions(log) === 2, "history counts both sessions");
  ok(sessionsInWindow(7, planLog(log)) === 1, "the week's 'done' counter counts only the plan session");
  const h = sessionHistory(log);
  ok(h.length === 2 && h.some((s) => s.source === "quick" && s.moves === 2) && h.some((s) => s.label === "Push"), "history groups entries into sessions with labels");
  ok((weeklyVolume(7, log).core || 0) + (weeklyVolume(7, log).abs || 0) > 0, "single-session sets count in weekly volume");
  const legacy = [appendEntry([], { exerciseId: "plank", sets: 3, feel: "right", muscles: ["core"], at: Date.now() - 2 * DAY })[0]];
  ok(sessionHistory(legacy).length === 1 && totalSessions(legacy) === 1, "old entries without a session id still group (by day)");
}

// 2 · the routine never moves because of single sessions; progression does
let routineSame = 0, routineTotal = 0, progressed = 0, progressTotal = 0, hardIgnored = 0, hardTotal = 0;
for (const [kit, inv] of Object.entries(KITS)) {
  for (const goal of ["muscle", "strength", "weightloss"]) {
    const p = { age: 31, height: 174, weight: 70, level: "intermediate", goal, equipment: "bw", inventory: inv, customGear: [], sessionMinutes: 45, daysPerWeek: 3, skill: null, excluded: [] };
    for (const day of [["chest", "frontDelts", "triceps"], ["lats", "biceps", "rearDelts"], ["quads", "hamstrings", "glutes", "calves", "core", "abs"]]) {
      const sel = new Set(day);
      // some plan history from earlier in the week
      const base = buildWorkout(p, sel, []);
      let hist = [];
      base.exercises.forEach((_, i) => { hist = upsertEntry(hist, entry(base, i, "plan", "right", { sessionId: "plan-0", at: Date.now() - 3 * DAY })); });
      const before = buildWorkout(p, sel, hist);
      // a single session on the same area, ticked but not rated
      for (const focus of ["core", "full", "upper", "lower"]) {
        const q = buildQuickWorkout(p, { focus, minutes: 30, seed: 11 }, hist);
        let withQ = hist;
        q.exercises.forEach((_, i) => { withQ = upsertEntry(withQ, entry(q, i, "quick", null, { sessionId: "quick-1" })); });
        routineTotal++;
        if (ids(buildWorkout(p, sel, withQ)) === ids(before)) routineSame++;
      }
      // a rated single session that hits the plan's first move
      const ex0 = before.exercises[0];
      const fake = { format: "sets", exercises: [ex0] };
      const easy = upsertEntry(hist, entry(fake, 0, "quick", "easy", { sessionId: "quick-2" }));
      const presc = (log) => { const e = buildWorkout(p, sel, log).exercises; return JSON.stringify(e.map((x) => [x.id, x.load, x.reps, x.holdSecs])); };
      progressTotal++; if (presc(easy) !== presc(hist)) progressed++;
      const circuitHard = [0, 1, 2].reduce((l, k) => upsertEntry(l, entry({ format: "circuit", exercises: [ex0] }, 0, "quick", "hard", { sessionId: "quick-h" + k })), hist);
      hardTotal++; if (presc(circuitHard) === presc(hist)) hardIgnored++;
    }
  }
}
ok(routineSame === routineTotal, `plan picks the same movements after a single session (${routineSame}/${routineTotal})`);
ok(progressed === progressTotal, `an 'Easy' in a single session moves that lift's plan target (${progressed}/${progressTotal})`);
ok(hardIgnored === hardTotal, `'Hard' under circuit fatigue never triggers a plan back-off (${hardIgnored}/${hardTotal})`);

console.log(failures ? `\n❌ ${failures} FAILURES` : "\n✅ history contract holds");
process.exitCode = failures ? 1 : 0;
