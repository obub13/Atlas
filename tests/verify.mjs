// Contract: nothing the app shows may reference gear the user does not own.
import { buildWorkout, inventoryOf, available, skillProgress, reachableStages } from "../src/engine/generator.js";
import { SKILLS, SKILL_LIST, criterionLabel, stageNeeds } from "../src/engine/skills.js";
import { MUSCLES, PRESETS, EQUIP_PRESETS, LEVELS, GOALS } from "../src/engine/data.js";

// A word that appears in shown text implies owning at least one of these items.
export const IMPLIES = {
  dumbbell:    ["dumbbells"],
  kettlebell:  ["kettlebell"],
  barbell:     ["barbell"],
  plate:       ["barbell"],
  cable:       ["cable"],
  machine:     ["machines"],
  "pull-up bar": ["pullupbar"],
  "jump rope": ["rope"],
  "skipping":  ["rope"],
  towel:       ["towel"],
  table:       ["table"],
  wall:        ["wall"],
  // one elevated surface satisfies any of these words
  bench:       ["chair", "bench", "rack"],
  chair:       ["chair", "bench"],
  step:        ["chair", "bench"],
  band:        ["bands"],
};

export const KITS = {
  "nothing at all":        [],
  "kettlebell + bar":      ["kettlebell", "pullupbar"],
  "kettlebell only":       ["kettlebell"],
  "pull-up bar only":      ["pullupbar"],
  "bands only":            ["bands"],
  "dumbbells only":        ["dumbbells"],
  "furniture (bw preset)": EQUIP_PRESETS.bw,
  "home kit (min preset)": EQUIP_PRESETS.min,
  "full gym":              EQUIP_PRESETS.gym,
  "towel + chair":         ["towel", "chair"],
  "barbell, no rack":      ["barbell", "bench"],
  "machines only":         ["machines"],
};

const WORD_RE = Object.fromEntries(
  Object.keys(IMPLIES).map((w) => [w, new RegExp(`\\b${w.replace(/[-\s]/g, "[-\\s]")}s?\\b`, "i")])
);

/** Violations for one piece of displayed text against one kit. */
export function textViolations(text, inv) {
  const out = [];
  if (!text) return out;
  for (const [word, items] of Object.entries(IMPLIES)) {
    if (!WORD_RE[word].test(text)) continue;
    if (items.some((i) => inv.has(i))) continue;
    out.push({ word, items });
  }
  return out;
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  const SELECTIONS = [
    ...PRESETS.map((p) => ({ name: p.id, muscles: p.muscles })),
    ...Object.keys(MUSCLES).map((m) => ({ name: m, muscles: [m] })),
    { name: "all14", muscles: Object.keys(MUSCLES) },
  ];
  const violations = [];
  const stats = { workouts: 0, exercises: 0, emptyRoutines: 0, skillBlocks: 0, skillStages: 0, skillOnly: 0 };
  const checkText = (where, text, inv, kitName) => {
    for (const v of textViolations(text, inv)) {
      violations.push(`[${kitName}] ${where} mentions "${v.word}" but kit lacks ${v.items.join("/")} :: ${text.slice(0, 96)}`);
    }
  };

  for (const [kitName, ids] of Object.entries(KITS)) {
    for (const level of Object.keys(LEVELS)) {
      for (const goal of Object.keys(GOALS)) {
        for (const mins of [20, 45]) {
          for (const sel of SELECTIONS) {
            const skillIds = [null, ...SKILL_LIST.map((s) => s.id)];
            const chosen = skillIds[(stats.workouts + sel.name.length) % skillIds.length];
            const profile = {
              age: 30, height: 175, weight: 78, level, goal,
              equipment: "bw", inventory: ids, customGear: [],
              sessionMinutes: mins, daysPerWeek: 3, skill: chosen,
            };
            const inv = inventoryOf(profile);
            const w = buildWorkout(profile, new Set(sel.muscles), []);
            stats.workouts++;
            if (!w || (!w.exercises.length && !w.skill)) {
              stats.emptyRoutines++;
              violations.push(`[${kitName}] EMPTY routine: ${sel.name} / ${level} / ${goal} / ${mins}min / skill=${chosen}`);
              continue;
            }
            if (!w.exercises.length) stats.skillOnly++;

            for (const ex of w.exercises) {
              stats.exercises++;
              if (!available(ex, inv))
                violations.push(`[${kitName}] UNPERFORMABLE ${ex.name} needs=${JSON.stringify(ex.needs)} any=${JSON.stringify(ex.needsAny)}`);
              checkText(`exercise name "${ex.name}"`, ex.name, inv, kitName);
              checkText(`tip on ${ex.name}`, ex.tip, inv, kitName);
              checkText(`label on ${ex.name}`, ex.needsLabel, inv, kitName);
              checkText(`coach note on ${ex.name}`, ex.coachNote, inv, kitName);
              if (ex.load != null && !["dumbbells", "kettlebell", "barbell", "cable", "machines"].some((i) => inv.has(i)))
                violations.push(`[${kitName}] ${ex.name} suggests ${ex.load}kg with no loadable gear`);
            }
            for (const wu of w.warmup) {
              if (!available(wu, inv)) violations.push(`[${kitName}] UNPERFORMABLE warm-up ${wu.name}`);
              checkText(`warm-up "${wu.name}"`, wu.name + " — " + wu.note, inv, kitName);
            }
            for (const st of w.stretches) checkText(`stretch "${st.name}"`, st.name + " — " + st.note, inv, kitName);

            if (w.skill) {
              stats.skillBlocks++;
              const skill = SKILLS[w.skill.skillId];
              const stage = skill.stages.find((s) => s.name === w.skill.stageName);
              if (!stage) violations.push(`[${kitName}] skill ${skill.name} returned unknown stage ${w.skill.stageName}`);
              else if (!available(stageNeeds(skill, stage), inv))
                violations.push(`[${kitName}] UNPERFORMABLE skill stage ${skill.name} → ${stage.name}`);
              checkText(`skill stage "${w.skill.stageName}"`, w.skill.stageName, inv, kitName);
              checkText(`skill tip on ${w.skill.stageName}`, w.skill.tip, inv, kitName);
              checkText(`skill note on ${w.skill.stageName}`, w.skill.note, inv, kitName);
              if (w.estMinutes > profile.sessionMinutes + 6)
                violations.push(`[${kitName}] skill session overruns budget: ${w.estMinutes}min vs ${profile.sessionMinutes}min`);
            } else if (chosen) {
              const stagesOk = reachableStages(SKILLS[chosen], inv).length;
              if (stagesOk > 0) violations.push(`[${kitName}] skill ${chosen} is performable but was not programmed`);
            }
          }
        }
      }
    }
  }

  for (const [kitName, ids] of Object.entries(KITS)) {
    const inv = new Set(ids);
    for (const skill of SKILL_LIST) {
      for (const stage of reachableStages(skill, inv)) {
        stats.skillStages++;
        checkText(`stage name "${stage.name}" of ${skill.name}`, stage.name, inv, kitName);
        checkText(`stage tip of ${skill.name}/${stage.name}`, stage.tip, inv, kitName);
        if (!criterionLabel(stage)) violations.push(`[${kitName}] ${skill.name}/${stage.name} has no criterion`);
      }
    }
  }

  console.log(`skill coverage: ${stats.skillBlocks} programmed blocks · ${stats.skillStages} stage/kit combinations checked`);
  console.log(`checked ${stats.workouts} routines · ${stats.exercises} prescribed exercises across ${Object.keys(KITS).length} kits`);
  console.log(`empty routines: ${stats.emptyRoutines} · skill-only sessions (valid): ${stats.skillOnly}`);
  if (!violations.length) {
    console.log("\n✅ NO VIOLATIONS — nothing shown references gear the user doesn't own.");
  } else {
    const uniq = [...new Set(violations)];
    console.log(`\n❌ ${violations.length} violations (${uniq.length} distinct):\n`);
    uniq.slice(0, 40).forEach((v) => console.log("  " + v));
    process.exitCode = 1;
  }
}
