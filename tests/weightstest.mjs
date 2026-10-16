// Fixed weights: a person who owns a 6 kg and a 14 kg bell is only ever asked
// for 6 or 14 kg. Progress then comes from reps, the next bell when the jump is
// sane, and tempo once the heaviest bell is outgrown.
import { buildWorkout, progressionFor, ownedWeights, nearestOwned, stepOwned, nextBellToBuy, replaceExercise, alternativesFor } from "../src/engine/generator.js";
import { buildQuickWorkout, QUICK_FOCUS } from "../src/engine/quick.js";
import { EXERCISES, MUSCLES, PRESETS, GOALS, LEVELS } from "../src/engine/data.js";

let failures = 0;
const ok = (c, m) => { if (!c) { failures++; console.log("  ❌ " + m); } else console.log("  ✓ " + m); };
const DAY = 864e5;

// 1 · helpers
ok(JSON.stringify(ownedWeights({ weights: { kettlebell: [14, "6", 6, -2, "x", 0] } }, "kettlebell")) === "[6,14]", "owned weights are cleaned: numbers, positive, unique, sorted");
ok(ownedWeights({}, "kettlebell").length === 0 && ownedWeights({ weights: { kettlebell: "14" } }, "kettlebell").length === 0, "no list → unknown (any weight)");
ok(nearestOwned(11.4, [6, 14]) === 14 && nearestOwned(8.5, [6, 14]) === 6 && nearestOwned(30, [6, 14]) === 14 && nearestOwned(2, [6, 14]) === 6, "suggestions snap to the nearest bell you own");
ok(stepOwned(6, [6, 14], 1) === 14 && stepOwned(14, [6, 14], 1) === null && stepOwned(14, [6, 14], -1) === 6, "stepping moves between owned bells only");
ok(nextBellToBuy([6, 14]) === 16 && nextBellToBuy([6, 14, 16]) === 18 && nextBellToBuy([]) === 4, "next bell to buy is the next standard size up");

// 2 · every prescribed load is a bell you own — plan days and single sessions, every goal and level
const base = { age: 28, height: 175, weight: 57, customGear: [], excluded: [], skill: null, daysPerWeek: 5 };
const kits = { "his kit": ["wall", "chair", "towel", "kettlebell", "pullupbar"], "kettlebell only": ["kettlebell"] };
let checked = 0, bad = [];
for (const [kit, inv] of Object.entries(kits)) for (const goal of Object.keys(GOALS)) for (const level of Object.keys(LEVELS)) for (const mins of [20, 45]) {
  const p = { ...base, goal, level, inventory: inv, sessionMinutes: mins, weights: { kettlebell: [6, 14] } };
  const sels = [...PRESETS.map((x) => x.muscles), ...Object.keys(MUSCLES).map((m) => [m])];
  const ws = sels.map((sel) => buildWorkout(p, new Set(sel), []));
  for (const q of QUICK_FOCUS) ws.push(buildQuickWorkout(p, { focus: q.id, minutes: mins, format: q.format, seed: 3 }, []));
  for (const w of ws) for (const e of w?.exercises || []) {
    if (e.load == null) continue;
    checked++;
    if (e.load !== 6 && e.load !== 14) bad.push(`${kit}/${goal}/${level}: ${e.name} ${e.load}kg`);
  }
}
ok(checked > 500 && !bad.length, `${checked} loaded prescriptions, all 6 or 14 kg${bad.length ? ` — ${bad.slice(0, 4).join("; ")}` : ""}`);
{
  const p = { ...base, goal: "muscle", level: "intermediate", inventory: kits["his kit"], sessionMinutes: 30, weights: { kettlebell: [6, 14] } };
  const w = buildWorkout(p, new Set(["frontDelts", "glutes"]), []);
  const loaded = w.exercises.find((e) => e.load != null);
  const alt = alternativesFor(loaded, p, [], w.exercises.map((e) => e.id)).find((a) => a.loadable);
  const swapped = replaceExercise(w, w.exercises.indexOf(loaded), alt, p, []).exercises[w.exercises.indexOf(loaded)];
  ok([6, 14].includes(swapped.load) && JSON.stringify(swapped.weights) === "[6,14]", `a swapped-in move also uses a bell you own (${swapped.name}, ${swapped.load} kg)`);
  ok(w.exercises.filter((e) => e.load != null).every((e) => JSON.stringify(e.weights) === "[6,14]"), "each loaded exercise carries the owned bells, so ± steps between them");
  const free = buildWorkout({ ...p, weights: {} }, new Set(["frontDelts", "glutes", "lats"]), []);
  ok(free.exercises.some((e) => e.load != null && e.load !== 6 && e.load !== 14) && free.exercises.every((e) => !e.weights), "no bells listed → any weight can be suggested, as before");
  const mixed = buildWorkout({ ...p, inventory: [...kits["his kit"], "dumbbells"] }, new Set(["biceps", "frontDelts", "rearDelts"]), []);
  const db = mixed.exercises.filter((e) => e.implement === "dumbbells" && e.load != null);
  ok(db.length > 0 && db.every((e) => !e.weights), `bells listed but not dumbbells → dumbbell moves stay free (${db.map((e) => e.name).join(", ")})`);
}

// 3 · progression on a fixed set of bells
const p = { ...base, goal: "muscle", level: "intermediate", inventory: kits["his kit"], sessionMinutes: 30, weights: { kettlebell: [6, 14] } };
const swing = EXERCISES.find((e) => e.id === "kbswing");
const halo = EXERCISES.find((e) => e.id === "kbhalo");
const run = (ex, prof, feels, start = []) => {
  const log = [...start], out = [];
  feels.forEach((feel, i) => {
    const pr = progressionFor(ex, prof, log);
    out.push(pr);
    log.push({ exerciseId: ex.id, sets: 3, reps: pr.reps, load: pr.load, feel, muscles: [ex.primary], at: Date.now() - (40 - i) * DAY, source: "plan", format: "sets", sessionId: `s${i}`, slot: "0" });
  });
  return { out, log, next: progressionFor(ex, prof, log) };
};
{
  const { out, next } = run(swing, p, Array(12).fill("right"));
  ok(out.every((x) => x.load === 14), "at the heaviest bell the load never goes past 14 kg");
  ok(out[1].reps[1] === out[0].reps[1] + 1 && out[3].reps[1] > out[1].reps[1], "…reps climb instead (one per session on “right”)");
  ok(next.reps[1] === 18 && next.atMax && /3 seconds/.test(next.note) && /16kg/.test(next.note), `…to a cap (${next.reps.join("-")}), then tempo, and it names the next bell: “${next.note}”`);
  const bought = progressionFor(swing, { ...p, weights: { kettlebell: [6, 14, 16] } }, run(swing, p, Array(12).fill("right")).log);
  ok(bought.load === 16 && bought.reps[0] === 8, "add a 16 kg bell and the next session moves to it, back at the bottom of the range");
}
{
  const { out } = run(halo, p, Array(10).fill("easy"));
  ok(out[0].load === 6 && out.every((x) => x.load === 6), "6 → 14 kg is too big a jump for halos, so they stay on the 6");
  ok(out[out.length - 1].reps[1] === 18 && /too big a jump/.test(out[out.length - 1].note), "…and progress by reps, then tempo");
}
{
  const { next } = run(swing, p, ["right", "hard", "hard"]);
  ok(next.deload && next.load === 14 && next.reps[1] <= 8, `two hard sessions on the heaviest bell → same bell, fewer reps (${next.reps.join("-")}), not a drop to 6 kg`);
  const near = run(swing, { ...p, weights: { kettlebell: [12, 14] } }, ["right", "hard", "hard"]).next;
  ok(near.deload && near.load === 12, "…but with a 12 kg bell on hand the deload uses it");
}
{
  const legacy = [{ exerciseId: "kbhalo", sets: 3, reps: [10, 10], load: 14, feel: "right", muscles: ["frontDelts"], at: Date.now() - 2 * DAY, source: "manual", format: "sets", sessionId: "m1", slot: "4" }];
  const nx = progressionFor(halo, p, legacy);
  ok(nx.load === 14 && nx.reps[1] === 11, "your logged 14 kg halos carry on at 14 kg, one more rep");
  const odd = progressionFor(swing, p, [{ ...legacy[0], exerciseId: "kbswing", load: 15 }]);
  ok(odd.load === 14, "a logged weight you don't own (15 kg) is read as the nearest bell you do");
}

console.log(failures ? `\n❌ ${failures} FAILURES` : "\n✅ only bells you own are ever prescribed");
process.exitCode = failures ? 1 : 0;
