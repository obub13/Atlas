// Logging a workout done without the app: the free-text parser, the rows → log
// mapping, and the rule that logged workouts count everywhere except plan days.
import { parseWorkoutText, matchMove, entriesFromRows, rowProblem, musclesOf, tokens, slugOf, canonicalId } from "../src/engine/logparse.js";
import { upsertEntry, planLog, weeklyVolume, sessionHistory, sessionsInWindow, totalSessions } from "../src/engine/history.js";
import { progressionFor } from "../src/engine/generator.js";
import { planWeek, weekProgress } from "../src/engine/week.js";
import { exercisesLogged, liftSeries, summary, nameOf } from "../src/engine/progress.js";
import { sessionRowFromEntries, entriesFromRows as mapEntries } from "../src/data/mapping.js";
import { EXERCISES, EQUIP_PRESETS, MUSCLES } from "../src/engine/data.js";

let failures = 0;
const ok = (c, m) => { if (!c) { failures++; console.log("  ❌ " + m); } else console.log("  ✓ " + m); };
const by = (rows, text) => rows.find((r) => r.text.toLowerCase().includes(text));

// 1 · the exact message that started this feature
{
  const msg = "today i did these workouts  with a kettlebell : 3x10 all\n\nrussian twist, tridents, leg raises, kettlebell pushup pass through and halos";
  const { defaults, rows } = parseWorkoutText(msg);
  ok(rows.length === 5, `five exercises found, lead-in ignored (got ${rows.map((r) => r.text).join(" | ")})`);
  ok(defaults.sets === 3 && defaults.reps === 10, "“3x10 all” becomes the default for every row");
  ok(rows.every((r) => r.sets === 3 && r.reps === 10 && r.holdSecs == null), "every row is 3 × 10");
  ok(by(rows, "russian")?.match?.type === "library" && by(rows, "russian").match.id === "russiantwist", "russian twist → the library's Russian Twist (feeds its progression)");
  ok(by(rows, "leg raise")?.match?.id === "legraise", "leg raises → Lying Leg Raise");
  ok(by(rows, "pass")?.match?.id === "kbpassthrough" && by(rows, "pass").match.primary === "chest", "push-up pass-through → the library's Push-Up Pass-Through, chest first");
  ok(by(rows, "halo")?.match?.id === "kbhalo" && by(rows, "halo").match.primary === "frontDelts", "halos → the library's Kettlebell Halo, shoulders");
  ok(by(rows, "trident") && !by(rows, "trident").match, "tridents → unknown, so the person picks the muscles");
  ok(rowProblem(by(rows, "trident")) === "Which muscle did it work?", "an unknown move can't be saved until it has a muscle");
  ok(rows.filter((r) => r.match).every((r) => rowProblem(r) === null), "every recognised row is ready to save");
}

// 2 · other ways people write it
{
  const { rows } = parseWorkoutText("goblet squat 4x8 16kg\nplank 3x45s\npush-ups 3x15\nswings 5x20 35lb");
  ok(rows.length === 4, "one exercise per line");
  const g = by(rows, "goblet"), p = by(rows, "plank"), pu = by(rows, "push"), sw = by(rows, "swing");
  ok(g?.match?.type === "library" && g.sets === 4 && g.reps === 8 && g.load === 16, "goblet squat 4x8 16kg → library move, load in kg");
  ok(p?.holdSecs === 45 && p.reps == null && p.sets === 3, "plank 3x45s → a 45-second hold");
  ok(pu?.match?.type === "library" && pu.reps === 15, "push-ups 3x15 → a library push-up");
  ok(sw?.load === 16 && sw.sets === 5, "35 lb is converted to kg (rounded to 0.5)");
  const all = parseWorkoutText("all 3x12 - swings, renegade rows, windmills").rows;
  ok(all.length === 3 && all.every((r) => r.sets === 3 && r.reps === 12 && r.match), "“all 3x12” before the list applies to every row");
  const mixed = parseWorkoutText("3x10 all: halos, plank 3x30s").rows;
  ok(mixed[0].reps === 10 && mixed[1].holdSecs === 30 && mixed[1].reps == null, "a row's own numbers beat the default");
  const sets = parseWorkoutText("4 sets of 12 russian twists").rows;
  ok(sets[0]?.sets === 4 && sets[0].reps === 12, "“4 sets of 12” is understood");
  ok(parseWorkoutText("").rows.length === 0 && parseWorkoutText("3x10 all").rows.length === 0, "nothing to log → no rows, no crash");
  ok(tokens("Push-Ups") .join() === "pushup" && tokens("push ups").join() === "pushup", "push-up spellings are unified");
}

// 3 · moves you've logged before win
{
  const customs = [{ id: "custom:tridents", name: "Tridents", primary: "core", secondary: ["frontDelts"], timed: false }];
  const m = matchMove("trident", customs);
  ok(m?.type === "custom" && m.id === "custom:tridents", "a saved custom move is recognised next time");
  ok(parseWorkoutText("3x10 all: tridents", customs).rows[0].match?.primary === "core", "…with the muscles picked the first time");
  ok(slugOf("Kettlebell Push-Up Pass-Through") === "custom:kettlebell-push-up-pass-through", "custom ids are stable, readable slugs");
}

// 4 · rows → log entries
const DAY = 864e5;
const now = Date.now();
const msg = "3x10 all: russian twist, tridents, leg raises, kettlebell pushup pass through and halos";
const rows = parseWorkoutText(msg).rows.map((r) => (r.match ? r : { ...r, primary: "core", secondary: ["frontDelts", "abs"] }));
rows.find((r) => r.match?.id === "russiantwist").feel = "easy";
rows.find((r) => r.match?.id === "russiantwist").load = 12;
const { entries, newCustoms } = entriesFromRows(rows, { sessionId: "manual-1", at: now - 1000, label: "Kettlebell core", customs: [] });
{
  ok(entries.length === 5 && entries.every((e) => e.source === "manual" && e.sessionId === "manual-1" && e.dayKey === null), "five entries in one manual session, no plan day");
  ok(entries.every((e, i) => e.slot === i && e.at === now - 1000 + i * 1000), "slots and timestamps keep the typed order");
  ok(entries.find((e) => e.exerciseId === "russiantwist")?.load === 12, "library moves keep their library id and load");
  const t = entries.find((e) => e.exerciseId === "custom:tridents");
  ok(t && t.muscles.join() === "core,frontDelts,abs", "an unknown move gets a custom id and the muscles picked");
  ok(newCustoms.length === 1 && newCustoms[0].id === "custom:tridents" && newCustoms[0].primary === "core", "only the truly new move (tridents) is returned to remember");
  ok(entries.filter((e) => !e.feel).length === 4, "unrated rows are stored unrated");
  const again = entriesFromRows(parseWorkoutText("tridents 3x12", newCustoms).rows, { sessionId: "manual-2", at: now, label: "x", customs: newCustoms });
  ok(again.entries[0].exerciseId === "custom:tridents" && again.newCustoms.length === 0, "logging it again reuses the saved move — one progress line, not two");
  ok(musclesOf({ name: "x", primary: "nope" }) === null, "an invalid muscle never reaches the log");
  ok(Object.keys(MUSCLES).includes(entries[0].muscles[0]), "muscles are app muscle ids");
  ok(sessionRowFromEntries(entries).source === "manual", "the database row keeps source = manual");
}

// 5 · counts toward history, volume and progression — never toward plan days
{
  const profile = { age: 31, height: 174, weight: 75, level: "intermediate", goal: "muscle", equipment: "min", inventory: [...EQUIP_PRESETS.min, "kettlebell"], customGear: [], sessionMinutes: 45, daysPerWeek: 3, skill: null, excluded: [] };
  let log = entries.reduce((l, e) => upsertEntry(l, e), []);
  ok(totalSessions(log) === 1 && sessionHistory(log)[0].source === "manual" && sessionHistory(log)[0].label === "Kettlebell core", "it's one session in the history, with its name");
  const v = weeklyVolume(7, log);
  ok(v.core >= 3 && v.abs >= 3 && v.chest >= 3 && v.frontDelts >= 3, "its sets count in weekly volume (core, abs, chest, shoulders)");
  ok(planLog(log).length === 0 && sessionsInWindow(7, planLog(log)) === 0, "the plan's 'done' counter ignores it");
  const plan = planWeek(profile, new Set(Object.keys(MUSCLES)), []);
  const wp = weekProgress(plan, log);
  ok(wp.doneCount === 0 && wp.next === 0, "no plan day is ticked off by a logged workout");
  // a manual entry that carries a dayKey by mistake still mustn't tick a day
  const sneaky = upsertEntry(log, { ...entries[0], slot: 9, dayKey: plan.days[0].key });
  ok(weekProgress(plan, sneaky).doneCount === 0, "even with a day key, a manual session never ticks a plan day");
  const rt = EXERCISES.find((e) => e.id === "russiantwist");
  const prog = progressionFor(rt, profile, log);
  ok(!prog.isFirst, "a rated library move logged by hand drives that move's next prescription");
  const unrated = progressionFor(EXERCISES.find((e) => e.id === "legraise"), profile, log);
  ok(unrated.isFirst === true, "an unrated move doesn't fake a progression step");
  const customs = newCustoms;
  const list = exercisesLogged(log, customs);
  ok(list.some((l) => l.id === "custom:tridents" && l.name === "Tridents"), "custom moves get their own progress line, under their own name");
  ok(nameOf("custom:some-new-move") === "Some New Move", "an unknown custom id still reads well");
  log = upsertEntry(log, { ...entries.find((e) => e.exerciseId === "russiantwist"), sessionId: "manual-3", slot: 0, load: 14, at: now + 5000 });
  const s = liftSeries(log, "russiantwist", customs);
  ok(s.metric === "load" && s.points.length === 2 && s.change?.delta === 2, "logged sessions make a lift line (12 → 14 kg)");
  ok(s.points.every((p) => p.source === "manual"), "points know they came from logged workouts");
  const sum = summary(log);
  ok(sum.sessions === 2, "the Progress summary counts logged sessions");
  // the date picker: a workout from yesterday lands yesterday
  const y = entriesFromRows(rows.slice(0, 1), { sessionId: "manual-y", at: now - DAY, label: "y", customs: [] }).entries[0];
  ok(new Date(y.at).toDateString() === new Date(now - DAY).toDateString(), "a back-dated workout is stored on its own day");
}

// 6 · kettlebell moves, the way people name them
{
  const list = "3x10 all: halos, around the world, bicep curls, suitcase walk, kettlebell swings, side-to-side swings, turkish get up, windmills, cleans, clean and press, snatches, high pulls, renegade rows, goblet squat, figure 8, thrusters, sumo deadlift, cossack squat, racked carry, waiter walk";
  const want = ["kbhalo", "kbaroundworld", "dbcurl", "suitcase", "kbswing", "kbsideswing", "kbtgu", "kbwindmill", "kbclean", "kbcleanpress",
    "kbsnatch", "kbhighpull", "kbrenegade", "gobletsquat", "kbfigure8", "kbthruster", "kbsumodl", "kbcossack", "kbrackcarry", "kbwaiter"];
  const got = parseWorkoutText(list).rows.map((r) => r.match?.type === "library" ? r.match.id : `?${r.text}`);
  const miss = want.filter((id, i) => got[i] !== id);
  ok(!miss.length && got.length === want.length, `all ${want.length} kettlebell names map to their library move${miss.length ? ` (wrong: ${miss.map((m) => `${m}→${got[want.indexOf(m)]}`).join(", ")})` : ""}`);
  ok(matchMove("swings").id === "kbswing" && matchMove("side to side swing").id === "kbsideswing", "a plain swing and a side-to-side swing are told apart");
  ok(matchMove("barbell curl").id !== "dbcurl" && matchMove("bicep curl").id === "dbcurl", "“bicep curl” is the kettlebell/dumbbell curl; “barbell curl” isn't");
  // every kettlebell move: performable with just a bell, never names other gear
  const kbOnly = EXERCISES.filter((e) => (e.needs || []).includes("kettlebell"));
  ok(kbOnly.length >= 20, `${kbOnly.length} kettlebell-specific moves in the library`);
  ok(kbOnly.every((e) => e.needs.length === 1 && !/dumbbell|barbell|bench|chair|band|cable|machine|\bsteps?\b|wall|towel|table/i.test(e.name + " " + e.tip)), "each needs only the bell and mentions no other gear");
  ok(EXERCISES.every((e) => !e.repRange || (e.repRange[0] >= 1 && e.repRange[0] <= e.repRange[1])), "rep-range overrides are sane");
  const ids = EXERCISES.map((e) => e.id);
  ok(new Set(ids).size === ids.length, "library ids are unique");
}

// 7 · custom moves the library has since learned migrate onto the library move
{
  ok(canonicalId("custom:kettlebell-halos") === "kbhalo" && canonicalId("custom:kettlebell-halo") === "kbhalo", "custom halos → kbhalo");
  ok(canonicalId("custom:push-up-pass-through") === "kbpassthrough", "custom push-up pass-through → kbpassthrough");
  ok(canonicalId("custom:tridents") === "custom:tridents" && canonicalId("russiantwist") === "russiantwist", "unknown customs and library ids are left alone");
  const rowsDb = [{ session_id: "s1", slot: "0", exercise_id: "custom:kettlebell-halos", sets: 3, reps_min: 10, reps_max: 10, load_kg: "14.00", feel: "right", muscles: ["frontDelts", "core"], logged_at: new Date(now - 2 * DAY).toISOString() }];
  const loaded = mapEntries([{ id: "s1", source: "manual", format: "sets", label: "Core and abs", started_at: new Date(now - 2 * DAY).toISOString() }], rowsDb);
  ok(loaded[0].exerciseId === "kbhalo" && loaded[0].muscles.join() === "frontDelts,core", "an old halo log loads as the library halo, muscles as logged");
  const profile = { age: 28, weight: 57, level: "intermediate", goal: "muscle", inventory: ["kettlebell"], customGear: [], excluded: [], sessionMinutes: 30, daysPerWeek: 3 };
  const next = progressionFor(EXERCISES.find((e) => e.id === "kbhalo"), profile, loaded);
  ok(!next.isFirst && next.load === 14 && next.reps[0] === 9, `…so the next halo prescription builds on it (14 kg, ${next.reps.join("-")} reps)`);
  const stillCustom = parseWorkoutText("halos", [{ id: "custom:kettlebell-halos", name: "Kettlebell Halos", primary: "frontDelts", secondary: [] }]).rows[0];
  ok(stillCustom.match.type === "library" && stillCustom.match.id === "kbhalo", "a saved custom halo no longer shadows the library halo");
}

console.log(failures ? `\n❌ ${failures} FAILURES` : "\n✅ logged workouts parse right and count everywhere but plan days");
process.exitCode = failures ? 1 : 0;
