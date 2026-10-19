// ─── The user's calendar ──────────────────────────────────────────────────────
// Timestamps are stored as absolute instants (timestamptz / epoch ms): a set
// done at 01:30 on Sunday in Tel Aviv is the same instant everywhere. What
// differs between devices is how an instant is READ: which day, which week.
// So "which week" is a property of the person, not the device: their home
// time zone and the day their week starts on. Every day/week boundary in the
// app goes through here, with those two values from the profile — a laptop in
// UTC and a phone in Israel then agree on where a Sunday-night workout lands.
const DAY = 864e5;

const deviceZone = () => {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"; } catch { return "UTC"; }
};

export function validZone(tz) {
  if (!tz || typeof tz !== "string") return false;
  try { new Intl.DateTimeFormat("en-US", { timeZone: tz }); return true; } catch { return false; }
}

/** First day of the week for a locale: 0 = Sunday, 1 = Monday, 6 = Saturday. */
export function localeWeekStart(locale, tz) {
  try {
    const l = new Intl.Locale(locale || "en");
    const info = (typeof l.getWeekInfo === "function" ? l.getWeekInfo() : l.weekInfo) || null;
    if (info && info.firstDay) return info.firstDay % 7;
  } catch {}
  // no weekInfo in this engine: a few zones whose week clearly starts on Sunday
  if (/^(Asia\/(Jerusalem|Tel_Aviv)|America\/)/.test(tz || "")) return 0;
  return 1;
}

/** The device's calendar — the default until the profile says otherwise. */
export function deviceCalendar() {
  const timeZone = deviceZone();
  let locale = "en";
  try { locale = (typeof navigator !== "undefined" && navigator.language) || Intl.DateTimeFormat().resolvedOptions().locale || "en"; } catch {}
  return { timeZone, weekStartsOn: localeWeekStart(locale, timeZone) };
}

/** A complete, valid calendar from whatever the profile holds. */
export function calendarOf(profile) {
  const dev = deviceCalendar();
  const timeZone = validZone(profile?.timeZone) ? profile.timeZone : dev.timeZone;
  const w = Number(profile?.weekStartsOn);
  return { timeZone, weekStartsOn: [0, 1, 6].includes(w) ? w : dev.weekStartsOn };
}

const fmtCache = new Map();
function partsFmt(tz) {
  if (!fmtCache.has(tz)) {
    fmtCache.set(tz, new Intl.DateTimeFormat("en-US", {
      timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit", weekday: "short",
    }));
  }
  return fmtCache.get(tz);
}
const WD = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

/** Wall-clock parts of an instant in a zone. */
export function zoned(ts, tz) {
  const p = Object.fromEntries(partsFmt(tz).formatToParts(new Date(ts)).map((x) => [x.type, x.value]));
  return { y: +p.year, m: +p.month, d: +p.day, h: +p.hour % 24, mi: +p.minute, s: +p.second, wd: WD[p.weekday] };
}

/** The instant of a wall-clock time in a zone (DST-safe: re-checks the offset once). */
export function instantOf(y, m, d, h, mi, tz) {
  const wall = Date.UTC(y, m - 1, d, h, mi);
  let t = wall;
  for (let i = 0; i < 2; i++) {
    const z = zoned(t, tz);
    const asUtc = Date.UTC(z.y, z.m - 1, z.d, z.h, z.mi);
    t += wall - asUtc;
  }
  return t;
}

/** Local midnight (in the user's zone) of the day an instant falls on. */
export function dayStart(ts, cal) {
  const z = zoned(ts, cal.timeZone);
  return instantOf(z.y, z.m, z.d, 0, 0, cal.timeZone);
}

/** Midnight n calendar days after the day of ts (n can be negative). */
export function addDays(ts, n, cal) {
  const z = zoned(ts, cal.timeZone);
  const u = new Date(Date.UTC(z.y, z.m - 1, z.d + n));
  return instantOf(u.getUTCFullYear(), u.getUTCMonth() + 1, u.getUTCDate(), 0, 0, cal.timeZone);
}

/** Midnight of the first day of the week containing ts. */
export function weekStartIn(ts, cal) {
  const z = zoned(ts, cal.timeZone);
  const back = (z.wd - cal.weekStartsOn + 7) % 7;
  return addDays(ts, -back, cal);
}

/** "2026-10-18" — the user's calendar date of an instant. */
export function dateKey(ts, cal) {
  const z = zoned(ts, cal.timeZone);
  return `${z.y}-${String(z.m).padStart(2, "0")}-${String(z.d).padStart(2, "0")}`;
}

/** Whole weeks between the weeks containing a and b (b later → positive). */
export function weeksBetween(a, b, cal) {
  return Math.round((weekStartIn(b, cal) - weekStartIn(a, cal)) / (7 * DAY));
}

export const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** What pure engine functions assume when no calendar is passed: this device's zone, Monday. */
export const fallbackCalendar = () => ({ timeZone: deviceZone(), weekStartsOn: 1 });
