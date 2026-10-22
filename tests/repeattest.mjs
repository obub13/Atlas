// Tap a day on the calendar → see exactly what was done → do it again.
// Uses Ofek's real week (logged in Israel, Sunday-start weeks, 6 + 14 kg bells).
import { sessionsOnDay, repeatSession } from "../src/engine/repeat.js";
import { canonicalId } from "../src/engine/logparse.js";
import { upsertEntry, planLog } from "../src/engine/history.js";

let failures = 0;
const ok = (c, m) => { if (!c) { failures++; console.log("  ❌ " + m); } else console.log("  ✓ " + m); };
const IL = { timeZone: "Asia/Jerusalem", weekStartsOn: 0 };
const T = (iso) => Date.parse(iso);
const customs = [{ id: "custom:tridents", name: "Tridents", primary: "core", secondary: [], timed: false }];
const profile = { age: 28, height: 175, weight: 57, level: "intermediate", goal: "muscle", equipment: "bw", inventory: ["wall", "chair", "towel", "kettlebell", "pullupbar"], customGear: [], excluded: [], sessionMinutes: 20, daysPerWeek: 5, weights: { kettlebell: [6, 14] }, warmup: true, customExercises: customs };
const E = (sessionId, label, source, slot, exerciseId, sets, reps, load, feel, muscles, iso, extra = {}) =>
  ({ exerciseId: canonicalId(exerciseId), sets, reps, holdSecs: null, load, feel, muscles, source, format: "sets", sessionId, slot: String(slot), label, dayKey: source === "plan" ? "lats,rearDelts,biceps,forearms,traps" : null, at: T(iso), ...extra });
const log = [
  E("pull", "Pull", "plan", "skill", "skill:lsit:Support Hold", 3, null, null, "easy", ["abs", "core"], "2026-10-15T17:13:38Z", { holdSecs: 30, ladder: "skill:lsit", stageName: "Support Hold" }),
  E("pull", "Pull", "plan", 0, "pullup", 2, [8, 12], null, "easy", ["lats", "biceps"], "2026-10-15T17:13:57Z", { ladder: "chin" }),
  E("pull", "Pull", "plan", 1, "dbshrug", 3, [8, 12], 15, "hard", ["traps", "forearms"], "2026-10-15T17:14:15Z"),
  E("core", "Core and abs", "manual", 0, "custom:tridents", 3, [10, 10], 14, "right", ["core"], "2026-10-16T16:37:31Z"),
  E("core", "Core and abs", "manual", 1, "russiantwist", 3, [10, 10], 14, "right", ["core", "abs"], "2026-10-16T16:37:32Z"),
  E("core", "Core and abs", "manual", 2, "legraise", 3, [10, 10], null, "right", ["abs", "core"], "2026-10-16T16:37:33Z", { ladder: "legraise" }),
  E("core", "Core and abs", "manual", 3, "custom:push-up-pass-through", 3, [10, 10], 14, "hard", ["core", "chest"], "2026-10-16T16:37:34Z"),
  E("core", "Core and abs", "manual", 4, "custom:kettlebell-halos", 3, [10, 10], 14, "right", ["frontDelts", "core"], "2026-10-16T16:37:35Z"),
  // a single-session circuit at 23:30 on Saturday night, Israel time
  E("late", "Core & Abs", "quick", 0, "plank", 3, null, null, null, ["core", "abs"], "2026-10-24T20:30:00Z", { holdSecs: 40, format: "circuit", ladder: "plank" }),
  E("late", "Core & Abs", "quick", 1, "deadbug", 3, [10, 15], null, null, ["abs", "core"], "2026-10-24T20:31:00Z", { format: "circuit" }),
];

// 1 · the day view
{
  const d16 = sessionsOnDay(log, "2026-10-16", IL, customs, profile);
  ok(d16.length === 1 && d16[0].label === "Core and abs" && d16[0].source === "manual", "the 16th: one session, “Core and abs”, logged by hand");
  ok(d16[0].moves.map((m) => m.name).join(", ") === "Tridents, Russian Twist, Lying Leg Raise, Push-Up Pass-Through, Kettlebell Halo", `…its five moves in the order done (${d16[0].moves.map((m) => m.name).join(", ")})`);
  ok(d16[0].moves.every((m) => m.sets === 3 && m.reps[0] === 10) && d16[0].sets === 15 && d16[0].moves[0].load === 14, "…each 3 × 10, 15 sets, with the 14 kg loads");
  const d15 = sessionsOnDay(log, "2026-10-15", IL, customs, profile)[0];
  ok(d15.moves.some((m) => m.name === "Kettlebell Shrug") && !d15.moves.some((m) => /Dumbbell/.test(m.name)), "moves read as they do for your kit (Kettlebell Shrug, not Dumbbell Shrug)");
  ok(d15.moves[d15.moves.length - 1].skill && d15.moves[d15.moves.length - 1].name === "Support Hold", "skill practice is listed too, after the lifts");
  ok(sessionsOnDay(log, "2026-10-17", IL, customs, profile).length === 0, "a rest day shows nothing");
  ok(sessionsOnDay(log, "2026-10-24", IL).length === 1 && sessionsOnDay(log, "2026-10-25", IL).length === 0, "23:30 on Saturday in Israel is Saturday's workout, not Sunday's");
}

// 2 · doing it again
{
  const s = sessionsOnDay(log, "2026-10-16", IL, customs, profile)[0];
  const w = repeatSession(s, profile, log, { customs, sessionId: "again-1" });
  ok(w.exercises.map((x) => x.id).join() === "custom:tridents,russiantwist,legraise,kbpassthrough,kbhalo", "same five moves, same order (old customs now read as the library halo and pass-through)");
  ok(w.exercises.every((x) => x.sets === 3 && x.setsArr.length === 3), "same number of sets");
  ok(w.exercises.find((x) => x.id === "kbhalo").load === 14 && w.exercises.find((x) => x.id === "custom:tridents").load === 14, "the 14 kg bell where you used it");
  ok(w.exercises.every((x) => x.coachNote), "each move says what's different today, if anything");
  const tri = w.exercises[0];
  ok(tri.primary === "core" && tri.name === "Tridents" && tri.rest > 0, "your own move (Tridents) runs like any other, with its muscles and rest");
  ok(w.mode === "quick" && w.repeatOf.id === "core" && /again/.test(w.focusLabel) && w.sessionId === "again-1", "it runs as a single session, labelled as a repeat");
  ok(w.warmup.length > 0 && repeatSession(s, { ...profile, warmup: false }, log, { customs }).warmup.length === 0, "the warm-up follows your setting");

  // unrated history → exactly what you did; rated → today's progression
  const unrated = log.map((e) => (e.sessionId === "core" ? { ...e, feel: null } : e));
  const s2 = sessionsOnDay(unrated, "2026-10-16", IL, customs, profile)[0];
  const w2 = repeatSession(s2, profile, unrated, { customs });
  ok(w2.exercises.find((x) => x.id === "russiantwist").reps.join() === "10,10" && /Same as last time: 3 × 10 @ 14 kg/.test(w2.exercises.find((x) => x.id === "russiantwist").coachNote), "nothing rated → repeat exactly: 3 × 10 @ 14 kg");
  ok(w.exercises.find((x) => x.id === "russiantwist").reps[1] === 11, "rated “right” → one more rep than last time");

  // the pull day: skill practice isn't copied, the bodyweight pull-up stays bodyweight
  const pull = repeatSession(sessionsOnDay(log, "2026-10-15", IL, customs, profile)[0], profile, log, { customs });
  ok(pull.exercises.length === 2 && !pull.exercises.some((x) => String(x.id).startsWith("skill:")), "skill practice isn't copied into a repeat");
  ok(pull.exercises.find((x) => x.id === "pullup").load == null, "pull-ups stay bodyweight");
  ok(pull.exercises.find((x) => x.id === "dbshrug").load === 14 && pull.exercises.find((x) => x.id === "dbshrug").name === "Kettlebell Shrug", "the shrug comes back on your 14 kg bell");

  // a circuit stays a circuit
  const c = repeatSession(sessionsOnDay(log, "2026-10-24", IL)[0], profile, log, {});
  ok(c.format === "circuit" && c.rounds === 3 && c.exercises.every((x) => x.sets === 3) && c.exercises[0].holdSecs === 40, "a circuit comes back as a 3-round circuit with the same hold");

  // gear you no longer own
  const noBell = { ...profile, inventory: ["wall", "chair", "towel", "pullupbar"] };
  const nb = repeatSession(s, noBell, log, { customs });
  ok(nb.skipped.some((x) => x.name === "Russian Twist") && !nb.exercises.some((x) => x.id === "russiantwist"), "a move whose gear you no longer have is left out, and says why");
}

// 3 · logging the repeat is a normal single session
{
  const s = sessionsOnDay(log, "2026-10-16", IL, customs, profile)[0];
  const w = repeatSession(s, profile, log, { customs, sessionId: "again-2" });
  let next = log;
  w.exercises.forEach((x, i) => { next = upsertEntry(next, { exerciseId: x.id, sets: x.sets, reps: x.reps, holdSecs: x.holdSecs, load: x.load, feel: "right", muscles: [x.primary, ...x.secondary], source: "quick", format: w.format, sessionId: w.sessionId, slot: i, label: w.label, at: T("2026-10-22T16:00:00Z") + i }); });
  const today = sessionsOnDay(next, "2026-10-22", IL, customs, profile);
  ok(today.length === 1 && today[0].moves.length === 5 && today[0].source === "quick", "done again: it shows on today's date as a single session");
  ok(planLog(next).length === planLog(log).length, "…and never as a plan day");
}

console.log(failures ? `\n❌ ${failures} FAILURES` : "\n✅ any past day can be opened and done again");
process.exitCode = failures ? 1 : 0;
