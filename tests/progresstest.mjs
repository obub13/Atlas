// Progress maths + skill pacing. Pure functions, hand-built logs with known answers.
import { summary, liftSeries, exercisesLogged, calendar, weeklyVolumeSeries, skillTimeline, niceTicks } from "../src/engine/progress.js";
import { skillProgress, inventoryOf } from "../src/engine/generator.js";
import { weekStart } from "../src/engine/week.js";
import { SKILLS } from "../src/engine/skills.js";

let failures = 0;
const ok = (c, m) => { if (!c) { failures++; console.log("  ❌ " + m); } else console.log("  ✓ " + m); };
const DAY = 864e5, WEEK = 7 * DAY;
const now = weekStart(Date.now()) + 2 * DAY + 12 * 3600e3; // a Wednesday noon
const e = (o) => ({ sets: 3, feel: "right", muscles: ["chest", "triceps"], source: "plan", format: "sets", slot: "0", ...o });

// summary
const log = [
  e({ sessionId: "a", exerciseId: "gobletsquat", load: 16, reps: [8, 12], at: now - 3 * WEEK, muscles: ["quads", "glutes"] }),
  e({ sessionId: "b", exerciseId: "gobletsquat", load: 18, reps: [8, 12], at: now - 2 * WEEK, muscles: ["quads", "glutes"] }),
  e({ sessionId: "c", exerciseId: "gobletsquat", load: 20, reps: [8, 12], at: now - 1 * WEEK, muscles: ["quads", "glutes"] }),
  e({ sessionId: "c", slot: "1", exerciseId: "pushup", load: null, reps: [10, 14], at: now - 1 * WEEK }),
  e({ sessionId: "d", exerciseId: "plank", holdSecs: 40, reps: null, at: now - DAY, source: "quick", format: "circuit", muscles: ["core"] }),
  e({ sessionId: "e", exerciseId: "pushup", load: null, reps: [11, 15], at: now - 2 * 3600e3 }),
];
const s = summary(log, now);
ok(s.sessions === 5, "summary counts sessions, not exercises (5)");
ok(s.thisWeek === 2 && s.thisWeekQuick === 1 && s.thisWeekPlan === 1, "this week: 1 plan + 1 single");
ok(s.streakWeeks === 4, `week streak counts back through consecutive weeks (${s.streakWeeks})`);
ok(s.sets30 === 18, `sets in the last 30 days (${s.sets30})`);
ok(summary([e({ sessionId: "x", exerciseId: "pushup", at: now - 2 * WEEK })], now).streakWeeks === 0, "a gap of a full week breaks the streak");

// lifts
const sq = liftSeries(log, "gobletsquat");
ok(sq.metric === "load" && sq.points.map((p) => p.value).join() === "16,18,20", "loaded lift tracks working weight per session");
ok(sq.change.delta === 4 && sq.change.pct === 25, "change: +4 kg, +25%");
const pu = liftSeries(log, "pushup");
ok(pu.metric === "reps" && pu.points.map((p) => p.value).join() === "14,15", "bodyweight lift tracks target reps");
ok(liftSeries(log, "plank").metric === "hold", "timed hold tracks seconds");
const dup = liftSeries([...log, e({ sessionId: "c", exerciseId: "gobletsquat", load: 22, at: now - WEEK + 60000 })], "gobletsquat");
ok(dup.points.length === 3 && dup.points[2].value === 22, "one point per session — a re-rate in the same session replaces it");
ok(exercisesLogged(log)[0].id === "gobletsquat" && exercisesLogged(log).length === 3, "exercise list: most-trained first");

// calendar
const cal = calendar(log, 4, now);
ok(cal.days.length === 28, "4-week grid = 28 days");
const trained = cal.days.filter((d) => d.plan || d.quick);
ok(trained.length === 5, `5 training days marked (${trained.length})`);
ok(cal.days.some((d) => d.quick === 1 && d.plan === 0), "single-session day marked as single");
ok(cal.days.filter((d) => d.future).length === 4, "days after today are future (Thu–Sun)");
ok(new Date(cal.start).getDay() === 1, "weeks start on Monday");

// weekly volume
const vol = weeklyVolumeSeries(log, 4, now);
ok(vol.weeks.length === 4 && vol.weeks[0].muscles.quads === 3, "squat week: 3 direct sets for quads");
ok(vol.weeks[2].muscles.triceps === 1.5, "a secondary muscle counts half (triceps from push-ups)");
ok(vol.muscles[0] === "chest" && !vol.muscles.includes("lats"), "only trained muscles are rows, in body order");

// skills
const sk = (stage, feel, d) => e({ sessionId: "s" + d, exerciseId: `skill:lsit:${stage}`, ladder: "skill:lsit", stageName: stage, feel, at: now - d * DAY, muscles: ["core"] });
const st = SKILLS.lsit.stages;
const tl = skillTimeline([sk(st[0].name, "easy", 9), sk(st[0].name, "easy", 7), sk(st[1].name, "right", 5)]);
ok(tl[0].currentIndex === 1 && tl[0].stages[0].firstAt === now - 9 * DAY && tl[0].stages[2].firstAt === null, "skill timeline: current stage and the date each stage was reached");

// skill pacing — two clean sessions to move up, two rough ones to step back
const inv = inventoryOf({ inventory: ["wall", "chair", "table", "towel"], customGear: [] });
const at = (l) => skillProgress("lsit", l, inv);
ok(at([sk(st[0].name, "easy", 3)]).index === 0, "one easy session: stay on the stage");
ok(at([sk(st[0].name, "easy", 5), sk(st[0].name, "easy", 3)]).index === 1 && at([sk(st[0].name, "easy", 5), sk(st[0].name, "easy", 3)]).promoted, "two easy in a row: move up");
ok(at([sk(st[0].name, "easy", 5), sk(st[0].name, "right", 4), sk(st[0].name, "easy", 3)]).index === 0, "easy, right, easy: not a streak — stay");
ok(at([sk(st[1].name, "hard", 3)]).index === 1, "one hard session: stay");
ok(at([sk(st[1].name, "hard", 5), sk(st[1].name, "hard", 3)]).index === 0, "two hard in a row: step back");
ok(at([sk(st[0].name, "easy", 5), sk(st[0].name, null, 4), sk(st[0].name, "easy", 3)]).index === 1, "an unrated practice doesn't break the streak");

// ticks
ok(JSON.stringify(niceTicks(12.1, 22.9, 3)) === JSON.stringify([10, 15, 20, 25]), `nice ticks (${niceTicks(12.1, 22.9, 3)})`);
ok(niceTicks(0, 1, 3).every((v) => Number.isFinite(v)), "ticks on a tiny range");

console.log(failures ? `\n❌ ${failures} FAILURES` : "\n✅ progress maths hold");
process.exitCode = failures ? 1 : 0;
