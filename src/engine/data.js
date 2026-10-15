// ─── Atlas Trainer: domain data ────────────────────────────────────────────────
// tier: how much a muscle drives a session. Minor muscles are deferred first
// when the clock runs out, because compounds already give them indirect work.
export const MUSCLES = {
  chest:      { label: "Chest",       tier: "major", views: ["front"] },
  lats:       { label: "Lats",        tier: "major", views: ["back"]  },
  frontDelts: { label: "Front Delts", tier: "major", views: ["front"] },
  quads:      { label: "Quads",       tier: "major", views: ["front"] },
  hamstrings: { label: "Hamstrings",  tier: "major", views: ["back"]  },
  glutes:     { label: "Glutes",      tier: "major", views: ["back"]  },
  abs:        { label: "Abs",         tier: "major", views: ["front"] },
  core:       { label: "Core",        tier: "major", views: ["front", "back"] },
  rearDelts:  { label: "Rear Delts",  tier: "minor", views: ["back"]  },
  biceps:     { label: "Biceps",      tier: "minor", views: ["front"] },
  triceps:    { label: "Triceps",     tier: "minor", views: ["back"]  },
  forearms:   { label: "Forearms",    tier: "minor", views: ["front", "back"] },
  traps:      { label: "Traps",       tier: "minor", views: ["back"]  },
  calves:     { label: "Calves",      tier: "minor", views: ["front", "back"] },
};

export const PRESETS = [
  { id: "push",  label: "Push",      muscles: ["chest", "frontDelts", "triceps"] },
  { id: "pull",  label: "Pull",      muscles: ["lats", "traps", "rearDelts", "biceps"] },
  { id: "legs",  label: "Legs",      muscles: ["quads", "hamstrings", "glutes", "calves"] },
  { id: "core",  label: "Core",      muscles: ["abs", "core"] },
  { id: "upper", label: "Upper",     muscles: ["chest", "lats", "frontDelts", "rearDelts", "biceps", "triceps"] },
  { id: "lower", label: "Lower",     muscles: ["quads", "hamstrings", "glutes", "calves"] },
  { id: "full",  label: "Full Body", muscles: ["chest", "lats", "quads", "hamstrings", "glutes", "core"] },
];

export const EQUIP_RANK = { bw: 0, min: 1, gym: 2 };

// ── Equipment you actually own ────────────────────────────────────────────────
// Exercises are matched against this list, not against a coarse "gym tier".
// needs    — every item must be present.  needsAny — at least one must be.
export const ITEMS = [
  { id: "wall",       label: "Clear wall space",          group: "Around the house" },
  { id: "chair",      label: "Chair, bench or step",      group: "Around the house" },
  { id: "table",      label: "Table or waist-height bar", group: "Around the house" },
  { id: "towel",      label: "Towel",                     group: "Around the house" },
  { id: "bands",      label: "Resistance bands",          group: "Portable kit" },
  { id: "dumbbells",  label: "Dumbbells",                 group: "Portable kit" },
  { id: "kettlebell", label: "Kettlebell",                group: "Portable kit" },
  { id: "pullupbar",  label: "Pull-up bar",               group: "Portable kit" },
  { id: "rope",       label: "Jump rope",                 group: "Portable kit" },
  { id: "bench",      label: "Weight bench",              group: "Gym floor" },
  { id: "barbell",    label: "Barbell & plates",          group: "Gym floor" },
  { id: "rack",       label: "Squat rack or dip bars",    group: "Gym floor" },
  { id: "cable",      label: "Cable machine",             group: "Gym floor" },
  { id: "machines",   label: "Weight machines",           group: "Gym floor" },
];

export const ITEM_GROUPS = ["Around the house", "Portable kit", "Gym floor"];
export const ITEM_LABEL = Object.fromEntries(ITEMS.map((i) => [i.id, i.label]));

// Items that let you add external load — decides whether a weight is suggested.
export const LOADING_ITEMS = ["dumbbells", "kettlebell", "barbell", "cable", "machines"];

// Starting kits only PRE-FILL the checklist. The checklist is the truth.
export const EQUIP_PRESETS = {
  bw:  ["wall", "chair", "table", "towel"],
  min: ["wall", "chair", "table", "towel", "bands", "dumbbells"],
  gym: ITEMS.map((i) => i.id),
};

// Movement patterns — used for structural balance and session ordering.
export const PATTERNS = {
  hpush: "Horizontal push", vpush: "Vertical push",
  hpull: "Horizontal pull", vpull: "Vertical pull",
  squat: "Squat", hinge: "Hinge", lunge: "Single-leg",
  carry: "Carry", brace: "Anti-movement", iso: "Isolation",
};

// Bodyweight progression ladders. When a movement can't be loaded, the way to
// make it harder is to change the variation — this is that ordering.
export const LADDERS = {
  pushup:  { label: "Push-up",   pattern: "hpush" },
  dip:     { label: "Dip",       pattern: "hpush" },
  row:     { label: "Row",       pattern: "hpull" },
  chin:    { label: "Pull-up",   pattern: "vpull" },
  squat:   { label: "Squat",     pattern: "squat" },
  hinge:   { label: "Hinge",     pattern: "hinge" },
  plank:   { label: "Plank",     pattern: "brace" },
  legraise:{ label: "Leg raise", pattern: "brace" },
  calf:    { label: "Calf raise",pattern: "iso"   },
  hang:    { label: "Hang",      pattern: "carry" },
};

const KB = ["dumbbells", "kettlebell"];

// loadable  — can external load be added? drives whether rep targets or
//             variation changes are the progression lever.
// skill     — 1 anyone / 2 needs coordination / 3 technical or heavy.
// impact    — jumping or landing; gated by age.
// loadFactor/loadUnit — starting-load suggestion as a share of bodyweight.
// nameBy/tipBy — wording for the implement actually owned (never name gear the user lacks).
export const EXERCISES = [
  // ── Chest ──────────────────────────────────────────────────────────────────
  { id: "wallpushup",    needs: ["wall"],  name: "Wall Push-Up",             equip: "bw",  primary: "chest", secondary: ["triceps","frontDelts"], compound: true,  loadable: false, skill: 1, pattern: "hpush", ladder: "pushup", rank: 1, tip: "Hands on the wall at chest height, body straight. Step your feet back to make it harder." },
  { id: "inclinepushup", needs: ["chair"], name: "Incline Push-Up",          equip: "bw",  primary: "chest", secondary: ["triceps","frontDelts","core"], compound: true, loadable: false, skill: 1, pattern: "hpush", ladder: "pushup", rank: 2, tip: "Hands on a counter, a sturdy chair back or a step. The lower the surface, the harder it gets." },
  { id: "kneepushup",    needs: [],        name: "Knee Push-Up",             equip: "bw",  primary: "chest", secondary: ["triceps","frontDelts","core"], compound: true, loadable: false, skill: 1, pattern: "hpush", ladder: "pushup", rank: 3, tip: "Knees down, hips forward so you stay in a straight line from knee to head — don't pike." },
  { id: "pushup",        needs: [],        name: "Push-Up",                  equip: "bw",  primary: "chest", secondary: ["triceps","frontDelts","core"], compound: true, loadable: false, skill: 1, pattern: "hpush", ladder: "pushup", rank: 4, tip: "Rigid line from head to heels; lower until your chest is a fist's height off the floor." },
  { id: "declinepushup", needs: ["chair"], name: "Decline Push-Up",          equip: "bw",  primary: "chest", secondary: ["frontDelts","triceps","core"], compound: true, loadable: false, skill: 2, pattern: "hpush", ladder: "pushup", rank: 5, tip: "Feet on a chair or couch. The higher the feet, the more upper-chest and shoulder load." },
  { id: "archerpushup",  needs: [],        name: "Archer Push-Up",           equip: "bw",  primary: "chest", secondary: ["triceps","frontDelts","core"], compound: true, loadable: false, skill: 3, pattern: "hpush", ladder: "pushup", rank: 6, tip: "Wide hands; bend one arm and keep the other straight, shifting your weight onto the working side." },
  { id: "floorpress",    needs: [], needsAny: KB, nameBy: { kettlebell: "Kettlebell Floor Press" }, name: "Dumbbell Floor Press", equip: "min", primary: "chest", secondary: ["triceps"], compound: true, loadable: true, skill: 1, pattern: "hpush", loadFactor: 0.18, loadUnit: "perHand", tip: "Pause when your upper arms touch the floor — no bounce. Press slightly inward at the top." },
  { id: "dbbench",       needs: ["dumbbells","bench"], name: "Dumbbell Bench Press", equip: "min", primary: "chest", secondary: ["triceps","frontDelts"], compound: true, loadable: true, skill: 2, pattern: "hpush", loadFactor: 0.22, loadUnit: "perHand", tip: "Shoulder blades pinned to the bench; elbows about 45° from your ribs, not flared to 90°." },
  { id: "bandfly",       needs: ["bands"], name: "Band Chest Fly",           equip: "min", primary: "chest", secondary: [], compound: false, loadable: false, skill: 1, pattern: "iso", tip: "Anchor the band behind you at chest height. Soft elbows; hug a barrel, don't press." },
  { id: "benchpress",    needs: ["barbell","bench"], name: "Barbell Bench Press", equip: "gym", primary: "chest", secondary: ["triceps","frontDelts"], compound: true, loadable: true, skill: 3, pattern: "hpush", loadFactor: 0.65, loadUnit: "total", tip: "Shoulder blades pinched, feet planted. Touch the bar to your sternum under control." },
  { id: "inclinedb",     needs: ["dumbbells","bench"], name: "Incline Dumbbell Press", equip: "gym", primary: "chest", secondary: ["frontDelts","triceps"], compound: true, loadable: true, skill: 2, pattern: "hpush", loadFactor: 0.20, loadUnit: "perHand", tip: "Bench at 30°, not 45° — any steeper and it turns into a shoulder press." },
  { id: "cablefly",      needs: ["cable"], name: "Cable Crossover Fly",      equip: "gym", primary: "chest", secondary: [], compound: false, loadable: true, skill: 1, pattern: "iso", tip: "Step forward into a staggered stance; squeeze your pecs together for a full second at the midpoint." },

  // ── Lats ───────────────────────────────────────────────────────────────────
  { id: "highrow",       needs: ["table"], name: "High Inverted Row",        equip: "bw",  primary: "lats", secondary: ["biceps","rearDelts"], compound: true, loadable: false, skill: 1, pattern: "hpull", ladder: "row", rank: 1, tip: "Bar or table edge at hip height, body angled well above horizontal. The more upright, the easier." },
  { id: "tablerow",      needs: ["table"], name: "Inverted Table Row",       equip: "bw",  primary: "lats", secondary: ["biceps","rearDelts","core"], compound: true, loadable: false, skill: 1, pattern: "hpull", ladder: "row", rank: 2, tip: "Grip the edge of a sturdy table, body straight underneath. Pull your chest to the edge." },
  { id: "feetuprow",     needs: ["table","chair"], name: "Feet-Elevated Inverted Row", equip: "bw", primary: "lats", secondary: ["biceps","rearDelts","core"], compound: true, loadable: false, skill: 2, pattern: "hpull", ladder: "row", rank: 3, tip: "Feet up on a second chair so your body is level. Squeeze the shoulder blades at the top." },
  { id: "supermanpull",  needs: [],        name: "Superman Lat Pull",        equip: "bw",  primary: "lats", secondary: ["core"], compound: false, loadable: false, skill: 1, pattern: "iso", tip: "Lying face down, arms extended: lift chest, then pull elbows to your ribs like a pulldown." },
  { id: "dbrow",         needs: [], needsAny: KB, nameBy: { kettlebell: "One-Arm Kettlebell Row" }, name: "One-Arm Dumbbell Row", equip: "min", primary: "lats", secondary: ["biceps","rearDelts"], compound: true, loadable: true, skill: 1, pattern: "hpull", loadFactor: 0.25, loadUnit: "perHand", tip: "Flat back, pull the weight to your hip pocket — not your chest. No torso twist." },
  { id: "bandpulldown",  needs: ["bands"], name: "Band Lat Pulldown",        equip: "min", primary: "lats", secondary: ["biceps"], compound: false, loadable: false, skill: 1, pattern: "vpull", tip: "Anchor the band high. Drive your elbows down and back; feel the stretch at the top." },
  { id: "deadhangpull",  needs: ["pullupbar"], name: "Negative Pull-Up",     equip: "min", primary: "lats", secondary: ["biceps","forearms"], compound: true, loadable: false, skill: 2, pattern: "vpull", ladder: "chin", rank: 2, tip: "Jump or climb to the top position, then lower yourself as slowly as you can. 5 seconds is the target." },
  { id: "pullup",        needs: ["pullupbar"], name: "Pull-Up",              equip: "gym", primary: "lats", secondary: ["biceps","core","forearms"], compound: true, loadable: true, skill: 3, pattern: "vpull", ladder: "chin", rank: 4, tip: "Start from a dead hang; lead with your chest, chin over bar, control the descent." },
  { id: "latpulldown",   needs: ["cable"], name: "Lat Pulldown",             equip: "gym", primary: "lats", secondary: ["biceps"], compound: true, loadable: true, skill: 1, pattern: "vpull", loadFactor: 0.55, loadUnit: "total", tip: "Slight lean back, bar to your collarbone. Think 'elbows into your back pockets'." },
  { id: "seatedrow",     needs: ["cable"], name: "Seated Cable Row",         equip: "gym", primary: "lats", secondary: ["biceps","rearDelts","traps"], compound: true, loadable: true, skill: 1, pattern: "hpull", loadFactor: 0.50, loadUnit: "total", tip: "Chest tall, pull to your navel. Let the shoulder blades travel — don't lock the torso rigid." },

  // ── Traps ──────────────────────────────────────────────────────────────────
  { id: "yraise",        needs: [],        name: "Prone Y-Raise",            equip: "bw",  primary: "traps", secondary: ["rearDelts"], compound: false, loadable: false, skill: 1, pattern: "iso", tip: "Face down, arms in a Y, thumbs up. Lift from the shoulder blades, not the neck." },
  { id: "scapshrug",     needs: [],        name: "Scapular Shrug",           equip: "bw",  primary: "traps", secondary: [], compound: false, loadable: false, skill: 1, pattern: "iso", tip: "In a plank or a hang, shrug the shoulder blades down and together without bending the elbows." },
  { id: "dbshrug",       needs: [], needsAny: KB, nameBy: { kettlebell: "Kettlebell Shrug" }, name: "Dumbbell Shrug", equip: "min", primary: "traps", secondary: ["forearms"], compound: false, loadable: true, skill: 1, pattern: "iso", loadFactor: 0.30, loadUnit: "perHand", tip: "Straight up toward your ears, one-second hold at the top. No rolling." },
  { id: "facepull",      needs: ["bands"], name: "Band Face Pull",           equip: "min", primary: "traps", secondary: ["rearDelts"], compound: false, loadable: false, skill: 1, pattern: "iso", tip: "Pull to your nose with elbows high, ending in a double-biceps pose. Great for posture." },
  { id: "bbshrug",       needs: ["barbell"], name: "Barbell Shrug",          equip: "gym", primary: "traps", secondary: ["forearms"], compound: false, loadable: true, skill: 1, pattern: "iso", loadFactor: 0.70, loadUnit: "total", tip: "Heavy but strict: no arm bend, no bounce. Pause at the top." },

  // ── Front delts ────────────────────────────────────────────────────────────
  { id: "wallpike",      needs: ["wall"],  name: "Wall-Assisted Pike Press", equip: "bw",  primary: "frontDelts", secondary: ["triceps","traps"], compound: true, loadable: false, skill: 1, pattern: "vpush", tip: "Hips high in an A-frame with feet against a wall. Lower your head toward your hands." },
  { id: "pikepushup",    needs: [],        name: "Pike Push-Up",             equip: "bw",  primary: "frontDelts", secondary: ["triceps","traps"], compound: true, loadable: false, skill: 2, pattern: "vpush", tip: "Hips high in an A-frame; lower the crown of your head to the floor between your hands." },
  { id: "walkout",       needs: [],        name: "Inchworm Walkout",         equip: "bw",  primary: "frontDelts", secondary: ["core","chest"], compound: true, loadable: false, skill: 1, pattern: "vpush", tip: "Walk hands out past a plank, pause, walk back. Slow tempo beats extra reps." },
  { id: "dbpress",       needs: [], needsAny: KB, nameBy: { kettlebell: "Kettlebell Shoulder Press" }, tipBy: { kettlebell: "One bell, one arm at a time. Press up and slightly in; ribs down, glutes tight." }, name: "Dumbbell Shoulder Press", equip: "min", primary: "frontDelts", secondary: ["triceps","traps"], compound: true, loadable: true, skill: 1, pattern: "vpush", loadFactor: 0.15, loadUnit: "perHand", tip: "Press up and slightly in; finish with biceps beside your ears. Ribs down, glutes tight." },
  { id: "latraise",      needs: ["dumbbells"], name: "Lateral Raise",        equip: "min", primary: "frontDelts", secondary: ["traps"], compound: false, loadable: true, skill: 1, pattern: "iso", loadFactor: 0.06, loadUnit: "perHand", tip: "Lead with the elbows, pinkies slightly up, stop at shoulder height. Light weight, strict form." },
  { id: "ohp",           needs: ["barbell"], name: "Overhead Press",         equip: "gym", primary: "frontDelts", secondary: ["triceps","core"], compound: true, loadable: true, skill: 3, pattern: "vpush", loadFactor: 0.45, loadUnit: "total", tip: "Squeeze glutes to protect your lower back. Bar path close to the face, head 'through' at the top." },
  { id: "machinepress",  needs: ["machines"], name: "Machine Shoulder Press", equip: "gym", primary: "frontDelts", secondary: ["triceps"], compound: true, loadable: true, skill: 1, pattern: "vpush", loadFactor: 0.35, loadUnit: "total", tip: "Seat height so the handles start at shoulder level. Full lockout without shrugging." },

  // ── Rear delts ─────────────────────────────────────────────────────────────
  { id: "snowangel",     needs: [],        name: "Prone Snow Angel",         equip: "bw",  primary: "rearDelts", secondary: ["traps"], compound: false, loadable: false, skill: 1, pattern: "iso", tip: "Face down, sweep straight arms from hips to overhead, hovering the whole way." },
  { id: "proneT",        needs: [],        name: "Prone T-Raise",            equip: "bw",  primary: "rearDelts", secondary: ["traps"], compound: false, loadable: false, skill: 1, pattern: "iso", tip: "Face down, arms straight out to the sides like a T, thumbs up. Lift and squeeze, don't shrug." },
  { id: "wallangel",     needs: ["wall"],  name: "Wall Angel",               equip: "bw",  primary: "rearDelts", secondary: ["traps","frontDelts"], compound: false, loadable: false, skill: 1, pattern: "iso", tip: "Back flat to the wall, arms in a goalpost, slide up and down keeping wrists and elbows touching." },
  { id: "bandpullapart", needs: ["bands"], name: "Band Pull-Apart",          equip: "min", primary: "rearDelts", secondary: ["traps"], compound: false, loadable: false, skill: 1, pattern: "iso", tip: "Arms straight at shoulder height; stretch the band to your chest and squeeze your shoulder blades." },
  { id: "reversefly",    needs: ["dumbbells"], name: "Bent-Over Reverse Fly", equip: "min", primary: "rearDelts", secondary: ["traps"], compound: false, loadable: true, skill: 1, pattern: "iso", loadFactor: 0.06, loadUnit: "perHand", tip: "Hinge to near-parallel, soft elbows, raise out to the sides like wings. No momentum." },
  { id: "pecdeck",       needs: ["machines"], name: "Reverse Pec Deck",      equip: "gym", primary: "rearDelts", secondary: ["traps"], compound: false, loadable: true, skill: 1, pattern: "iso", loadFactor: 0.20, loadUnit: "total", tip: "Seat high, arms just below shoulder height. Pause the squeeze; don't chase heavy stacks." },

  // ── Biceps ─────────────────────────────────────────────────────────────────
  { id: "towelcurl",     needs: ["towel"], name: "Towel Isometric Curl",     equip: "bw",  primary: "biceps", secondary: ["forearms"], compound: false, loadable: false, skill: 1, pattern: "iso", timed: true, tip: "Stand on a towel, curl against it at 90° and hold hard. Max-effort tension the whole time." },
  { id: "curlnegative",  needs: [],        name: "Self-Resisted Curl",       equip: "bw",  primary: "biceps", secondary: ["forearms"], compound: false, loadable: false, skill: 1, pattern: "iso", tip: "Press down with the opposite hand as you curl up, then resist hard on the way down." },
  { id: "bwcurlrow",     needs: ["table"], name: "Underhand Table Row",      equip: "bw",  primary: "biceps", secondary: ["lats","forearms"], compound: true, loadable: false, skill: 1, pattern: "hpull", tip: "Palms-up grip on a table edge; keep elbows tight to your sides so the biceps do the pulling." },
  { id: "dbcurl",        needs: [], needsAny: KB, nameBy: { kettlebell: "Kettlebell Curl" }, name: "Dumbbell Curl", equip: "min", primary: "biceps", secondary: ["forearms"], compound: false, loadable: true, skill: 1, pattern: "iso", loadFactor: 0.11, loadUnit: "perHand", tip: "Elbows pinned to your sides; control the lowering for a slow 3-count." },
  { id: "hammercurl",    needs: ["dumbbells"], name: "Hammer Curl",          equip: "min", primary: "biceps", secondary: ["forearms"], compound: false, loadable: true, skill: 1, pattern: "iso", loadFactor: 0.12, loadUnit: "perHand", tip: "Neutral grip, thumbs up. Hits the brachialis for thicker-looking arms." },
  { id: "chinup",        needs: ["pullupbar"], name: "Chin-Up",              equip: "gym", primary: "biceps", secondary: ["lats","core","forearms"], compound: true, loadable: true, skill: 3, pattern: "vpull", ladder: "chin", rank: 3, tip: "Underhand grip, shoulder width. Pull until your chin clears; lower on a 3-count." },
  { id: "bbcurl",        needs: ["barbell"], name: "Barbell Curl",           equip: "gym", primary: "biceps", secondary: ["forearms"], compound: false, loadable: true, skill: 1, pattern: "iso", loadFactor: 0.30, loadUnit: "total", tip: "Glue your elbows to your ribs. If your hips swing, the weight is too heavy." },
  { id: "preachercurl",  needs: ["barbell","bench"], name: "Preacher Curl",  equip: "gym", primary: "biceps", secondary: [], compound: false, loadable: true, skill: 1, pattern: "iso", loadFactor: 0.22, loadUnit: "total", tip: "Armpits into the pad. Don't fully lock out at the bottom — keep tension on the muscle." },

  // ── Triceps ────────────────────────────────────────────────────────────────
  { id: "chairdip",      needs: ["chair"], name: "Bench Dip",                equip: "bw",  primary: "triceps", secondary: ["chest","frontDelts"], compound: true, loadable: false, skill: 1, pattern: "hpush", ladder: "dip", rank: 2, tip: "Hands on a chair edge, hips close to it. Stop at 90° elbows to spare your shoulders." },
  { id: "diamondpushup", needs: [],        name: "Diamond Push-Up",          equip: "bw",  primary: "triceps", secondary: ["chest","frontDelts"], compound: true, loadable: false, skill: 2, pattern: "hpush", tip: "Hands form a diamond under your sternum; keep elbows brushing your ribs." },
  { id: "wallext",       needs: ["wall"],  name: "Wall Triceps Extension",   equip: "bw",  primary: "triceps", secondary: [], compound: false, loadable: false, skill: 1, pattern: "iso", tip: "Forearms on a wall above your head, lower your forehead toward it, press back out with the triceps." },
  { id: "ohext",         needs: [], needsAny: KB, nameBy: { kettlebell: "Kettlebell Overhead Extension" }, name: "Overhead Triceps Extension", equip: "min", primary: "triceps", secondary: [], compound: false, loadable: true, skill: 1, pattern: "iso", loadFactor: 0.15, loadUnit: "total", tip: "Both hands on one weight behind your head; elbows point forward, not flared." },
  { id: "kickback",      needs: ["dumbbells"], name: "Dumbbell Kickback",    equip: "min", primary: "triceps", secondary: [], compound: false, loadable: true, skill: 1, pattern: "iso", loadFactor: 0.07, loadUnit: "perHand", tip: "Upper arm locked parallel to the floor; only the forearm moves. Squeeze at lockout." },
  { id: "pushdown",      needs: ["cable"], name: "Cable Pushdown",           equip: "gym", primary: "triceps", secondary: [], compound: false, loadable: true, skill: 1, pattern: "iso", loadFactor: 0.30, loadUnit: "total", tip: "Elbows pinned, full lockout, slight lean. Let the cable stretch the triceps at the top." },
  { id: "cgbench",       needs: ["barbell","bench"], name: "Close-Grip Bench Press", equip: "gym", primary: "triceps", secondary: ["chest","frontDelts"], compound: true, loadable: true, skill: 3, pattern: "hpush", loadFactor: 0.55, loadUnit: "total", tip: "Grip just inside shoulder width; elbows track close to your torso." },
  { id: "paralleldip",   needs: ["rack"],  name: "Parallel Bar Dip",         equip: "gym", primary: "triceps", secondary: ["chest","frontDelts"], compound: true, loadable: true, skill: 3, pattern: "hpush", ladder: "dip", rank: 4, tip: "Slight forward lean, lower to a 90° elbow. Stop the set the moment your shoulders round forward." },

  // ── Forearms ───────────────────────────────────────────────────────────────
  { id: "deadhang",      needs: ["pullupbar"], name: "Dead Hang",            equip: "bw",  primary: "forearms", secondary: ["lats","traps"], compound: false, loadable: false, skill: 1, pattern: "carry", timed: true, ladder: "hang", rank: 1, tip: "Hang from a bar or a door frame with shoulders active — not fully slack. Breathe." },
  { id: "towelhang",     needs: ["pullupbar","towel"], name: "Towel Hang",   equip: "bw",  primary: "forearms", secondary: ["lats"], compound: false, loadable: false, skill: 2, pattern: "carry", timed: true, ladder: "hang", rank: 2, tip: "Loop a towel over the bar and grip that instead. Brutal on grip — start with short holds." },
  { id: "fingerext",     needs: [],        name: "Finger Extension",         equip: "bw",  primary: "forearms", secondary: [], compound: false, loadable: false, skill: 1, pattern: "iso", tip: "Bunch your fingertips together, then open the hand against the resistance of your other hand. Balances all the gripping." },
  { id: "towelwring",    needs: ["towel"], name: "Towel Wring",              equip: "bw",  primary: "forearms", secondary: [], compound: false, loadable: false, skill: 1, pattern: "iso", timed: true, tip: "Twist a damp towel in opposite directions as hard as you can, then switch. Cheap, brutal grip work." },
  { id: "farmercarry",   needs: ["dumbbells"], name: "Farmer Carry",         equip: "min", primary: "forearms", secondary: ["traps","core"], compound: true, loadable: true, skill: 1, pattern: "carry", timed: true, loadFactor: 0.30, loadUnit: "perHand", tip: "Heavy weight in each hand, walk tall with ribs down. Grip fails before anything else — that's the point." },
  { id: "wristcurl",     needs: ["dumbbells"], name: "Wrist Curl",           equip: "min", primary: "forearms", secondary: [], compound: false, loadable: true, skill: 1, pattern: "iso", loadFactor: 0.08, loadUnit: "perHand", tip: "Forearms on your thighs, palms up, let the weight roll to your fingertips then curl it back." },
  { id: "reversecurl",   needs: ["dumbbells"], name: "Reverse Curl",         equip: "min", primary: "forearms", secondary: ["biceps"], compound: false, loadable: true, skill: 1, pattern: "iso", loadFactor: 0.08, loadUnit: "perHand", tip: "Palms down, elbows tight. Go lighter than a normal curl — this one humbles people." },
  { id: "platepinch",    needs: ["barbell"], name: "Plate Pinch Hold",       equip: "gym", primary: "forearms", secondary: [], compound: false, loadable: true, skill: 1, pattern: "carry", timed: true, loadFactor: 0.12, loadUnit: "perHand", tip: "Pinch two smooth plates together between thumb and fingers and hold. Don't drop them on your feet." },

  // ── Abs ────────────────────────────────────────────────────────────────────
  { id: "deadbug",       needs: [],        name: "Dead Bug",                 equip: "bw",  primary: "abs", secondary: ["core"], compound: false, loadable: false, skill: 1, pattern: "brace", tip: "Lower opposite arm and leg while your lower back stays welded to the floor. Exhale hard." },
  { id: "kneeraise",     needs: [],        name: "Lying Knee Raise",         equip: "bw",  primary: "abs", secondary: ["core"], compound: false, loadable: false, skill: 1, pattern: "brace", ladder: "legraise", rank: 1, tip: "Knees bent, curl the pelvis off the floor. Small range done properly beats big range done sloppily." },
  { id: "legraise",      needs: [],        name: "Lying Leg Raise",          equip: "bw",  primary: "abs", secondary: ["core"], compound: false, loadable: false, skill: 2, pattern: "brace", ladder: "legraise", rank: 2, tip: "Hands under hips, legs to vertical, lower slow — heels never touch down." },
  { id: "hollowhold",    needs: [],        name: "Hollow Body Hold",         equip: "bw",  primary: "abs", secondary: ["core"], compound: false, loadable: false, skill: 2, pattern: "brace", timed: true, tip: "Lower back pressed down, arms and legs hovering long. Shaking is normal; sagging is not." },
  { id: "wsitup",        needs: [], needsAny: KB, name: "Weighted Sit-Up",   equip: "min", primary: "abs", secondary: ["core"], compound: false, loadable: true, skill: 1, pattern: "brace", loadFactor: 0.10, loadUnit: "total", tip: "Hug a weight to your chest; roll up one vertebra at a time." },
  { id: "hangingknee",   needs: ["pullupbar"], name: "Hanging Knee Raise",   equip: "gym", primary: "abs", secondary: ["core","forearms"], compound: false, loadable: false, skill: 2, pattern: "brace", ladder: "legraise", rank: 3, tip: "Curl the pelvis, not just the knees — think 'knees to elbows'. No swinging." },
  { id: "cablecrunch",   needs: ["cable"], name: "Cable Crunch",             equip: "gym", primary: "abs", secondary: [], compound: false, loadable: true, skill: 1, pattern: "brace", loadFactor: 0.25, loadUnit: "total", tip: "Kneel, rope beside your ears, crunch ribs to hips. Hips stay still." },

  // ── Core ───────────────────────────────────────────────────────────────────
  { id: "kneeplank",     needs: [],        name: "Knee Plank",               equip: "bw",  primary: "core", secondary: ["abs"], compound: false, loadable: false, skill: 1, pattern: "brace", timed: true, ladder: "plank", rank: 1, tip: "Forearms and knees down, straight line from knee to head. Squeeze the glutes." },
  { id: "plank",         needs: [],        name: "Plank",                    equip: "bw",  primary: "core", secondary: ["abs"], compound: false, loadable: false, skill: 1, pattern: "brace", timed: true, ladder: "plank", rank: 2, tip: "Squeeze glutes and quads, tuck the pelvis slightly. A shorter, tighter plank beats a long saggy one." },
  { id: "sideplank",     needs: [],        name: "Side Plank",               equip: "bw",  primary: "core", secondary: ["abs"], compound: false, loadable: false, skill: 2, pattern: "brace", timed: true, ladder: "plank", rank: 3, tip: "Straight line from ankles to shoulders; push the floor away. Switch sides each set." },
  { id: "birddog",       needs: [],        name: "Bird Dog",                 equip: "bw",  primary: "core", secondary: [], compound: false, loadable: false, skill: 1, pattern: "brace", tip: "Opposite arm and leg reach long; hips stay level as if balancing a cup on your back." },
  { id: "russiantwist",  needs: [], needsAny: KB, name: "Russian Twist",     equip: "min", primary: "core", secondary: ["abs"], compound: false, loadable: true, skill: 1, pattern: "brace", loadFactor: 0.08, loadUnit: "total", tip: "Lean back to 45°, rotate from the ribs. Slower is harder — and better." },
  { id: "pallof",        needs: ["bands"], name: "Pallof Press",             equip: "min", primary: "core", secondary: [], compound: false, loadable: false, skill: 1, pattern: "brace", tip: "Band at chest height, press straight out and resist the twist. Anti-rotation is the point." },
  { id: "suitcase",      needs: [], needsAny: KB, name: "Suitcase Carry",    equip: "min", primary: "core", secondary: ["forearms","traps"], compound: true, loadable: true, skill: 1, pattern: "carry", timed: true, loadFactor: 0.25, loadUnit: "perHand", tip: "Weight in one hand only; walk without leaning. Your obliques are doing all the work." },
  { id: "backext",       needs: ["machines"], name: "Back Extension",        equip: "gym", primary: "core", secondary: ["hamstrings","glutes"], compound: false, loadable: true, skill: 1, pattern: "hinge", loadFactor: 0.15, loadUnit: "total", tip: "Hinge at the hips, rise to a straight line — no hyperextending past neutral." },

  // ── Quads ──────────────────────────────────────────────────────────────────
  { id: "boxsquat",      needs: ["chair"], name: "Box Squat",                equip: "bw",  primary: "quads", secondary: ["glutes","core"], compound: true, loadable: false, skill: 1, pattern: "squat", ladder: "squat", rank: 1, tip: "Sit back to a chair, tap it lightly, stand up. The chair sets your depth and catches you." },
  { id: "airsquat",      needs: [],        name: "Bodyweight Squat",         equip: "bw",  primary: "quads", secondary: ["glutes","core"], compound: true, loadable: false, skill: 1, pattern: "squat", ladder: "squat", rank: 2, tip: "Chest proud, knees tracking over toes, hips below parallel if mobility allows." },
  { id: "splitsquat",    needs: [],        name: "Split Squat",              equip: "bw",  primary: "quads", secondary: ["glutes","hamstrings"], compound: true, loadable: false, skill: 2, pattern: "lunge", ladder: "squat", rank: 3, tip: "Feet in a long stance, drop the back knee straight down. Both feet stay planted the whole set." },
  { id: "revlunge",      needs: [],        name: "Reverse Lunge",            equip: "bw",  primary: "quads", secondary: ["glutes","hamstrings","core"], compound: true, loadable: false, skill: 2, pattern: "lunge", tip: "Take a long stride backwards, drop the rear knee to a hover, drive up through the front heel." },
  { id: "wallsit",       needs: ["wall"],  name: "Wall Sit",                 equip: "bw",  primary: "quads", secondary: ["glutes"], compound: false, loadable: false, skill: 1, pattern: "brace", timed: true, tip: "Thighs parallel, back flat on the wall, hands off your legs." },
  { id: "gobletsquat",   needs: [], needsAny: KB, name: "Goblet Squat",      equip: "min", primary: "quads", secondary: ["glutes","core"], compound: true, loadable: true, skill: 1, pattern: "squat", loadFactor: 0.25, loadUnit: "total", tip: "Hold the weight at your chest like a goblet; elbows slide inside your knees at the bottom." },
  { id: "bulgarian",     needs: ["chair"], name: "Bulgarian Split Squat",    equip: "min", primary: "quads", secondary: ["glutes","core"], compound: true, loadable: true, skill: 3, pattern: "lunge", loadFactor: 0.12, loadUnit: "perHand", tip: "Rear foot on a chair. Torso tall for quads, hinged forward for glutes." },
  { id: "backsquat",     needs: ["barbell","rack"], name: "Barbell Back Squat", equip: "gym", primary: "quads", secondary: ["glutes","core","hamstrings"], compound: true, loadable: true, skill: 3, pattern: "squat", loadFactor: 0.80, loadUnit: "total", tip: "Brace like you're about to be punched; break at hips and knees together." },
  { id: "legpress",      needs: ["machines"], name: "Leg Press",             equip: "gym", primary: "quads", secondary: ["glutes"], compound: true, loadable: true, skill: 1, pattern: "squat", loadFactor: 1.20, loadUnit: "total", tip: "Feet mid-platform, lower until thighs near your chest — never let your hips roll off the pad." },
  { id: "legext",        needs: ["machines"], name: "Leg Extension",         equip: "gym", primary: "quads", secondary: [], compound: false, loadable: true, skill: 1, pattern: "iso", loadFactor: 0.30, loadUnit: "total", tip: "Pause at the top for a second. Chasing heavy weight here just grinds the knee." },

  // ── Hamstrings ─────────────────────────────────────────────────────────────
  { id: "goodmorning",   needs: [],        name: "Bodyweight Good Morning",  equip: "bw",  primary: "hamstrings", secondary: ["glutes","core"], compound: true, loadable: false, skill: 1, pattern: "hinge", ladder: "hinge", rank: 1, tip: "Hands behind your head, push the hips back with a flat back. This teaches the hinge." },
  { id: "bridgewalk",    needs: [],        name: "Glute Bridge Walkout",     equip: "bw",  primary: "hamstrings", secondary: ["glutes"], compound: false, loadable: false, skill: 1, pattern: "hinge", tip: "From a high bridge, walk your heels out one small movement at a time, then back in. Hips stay up." },
  { id: "slidecurl",     needs: ["towel"], name: "Sliding Leg Curl",         equip: "bw",  primary: "hamstrings", secondary: ["glutes","core"], compound: false, loadable: false, skill: 2, pattern: "hinge", tip: "Heels on towels or socks on a smooth floor: bridge up, slide out slow, curl back in." },
  { id: "rdl",           needs: [], needsAny: KB, name: "Romanian Deadlift", equip: "min", primary: "hamstrings", secondary: ["glutes","core"], compound: true, loadable: true, skill: 2, pattern: "hinge", ladder: "hinge", rank: 3, loadFactor: 0.25, loadUnit: "perHand", tip: "Push your hips back like closing a car door; the weight slides down your thighs." },
  { id: "slrdl",         needs: [], needsAny: KB, name: "Single-Leg RDL",    equip: "min", primary: "hamstrings", secondary: ["glutes","core"], compound: true, loadable: true, skill: 3, pattern: "hinge", ladder: "hinge", rank: 4, loadFactor: 0.12, loadUnit: "perHand", tip: "Square hips, flat back, reach the free leg long behind you. Balance is part of the work." },
  { id: "legcurl",       needs: ["machines"], name: "Lying Leg Curl",        equip: "gym", primary: "hamstrings", secondary: ["calves"], compound: false, loadable: true, skill: 1, pattern: "iso", loadFactor: 0.30, loadUnit: "total", tip: "Hips pressed into the pad; curl fast up, lower on a 3-count." },
  { id: "deadlift",      needs: ["barbell"], name: "Barbell Deadlift",       equip: "gym", primary: "hamstrings", secondary: ["glutes","core","traps","forearms"], compound: true, loadable: true, skill: 3, pattern: "hinge", loadFactor: 1.00, loadUnit: "total", tip: "Bar over mid-foot, lats tight, push the floor away. It's a leg press with a bar in your hands." },

  // ── Glutes ─────────────────────────────────────────────────────────────────
  { id: "glutebridge",   needs: [],        name: "Glute Bridge",             equip: "bw",  primary: "glutes", secondary: ["hamstrings","core"], compound: false, loadable: false, skill: 1, pattern: "hinge", tip: "Drive through your heels, squeeze hard at the top for 2 seconds. Ribs stay down." },
  { id: "frogpump",      needs: [],        name: "Frog Pump",                equip: "bw",  primary: "glutes", secondary: [], compound: false, loadable: false, skill: 1, pattern: "iso", tip: "Soles of feet together, knees wide, pump the hips. High reps, big squeeze." },
  { id: "slbridge",      needs: [],        name: "Single-Leg Glute Bridge",  equip: "bw",  primary: "glutes", secondary: ["hamstrings","core"], compound: false, loadable: false, skill: 2, pattern: "hinge", tip: "One foot planted, the other knee hugged in. Keep the hips level as you drive up." },
  { id: "stepup",        needs: ["chair"], name: "Step-Up",                  equip: "min", primary: "glutes", secondary: ["quads","core"], compound: true, loadable: true, skill: 2, pattern: "lunge", loadFactor: 0.12, loadUnit: "perHand", tip: "Knee-height surface; drive through the top heel and don't push off the bottom leg." },
  { id: "hipthrust",     needs: ["chair"], name: "Hip Thrust",               equip: "min", primary: "glutes", secondary: ["hamstrings"], compound: true, loadable: true, skill: 2, pattern: "hinge", loadFactor: 0.40, loadUnit: "total", tip: "Shoulders on a bench, chin tucked, full lockout with a posterior tilt at the top." },
  { id: "cablekickback", needs: ["cable"], name: "Cable Kickback",           equip: "gym", primary: "glutes", secondary: ["hamstrings"], compound: false, loadable: true, skill: 1, pattern: "iso", loadFactor: 0.15, loadUnit: "total", tip: "Slight forward lean, kick back and up in an arc. Squeeze, don't swing." },
  { id: "abduction",     needs: ["machines"], name: "Hip Abduction",         equip: "gym", primary: "glutes", secondary: [], compound: false, loadable: true, skill: 1, pattern: "iso", loadFactor: 0.35, loadUnit: "total", tip: "Lean forward slightly to bias the upper glute. Control the return, don't let the stack slam." },

  // ── Calves ─────────────────────────────────────────────────────────────────
  { id: "calfraise",     needs: [],        name: "Standing Calf Raise",      equip: "bw",  primary: "calves", secondary: [], compound: false, loadable: false, skill: 1, pattern: "iso", ladder: "calf", rank: 1, tip: "Full stretch at the bottom, 2-second pause on your tiptoes at the top." },
  { id: "slcalfraise",   needs: [],        name: "Single-Leg Calf Raise",    equip: "bw",  primary: "calves", secondary: [], compound: false, loadable: false, skill: 2, pattern: "iso", ladder: "calf", rank: 2, tip: "Fingertips against something solid for balance only; pause hard for two seconds at the very top." },
  { id: "wcalfraise",    needs: [], needsAny: KB, tipBy: { kettlebell: "One bell at your side, other hand on something stable. Slow tempo — calves respond to time under tension." }, name: "Weighted Calf Raise", equip: "min", primary: "calves", secondary: ["forearms"], compound: false, loadable: true, skill: 1, pattern: "iso", loadFactor: 0.25, loadUnit: "perHand", tip: "A weight in each hand; slow tempo — calves respond to time under tension." },
  { id: "jumprope",      needs: ["rope"],  name: "Jump Rope",                equip: "min", primary: "calves", secondary: ["core"], compound: false, loadable: false, skill: 2, pattern: "iso", timed: true, impact: true, tip: "Stay on the balls of your feet, tiny hops, wrists doing the work." },
  { id: "seatedcalf",    needs: ["machines"], name: "Seated Calf Raise",     equip: "gym", primary: "calves", secondary: [], compound: false, loadable: true, skill: 1, pattern: "iso", loadFactor: 0.35, loadUnit: "total", tip: "Targets the soleus underneath: pause at both the stretch and the peak." },
  { id: "standcalfmach", needs: ["machines"], name: "Standing Calf Machine", equip: "gym", primary: "calves", secondary: [], compound: false, loadable: true, skill: 1, pattern: "iso", loadFactor: 0.60, loadUnit: "total", tip: "Knees soft but straight. Full range every rep — no tiny bouncing pulses." },
];

// ── Warm-up moves, keyed to what they mobilize ────────────────────────────────
// joint: true → prioritised for older trainees, who need more joint prep.
export const WARMUPS = [
  { name: "Jumping Jacks",           covers: ["*"], secs: 60, impact: true,  note: "Raise your heart rate and core temperature." },
  { name: "March in Place + Arm Swings", covers: ["*"], secs: 60, lowImpact: true, note: "Same job as jacks, no landing forces." },
  { name: "Arm Circles",             covers: ["chest","frontDelts","rearDelts","traps"], secs: 40, joint: true, note: "Small to large, both directions — wakes up the shoulder joint." },
  { name: "Wall Slides",             covers: ["chest","frontDelts","traps","lats"], secs: 40, joint: true, needs: ["wall"], note: "Back to the wall, slide arms overhead keeping wrists in contact." },
  { name: "Scapular Push-Up",        covers: ["chest","frontDelts","core"], secs: 40, note: "In plank, pinch and spread the shoulder blades only." },
  { name: "Pull-Apart",              covers: ["lats","rearDelts","traps","biceps"], secs: 40, needsAny: ["bands", "towel"],
    noteBy: { bands: "Hold a band at chest height and stretch it apart. Primes the upper back.",
              towel: "Hold a towel taut at chest height and pull outward hard against it. Primes the upper back." },
    note: "Stretch it apart at chest height. Primes the upper back." },
  { name: "Cat-Cow",                 covers: ["core","abs","lats"], secs: 40, joint: true, note: "Segment the spine slowly with your breath." },
  { name: "Torso Twists",            covers: ["core","abs"], secs: 40, note: "Feet planted, rotate from the ribs, arms loose." },
  { name: "Wrist Rolls & Openers",   covers: ["forearms","biceps","triceps"], secs: 30, joint: true, note: "Circles, then gentle palm-up stretches — prep for gripping and pressing." },
  { name: "Leg Swings",              covers: ["quads","hamstrings","glutes"], secs: 40, note: "Front-to-back and side-to-side, holding something stable." },
  { name: "Hip Circles",             covers: ["glutes","quads","core"], secs: 40, joint: true, note: "Big slow circles both directions — lubricates the hip joint." },
  { name: "Bodyweight Good Morning", covers: ["hamstrings","glutes","core"], secs: 40, note: "Hands behind head, hinge and stand. Grooves the hip hinge." },
  { name: "Slow Air Squats",         covers: ["quads","glutes","calves"], secs: 40, note: "3 seconds down, 3 up. Full depth, heels planted." },
  { name: "Ankle Rolls + Calf Rocks", covers: ["calves"], secs: 30, joint: true, note: "Roll each ankle, then rock gently onto your toes and back." },
];

export const STRETCHES = {
  chest:      { name: "Doorway Chest Stretch",       secs: 30, note: "Forearm on the frame, elbow at 90°, lean gently through." },
  frontDelts: { name: "Behind-Back Clasp",           secs: 30, note: "Clasp hands behind you, lift and open the chest." },
  rearDelts:  { name: "Cross-Body Shoulder Stretch", secs: 30, note: "Pull the arm across your chest with the opposite hand. Each side." },
  biceps:     { name: "Open-Arm Biceps Stretch",     secs: 30, note: "Arm straight out behind you, palm turned up, then rotate your body away from it slowly. Each side." },
  triceps:    { name: "Overhead Triceps Stretch",    secs: 30, note: "Elbow to the sky, hand down your spine; assist gently. Each side." },
  forearms:   { name: "Kneeling Wrist Stretch",      secs: 30, note: "Palms down then palms up, rocking gently back." },
  abs:        { name: "Cobra Stretch",               secs: 30, note: "Hips on the floor, press the chest up, look slightly ahead." },
  core:       { name: "Supine Twist",                secs: 30, note: "Knees drop to one side, shoulders flat. Breathe into the twist. Each side." },
  lats:       { name: "Child's Pose Side Reach",     secs: 30, note: "Walk both hands to one side and sink back. Each side." },
  traps:      { name: "Ear-to-Shoulder Stretch",     secs: 30, note: "Let the head fall sideways; add gentle hand pressure. Each side." },
  quads:      { name: "Standing Quad Stretch",       secs: 30, note: "Heel to glute, knees together, hips forward. Steady yourself on anything solid. Each side." },
  hamstrings: { name: "Seated Forward Fold",         secs: 30, note: "Hinge from the hips with a long spine; reach for shins or toes." },
  glutes:     { name: "Figure-4 Stretch",            secs: 30, note: "Ankle over opposite knee, pull the thigh toward you. Each side." },
  calves:     { name: "Standing Calf Stretch",       secs: 30, note: "Take one foot behind you, heel pinned to the floor, and shift your weight forward over the front leg. Each side." },
};

// ── Programming rules ────────────────────────────────────────────────────────
// reps: for movements that CAN be loaded. bwReps: for movements that can't —
// you cannot make a push-up heavier, so the rep target has to move instead.
export const GOALS = {
  weightloss: { label: "Weight Loss",     icon: "Flame",    reps: [12, 15], bwReps: [15, 20], holdSecs: 35, blurb: "Higher reps, short rests — keeps your heart rate up to maximize burn." },
  muscle:     { label: "Muscle Building", icon: "Dumbbell", reps: [8, 12],  bwReps: [10, 15], holdSecs: 40, blurb: "The hypertrophy zone: moderate reps, controlled tempo, honest rest." },
  strength:   { label: "Strength",        icon: "Zap",      reps: [4, 6],   bwReps: [6, 10],  holdSecs: 30, blurb: "Heavy and crisp: low reps, long rests, bar speed over burn." },
  endurance:  { label: "Endurance",       icon: "Activity", reps: [15, 20], bwReps: [18, 25], holdSecs: 50, blurb: "Long sets and minimal rest to build work capacity." },
};

// Rest by exercise ROLE, not a flat per-goal constant. A lateral raise never
// needs the same rest as a heavy squat.
export const REST = {
  weightloss: { compound: 60,  isolation: 45, timed: 45 },
  muscle:     { compound: 90,  isolation: 60, timed: 60 },
  strength:   { compound: 165, isolation: 75, timed: 60 },
  endurance:  { compound: 45,  isolation: 30, timed: 30 },
};

export const LEVELS = {
  // maxSkill 1 = anyone on day one · 2 = needs coordination · 3 = technical or heavy.
  // A beginner is kept off barbells and single-leg work; an intermediate who has
  // trained for a year absolutely should be squatting and deadlifting.
  beginner:     { label: "Beginner",     maxSkill: 2, setsPerMuscle: 4, holdMult: 0.7, loadMult: 0.70, ladderStart: 1, blurb: "New to training, or coming back after 6+ months off." },
  intermediate: { label: "Intermediate", maxSkill: 3, setsPerMuscle: 6, holdMult: 1.0, loadMult: 1.00, ladderStart: 2, blurb: "Training consistently for 6 months to 2 years." },
  advanced:     { label: "Advanced",     maxSkill: 3, setsPerMuscle: 8, holdMult: 1.4, loadMult: 1.30, ladderStart: 3, blurb: "2+ years of structured, progressive training." },
};

export const EQUIPMENT = {
  bw:  { label: "Pure Bodyweight", icon: "PersonStanding", blurb: "No gear at all — floor, wall, and a sturdy chair." },
  min: { label: "Minimalist",      icon: "Cable",          blurb: "Bands and a pair of dumbbells at home." },
  gym: { label: "Full Gym",        icon: "Building2",      blurb: "Barbells, cables, machines — the whole floor." },
};

export const TIME_OPTIONS = [
  { mins: 20, label: "20 min", blurb: "Tight but real — two or three movements done properly." },
  { mins: 30, label: "30 min", blurb: "The sweet spot for most home sessions." },
  { mins: 45, label: "45 min", blurb: "Room for a full split with accessories." },
  { mins: 60, label: "60 min", blurb: "A complete gym session, unhurried." },
  { mins: 75, label: "75 min", blurb: "High volume. Only worth it if you recover well." },
];

// Weekly split templates — the "agenda". Chosen by how many days you train.
export const SPLITS = {
  2: { name: "Full Body ×2",      days: ["full", "full"] },
  3: { name: "Push / Pull / Legs", days: ["push", "pull", "legs"] },
  4: { name: "Upper / Lower ×2",  days: ["upper", "lower", "upper", "lower"] },
  5: { name: "PPL + Upper / Lower", days: ["push", "pull", "legs", "upper", "lower"] },
  6: { name: "Push / Pull / Legs ×2", days: ["push", "pull", "legs", "push", "pull", "legs"] },
};

// Weekly direct-set landmarks per muscle, used for the honest weekly readout.
export const WEEKLY = { low: 6, good: 10, high: 20 };
