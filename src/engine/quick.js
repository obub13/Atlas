// ─── Single session: one workout, right now, no plan attached ─────────────────
// Same person, same gear, same progression history — different job. The weekly
// plan keeps its anchor lifts stable so load can climb; a single session is
// about the area you want to hit TODAY, so it favours variety and brevity and
// never changes what the plan will hand you next.
import { buildWorkout } from "./generator.js";

export const QUICK_FOCUS = [
  { id: "core",   label: "Core & Abs",   muscles: ["abs", "core"], format: "circuit",
    blurb: "Bracing, flexion and anti-rotation, back to back." },
  { id: "full",   label: "Full body",    muscles: ["quads", "hamstrings", "glutes", "chest", "lats", "core"], format: "circuit",
    blurb: "A bit of everything, heart rate up." },
  { id: "upper",  label: "Upper body",   muscles: ["chest", "lats", "frontDelts", "rearDelts", "biceps", "triceps"], format: "sets",
    blurb: "Push and pull, balanced." },
  { id: "lower",  label: "Lower body",   muscles: ["quads", "hamstrings", "glutes", "calves"], format: "sets",
    blurb: "Squat, hinge and single-leg work." },
  { id: "arms",   label: "Arms",         muscles: ["biceps", "triceps", "forearms"], format: "sets",
    blurb: "Biceps, triceps and grip." },
  { id: "glutes", label: "Glutes & hamstrings", muscles: ["glutes", "hamstrings"], format: "sets",
    blurb: "The back of the legs, properly." },
  { id: "push",   label: "Push",         muscles: ["chest", "frontDelts", "triceps"], format: "sets",
    blurb: "Chest, shoulders, triceps." },
  { id: "pull",   label: "Pull",         muscles: ["lats", "traps", "rearDelts", "biceps"], format: "sets",
    blurb: "Back, rear shoulders, biceps." },
];

export const QUICK_MINUTES = [10, 15, 20, 30, 45];

export const FORMATS = {
  circuit: { label: "Circuit",       blurb: "One set of each move back to back, short breathers, rest after each round." },
  sets:    { label: "Straight sets", blurb: "All sets of one move, then the next. Better when the weight is heavy." },
};

export const focusById = (id) => QUICK_FOCUS.find((f) => f.id === id) || QUICK_FOCUS[0];

/** A fresh seed per session, so two single sessions in a row aren't clones. */
export const newSeed = () => 1 + Math.floor(Math.random() * 9973);

/**
 * Build one standalone session. `seed` picks the variety; the same seed with
 * the same inputs rebuilds the same session, so it's testable.
 */
export function buildQuickWorkout(profile, { focus, minutes, format, seed = 1 }, log = []) {
  const f = focusById(focus);
  const p = { ...profile, sessionMinutes: minutes, skill: null };
  const w = buildWorkout(p, new Set(f.muscles), log, { variant: Math.max(1, seed), format: format || f.format, fresh: true });
  if (!w) return null;
  // Say so when the session is short because more would be junk volume —
  // otherwise a 45-minute core request that returns 21 minutes looks like a bug.
  const spare = minutes - w.estMinutes;
  const capped = w.coverage.some((c) => c.effective >= 8.5);
  const ceilingNote = spare >= 5 && capped
    ? `That’s the useful ceiling for ${f.label.toLowerCase()} in one session — around 10 hard sets per muscle. More would be fatigue without extra progress, so spend the spare ${spare} minutes on another area or finish early.`
    : null;
  return { ...w, mode: "quick", focus: f.id, focusLabel: f.label, seed, ceilingNote };
}
