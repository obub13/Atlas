// The weekly split: everything picked lands somewhere in the week, days fit the
// clock, big muscles get frequency when there's room, and the plan says honestly
// when the time/days given can't cover it all.
import { planWeek, weekProgress, weightOf, weekStart } from "../src/engine/week.js";
import { buildWorkout } from "../src/engine/generator.js";
import { MUSCLES, LEVELS, GOALS } from "../src/engine/data.js";
import { KITS } from "./verify.mjs";

let failures = 0;
const fail = (m) => { failures++; if (failures <= 15) console.log("  ❌ " + m); };
const ALL = Object.keys(MUSCLES);
const SELS = {
  all: ALL,
  upper: ["chest", "lats", "frontDelts", "rearDelts", "biceps", "triceps"],
  lowerCore: ["quads", "hamstrings", "glutes", "calves", "abs", "core"],
  arms: ["biceps", "triceps", "forearms"],
  mixed: ["chest", "glutes", "abs", "lats", "calves"],
};
const levels = Object.keys(LEVELS), goals = Object.keys(GOALS);
const st = { plans: 0, picked: 0, placed: 0, trained: 0, roomy: 0, roomyFull: 0, freqRoom: 0, freqOk: 0, b2b: 0, b2bPairs: 0, worstMs: 0, overrun: 0, sessions: 0 };
let n = 0;
for (const [kit, inv] of Object.entries(KITS)) for (const minutes of [20, 30, 45]) for (const days of [2, 3, 4, 5]) for (const [sname, sel] of Object.entries(SELS)) {
  n++;
  const profile = { age: 33, height: 176, weight: 74, level: levels[n % 3], goal: goals[n % 4], equipment: "bw", inventory: inv, customGear: [],
    sessionMinutes: minutes, daysPerWeek: days, skill: n % 5 === 0 ? "lsit" : null, excluded: [] };
  const t = Date.now();
  const plan = planWeek(profile, sel);
  st.worstMs = Math.max(st.worstMs, Date.now() - t);
  st.plans++;
  const tag = `${kit}/${minutes}m×${days}/${sname}`;
  if (plan.days.length < 1 || plan.days.length > days) fail(`${tag}: ${plan.days.length} days for a ${days}-day week`);
  if (plan.days.some((d) => !d.muscles.length)) fail(`${tag}: an empty training day`);
  // structural: every pick is in some day
  for (const m of sel) { st.picked++; if (plan.days.some((d) => d.muscles.includes(m))) st.placed++; else fail(`${tag}: ${m} isn't in any day`); }
  // real: built sessions train it
  const cov = plan.coverage;
  const gearOk = sel.filter((m) => !cov.noGear.includes(m));
  gearOk.forEach((m) => { if (["direct", "indirect"].includes(cov.status[m].level)) st.trained++; });
  const weight = sel.reduce((t, m) => t + weightOf(m), 0);
  const room = plan.capacity * days;
  if (room >= weight * 1.25) {
    st.roomy++;
    if (!cov.missing.length) st.roomyFull++;
    else fail(`${tag}: room for ${room} areas, ${weight} picked, but ${cov.missing.join(",")} not trained`);
  }
  if (room >= weight * 2.2 && days >= 3) {
    const majors = sel.filter((m) => MUSCLES[m].tier === "major");
    st.freqRoom += majors.length;
    st.freqOk += majors.filter((m) => plan.days.filter((d) => d.muscles.includes(m)).length >= 2).length;
  }
  if (days >= 4) for (let i = 1; i < plan.days.length; i++) {
    st.b2bPairs++;
    const a = plan.days[i - 1].muscles, b = plan.days[i].muscles;
    if (a.some((m) => b.includes(m) && MUSCLES[m].tier === "major" && !["abs", "core"].includes(m))) st.b2b++;
  }
  // each day's session fits the clock
  for (const d of plan.days) {
    const w = buildWorkout(profile, new Set(d.muscles), []);
    st.sessions++;
    if (w.estMinutes > minutes + 3) { st.overrun++; fail(`${tag}: ${d.label} runs ${w.estMinutes} min`); }
  }
  // determinism
  if (n % 25 === 0 && JSON.stringify(planWeek(profile, sel).days) !== JSON.stringify(plan.days)) fail(`${tag}: plan isn't deterministic`);
}

// progress: logging a day ticks exactly that day, single sessions never do
{
  const profile = { age: 30, height: 175, weight: 75, level: "intermediate", goal: "muscle", equipment: "bw", inventory: KITS["kettlebell + bar"] || Object.values(KITS)[0], customGear: [], sessionMinutes: 30, daysPerWeek: 3, skill: null, excluded: [] };
  const plan = planWeek(profile, ALL);
  const now = Date.now();
  const e = (dayKey, source = "plan") => ({ exerciseId: "x", sets: 3, feel: "right", muscles: ["chest"], at: now, source, dayKey });
  let p = weekProgress(plan, [], now);
  if (p.doneCount !== 0 || p.next !== 0) fail("fresh week should start at day 1");
  p = weekProgress(plan, [e(plan.days[0].key)], now);
  if (!p.done[0] || p.next !== 1) fail("logging day 1 should make day 2 next");
  p = weekProgress(plan, [e(plan.days[0].key), e(plan.days[1].key, "quick")], now);
  if (p.done[1]) fail("a single session ticked off a plan day");
  p = weekProgress(plan, [{ ...e(plan.days[0].key), at: weekStart(now) - 1000 }], now);
  if (p.done[0]) fail("last week's session counted this week");
  const allDone = weekProgress(plan, plan.days.map((d) => e(d.key)), now);
  if (!allDone.complete || allDone.next !== null) fail("all days logged should complete the week");
}

// Monday reset, but the rotation carries over (Ofek's week: Pull Thu, Push Sun, then Monday)
{
  const profile = { age: 28, height: 175, weight: 57, level: "intermediate", goal: "muscle", equipment: "bw", inventory: ["wall", "chair", "towel", "kettlebell", "pullupbar"], customGear: [], sessionMinutes: 20, daysPerWeek: 5, skill: "lsit", excluded: [] };
  const plan = planWeek(profile, ALL);
  const at = (iso) => Date.parse(iso);
  const pe = (i, iso, source = "plan") => ({ exerciseId: "x", sets: 3, feel: "right", muscles: plan.days[i].muscles, at: at(iso), source, dayKey: source === "plan" ? plan.days[i].key : null });
  const log = [pe(0, "2026-10-15T17:13:00"), pe(2, "2026-10-16T16:37:00", "manual"), pe(1, "2026-10-18T14:15:00")];
  const sun = weekProgress(plan, log, at("2026-10-18T21:00:00"));
  if (sun.doneCount !== 2 || sun.next !== 2) fail(`Sunday: expected 2 done and day 3 next, got ${sun.doneCount} / ${sun.next}`);
  const mon = weekProgress(plan, log, at("2026-10-19T09:00:00"));
  if (mon.doneCount !== 0) fail("Monday: the counter resets");
  if (mon.lastWeekCount !== 2) fail(`Monday: last week's 2 of 5 is reported (got ${mon.lastWeekCount})`);
  if (mon.next !== 2 || mon.nextReason !== "not trained yet") fail(`Monday: picks up at day 3 (never trained), not day 1 (got ${mon.next})`);
  if (mon.order.join() !== "2,3,4,0,1") fail(`Monday: untrained days first, then oldest first (got ${mon.order.join()})`);
  if (mon.lastDone[0] !== at("2026-10-15T17:13:00") || mon.lastDone[2] !== null) fail("last-done dates are per plan day; a logged workout never counts as one");
  // a full week done in order → the next week starts again at day 1 (the oldest)
  const full = plan.days.map((_, i) => pe(i, `2026-10-${String(20 + i).padStart(2, "0")}T10:00:00`));
  const after = weekProgress(plan, full, at("2026-10-26T08:00:00"));
  if (after.next !== 0 || after.lastWeekCount !== plan.days.length) fail("after a complete week, the rotation starts over at day 1");
  // mid-week, once day 3 is done, day 4 is next even though days 1–2 are older
  const mid = weekProgress(plan, [...log, pe(2, "2026-10-20T10:00:00")], at("2026-10-20T18:00:00"));
  if (mid.next !== 3 || !mid.done[2]) fail(`after day 3 this week, day 4 is next (got ${mid.next})`);
  // Sunday 23:59 belongs to last week; a future-dated entry is ignored
  const edge = weekProgress(plan, [pe(0, "2026-10-25T23:59:00"), pe(1, "2026-10-28T10:00:00")], at("2026-10-26T08:00:00"));
  if (edge.done[0] || edge.lastWeekCount !== 1 || edge.done[1]) fail("Sunday night counts last week; future entries are ignored");
  console.log(`Monday after Pull (Thu) + Push (Sun): 0/${plan.days.length} this week, last week ${mon.lastWeekCount}, next → ${plan.days[mon.next].label}`);
}

// Ofek's own case: everything, 20 min, 3 days, L-sit, kettlebell + pull-up bar
{
  const profile = { age: 31, height: 174, weight: 57, level: "intermediate", goal: "muscle", equipment: "bw", inventory: ["wall", "chair", "table", "towel", "kettlebell", "pullupbar"], customGear: [], sessionMinutes: 20, daysPerWeek: 3, skill: "lsit", excluded: [] };
  const plan = planWeek(profile, ALL);
  console.log(`\nall muscles · 20 min × 3 · L-sit · kettlebell + bar → ${plan.days.map((d) => d.label).join(" / ")}`);
  const lv = (l) => ALL.filter((m) => plan.coverage.status[m].level === l);
  console.log(`  direct: ${lv("direct").join(", ")}\n  via compounds: ${lv("indirect").join(", ") || "—"}\n  light: ${lv("light").join(", ") || "—"}\n  not this week: ${plan.coverage.missing.join(", ") || "—"}`);
  if (plan.days.length !== 3) fail("expected 3 days");
  if (new Set(plan.days.map((d) => d.key)).size !== 3) fail("expected 3 different days");
  if (!ALL.every((m) => plan.days.some((d) => d.muscles.includes(m)))) fail("not every muscle placed in the week");
}

const pct = (a, b) => `${a}/${b} (${Math.round((100 * a) / Math.max(1, b))}%)`;
console.log(`\nchecked ${st.plans} weekly plans · ${st.sessions} day sessions across ${Object.keys(KITS).length} kits`);
console.log(`every pick placed in a day: ${pct(st.placed, st.picked)}`);
console.log(`picks actually trained (direct or via compounds): ${pct(st.trained, st.picked)}`);
console.log(`weeks with room to spare that cover everything: ${pct(st.roomyFull, st.roomy)}`);
console.log(`big muscles hit 2+×/week when there's room: ${pct(st.freqOk, st.freqRoom)}`);
console.log(`back-to-back days on the same big muscle (4+ day weeks): ${pct(st.b2b, st.b2bPairs)}`);
console.log(`day sessions over the clock: ${st.overrun} · slowest plan: ${st.worstMs} ms`);
if (st.freqOk / Math.max(1, st.freqRoom) < 0.8) fail("frequency too low when there's room");
if (st.b2b / Math.max(1, st.b2bPairs) > 0.2) fail("too many back-to-back days on the same muscles");
console.log(failures ? `\n❌ ${failures} FAILURES` : "\n✅ weekly split contract holds");
process.exitCode = failures ? 1 : 0;
