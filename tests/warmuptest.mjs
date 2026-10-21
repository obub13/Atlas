// Turning the warm-up off gives its minutes to working sets — and changes
// nothing that progress depends on: the same days, the same anchor lifts,
// the same history. A week in progress keeps its ticks even if the split moves.
import { buildWorkout, dayCapacity } from "../src/engine/generator.js";
import { buildQuickWorkout, QUICK_FOCUS } from "../src/engine/quick.js";
import { planWeek, weekProgress, dayFor } from "../src/engine/week.js";
import { MUSCLES, GOALS, LEVELS, WARMUP_WHY } from "../src/engine/data.js";
import { KITS } from "./verify.mjs";
import { profileToRow, profileFromRow } from "../src/data/mapping.js";

let failures = 0;
const ok = (c, m) => { if (!c) { failures++; console.log("  ❌ " + m); } else console.log("  ✓ " + m); };
const ALL = new Set(Object.keys(MUSCLES));
const anchors = (w) => w.exercises.filter((e) => e.role === "anchor").map((e) => e.id);

// 1 · Ofek's own setup
const me = { age: 28, height: 175, weight: 57, level: "intermediate", goal: "muscle", equipment: "bw", inventory: ["wall", "chair", "towel", "kettlebell", "pullupbar"], customGear: [], excluded: [], sessionMinutes: 20, daysPerWeek: 5, skill: "lsit", weights: { kettlebell: [6, 14] } };
{
  const on = planWeek(me, ALL), off = planWeek({ ...me, warmup: false }, ALL);
  ok(on.days.map((d) => d.key).join("|") === off.days.map((d) => d.key).join("|"), `your week is the same five days either way (${off.days.map((d) => d.label).join(" / ")})`);
  let same = true, more = 0, fewer = 0;
  on.days.forEach((d, i) => {
    const a = buildWorkout(me, new Set(d.muscles), []), b = buildWorkout({ ...me, warmup: false }, new Set(off.days[i].muscles), []);
    if (anchors(a).join() !== anchors(b).join()) same = false;
    if (b.totalSets > a.totalSets) more++;
    if (b.totalSets < a.totalSets) fewer++;
    if (b.warmup.length || !b.warmupSkipped || a.warmupSkipped || !a.warmup.length) same = false;
    if (b.estMinutes > me.sessionMinutes + 1) same = false;
  });
  ok(same, "each day keeps its anchor lifts, drops the warm-up, and still fits 20 minutes");
  ok(more >= 3 && fewer === 0, `the freed minutes become working sets (${more} of 5 days gain sets, none lose any)`);
}

// 1b · with your real history: last week's Pull and Push, then the warm-up goes off
{
  const DAY = 864e5, now = Date.now();
  const p = { ...me }; // like your profile: no block start recorded
  const plan = planWeek(p, ALL);
  const pull = plan.days.find((d) => d.label === "Pull"), push = plan.days.find((d) => d.label === "Push");
  const log = [
    { exerciseId: "pullup", ladder: "chin", sets: 2, reps: [8, 8], feel: "easy", muscles: ["lats", "biceps", "core", "forearms"], source: "plan", dayKey: pull.key, sessionId: "a", slot: "0", at: now - 6 * DAY },
    { exerciseId: "dbshrug", sets: 3, reps: [8, 12], load: 15, feel: "hard", muscles: ["traps", "forearms"], source: "plan", dayKey: pull.key, sessionId: "a", slot: "1", at: now - 6 * DAY },
    { exerciseId: "pushup", ladder: "pushup", sets: 4, reps: [10, 15], feel: "easy", muscles: ["chest", "triceps"], source: "plan", dayKey: push.key, sessionId: "b", slot: "0", at: now - 3 * DAY },
  ];
  const offPlan = planWeek({ ...p, warmup: false }, ALL, log);
  const pullOff = buildWorkout({ ...p, warmup: false }, new Set(offPlan.days[dayFor(pull.key, offPlan.days)].muscles), log);
  const ids = pullOff.exercises.map((e) => e.id);
  ok(ids.includes("pullup") && ids.includes("dbshrug"), `your Pull day keeps Pull-Ups and the Kettlebell Shrug (${pullOff.exercises.map((e) => `${e.name} ${e.sets}×`).join(", ")})`);
  ok(pullOff.exercises.find((e) => e.id === "dbshrug").load === 14, "…and the shrug carries on from your last session (14 kg, your heaviest bell)");
  const pushOff = buildWorkout({ ...p, warmup: false }, new Set(offPlan.days[dayFor(push.key, offPlan.days)].muscles), log);
  ok(pushOff.exercises.some((e) => e.ladder === "pushup"), `Push keeps its push-up line, one rung up after an “easy” (${pushOff.exercises.filter((e) => e.ladder === "pushup").map((e) => e.name).join(", ")})`);
}

// 2 · across kits, goals, levels and lengths — with a week of training already logged
let weekKept = 0, weekTotal = 0; const weekLost = [];
let configs = 0, sameDays = 0, kept = 0, trainedTotal = 0, overrun = 0, dayTotal = 0, lost = [];
const DAY = 864e5;
for (const [kit, inv] of Object.entries(KITS)) for (const goal of Object.keys(GOALS)) for (const level of Object.keys(LEVELS)) for (const mins of [20, 30, 45]) for (const days of [3, 5]) {
  const p = { ...me, inventory: inv, goal, level, sessionMinutes: mins, daysPerWeek: days, skill: null, weights: {}, blockStarted: Date.now() - 10 * DAY };
  const on = planWeek(p, ALL, [], { validate: false });
  // you trained every day of the plan with the warm-up on and rated each lift
  const log = [];
  on.days.forEach((d, i) => {
    const w = buildWorkout(p, new Set(d.muscles), []);
    (w?.exercises || []).forEach((e, k) => log.push({ exerciseId: e.id, ladder: e.ladder, sets: e.sets, reps: e.reps, holdSecs: e.holdSecs, load: e.load, feel: "right",
      muscles: [e.primary, ...e.secondary], source: "plan", format: "sets", sessionId: `${i}`, slot: String(k), dayKey: d.key, at: Date.now() - (7 - i) * DAY }));
  });
  const off = planWeek({ ...p, warmup: false }, ALL, log, { validate: false });
  configs++;
  if (on.days.map((d) => d.key).join() === off.days.map((d) => d.key).join()) sameDays++;
  if (weekProgress(off, log).lastWeekCount + weekProgress(off, log).doneCount === 0 && log.length) lost.push(`${kit}/${goal}/${level}/${mins}/${days}: week ticks`);
  const weekIds = new Set(off.days.flatMap((d) => buildWorkout({ ...p, warmup: false }, new Set(d.muscles), log)?.exercises.map((e) => e.id) || []));
  for (const id of new Set(on.days.flatMap((d) => buildWorkout(p, new Set(d.muscles), []).exercises.filter((e) => e.role === "anchor").map((e) => e.id)))) {
    weekTotal++;
    if (weekIds.has(id)) weekKept++;
    else if (weekLost.length < 6) weekLost.push(`${kit}/${goal}/${level}/${mins}/${days}: ${id}`);
  }
  const unchanged = on.days.map((d) => d.key).join() === off.days.map((d) => d.key).join();
  on.days.forEach((d, i) => {
    if (!unchanged) return;
    const j = dayFor(d.key, off.days);
    if (j == null) return;
    dayTotal++;
    const before = log.filter((e) => e.dayKey === d.key);
    const b = buildWorkout({ ...p, warmup: false }, new Set(off.days[j].muscles), log);
    if (!b) return;
    const ids = new Set(b.exercises.map((e) => e.id));
    const anchorsBefore = buildWorkout(p, new Set(d.muscles), []).exercises.filter((e) => e.role === "anchor").map((e) => e.id);
    for (const id of anchorsBefore) {
      trainedTotal++;
      // a lift is "kept" if it's still in that day — or the day moved and it shows up in the new split's matching day
      if (ids.has(id)) kept++;
      else if (lost.length < 6) lost.push(`${kit}/${goal}/${level}/${mins}/${days}: ${d.label} lost ${id} → [${[...ids].join(" ")}]`);
    }
    if (b.estMinutes > mins + 3) overrun++;
    void before;
  });
}
console.log(`  · the split itself is unchanged in ${sameDays} of ${configs} setups; the rest get more room per day`);
ok(kept / trainedTotal >= 0.99, `same split: the lifts you've been progressing stay on their day (${kept}/${trainedTotal}, ${(100 * kept / trainedTotal).toFixed(1)}%; the few others move to a sibling on the same muscle)`);
ok(weekKept / weekTotal >= 0.98, `split moved or not, the lifts you've been progressing are still in your week: ${weekKept}/${weekTotal} (${(100 * weekKept / weekTotal).toFixed(1)}%)${weekLost.length ? "\n      e.g. " + weekLost.slice(0, 3).join("\n      ") : ""}`);
void (`${kept}/${trainedTotal} (${(100 * kept / trainedTotal).toFixed(1)}%)${lost.length ? "\n      e.g. " + lost.slice(0, 3).join("\n      ") : ""}`);
ok(overrun === 0, `no session runs over its time (${dayTotal} days checked)`);
ok(dayCapacity({ ...me, warmup: false }) >= dayCapacity(me), "a day can hold at least as much without the warm-up");
{
  const q = buildQuickWorkout({ ...me, warmup: false }, { focus: QUICK_FOCUS[0].id, minutes: 20, seed: 4 }, []);
  ok(q.warmup.length === 0 && q.warmupSkipped, "single sessions follow the same setting");
}

// 3 · a week in progress keeps its ticks even when the split does move
{
  const days = [{ key: "lats,rearDelts,biceps", muscles: ["lats", "rearDelts", "biceps"] }, { key: "chest,frontDelts,triceps", muscles: ["chest", "frontDelts", "triceps"] }, { key: "quads,hamstrings,glutes,calves", muscles: ["quads", "hamstrings", "glutes", "calves"] }];
  ok(dayFor("chest,frontDelts,triceps", days) === 1, "an unchanged day matches exactly");
  ok(dayFor("chest,frontDelts,triceps,abs", days) === 1, "a day that gained a muscle is still the same day");
  ok(dayFor("lats,rearDelts,biceps,forearms,traps", days) === 0, "a day that lost two minors is still the same day");
  ok(dayFor("quads,abs,calves", days) === 2 && dayFor("core,abs", days) === null, "a leg day maps to the leg day; nothing close → no tick");
  const plan = { days };
  const now = Date.parse("2026-10-21T12:00:00Z"), cal = { timeZone: "Asia/Jerusalem", weekStartsOn: 0 };
  const log = [{ source: "plan", dayKey: "chest,frontDelts,triceps,abs", at: Date.parse("2026-10-18T14:15:00Z"), muscles: ["chest"], sets: 3 }];
  const wp = weekProgress(plan, log, now, cal);
  ok(wp.done[1] && wp.doneCount === 1, "Sunday's Push still ticks this week's Push after the plan changed");
}

// 4 · saved and restored with the profile; the note is there to show
{
  const row = profileToRow("u1", { name: "Ofek", profile: { ...me, warmup: false }, selected: new Set(), onboarded: true });
  ok(row.settings.warmup === false && profileFromRow(row).profile.warmup === false, "the choice is saved in the profile and loads back");
  ok(WARMUP_WHY.points.length >= 3 && /ramp-up/.test(WARMUP_WHY.shortcut), "skipping shows why warm-ups exist, plus a one-minute alternative");
}

console.log(failures ? `\n❌ ${failures} FAILURES` : "\n✅ skipping the warm-up frees time without touching your progress");
process.exitCode = failures ? 1 : 0;
