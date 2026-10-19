// "Which week is this workout in?" is answered in the PERSON's calendar (home
// zone + first weekday), never the device's. Proves it by running the same
// questions in processes set to very different time zones and comparing.
import { execFileSync } from "child_process";
import { fileURLToPath } from "url";
import {
  zoned, instantOf, dayStart, addDays, weekStartIn, dateKey, weeksBetween, calendarOf, localeWeekStart, validZone,
} from "../src/engine/calendar.js";
import { weekProgress, planWeek } from "../src/engine/week.js";
import { calendar, summary, weeklyVolumeSeries } from "../src/engine/progress.js";
import { MUSCLES } from "../src/engine/data.js";

const IL = { timeZone: "Asia/Jerusalem", weekStartsOn: 0 };
const ALL = new Set(Object.keys(MUSCLES));
const profile = { age: 28, height: 175, weight: 57, level: "intermediate", goal: "muscle", equipment: "bw", inventory: ["wall", "chair", "towel", "kettlebell", "pullupbar"], customGear: [], sessionMinutes: 20, daysPerWeek: 5, skill: "lsit", excluded: [] };
const T = (iso) => Date.parse(iso);

/** Everything that depends on day/week boundaries, as plain data. */
function answers() {
  const plan = planWeek(profile, ALL);
  const pe = (i, at, source = "plan") => ({ exerciseId: "x", sets: 3, feel: "right", muscles: plan.days[i].muscles, at, source, dayKey: source === "plan" ? plan.days[i].key : null, sessionId: `s${i}${at}`, slot: "0" });
  // Pull Thu 15th evening; Push at 01:30 on Sunday the 18th, Israel time (= Sat 22:30 UTC)
  const log = [pe(0, T("2026-10-15T17:13:00Z")), pe(1, T("2026-10-17T22:30:00Z"))];
  const mon = T("2026-10-19T09:00:00Z");
  const wp = weekProgress(plan, log, mon, IL);
  const cal = calendar(log, 2, mon, IL);
  const vol = weeklyVolumeSeries(log, 2, mon, IL);
  return {
    weekStart: new Date(weekStartIn(mon, IL)).toISOString(),
    pushDay: dateKey(log[1].at, IL),
    done: wp.done, lastWeek: wp.lastWeekCount, next: wp.next,
    firstColumnWeekday: cal.days[0].wd,
    trainedDays: cal.days.filter((d) => d.plan).map((d) => d.key),
    thisWeekSessions: summary(log, mon, IL).thisWeek,
    volumeThisWeek: Object.keys(vol.weeks[1].muscles).length > 0,
    noon: new Date(instantOf(2026, 10, 18, 12, 0, "Asia/Jerusalem")).toISOString(),
    dstWeek: new Date(weekStartIn(T("2026-10-27T10:00:00Z"), IL)).toISOString(),
    dstDays: [addDays(T("2026-10-24T12:00:00Z"), 1, IL) - dayStart(T("2026-10-24T12:00:00Z"), IL), addDays(T("2026-10-25T12:00:00Z"), 1, IL) - dayStart(T("2026-10-25T12:00:00Z"), IL)],
  };
}

if (process.argv[2] === "--child") {
  process.stdout.write(JSON.stringify(answers()));
} else {
  let failures = 0;
  const ok = (c, m) => { if (!c) { failures++; console.log("  ❌ " + m); } else console.log("  ✓ " + m); };
  const a = answers();

  ok(a.pushDay === "2026-10-18", "01:30 Sunday in Israel is Sunday the 18th, even though it's still Saturday in UTC");
  ok(a.weekStart === "2026-10-17T21:00:00.000Z", "the week starts Sunday 00:00 Israel time (Sat 21:00 UTC)");
  ok(a.done[1] === true && a.done[0] === false && a.lastWeek === 1, "on Monday the 19th: Sunday's Push is THIS week, Thursday's Pull is last week");
  ok(a.next === 2, "…and the rotation continues at day 3");
  ok(a.firstColumnWeekday === 0 && a.trainedDays.join() === "2026-10-15,2026-10-18", "the training calendar starts its columns on Sunday and puts each workout on its Israeli date");
  ok(a.thisWeekSessions === 1 && a.volumeThisWeek, "summary and weekly volume agree with the Week tab");
  ok(a.noon === "2026-10-18T09:00:00.000Z", "a back-dated logged workout is stored at noon Israel time");
  ok(a.dstWeek === "2026-10-24T21:00:00.000Z", "the week containing the end of daylight saving still starts at local midnight");
  ok(a.dstDays[0] === 24 * 36e5 && a.dstDays[1] === 25 * 36e5, "the day clocks go back is 25 hours long; the day before is 24");

  // the same answers on devices set to very different zones
  const self = fileURLToPath(import.meta.url);
  for (const tz of ["UTC", "Pacific/Auckland", "America/Los_Angeles", "Asia/Jerusalem"]) {
    const out = execFileSync(process.execPath, [self, "--child"], { env: { ...process.env, TZ: tz } }).toString();
    ok(out === JSON.stringify(a), `a device set to ${tz} gives the identical week, days and counts`);
  }

  // what a device-local reading would have got wrong
  const utcMonday = { timeZone: "UTC", weekStartsOn: 1 };
  ok(dateKey(T("2026-10-17T22:30:00Z"), utcMonday) === "2026-10-17", "(for contrast: read in UTC, that Sunday workout is a Saturday — the bug this prevents)");

  // calendar settings
  ok(localeWeekStart("he-IL", "Asia/Jerusalem") === 0 && localeWeekStart("en-GB", "Europe/London") === 1, "default first weekday follows the locale: Sunday in Israel, Monday in the UK");
  ok(calendarOf({ timeZone: "Mars/Olympus", weekStartsOn: 3 }).timeZone !== "Mars/Olympus" && [0, 1, 6].includes(calendarOf({ weekStartsOn: 3 }).weekStartsOn), "an invalid zone or weekday falls back to the device's");
  ok(validZone("Asia/Jerusalem") && !validZone("") && !validZone("Nope/Nowhere"), "time zones are validated");
  const sat = { timeZone: "Asia/Dubai", weekStartsOn: 6 };
  ok(zoned(weekStartIn(T("2026-10-21T10:00:00Z"), sat), sat.timeZone).wd === 6, "a Saturday-start week begins on Saturday");
  ok(weeksBetween(T("2026-10-18T00:30:00+03:00"), T("2026-10-24T23:30:00+03:00"), IL) === 0 && weeksBetween(T("2026-10-24T23:30:00+03:00"), T("2026-10-25T00:30:00+03:00"), IL) === 1, "Saturday night and Sunday morning are a week apart; Sunday to Saturday is the same week");

  console.log(failures ? `\n❌ ${failures} FAILURES` : "\n✅ weeks are read in your calendar, on every device");
  process.exitCode = failures ? 1 : 0;
}
