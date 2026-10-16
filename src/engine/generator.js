// ─── Routine generator ────────────────────────────────────────────────────────
// A session is solved against a time budget, not read out of a lookup table.
import {
  EXERCISES, WARMUPS, STRETCHES, GOALS, LEVELS, REST, MUSCLES, WEEKLY,
  EQUIP_PRESETS, LOADING_ITEMS, ITEM_LABEL,
} from "./data.js";
import { lastFor, lastInLadder, consecutiveHard, currentBlock, hash, daysSince, planLog } from "./history.js";
import { SKILLS, SKILL_SETS, SKILL_REST, criterionLabel, stageNeeds } from "./skills.js";

const TRANSITION = 12;              // seconds of setup between sets
const PATTERN_ORDER = { squat: 1, hinge: 2, hpush: 3, hpull: 3, vpush: 4, vpull: 4, lunge: 5, iso: 6, brace: 7, carry: 8 };

const round = (n, step) => Math.max(step, Math.round(n / step) * step);
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

/* ── what you own decides what you're asked to do ─────────────────────────── */
export function inventoryOf(profile) {
  // An explicitly empty kit means "I have nothing" — never quietly hand back a
  // preset the user didn't choose. Only a missing field falls back.
  const list = Array.isArray(profile.inventory)
    ? profile.inventory
    : EQUIP_PRESETS[profile.equipment] || EQUIP_PRESETS.bw;
  const extra = (profile.customGear || []).map((g) => g.actsAs).filter(Boolean);
  return new Set([...list, ...extra]);
}

/** Can this movement be performed with the gear on hand? */
export function available(ex, inv) {
  if ((ex.needs || []).some((i) => !inv.has(i))) return false;
  if (ex.needsAny && !ex.needsAny.some((i) => inv.has(i))) return false;
  return true;
}

const canLoad = (ex, inv) => !!ex.loadable && LOADING_ITEMS.some((i) => inv.has(i));

/** Which allowed implement this person actually owns. */
export function implementFor(ex, inv) {
  if (ex.needsAny) return ex.needsAny.find((i) => inv.has(i)) || ex.needsAny[0];
  return (ex.needs || []).find((i) => LOADING_ITEMS.includes(i)) || null;
}

/** The movement as it should read for THIS kit — never naming gear they lack. */
export function resolveExercise(ex, inv) {
  const impl = implementFor(ex, inv);
  const single = impl === "kettlebell";   // one bell, so the load is a total
  return {
    ...ex,
    baseLoadUnit: ex.loadUnit || null,
    name: (impl && ex.nameBy && ex.nameBy[impl]) || ex.name,
    tip: (impl && ex.tipBy && ex.tipBy[impl]) || ex.tip,
    implement: impl,
    loadUnit: single ? "total" : ex.loadUnit || null,
    needsLabel: needsLabel(ex, inv),
  };
}

/** Plain-language label for what a movement needs, given what's owned. */
export function needsLabel(ex, inv) {
  const req = [...(ex.needs || [])];
  if (ex.needsAny) {
    const owned = inv ? ex.needsAny.find((i) => inv.has(i)) : null;
    req.push(owned || ex.needsAny[0]);
  }
  if (!req.length) return "Bodyweight";
  return req.map((i) => ITEM_LABEL[i] || i).join(" + ");
}

/* ── how the person's own numbers change the prescription ─────────────────── */
export function deriveLimits(profile) {
  const level = LEVELS[profile.level] || LEVELS.intermediate;
  const age = +profile.age || 30;

  // Recovery slows with age: rest lengthens, the volume ceiling comes down,
  // landing forces get screened out, and joints get more prep.
  const decadesOver40 = Math.max(0, Math.floor((age - 40) / 10));
  const restMult = clamp(1 + 0.1 * decadesOver40, 1, 1.4);
  const maxEffective = age >= 55 ? 9 : 10;
  const minDirect = profile.level === "beginner" ? 3 : 4;

  return {
    level,
    maxSkill: level.maxSkill,
    restMult,
    maxEffective,
    minDirect,
    targetDirect: level.setsPerMuscle,
    allowImpact: age < 60,
    jointPrep: age >= 45,
    ageNote:
      age >= 55 ? `Rest is stretched and volume capped for age ${age} — recovery, not effort, is the limiter.`
      : age >= 45 ? `Rest lengthened slightly and joint prep added for age ${age}.`
      : null,
  };
}

/* ── prescription per exercise ────────────────────────────────────────────── */
export function repsFor(ex, profile, inv = inventoryOf(profile)) {
  const goal = GOALS[profile.goal] || GOALS.muscle;
  const level = LEVELS[profile.level] || LEVELS.intermediate;
  if (ex.timed) return { holdSecs: round(goal.holdSecs * level.holdMult, 5), reps: null };
  // a few moves have their own sensible range whatever the goal (get-ups, windmills)
  if (ex.repRange) return { reps: [...ex.repRange], holdSecs: null };
  // A push-up cannot be made heavier, so the rep target has to move instead —
  // and neither can a hip thrust if there's nothing in the house to hold.
  // "Loadable" means loadable BY THIS PERSON, with the gear they actually own.
  return { reps: canLoad(ex, inv) ? goal.reps : goal.bwReps, holdSecs: null };
}

export function restFor(ex, profile, restMult = 1) {
  const table = REST[profile.goal] || REST.muscle;
  let secs;
  if (ex.timed) secs = table.timed;
  else if (ex.compound && ex.loadable) secs = table.compound;
  // A hard bodyweight compound sits between the two: real effort, but nothing
  // like the systemic cost of a loaded squat.
  else if (ex.compound) secs = (table.compound + table.isolation) / 2;
  else secs = table.isolation;
  return Math.round((secs * restMult) / 5) * 5;
}

export function suggestLoad(ex, profile, inv = inventoryOf(profile)) {
  if (!ex.loadFactor || !canLoad(ex, inv)) return null;
  const bw = +profile.weight || 75;
  const level = LEVELS[profile.level] || LEVELS.intermediate;
  // A per-hand factor describes ONE of a pair; a single kettlebell carries the
  // whole load, so it goes up accordingly.
  const perHandFactor = (ex.baseLoadUnit || ex.loadUnit) === "perHand";
  const single = ex.implement === "kettlebell";
  const raw = bw * ex.loadFactor * level.loadMult * (perHandFactor && single ? 1.5 : 1);
  const step = ex.loadUnit === "perHand" ? 2.5 : 5;
  return clamp(round(raw, step), step, bw * 2.5);
}

/* ── ladders: the progression lever for movements that can't be loaded ────── */
function ladderMembers(ladder, inv) {
  return EXERCISES
    .filter((e) => e.ladder === ladder && available(e, inv))
    .sort((a, b) => a.rank - b.rank);
}

/* What progression is allowed to learn from. Every logged workout counts —
   plan or single session — with two exceptions:
   · a move ticked but never rated tells us nothing about difficulty;
   · "Hard" inside a circuit is confounded by the 15-second breathers, so it
     never triggers a back-off. "Easy" there is trustworthy (easy even when
     tired), so it does move the target up. */
const progressLog = (log) => log.filter((e) => e.feel && !(e.format === "circuit" && e.feel === "hard"));

/* ── what to ask for this time, given what happened last time ─────────────── */
export function progressionFor(ex, profile, allLog, inv = inventoryOf(profile)) {
  const log = progressLog(allLog);
  const base = repsFor(ex, profile, inv);
  const suggested = suggestLoad(ex, profile, inv);
  const prev = lastFor(ex.id, log) || (ex.ladder ? lastInLadder(ex.ladder, log) : null);

  if (!prev) {
    return {
      ...base,
      load: suggested,
      isFirst: true,
      note: suggested
        ? `Starting point ~${suggested}kg ${ex.loadUnit === "perHand" ? "per hand" : "total"} — adjust so the last rep is hard but clean.`
        : "First time on this one. Find a tempo you can repeat and stop 2 reps short of failure.",
    };
  }

  const hardStreak = consecutiveHard(ex.id, log);
  const prevLoad = prev.load ?? suggested;
  const prevTopReps = prev.reps ? prev.reps[1] : null;
  const step = ex.loadUnit === "perHand" ? 2.5 : 5;

  // Two hard sessions in a row is a stall, not a challenge. Back off.
  if (hardStreak >= 2) {
    return {
      ...base,
      load: prevLoad != null ? Math.max(step, round(prevLoad * 0.9, step)) : null,
      reps: base.reps,
      deload: true,
      note: "Two hard sessions in a row — dropping about 10% this week to let you catch up. This is planned, not a setback.",
      prev,
    };
  }

  if (ex.timed) {
    const bump = prev.feel === "easy" ? 10 : prev.feel === "right" ? 5 : 0;
    return {
      ...base,
      holdSecs: (prev.holdSecs || base.holdSecs) + bump,
      load: prevLoad,
      note: bump
        ? `Last time ${prev.holdSecs || base.holdSecs}s and it felt ${prev.feel} — add ${bump}s today.`
        : `Hold ${prev.holdSecs || base.holdSecs}s again and own it before adding time.`,
      prev,
    };
  }

  if (canLoad(ex, inv) && prevLoad != null) {
    // Double progression: reps to the top of the range, then load.
    if (prev.feel === "easy") {
      return { ...base, load: round(prevLoad + step, step), note: `Last time ${prevLoad}kg felt easy — up to ${round(prevLoad + step, step)}kg today.`, prev };
    }
    if (prev.feel === "right") {
      const atTop = prevTopReps && prev.reps && prev.reps[1] >= base.reps[1] + 2;
      return atTop
        ? { ...base, load: round(prevLoad + step, step), note: `You've topped out the rep range — add load and drop back to ${base.reps[0]} reps.`, prev }
        : { ...base, reps: [base.reps[0] + 1, base.reps[1] + 1], load: prevLoad, note: `Same ${prevLoad}kg, one more rep per set than last time.`, prev };
    }
    return { ...base, load: prevLoad, note: `Repeating ${prevLoad}kg until it moves cleanly. Consistency beats ego.`, prev };
  }

  // Unloadable: harder variation first, more reps second.
  // Only claim a step up when the ladder actually moved us to a new rung —
  // at the top reachable rung, "easy" means more reps on the same movement.
  if (prev.feel === "easy" && ex.ladder && prev.exerciseId !== ex.id) {
    return { ...base, load: null, note: "That variation is getting easy — today you step up to a harder one.", prev, advanced: true };
  }
  const bump = prev.feel === "easy" ? 2 : prev.feel === "right" ? 1 : 0;
  return {
    ...base,
    load: null,
    reps: bump ? [base.reps[0] + bump, base.reps[1] + bump] : base.reps,
    note: bump ? `Add ${bump} rep${bump > 1 ? "s" : ""} per set on last session.` : "Match last session's reps with cleaner form.",
    prev,
  };
}

/* ── candidate selection ──────────────────────────────────────────────────── */
function candidatesFor(muscle, inv, limits, profile, log, prefer) {
  let pool = EXERCISES.filter(
    (e) => e.primary === muscle && available(e, inv) && (limits.allowImpact || !e.impact)
  );
  // Hidden movements never come back — unless hiding them would leave the
  // muscle with nothing at all, in which case we'd rather offer something.
  const excluded = new Set(profile.excluded || []);
  if (excluded.size) {
    const kept = pool.filter((e) => !excluded.has(e.id));
    if (kept.length) pool = kept;
  }
  // Skill gate — relaxed only if it would otherwise leave the muscle with nothing.
  let gated = pool.filter((e) => e.skill <= limits.maxSkill);
  if (!gated.length) gated = pool.filter((e) => e.skill <= limits.maxSkill + 1);
  if (!gated.length) gated = pool;

  // Collapse each ladder to the single rung this person should be on.
  const byLadder = new Map();
  const out = [];
  for (const ex of gated) {
    if (!ex.ladder) { out.push(ex); continue; }
    if (!byLadder.has(ex.ladder)) byLadder.set(ex.ladder, []);
    byLadder.get(ex.ladder).push(ex);
  }
  for (const [ladder, members] of byLadder) {
    const all = ladderMembers(ladder, inv).filter((e) => members.some((m) => m.id === e.id));
    if (!all.length) continue;
    const prev = lastInLadder(ladder, progressLog(log));
    let idx;
    if (prev) {
      idx = all.findIndex((e) => e.id === prev.exerciseId);
      if (idx < 0) idx = 0;
      if (prev.feel === "easy" && idx < all.length - 1) idx++;
      else if (prev.feel === "hard" && idx > 0) idx--;
    } else {
      idx = clamp(limits.level.ladderStart - 1, 0, all.length - 1);
    }
    out.push(all[idx]);
  }
  return rankCandidates(out.map((e) => resolveExercise(e, inv)), muscle, profile, prefer);
}

/** Every other movement this kit allows for the same muscle, best first.
    `taken` keeps out what's already in the session. */
export function alternativesFor(ex, profile, log, taken = []) {
  const inv = inventoryOf(profile);
  const limits = deriveLimits(profile);
  const skip = new Set([ex.id, ...taken, ...(profile.excluded || [])]);
  // For a swap we deliberately do NOT collapse ladders: someone who can't do
  // a Romanian deadlift wants to see both the easier and the harder rung.
  let pool = EXERCISES.filter(
    (e) => e.primary === ex.primary && !skip.has(e.id) && available(e, inv) && (limits.allowImpact || !e.impact)
  );
  const gated = pool.filter((e) => e.skill <= limits.maxSkill);
  if (gated.length) pool = gated;
  return rankCandidates(pool.map((e) => resolveExercise(e, inv)), ex.primary, profile).map((e) => ({
    ...e,
    // how it relates to what's being replaced, so the chooser can say so
    relation: e.ladder && e.ladder === ex.ladder
      ? (e.rank < ex.rank ? "easier" : "harder")
      : e.compound === ex.compound ? "similar" : e.compound ? "bigger" : "lighter",
  }));
}

/** Rebuild a single slot around a different movement, keeping the dose. */
export function replaceExercise(workout, index, alt, profile, log) {
  const inv = inventoryOf(profile);
  const limits = deriveLimits(profile);
  const old = workout.exercises[index];
  const presc = progressionFor(alt, profile, log, inv);
  const next = {
    ...alt,
    slot: old.slot, role: old.role, sets: old.sets, setsArr: Array(old.sets).fill(0),
    reps: presc.reps, holdSecs: presc.holdSecs, load: presc.load,
    loadable: canLoad(alt, inv), loadUnit: alt.loadUnit || null,
    needsLabel: alt.needsLabel || needsLabel(alt, inv),
    coachNote: presc.note, isFirst: !!presc.isFirst, deload: !!presc.deload, prev: presc.prev || null,
    // a circuit keeps its short between-move rest when a slot is swapped
    rest: workout.format === "circuit" ? old.rest : restFor(alt, profile, limits.restMult),
    swapped: true,
  };
  const exercises = workout.exercises.map((e, i) => (i === index ? next : e));
  return { ...workout, exercises };
}

/* Prefer the movement a coach would actually anchor a session on: compound
   first for the big muscles, and loadable where the goal needs load. */
function rankCandidates(list, muscle, profile, prefer) {
  const major = MUSCLES[muscle]?.tier === "major";
  const wantsLoad = profile.goal === "strength" || profile.goal === "muscle";
  return [...list].sort((a, b) => {
    if (prefer && prefer.size && prefer.has(a.id) !== prefer.has(b.id)) return prefer.has(a.id) ? -1 : 1;
    if (major && (b.compound ? 1 : 0) !== (a.compound ? 1 : 0)) return (b.compound ? 1 : 0) - (a.compound ? 1 : 0);
    if (wantsLoad && (b.loadable ? 1 : 0) !== (a.loadable ? 1 : 0)) return (b.loadable ? 1 : 0) - (a.loadable ? 1 : 0);
    if ((b.loadFactor ? 1 : 0) !== (a.loadFactor ? 1 : 0)) return (b.loadFactor ? 1 : 0) - (a.loadFactor ? 1 : 0);
    // Novices get the most accessible version of a movement; advanced trainees
    // get the one that actually loads heavy.
    return profile.level === "advanced" ? b.skill - a.skill : a.skill - b.skill;
  });
}

/* Only shuffle between movements of genuinely equal quality — never let a
   push-up win the anchor slot from a dumbbell press. */
function anchorPool(cands, muscle) {
  const major = MUSCLES[muscle]?.tier === "major";
  const grade = (e) => (major && e.compound ? 2 : 0) + (e.loadable ? 1 : 0);
  const best = Math.max(...cands.map(grade));
  return cands.filter((e) => grade(e) === best);
}

/* ── skill practice ───────────────────────────────────────────────────────── */
/** Every stage this kit allows. A skill is only offered if stage 1 is doable. */
export function reachableStages(skill, inv) {
  return skill.stages.filter((st) => available(stageNeeds(skill, st), inv));
}

export function skillAvailable(skill, inv) {
  return reachableStages(skill, inv).length > 0;
}

/** Which stage this person is on, and whether last session earned a promotion. */
export function skillProgress(skillId, log, inv) {
  const skill = SKILLS[skillId];
  if (!skill) return null;
  const stages = reachableStages(skill, inv);
  if (!stages.length) return { skill, stages: [], locked: true, index: 0, stage: null };

  // Only rated practices count; a ticked-but-unrated set says nothing about difficulty.
  const rated = log.filter((e) => e.ladder === `skill:${skillId}` && e.feel);
  const prev = rated[rated.length - 1] || lastInLadder(`skill:${skillId}`, log);
  let index = 0;
  let promoted = false, streak = 0, demoted = false;
  if (prev) {
    const at = stages.findIndex((st) => st.name === prev.stageName);
    index = at < 0 ? 0 : at;
    // A coach moves you up when the stage is solid twice running, not after one
    // good day — and drops you back after two rough ones, not one.
    for (let i = rated.length - 1; i >= 0; i--) {
      if (rated[i].stageName !== prev.stageName || rated[i].feel !== prev.feel) break;
      streak++;
    }
    if (prev.feel === "easy" && streak >= 2 && index < stages.length - 1) { index++; promoted = true; }
    else if (prev.feel === "hard" && streak >= 2 && index > 0) { index--; demoted = true; }
  }
  return { skill, stages, index, stage: stages[index], promoted, demoted, streak, locked: false, prev };
}

/** The practice block: short, submaximal, and done before anything tiring. */
function buildSkillBlock(profile, log, inv, capSecs) {
  if (!profile.skill) return null;
  const prog = skillProgress(profile.skill, log, inv);
  if (!prog || prog.locked || !prog.stage) return null;

  const c = prog.stage.criterion;
  const work = c.holdSecs ? c.holdSecs * (c.perSide ? 2 : 1) : c.reps * 3.5 * (c.perSide ? 2 : 1);
  const perSet = work + SKILL_REST + TRANSITION;

  // Practice scales to the time available. On a 20-minute day you get fewer,
  // sharper sets rather than a block that swallows the whole session.
  let sets = SKILL_SETS[profile.level] || 4;
  if (capSecs) sets = Math.max(2, Math.min(sets, Math.floor(capSecs / perSet)));
  const cost = sets * perSet;

  return {
    skillId: prog.skill.id,
    name: prog.skill.name,
    stageName: prog.stage.name,
    stageIndex: prog.index,
    stageCount: prog.stages.length,
    promoted: prog.promoted,
    target: criterionLabel(prog.stage),
    holdSecs: c.holdSecs || null,
    reps: c.reps || null,
    perSide: !!c.perSide,
    sets,
    setsArr: Array(sets).fill(0),
    rest: SKILL_REST,
    tip: prog.stage.tip,
    coaching: prog.skill.coaching,
    frequency: prog.skill.frequency,
    muscles: prog.skill.muscles,
    accessories: prog.skill.accessories || [],
    cost,
    note: prog.promoted
      ? `Two clean sessions in a row — moving up to ${prog.stage.name}.`
      : prog.demoted
      ? `Two rough sessions running, so we're stepping back to ${prog.stage.name} to rebuild it clean.`
      : prog.prev && prog.prev.feel === "easy"
      ? `That felt easy — one more clean session at ${prog.stage.name} and you move up.`
      : prog.prev && prog.prev.feel === "hard"
      ? `That was rough last time. Stay at ${prog.stage.name}; another hard one and we'll step back.`
      : prog.prev
      ? `Stage ${prog.index + 1} of ${prog.stages.length}. Clear the target comfortably twice in a row to move up.`
      : `Starting at stage ${prog.index + 1} of ${prog.stages.length}. Rate it Easy two sessions running and you'll move up.`,
  };
}

/** Roughly how many areas a session of this length can actually train. Used to
    warn BEFORE the routine is built, not after. */
/** Areas one session can train at a real dose (~3 sets each) — what the weekly split plans with. */
export function dayCapacity(profile) {
  return Math.max(1, Math.round(sessionSets(profile) / 3));
}

function sessionSets(profile) {
  const limits = deriveLimits(profile);
  const minutes = +profile.sessionMinutes || 30;
  const totalSecs = minutes * 60;
  const warmApprox = minutes <= 20 ? 140 : minutes <= 45 ? 180 : 220;
  const stretchApprox = Math.min(6 * 35, totalSecs * 0.12);
  const skillApprox = profile.skill ? totalSecs * 0.28 : 0;
  const budget = Math.max(60, totalSecs - warmApprox - stretchApprox - skillApprox);
  const typicalRest = REST[profile.goal]?.compound ?? 90;
  // a set of 15–20 takes far longer than a set of 5 — plan with the goal's own rep range
  const reps = (GOALS[profile.goal] || GOALS.muscle).reps;
  const work = Math.max(25, ((reps[0] + reps[1]) / 2) * 3.5);
  return Math.max(1, Math.floor(budget / (work + typicalRest * limits.restMult + TRANSITION)));
}

export function sessionCapacity(profile) {
  const limits = deriveLimits(profile);
  const minutes = +profile.sessionMinutes || 30;
  const totalSecs = minutes * 60;
  const warmApprox = minutes <= 20 ? 140 : minutes <= 45 ? 180 : 220;
  const stretchApprox = Math.min(6 * 35, totalSecs * 0.12);
  const skillApprox = profile.skill ? totalSecs * 0.28 : 0;
  const budget = Math.max(60, totalSecs - warmApprox - stretchApprox - skillApprox);
  const typicalRest = REST[profile.goal]?.compound ?? 90;
  const setCost = 35 + typicalRest * limits.restMult + TRANSITION;
  return Math.max(1, Math.floor(Math.max(1, Math.floor(budget / setCost)) / 2));
}

/* ── the solver ───────────────────────────────────────────────────────────── */
export function buildWorkout(profile, selected, log = [], { variant = 0, format = "sets", fresh = false } = {}) {
  // fresh: a standalone session that should feel new each time. The plan wants
  // the opposite (stable anchors so load can climb), so it never sets this.
  // Circuit: one set of each move back-to-back, a short breather between moves
  // and a real rest after each full round. Straight sets: the plan's default.
  const circuit = format === "circuit";
  let muscles = [...selected].filter((m) => MUSCLES[m]);
  // A skill on its own is a legitimate session — chasing an L-sit for 20 minutes
  // is training, even with nothing ticked on the body map. In that case the
  // supporting work is drawn from what the skill actually demands.
  if (!muscles.length && !profile.skill) return null;
  const skillLed = !muscles.length && !!profile.skill;
  if (skillLed && SKILLS[profile.skill]) muscles = [...SKILLS[profile.skill].muscles];

  const limits = deriveLimits(profile);
  const inv = inventoryOf(profile);
  const minutes = +profile.sessionMinutes || 30;
  const block = currentBlock(profile.blockStarted);

  // Warm-up and cool-down are carved out of the budget before any lifting.
  const warmup = buildWarmup(muscles, minutes, limits, inv);
  const warmSecs = warmup.reduce((t, w) => t + w.secs, 0);
  const totalSecs = minutes * 60;
  // Cool-down is capped as a share of the session, not left to grow with the
  // number of areas picked.
  const stretchReserve = Math.min(Math.min(muscles.length, 6) * 35, totalSecs * 0.12);
  // Skill practice is the priority, but it can't crowd out the training itself:
  // it gets at most a third of a session that also has muscle work to do.
  const skillCap = skillLed ? totalSecs * 0.7 : totalSecs * 0.33;
  const skill = buildSkillBlock(profile, log, inv, skillCap);
  const budget = totalSecs - warmSecs - stretchReserve - (skill ? skill.cost : 0);

  // Majors are the session; minors are accessory work and get deferred first.
  const ordered = [...muscles].sort((a, b) => {
    const t = (MUSCLES[a].tier === "major" ? 0 : 1) - (MUSCLES[b].tier === "major" ? 0 : 1);
    return t || muscles.indexOf(a) - muscles.indexOf(b);
  });

  // Circuit timing scales with age like everything else does.
  const circuitRest = circuit ? Math.round((15 * limits.restMult) / 5) * 5 : 0;
  const roundRest = circuit ? Math.round(((profile.goal === "strength" ? 90 : 60) * limits.restMult) / 5) * 5 : 0;
  const restOf = (ex) => (circuit ? circuitRest : restFor(ex, profile, limits.restMult));

  // How much actually fits? A typical working set costs its work time, its rest
  // and a transition — divide the budget by that and you know your real ceiling.
  const typicalRest = REST[profile.goal]?.compound ?? 90;
  // Work per set follows the goal's rep range: a set of 15–20 is twice a set of 8–12.
  const goalReps = (GOALS[profile.goal] || GOALS.muscle).reps;
  const typicalWork = Math.max(25, ((goalReps[0] + goalReps[1]) / 2) * 3.5);
  const typicalSetCost = circuit
    ? typicalWork + circuitRest + roundRest / 3 + TRANSITION
    : typicalWork + typicalRest * limits.restMult + TRANSITION;
  const affordableSets = Math.max(1, Math.floor(budget / typicalSetCost));
  const affordableExercises = Math.max(1, Math.floor(affordableSets / 2));
  const oversubscribed = muscles.length > affordableExercises;
  // Spread thin rather than deep when many areas are asked for.
  const setsEach = oversubscribed
    ? clamp(Math.floor(affordableSets / Math.min(muscles.length, affordableExercises)), 2, limits.minDirect)
    : limits.minDirect;

  const circuitBreadth = circuit && muscles.length * limits.minDirect * typicalSetCost > budget;
  // Breadth before depth: when a full dose for every area won't fit, every
  // area starts on an even share (≥2 sets) and Phase B grows them back up —
  // instead of the first areas taking four sets and the last getting nothing.
  const startSets = circuitBreadth ? 2
    : clamp(Math.floor(affordableSets / Math.max(1, muscles.length)), 2, limits.minDirect);

  // What was skipped last time comes first this time — that's what makes
  // "first up next session" a promise rather than a line of copy.
  // The weekly routine only looks at its own sessions; a single session is
  // allowed to see everything (it should know your legs were hit yesterday).
  const routineLog = fresh ? log : planLog(log);
  const staleBonus = (m) => {
    const d = daysSince(m, routineLog);
    return Math.min(d == null ? 14 : d, 14) / 14 * 0.35;
  };

  const plan = [];
  const deferred = [];
  let used = 0;

  // Accessories the skill itself calls for get first refusal on a slot — the
  // supporting work should actually support the thing you're chasing.
  const skillAccessories = new Set(skill ? skill.accessories : []);

  // The skill already trains its target muscles — count that before allocating.
  const skillEff = {};
  if (skill) skill.muscles.forEach((m, i) => { skillEff[m] = (skillEff[m] || 0) + (i === 0 ? skill.sets : skill.sets * 0.5); });

  const effective = () => {
    const eff = { ...skillEff };
    for (const p of plan) {
      eff[p.ex.primary] = (eff[p.ex.primary] || 0) + p.sets;
      for (const s of p.ex.secondary) eff[s] = (eff[s] || 0) + p.sets * 0.5;
    }
    return eff;
  };

  const workOf = (presc) => presc.holdSecs || ((presc.reps[0] + presc.reps[1]) / 2) * 3.5;
  // In a circuit each set also carries a share of the between-round rest.
  const costOf = (ex, sets, presc) =>
    sets * (workOf(presc) + restOf(ex) + TRANSITION + (circuit ? roundRest / 3 : 0));

  // A single exercise tops out at 4–5 sets; more volume means another movement.
  const capFor = (ex) => (ex.compound && profile.goal === "strength" ? 5 : ex.compound ? 4 : 4);

  const makeEntry = (ex, sets) => {
    const presc = progressionFor(ex, profile, log, inv);
    return { ex, sets, presc, rest: restOf(ex) };
  };

  // Grow entries round-robin up to `ceiling`, respecting per-muscle volume caps.
  const grow = (ceiling) => {
    let moved = true;
    while (moved) {
      moved = false;
      for (const entry of plan) {
        const eff = effective();
        const lim = Math.min(ceiling, capFor(entry.ex));
        if (entry.sets >= lim) continue;
        // The ceiling applies to every muscle the set touches, not just the
        // primary — otherwise growing one lift quietly overshoots another.
        if ((eff[entry.ex.primary] || 0) + 1 > limits.maxEffective) continue;
        if (entry.ex.secondary.some((m) => (eff[m] || 0) + 0.5 > limits.maxEffective)) continue;
        const step = costOf(entry.ex, 1, entry.presc);
        if (used + step > budget) continue;
        entry.sets += 1; used += step; moved = true;
      }
    }
  };

  // ── Phase A (oversubscribed): pick the movements that cover the most ──────
  // With 14 areas and 20 minutes, the right answer isn't one exercise per
  // muscle in priority order — it's the few compounds that touch the most of
  // what was asked for. Greedy set-cover, deterministic, no RNG.
  if (oversubscribed) {
    const uncovered = new Set(ordered);
    const taken = new Set();
    while (uncovered.size && plan.length < affordableExercises) {
      let best = null;
      for (const m of ordered) {
        if (!uncovered.has(m)) continue;
        for (const ex of candidatesFor(m, inv, limits, profile, log, skillAccessories).slice(0, 4)) {
          if (taken.has(ex.id)) continue;
          // Weight coverage by how much a muscle actually contributes to a
          // session — covering quads is worth more than covering forearms.
          const weight = (x) => (MUSCLES[x]?.tier === "major" ? 1 : 0.5);
          const reach =
            weight(ex.primary) * (1 + staleBonus(ex.primary)) +
            ex.secondary.filter((x) => uncovered.has(x)).reduce((t, x) => t + 0.6 * weight(x), 0);
          for (let sets = setsEach; sets >= 2; sets--) {
            const entry = makeEntry(ex, sets);
            const cost = costOf(ex, sets, entry.presc);
            if (used + cost > budget) continue;
            // A rebuild perturbs near-equal candidates (push-up vs incline push-up),
            // never enough to trade a squat for a calf raise.
            const spread = fresh ? 0.45 : 0.15;
            const jitter = variant ? ((hash(`${ex.id}|v${variant}`) % 1000) / 1000) * spread : 0;
            const score = (reach / (cost / 60)) * (1 + jitter);
            if (!best || score > best.score + 1e-9) best = { ex, entry, cost, score };
            break;
          }
        }
      }
      if (!best) break;
      best.entry.role = "anchor";
      plan.push(best.entry);
      used += best.cost;
      taken.add(best.ex.id);
      uncovered.delete(best.ex.primary);
      best.ex.secondary.forEach((x) => uncovered.delete(x));
    }
    for (const m of ordered) {
      if (!plan.some((p) => p.ex.primary === m || p.ex.secondary.includes(m))) {
        deferred.push({ muscle: m, why: "time" });
      }
    }
  }

  // ── Phase A: one movement per selected muscle, at the minimum useful dose ──
  for (const m of oversubscribed ? [] : ordered) {
    const cands = candidatesFor(m, inv, limits, profile, log, skillAccessories);
    if (!cands.length) { deferred.push({ muscle: m, why: "gear" }); continue; }

    // Minor muscles already well covered by the compounds we've chosen don't
    // need their own slot — a trainer says "your presses covered triceps".
    const eff = effective();
    if (MUSCLES[m].tier === "minor" && (eff[m] || 0) >= 3) continue;

    // Variant 0 is the block's stable anchor — the lift you progress on.
    // Rebuilding steps `variant` up, which walks through the equal-quality pool
    // (and, past it, the next-best options) so you get a genuinely different
    // movement rather than the same one wearing a different hash.
    const best = anchorPool(cands, m);
    const pool = variant > 0
      ? [...best, ...cands.filter((e) => !best.includes(e))].slice(0, Math.max(3, Math.min(cands.length, 5)))
      : best.slice(0, 3);
    const anchor = fresh
      ? pool[hash(`${m}|fresh|${variant}`) % pool.length]
      : pool[(hash(`${m}|${block.index}|${profile.equipment}|${profile.goal}`) + variant) % pool.length];

    // Breadth beats depth: if the full dose won't fit, take a smaller one
    // rather than dropping the muscle entirely. The dose also has to respect
    // what the muscle already got from earlier compounds — five hinges and a
    // lunge have already worked the core; the core slot gets what's left.
    const withinCap = (e, sets) =>
      (eff[m] || 0) + sets <= limits.maxEffective &&
      e.secondary.every((s) => (eff[s] || 0) + sets * 0.5 <= limits.maxEffective);
    let placed = false, capped = false;
    // A short circuit wants breadth: if full doses for every area won't fit,
    // place each at two rounds' worth first — the round count is set for the
    // whole circuit once the moves are chosen.
    for (let sets = startSets; sets >= 2; sets--) {
      if (!withinCap(anchor, sets)) { capped = true; continue; }
      const entry = makeEntry(anchor, sets);
      const cost = costOf(anchor, sets, entry.presc);
      if (used + cost > budget) continue;
      entry.role = "anchor"; plan.push(entry); used += cost; placed = true; break;
    }
    // Capped out with plenty already done is "covered by your compounds", not a miss.
    if (!placed && !(capped && (eff[m] || 0) >= 3)) deferred.push({ muscle: m, why: "time" });
  }

  // Nothing fit at all — force the single highest-priority movement in rather
  // than handing back an empty routine.
  if (!plan.length && ordered.length && !skill) {
    const m = ordered[0];
    const cands = candidatesFor(m, inv, limits, profile, log, skillAccessories);
    if (cands.length) {
      const entry = makeEntry(cands[0], Math.max(2, limits.minDirect - 1));
      entry.role = "anchor";
      plan.push(entry);
      used += costOf(cands[0], entry.sets, entry.presc);
      const i = deferred.findIndex((d) => d.muscle === m);
      if (i >= 0) deferred.splice(i, 1);
    }
  }

  // ── Phase B1: bring every anchor up to a real working dose first ──────────
  if (!oversubscribed) grow(Math.max(3, limits.minDirect));

  // ── Phase C: spend leftover time on a second movement for major muscles ───
  const used2 = new Set(plan.map((p) => p.ex.id));
  for (const m of oversubscribed ? [] : ordered) {
    if (MUSCLES[m].tier !== "major") continue;
    const eff = effective();
    if ((eff[m] || 0) + limits.minDirect > limits.maxEffective) continue;
    // A second movement must not push any muscle it touches past the ceiling —
    // core piling up from every hinge in a glutes session is still junk volume.
    const fits = (e, sets) =>
      (eff[m] || 0) + sets <= limits.maxEffective &&
      e.secondary.every((s) => (eff[s] || 0) + sets * 0.5 <= limits.maxEffective);
    const cands = candidatesFor(m, inv, limits, profile, log, skillAccessories)
      .filter((e) => !used2.has(e.id) && fits(e, 2));
    if (!cands.length) continue;
    // Accessories rotate — variety is fine here, it's the anchors that must stay put.
    const pick = fresh
      ? cands[hash(`${m}|acc|fresh|${variant}`) % cands.length]
      : cands[(hash(`${m}|acc|${block.index}|${routineLog.length}`) + variant) % cands.length];
    for (let sets = limits.minDirect; sets >= 2; sets--) {
      if (!fits(pick, sets)) continue;
      const entry = makeEntry(pick, sets);
      const cost = costOf(pick, sets, entry.presc);
      if (used + cost > budget) continue;
      entry.role = "accessory";
      plan.push(entry); used2.add(pick.id); used += cost; break;
    }
  }

  // ── Phase C2: areas that only got splash from compounds get their own move ─
  // when there's clock left — rear delts "lit up by rows" isn't trained. The
  // anchors get to a real dose (3 sets) first; minors only take what's left.
  grow(3);
  for (const m of ordered) {
    const eff = effective();
    if ((eff[m] || 0) >= 3) continue;
    if (plan.some((p) => p.ex.primary === m)) continue;
    if (deferred.some((d) => d.muscle === m && d.why === "gear")) continue;
    const taken = new Set(plan.map((p) => p.ex.id));
    const fits = (e, sets) =>
      (eff[m] || 0) + sets <= limits.maxEffective &&
      e.secondary.every((x) => (eff[x] || 0) + sets * 0.5 <= limits.maxEffective);
    const cand = candidatesFor(m, inv, limits, profile, log, skillAccessories).find((e) => !taken.has(e.id) && fits(e, 2));
    if (!cand) continue;
    for (let sets = 3; sets >= 2; sets--) {
      if (!fits(cand, sets)) continue;
      const entry = makeEntry(cand, sets);
      const cost = costOf(cand, sets, entry.presc);
      if (used + cost > budget) continue;
      entry.role = "accessory";
      plan.push(entry); used += cost;
      const di = deferred.findIndex((d) => d.muscle === m);
      if (di >= 0) deferred.splice(di, 1);
      break;
    }
  }

  // ── Phase B2: any time still on the clock goes into more quality sets ─────
  grow(limits.targetDirect);

  // ── Circuit: every move gets the same number of rounds ────────────────────
  // Rounds are chosen to fit the clock AND the per-muscle volume ceiling; if
  // even two rounds won't fit, the lowest-priority moves come off the end.
  let rounds = null;
  const circuitSecs = (r) =>
    plan.reduce((t, p) => t + r * (workOf(p.presc) + circuitRest + TRANSITION), 0) + r * roundRest;
  if (circuit && plan.length) {
    const effAt = (r) => {
      const e = { ...skillEff };
      for (const p of plan) {
        e[p.ex.primary] = (e[p.ex.primary] || 0) + r;
        for (const s of p.ex.secondary) e[s] = (e[s] || 0) + r * 0.5;
      }
      return e;
    };
    const overCap = (r) => Object.values(effAt(r)).some((v) => v > limits.maxEffective);
    const avg = plan.reduce((t, p) => t + p.sets, 0) / plan.length;
    rounds = clamp(Math.round(avg), 2, 5);
    while (rounds > 2 && (circuitSecs(rounds) > budget || overCap(rounds))) rounds--;
    // Drop moves from the end only if they'd be leaving a muscle over its cap,
    // or the circuit simply doesn't fit — never below two moves.
    const lowPriority = () => {
      let at = plan.length - 1;
      for (let i = plan.length - 1; i >= 0; i--) if (plan[i].role === "accessory") { at = i; break; }
      return at;
    };
    while (plan.length > 2 && (circuitSecs(rounds) > budget || overCap(rounds))) plan.splice(lowPriority(), 1);
    // Time still on the clock and volume still under the ceiling → one more round,
    // rather than handing back a 20-minute session that's over in 15.
    while (rounds < 5 && circuitSecs(rounds + 1) <= budget && !overCap(rounds + 1)) rounds++;
    plan.forEach((p) => { p.sets = rounds; });
  }

  // ── Order the session: big patterns first; novices climb the skill ladder ──
  const skillDir = profile.level === "beginner" ? 1 : -1;
  plan.sort((a, b) =>
    (b.ex.compound ? 1 : 0) - (a.ex.compound ? 1 : 0) ||
    (PATTERN_ORDER[a.ex.pattern] || 9) - (PATTERN_ORDER[b.ex.pattern] || 9) ||
    skillDir * (a.ex.skill - b.ex.skill)
  );

  // ── Coverage report: only claim what the routine actually contains ────────
  const eff = effective();
  const directSet = new Set(plan.map((p) => p.ex.primary));
  const coverage = muscles.map((m) => ({
    muscle: m,
    direct: plan.filter((p) => p.ex.primary === m).reduce((t, p) => t + p.sets, 0),
    effective: +(eff[m] || 0).toFixed(1),
    // "light" is the honest middle: it got something from your compounds, but
    // not enough to call it trained.
    status: directSet.has(m) ? "direct"
      : (eff[m] || 0) >= 3 ? "indirect"
      : (eff[m] || 0) > 0 ? "light"
      : "deferred",
  }));
  const trained = coverage.filter((c) => c.status === "direct" || c.status === "indirect").map((c) => c.muscle);
  const light = coverage.filter((c) => c.status === "light").map((c) => c.muscle);
  const notFitted = coverage.filter((c) => c.status === "deferred").map((c) => c.muscle);

  const exercises = plan.map((p, i) => ({
    ...p.ex,
    slot: i + 1,
    role: p.role,
    sets: p.sets,
    setsArr: Array(p.sets).fill(0),
    reps: p.presc.reps,
    holdSecs: p.presc.holdSecs,
    load: p.presc.load,
    loadable: canLoad(p.ex, inv),
    loadUnit: p.ex.loadUnit || null,
    needsLabel: p.ex.needsLabel || needsLabel(p.ex, inv),
    coachNote: p.presc.note,
    isFirst: !!p.presc.isFirst,
    deload: !!p.presc.deload,
    prev: p.presc.prev || null,
    rest: p.rest,
  }));

  // Stretch only what was actually trained.
  const stretches = trained.map((m) => ({ muscle: m, ...STRETCHES[m] })).filter((s) => s.name);

  const workSecs = circuit && rounds
    ? circuitSecs(rounds)
    : plan.reduce((t, p) => t + costOf(p.ex, p.sets, p.presc), 0);
  const estMinutes = Math.max(1, Math.round(
    (warmSecs + workSecs + (skill ? skill.cost : 0) + stretches.length * 35) / 60
  ));

  return {
    id: Date.now(),
    variant,
    format: circuit ? "circuit" : "sets",
    rounds,
    circuitRest,
    roundRest,
    block,
    skill,
    muscles,
    coverage,
    trained,
    deferred: notFitted,
    light,
    oversubscribed,
    capacityAreas: affordableExercises,
    deferredDetail: deferred,
    noGear: deferred.filter((d) => d.why === "gear").map((d) => d.muscle),
    outOfTime: deferred.filter((d) => d.why === "time").map((d) => d.muscle),
    warmup,
    exercises,
    stretches,
    estMinutes,
    budgetMinutes: minutes,
    totalSets: exercises.reduce((t, e) => t + e.sets, 0),
    goal: profile.goal,
    ageNote: limits.ageNote,
    balance: balanceCheck(exercises),
  };
}

/* ── warm-up: matched to the muscles trained, the clock, and the person ───── */
function buildWarmup(muscles, minutes, limits, inv) {
  const slots = minutes <= 12 ? 2 : minutes <= 20 ? 3 : minutes <= 45 ? 4 : 5;
  // Resolve each warm-up's wording to the implement actually owned.
  const usable = WARMUPS.filter((w) => available(w, inv)).map((w) => {
    if (!w.noteBy) return w;
    const impl = (w.needsAny || []).find((i) => inv.has(i));
    return impl && w.noteBy[impl] ? { ...w, note: w.noteBy[impl] } : w;
  });
  const pulse = usable.find((w) => (limits.allowImpact ? w.impact : w.lowImpact)) || usable[0];
  const out = [pulse];
  const remaining = new Set(muscles);

  const rest = usable.filter((w) => w !== pulse && !w.impact && !w.lowImpact);
  const ranked = limits.jointPrep ? [...rest].sort((a, b) => (b.joint ? 1 : 0) - (a.joint ? 1 : 0)) : rest;

  for (const w of ranked) {
    if (out.length >= slots) break;
    if (w.covers.some((c) => remaining.has(c))) { out.push(w); w.covers.forEach((c) => remaining.delete(c)); }
  }
  for (const w of ranked) {
    if (out.length >= slots) break;
    if (!out.includes(w)) out.push(w);
  }
  return out;
}

/* ── structural balance: flag a session that only pushes or only pulls ────── */
function balanceCheck(exercises) {
  const push = exercises.filter((e) => e.pattern === "hpush" || e.pattern === "vpush").reduce((t, e) => t + e.sets, 0);
  const pull = exercises.filter((e) => e.pattern === "hpull" || e.pattern === "vpull").reduce((t, e) => t + e.sets, 0);
  if (push + pull === 0) return null;
  if (push > 0 && pull === 0) return { type: "push-only", push, pull, note: "All push, no pull today. Pair this with a pull session within a couple of days to keep your shoulders happy." };
  if (pull > 0 && push === 0) return { type: "pull-only", push, pull, note: "All pull, no push today. That's fine inside a split — just make sure a push day follows." };
  return null;
}

export function bmi(profile) {
  const h = profile.height / 100;
  if (!h || !profile.weight) return null;
  return +(profile.weight / (h * h)).toFixed(1);
}

/* ── weekly readout, derived from the log ─────────────────────────────────── */
export function weeklyReadout(volume, daysPerWeek, sessionsDone) {
  const rows = Object.entries(volume)
    .map(([muscle, sets]) => ({
      muscle,
      sets: +sets.toFixed(1),
      status: sets >= WEEKLY.high ? "high" : sets >= WEEKLY.good ? "good" : sets >= WEEKLY.low ? "low" : "minimal",
    }))
    .sort((a, b) => b.sets - a.sets);
  return { rows, sessionsDone, daysPerWeek, onTrack: sessionsDone >= daysPerWeek };
}
