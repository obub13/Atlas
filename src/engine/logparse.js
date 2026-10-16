// ─── Logging a workout done outside the app ───────────────────────────────────
// "3x10 all: russian twist, tridents, leg raises, halos" → rows the log can hold.
// Names are matched against the exercise library first, then against moves the
// person has logged before, then against a small list of common moves the
// library doesn't program. Anything still unknown becomes a new move and the
// person picks which muscles it worked — so its sets land in the right place in
// weekly volume and it gets its own progress line.
import { EXERCISES, MUSCLES } from "./data.js";

/** Common moves the generator doesn't program, with the muscles they mostly train. */
export const KNOWN_MOVES = [
  { name: "Kettlebell Halo",          words: ["halo"],                         primary: "frontDelts", secondary: ["core", "triceps"] },
  { name: "Kettlebell Swing",         words: ["swing"],                        primary: "glutes",     secondary: ["hamstrings", "core"] },
  { name: "Push-Up Pass-Through",     words: ["pushup", "pass", "through"],    primary: "chest",      secondary: ["triceps", "core"] },
  { name: "Renegade Row",             words: ["renegade", "row"],              primary: "lats",       secondary: ["core", "chest"] },
  { name: "Windmill",                 words: ["windmill"],                     primary: "core",       secondary: ["frontDelts", "hamstrings"] },
  { name: "Turkish Get-Up",           words: ["turkish", "getup"],             primary: "core",       secondary: ["frontDelts", "glutes"] },
  { name: "Around the World",         words: ["around", "world"],              primary: "core",       secondary: ["frontDelts"] },
  { name: "Figure 8",                 words: ["figure", "8"],                  primary: "core",       secondary: ["forearms", "glutes"] },
  { name: "Kettlebell Clean",         words: ["clean"],                        primary: "glutes",     secondary: ["hamstrings", "traps"] },
  { name: "Kettlebell Snatch",        words: ["snatch"],                       primary: "glutes",     secondary: ["frontDelts", "hamstrings"] },
  { name: "High Pull",                words: ["high", "pull"],                 primary: "traps",      secondary: ["rearDelts"] },
  { name: "Thruster",                 words: ["thruster"],                     primary: "quads",      secondary: ["frontDelts", "glutes"] },
  { name: "Bicycle Crunch",           words: ["bicycle", "crunch"],            primary: "abs",        secondary: ["core"] },
  { name: "Mountain Climber",         words: ["mountain", "climber"],          primary: "core",       secondary: ["abs"] },
  { name: "Burpee",                   words: ["burpee"],                       primary: "quads",      secondary: ["chest", "core"] },
  { name: "V-Up",                     words: ["vup"],                          primary: "abs",        secondary: ["core"] },
  { name: "Flutter Kicks",            words: ["flutter", "kick"],              primary: "abs",        secondary: ["core"] },
];

// words that don't identify a movement
const NOISE = new Set(["a", "an", "the", "with", "and", "of", "on", "my", "kettlebell", "kettlebells", "kb", "kbs", "dumbbell", "db",
  "weighted", "all", "set", "sets", "rep", "reps", "x", "each", "side", "per", "today", "i", "did", "do", "then", "plus", "also"]);

const singular = (w) => (w.length > 3 && w.endsWith("es") && /(sh|ch|x|ss)es$/.test(w) ? w.slice(0, -2)
  : w.length > 3 && w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1) : w);

/** Lower-case, unify spellings (push-up / push up → pushup), drop noise words. */
export function tokens(text) {
  return String(text).toLowerCase()
    .replace(/push[\s-]*ups?/g, "pushup").replace(/pull[\s-]*ups?/g, "pullup").replace(/sit[\s-]*ups?/g, "situp")
    .replace(/chin[\s-]*ups?/g, "chinup").replace(/get[\s-]*ups?/g, "getup").replace(/v[\s-]+ups?/g, "vup")
    .replace(/[^a-z0-9]+/g, " ").trim().split(/\s+/).filter(Boolean).map(singular).filter((w) => !NOISE.has(w));
}

export const slugOf = (name) => "custom:" + String(name).toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);

function candidates(customs) {
  const lib = EXERCISES.flatMap((e) => [e.name, ...Object.values(e.nameBy || {})].map((n) => ({
    type: "library", id: e.id, name: n, primary: e.primary, secondary: e.secondary, timed: !!e.timed, loadable: !!e.loadable, words: tokens(n),
  })));
  const mine = customs.map((c) => ({ type: "custom", id: c.id, name: c.name, primary: c.primary, secondary: c.secondary || [], timed: !!c.timed, loadable: true, words: tokens(c.name) }));
  const known = KNOWN_MOVES.map((k) => ({ type: "known", id: slugOf(k.name), name: k.name, primary: k.primary, secondary: k.secondary, timed: false, loadable: true, words: k.words }));
  return [...mine, ...lib, ...known];
}

/** Best match for a typed name, or null. Jaccard overlap on meaningful words. */
export function matchMove(text, customs = []) {
  const t = new Set(tokens(text));
  if (!t.size) return null;
  let best = null;
  for (const c of candidates(customs)) {
    const w = new Set(c.words);
    if (!w.size) continue;
    let inter = 0;
    for (const x of w) if (t.has(x)) inter++;
    if (!inter) continue;
    const score = inter / (t.size + w.size - inter) + (c.type === "custom" ? 0.05 : 0); // a move you've logged before wins ties
    if (score >= 0.5 && (!best || score > best.score + 1e-9)) best = { ...c, score };
  }
  return best;
}

const PREAMBLE = /\b(workouts?|exercises?|these|following|session|training)\b/i;

const SETSREPS = /(\d{1,2})\s*[x×*]\s*(\d{1,3})(?!\s*(?:s|sec|secs|seconds)\b)/i;
const SETSHOLD = /(\d{1,2})\s*[x×*]\s*(\d{1,3})\s*(?:s|sec|secs|seconds)\b/i;
const SETSOF = /(\d{1,2})\s*sets?\s*(?:of\s*)?(\d{1,3})\s*(?:reps?)?/i;
const KG = /(\d{1,3}(?:[.,]\d)?)\s*(?:kg|kgs|kilo|kilos)\b/i;
const LB = /(\d{1,3}(?:[.,]\d)?)\s*(?:lb|lbs|pounds?)\b/i;

function readNumbers(s) {
  const out = {};
  let m;
  if ((m = SETSHOLD.exec(s))) { out.sets = +m[1]; out.holdSecs = +m[2]; s = s.replace(m[0], " "); }
  else if ((m = SETSREPS.exec(s)) || (m = SETSOF.exec(s))) { out.sets = +m[1]; out.reps = +m[2]; s = s.replace(m[0], " "); }
  if ((m = KG.exec(s))) { out.load = +m[1].replace(",", "."); s = s.replace(m[0], " "); }
  else if ((m = LB.exec(s))) { out.load = Math.round(+m[1].replace(",", ".") * 0.4536 * 2) / 2; s = s.replace(m[0], " "); }
  return { ...out, rest: s };
}

/**
 * Turn free text into rows. A sets×reps (or kg) that applies to "all" — or that
 * comes before the list — is the default for every row; a row's own numbers win.
 */
export function parseWorkoutText(text, customs = []) {
  let s = String(text || "").replace(/\r/g, "");
  // global defaults: "3x10 all", "all 3x10", or numbers before a colon
  const defaults = { sets: null, reps: null, holdSecs: null, load: null };
  const head = /^(.*?)(?::|\n)/.exec(s);
  const takeGlobal = (chunk) => {
    const n = readNumbers(chunk);
    for (const k of ["sets", "reps", "holdSecs", "load"]) if (n[k] != null) defaults[k] = n[k];
    return n.rest;
  };
  const allRe = /(?:\b(\d{1,2}\s*[x×*]\s*\d{1,3}\s*(?:s|sec|secs|seconds)?|\d{1,2}\s*sets?\s*(?:of\s*)?\d{1,3}\s*(?:reps?)?)\s*(?:for\s+)?(?:all|each|everything)\b)|(?:\b(?:all|each|everything)\s*(?:at|:)?\s*(\d{1,2}\s*[x×*]\s*\d{1,3}\s*(?:s|sec|secs|seconds)?))/i;
  let m = allRe.exec(s);
  if (m) { takeGlobal(m[1] || m[2]); s = s.replace(m[0], " "); }
  else if (head && readNumbers(head[1]).sets != null && tokens(readNumbers(head[1]).rest).length === 0) {
    takeGlobal(head[1]); s = s.slice(head[0].length);
  }
  // a lead-in like "today I did these with a kettlebell:" isn't an exercise
  const colon = s.indexOf(":");
  if (colon >= 0 && !matchMove(readNumbers(s.slice(0, colon)).rest, customs)) s = s.slice(colon + 1);
  const parts = s.split(/[\n,;+•]|\band\b|\bthen\b/i).map((x) => x.trim()).filter(Boolean)
    .filter((x) => !PREAMBLE.test(x) || matchMove(x, customs));
  const rows = [];
  for (const part of parts) {
    const n = readNumbers(part);
    const name = n.rest.replace(/^[\s\-–:.)\d]+/, "").replace(/\s+/g, " ").trim();
    if (!tokens(name).length) continue;
    const match = matchMove(name, customs);
    rows.push({
      text: name,
      name: match ? match.name : titleCase(name),
      match,
      sets: n.sets ?? defaults.sets,
      reps: n.holdSecs != null ? null : n.reps ?? (defaults.holdSecs != null ? null : defaults.reps),
      holdSecs: n.holdSecs ?? (n.reps != null ? null : defaults.holdSecs),
      load: n.load ?? defaults.load,
    });
  }
  return { defaults, rows };
}

const titleCase = (s) => String(s).replace(/\b(kettlebell|kb)\b/gi, "").replace(/\s+/g, " ").trim()
  .replace(/\b\w/g, (c) => c.toUpperCase()) || s;

/** The muscles a row trains, as the log stores them: [primary, ...secondary]. */
export function musclesOf(row) {
  const primary = row.primary || row.match?.primary;
  if (!primary || !MUSCLES[primary]) return null;
  const secondary = (row.secondary || row.match?.secondary || []).filter((m) => MUSCLES[m] && m !== primary);
  return [primary, ...secondary];
}

/**
 * Rows → log entries for one logged session. Library moves keep their id (so
 * they feed that lift's progression); everything else gets a stable custom id.
 * Returns the entries plus any new custom moves to remember on the profile.
 */
export function entriesFromRows(rows, { sessionId, at, label, customs = [] }) {
  const newCustoms = [];
  const entries = rows.map((r, i) => {
    const libraryId = r.match?.type === "library" ? r.match.id : null;
    const muscles = musclesOf(r);
    let exerciseId = libraryId;
    if (!exerciseId) {
      exerciseId = r.match?.type === "custom" ? r.match.id : slugOf(r.name);
      if (!customs.some((c) => c.id === exerciseId) && !newCustoms.some((c) => c.id === exerciseId)) {
        newCustoms.push({ id: exerciseId, name: r.name.trim().slice(0, 60), primary: muscles[0], secondary: muscles.slice(1), timed: r.holdSecs != null });
      }
    }
    const ex = libraryId ? EXERCISES.find((e) => e.id === libraryId) : null;
    return {
      exerciseId, ladder: ex?.ladder || null, rank: ex?.rank || null,
      sets: Math.max(1, Math.min(20, Math.round(r.sets))),
      reps: r.holdSecs != null ? null : [Math.round(r.reps), Math.round(r.reps)],
      holdSecs: r.holdSecs != null ? Math.round(r.holdSecs) : null,
      load: r.load == null || r.load === "" ? null : +r.load,
      feel: r.feel || null,
      muscles,
      source: "manual", format: "sets", sessionId, slot: i, label, dayKey: null,
      at: at + i * 1000,
    };
  });
  return { entries, newCustoms };
}

/** What's still missing before a row can be saved, or null when it's ready. */
export function rowProblem(r) {
  if (!String(r.name || "").trim()) return "Name the exercise";
  if (!(r.sets >= 1)) return "How many sets?";
  if (r.holdSecs == null && !(r.reps >= 1)) return "How many reps?";
  if (r.holdSecs != null && !(r.holdSecs >= 1)) return "How many seconds?";
  if (!musclesOf(r)) return "Which muscle did it work?";
  return null;
}
