// ─── Calisthenics skills ──────────────────────────────────────────────────────
// A skill is not just another exercise. It's a position you're trying to own,
// so it gets programmed differently: practised FIRST while you're fresh, in
// short submaximal sets, and you move up a stage only when you clear a stated
// criterion — not when a timer says so.

export const SKILLS = {
  lsit: {
    id: "lsit",
    name: "L-Sit",
    blurb: "Legs locked straight out in front, whole body held off the floor on your hands.",
    needs: [],
    muscles: ["abs", "core", "frontDelts", "triceps", "quads"],
    frequency: "3–5 times a week. It's a skill, not a smoke session — stop every set with something left.",
    coaching:
      "Two things build the L-sit: pushing the floor away hard enough to sink your shoulders, and enough compression to lift straight legs. " +
      "Every stage trains both. Working on raised hands — parallettes, two low blocks, even the seats of two sturdy chairs — buys clearance for your legs and makes each stage reachable sooner.",
    accessories: ["hollowhold", "legraise", "deadbug", "chairdip"],
    stages: [
      { name: "Support Hold",          criterion: { holdSecs: 30 },
        tip: "Hands planted by your hips, elbows locked, feet still on the floor. Push down hard so your shoulders drop away from your ears — that depression is the whole foundation." },
      { name: "Tuck L-Sit",            criterion: { holdSecs: 20 },
        tip: "Same lockout, now pull both knees to your chest and let the feet leave the floor. Round the lower back slightly; don't lean back to cheat the lift." },
      { name: "One-Leg L-Sit",         criterion: { holdSecs: 15, perSide: true },
        tip: "One leg extended to horizontal, the other stays tucked. Swap sides each set — the weaker side sets the pace, not the stronger one." },
      { name: "Advanced Tuck L-Sit",   criterion: { holdSecs: 15 },
        tip: "Thighs level with the floor, shins reaching forward at about 45°. Chest tall. If the hips slide backwards, go back to the previous stage." },
      { name: "Full L-Sit",            criterion: { holdSecs: 10 },
        tip: "Both legs straight and level, toes pointed, thighs squeezed together. Ten honest seconds beats twenty with bent knees." },
      { name: "Full L-Sit — 30 seconds", criterion: { holdSecs: 30 },
        tip: "The position is yours. Build to thirty unbroken seconds, then start working the legs above parallel toward a V-sit." },
    ],
  },

  pullup: {
    id: "pullup",
    name: "First Pull-Up",
    blurb: "Dead hang to chin over the bar, no kick, no kip.",
    needs: ["pullupbar"],
    muscles: ["lats", "biceps", "forearms", "core"],
    frequency: "3–4 times a week. Frequent and fresh beats one brutal session.",
    coaching:
      "Almost nobody gets their first pull-up by attempting pull-ups. You get it from hanging, from learning to pull with the shoulder blades before the arms, and from lowering slowly under control. The negatives do most of the work.",
    accessories: ["tablerow", "supermanpull", "deadhang", "scapshrug"],
    stages: [
      { name: "Dead Hang",             criterion: { holdSecs: 30 },
        tip: "Hang with shoulders active rather than fully slack. Breathe. Grip usually quits long before your back does — that's normal and it improves fast." },
      { name: "Scapular Pull-Up",      criterion: { reps: 8 },
        tip: "Arms stay dead straight. Pull only by sliding your shoulder blades down and together, lifting an inch or two. Tiny range, enormous payoff." },
      { name: "Negative Pull-Up",      criterion: { reps: 5 },
        tip: "Jump or climb to the top, chin over the bar, then lower for a slow five count. This single drill builds most of the strength." },
      { name: "Assisted Pull-Up",      criterion: { reps: 8 }, needsAny: ["bands", "chair"],
        tip: "Band under the feet, or toes resting on a chair taking just enough weight. Each week, take a little less help." },
      { name: "First Pull-Up",         criterion: { reps: 1 },
        tip: "Dead hang, chin clears the bar, controlled descent. One clean rep is the milestone — go for it fresh, at the very start of a session." },
      { name: "Five Strict Pull-Ups",  criterion: { reps: 5 },
        tip: "Now build volume. Five clean reps, full range every time, no kipping to squeeze out extras." },
    ],
  },

  pistol: {
    id: "pistol",
    name: "Pistol Squat",
    blurb: "Full squat on one leg, the other held straight out in front.",
    needs: [],
    muscles: ["quads", "glutes", "core", "hamstrings", "calves"],
    frequency: "2–3 times a week. It's demanding on the knees — quality reps only.",
    coaching:
      "A pistol needs three things at once: single-leg strength, ankle mobility to keep the heel down, and the balance to hold it together. " +
      "If your heel lifts, the ankle is the limiter, not the leg — work the depth you can hold with a flat foot.",
    accessories: ["splitsquat", "boxsquat", "wallsit", "slbridge", "calfraise"],
    stages: [
      { name: "Box Squat",             criterion: { reps: 15 }, needs: ["chair"],
        tip: "Sit back to a chair on two legs, tap lightly, stand. Build the pattern and the depth before you take a leg away." },
      { name: "Assisted Single-Leg Squat", criterion: { reps: 8, perSide: true },
        tip: "Hold a door frame or post and lower on one leg. Use your hands only for balance and a little help — not to haul yourself up." },
      { name: "Elevated Pistol",       criterion: { reps: 8, perSide: true }, needs: ["chair"],
        tip: "One leg, sitting to a chair, free leg reaching forward. Lower the surface as you get stronger." },
      { name: "Rolling Pistol",        criterion: { reps: 5, perSide: true },
        tip: "Roll back onto your shoulders, then rock forward and stand up on one leg. The momentum gets you past the hardest inch." },
      { name: "Full Pistol Squat",     criterion: { reps: 3, perSide: true },
        tip: "From standing, all the way down and back up on one leg, heel flat throughout. Three clean each side." },
      { name: "Five Clean Pistols",    criterion: { reps: 5, perSide: true },
        tip: "Five per side, no wobble, no heel lift, free leg never touching down." },
    ],
  },

  handstand: {
    id: "handstand",
    name: "Handstand",
    blurb: "Balanced upside down on your hands, no wall.",
    needs: ["wall"],
    muscles: ["frontDelts", "core", "abs", "traps", "triceps"],
    frequency: "Almost daily. Short, frequent practice beats long sessions — balance is a nervous-system skill.",
    coaching:
      "Handstands are learned in a line: get the shape against a wall, then get the balance off it. " +
      "Chest-to-wall teaches the straight body most people are missing; back-to-wall lets you practise the balance itself. Fingertips do the steering.",
    accessories: ["pikepushup", "wallpike", "plank", "hollowhold"],
    stages: [
      { name: "Wall Plank",            criterion: { holdSecs: 45 },
        tip: "Feet on the wall, hands on the floor, body horizontal. Push the floor away and squeeze everything. Builds the shoulder endurance first." },
      { name: "Chest-to-Wall Handstand", criterion: { holdSecs: 30 },
        tip: "Walk your feet up the wall until your chest is close to it. Ribs down, glutes tight, ears between your arms. This is where the straight line is built." },
      { name: "Back-to-Wall Handstand", criterion: { holdSecs: 45 },
        tip: "Kick up with your back to the wall and only your heels touching. Now you can feel the balance point." },
      { name: "Wall Shoulder Taps",    criterion: { reps: 10 },
        tip: "From the wall handstand, shift your weight and tap one shoulder, then the other. Ten controlled taps means you can hold your own weight on one arm briefly." },
      { name: "Freestanding Handstand", criterion: { holdSecs: 10 },
        tip: "Kick up away from the wall and steer with your fingers — press the fingertips to stop falling forward. Bail by turning out, never by folding." },
      { name: "Thirty-Second Handstand", criterion: { holdSecs: 30 },
        tip: "Now it's a position you own. Chase consistency: five solid attempts a day beats one long grind." },
    ],
  },

  frontlever: {
    id: "frontlever",
    name: "Front Lever",
    blurb: "Hanging from a bar, body held horizontal and straight, facing up.",
    needs: ["pullupbar"],
    muscles: ["lats", "core", "abs", "forearms", "rearDelts"],
    frequency: "2–3 times a week. Very high tension — leave a day between attempts.",
    coaching:
      "The lever is straight-arm pulling strength, which is a different quality from bent-arm pulling. " +
      "Keep the elbows locked and think about pulling the bar down toward your hips. Shorten the lever whenever the hips start to sag — form is the whole exercise.",
    accessories: ["deadhang", "hollowhold", "hangingknee", "tablerow"],
    stages: [
      { name: "Tuck Front Lever",      criterion: { holdSecs: 15 },
        tip: "Hang, then pull your knees to your chest until your back is horizontal. Arms stay straight — that's non-negotiable." },
      { name: "Advanced Tuck Front Lever", criterion: { holdSecs: 15 },
        tip: "Open the knees so your back flattens and the hips extend. Flat back, not a rounded ball." },
      { name: "One-Leg Front Lever",   criterion: { holdSecs: 10, perSide: true },
        tip: "Extend one leg fully, keep the other tucked. Alternate which leg extends between sets." },
      { name: "Straddle Front Lever",  criterion: { holdSecs: 8 },
        tip: "Both legs straight but spread wide. The wider the straddle, the lighter the lever." },
      { name: "Full Front Lever",      criterion: { holdSecs: 5 },
        tip: "Legs together, body dead level from shoulders to toes. Five clean seconds is a real front lever." },
    ],
  },

  muscleup: {
    id: "muscleup",
    name: "Muscle-Up",
    blurb: "Pull over the bar and press out on top, in one movement.",
    needs: ["pullupbar"],
    muscles: ["lats", "chest", "triceps", "biceps", "core"],
    frequency: "2–3 times a week, always at the very start of a session.",
    coaching:
      "The muscle-up is a pull-up, a transition, and a dip stitched together — and the transition is what stops people, not strength. " +
      "You need a chest-height pull-up and a solid straight-bar dip before the transition drills are worth your time.",
    accessories: ["pullup", "chairdip", "hangingknee", "scapshrug"],
    stages: [
      { name: "Five Strict Pull-Ups",  criterion: { reps: 5 },
        tip: "The entry fee. Full dead hang to chin over the bar, five times, no kipping." },
      { name: "Chest-to-Bar Pull-Up",  criterion: { reps: 5 },
        tip: "Pull higher than a normal rep — the bar touches your upper chest. Lean back slightly and drive the elbows down." },
      { name: "Straight-Bar Dip",      criterion: { reps: 5 },
        tip: "Support yourself above the bar, lower until your chest reaches it, press back to a locked arm. This is the top half of the move." },
      { name: "Explosive Pull-Up",     criterion: { reps: 3 },
        tip: "Pull hard enough that the bar reaches your lower chest or ribs and your hands unweight for a moment at the top." },
      { name: "Transition Drill",      criterion: { reps: 3 },
        tip: "From a low bar with feet assisting, practise rolling the wrists over the bar and getting the chest above it. This is the piece everyone skips." },
      { name: "Strict Muscle-Up",      criterion: { reps: 1 },
        tip: "One continuous movement: pull, roll the shoulders over, press out. Fresh, at the top of the session, with a bar you trust." },
    ],
  },

  dragonflag: {
    id: "dragonflag",
    name: "Dragon Flag",
    blurb: "Anchored by the shoulders, whole body held rigid and lowered as one straight line.",
    needs: ["chair"],
    muscles: ["abs", "core", "lats", "glutes"],
    frequency: "2–3 times a week. Brutal on the lower back if the form slips — stop the set the moment you bend.",
    coaching:
      "Everything hinges on staying a single rigid plank from shoulders to toes; the moment you pike at the hips it stops being a dragon flag. " +
      "Grip something solid behind your head, drive your shoulders into the surface, and lower only as far as you can stay straight.",
    accessories: ["hollowhold", "legraise", "plank", "glutebridge"],
    stages: [
      { name: "Negative Dragon Flag",  criterion: { reps: 5 },
        tip: "Start with hips up and body vertical, then lower as slowly as you can while staying dead straight. Reset at the bottom." },
      { name: "Tuck Dragon Flag",      criterion: { holdSecs: 15 },
        tip: "Knees tucked, hips high, shoulders driving down into the surface. Hold the tucked shape without letting the hips drop." },
      { name: "Straddle Dragon Flag",  criterion: { holdSecs: 12 },
        tip: "Legs straight and spread wide to lighten the lever. Ribs down; do not let the lower back arch." },
      { name: "Full Dragon Flag Hold", criterion: { holdSecs: 8 },
        tip: "Legs together, body one rigid line held at an angle. Squeeze the glutes hard — it's what keeps you straight." },
      { name: "Five Dragon Flag Reps", criterion: { reps: 5 },
        tip: "Full range, lowering under control and raising without breaking the line. Five is a genuinely strong midsection." },
    ],
  },
};

export const SKILL_LIST = Object.values(SKILLS);

/** How many practice sets, by training age. Skill work stays submaximal. */
export const SKILL_SETS = { beginner: 3, intermediate: 4, advanced: 5 };
// Skill practice is deliberately submaximal — you stop with something left, so
// it does not need heavy-compound rest. 60s keeps a short session viable.
export const SKILL_REST = 60;

/** "3 × 20s hold" / "4 × 8 reps each side" */
export function criterionLabel(stage) {
  const c = stage.criterion;
  const side = c.perSide ? " each side" : "";
  return c.holdSecs ? `${c.holdSecs}s hold${side}` : `${c.reps} rep${c.reps === 1 ? "" : "s"}${side}`;
}

/** Gear check for one stage: the skill's baseline plus any stage override. */
export function stageNeeds(skill, stage) {
  return {
    needs: [...(skill.needs || []), ...(stage.needs || [])],
    needsAny: stage.needsAny || skill.needsAny || null,
  };
}
