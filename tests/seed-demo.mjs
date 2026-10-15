// Simulate six weeks of real training through the actual engine + repository,
// for screenshots and for eyeballing the Progress charts with real-looking data.
//   import { seedDemo } from "./seed-demo.mjs"; await seedDemo(client, userId)
import { createRepo } from "../src/data/repo.js";
import { uuid } from "../src/data/mapping.js";
import { planWeek, weekStart } from "../src/engine/week.js";
import { buildWorkout } from "../src/engine/generator.js";
import { buildQuickWorkout } from "../src/engine/quick.js";
import { upsertEntry, hash } from "../src/engine/history.js";

const DAY = 864e5;
export const DEMO_PROFILE = { age: 31, height: 174, weight: 72, level: "intermediate", goal: "muscle", equipment: "bw",
  inventory: ["wall", "chair", "table", "towel", "kettlebell", "pullupbar", "dumbbells"], customGear: [], skill: "lsit", excluded: [],
  sessionMinutes: 45, daysPerWeek: 3, quickPrefs: { focus: "core", minutes: 15 } };

export async function seedDemo(client, userId, { weeks = 6 } = {}) {
  const profile = { ...DEMO_PROFILE, blockStarted: weekStart(Date.now()) - weeks * 7 * DAY };
  const sel = new Set(["chest", "lats", "frontDelts", "quads", "hamstrings", "glutes", "abs", "core", "rearDelts", "biceps", "triceps", "calves"]);
  let log = [];
  const feelFor = (k) => ["right", "right", "easy", "right", "hard", "easy"][hash(k) % 6];
  const record = (w, kind, at, label, dayKey) => {
    const sid = uuid();
    w.exercises.forEach((ex, i) => {
      log = upsertEntry(log, { exerciseId: ex.id, ladder: ex.ladder, rank: ex.rank, sets: ex.sets, reps: ex.reps, holdSecs: ex.holdSecs,
        load: ex.load, feel: feelFor(sid + i), muscles: [ex.primary, ...ex.secondary], source: kind, format: w.format,
        sessionId: sid, slot: i, label, dayKey, at: at + i * 240000 });
    });
    if (w.skill) {
      const sk = w.skill;
      log = upsertEntry(log, { exerciseId: `skill:${sk.skillId}:${sk.stageName}`, ladder: `skill:${sk.skillId}`, stageName: sk.stageName,
        sets: sk.sets, reps: sk.reps, holdSecs: sk.holdSecs, load: null, feel: hash(sid) % 3 ? "easy" : "right", muscles: sk.muscles,
        source: "plan", sessionId: sid, slot: "skill", label, dayKey, at: at - 60000 });
    }
  };
  const start = weekStart(Date.now()) - weeks * 7 * DAY;
  for (let wk = 0; wk < weeks; wk++) {
    const plan = planWeek(profile, sel, log, { validate: false });
    const offsets = [0, 2, 4]; // Mon, Wed, Fri
    plan.days.forEach((d, i) => {
      if (wk === 2 && i === 2) return; // a missed day, like real life
      const at = start + wk * 7 * DAY + offsets[i] * DAY + 18 * 3600e3;
      const w = buildWorkout(profile, new Set(d.muscles), log, {});
      record(w, "plan", at, d.label, d.key);
    });
    if (wk % 2 === 1) {
      const q = buildQuickWorkout(profile, { focus: "core", minutes: 15, seed: wk + 3 }, log);
      record(q, "quick", start + wk * 7 * DAY + 5 * DAY + 10 * 3600e3, q.focusLabel, null);
    }
  }
  const repo = createRepo(client, userId, { store: { get: () => null, set: () => {} } });
  await repo.load();
  repo.saveProfile({ name: "Ofek", profile, selected: sel, onboarded: true });
  repo.syncLog(log);
  for (let i = 0; i < 200 && repo.status().pending; i++) await new Promise((r) => setTimeout(r, 50));
  repo.stop();
  return { log, profile };
}
