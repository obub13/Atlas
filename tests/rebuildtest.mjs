// Contract for Rebuild / Swap / Hide across the whole kit × selection matrix.
import { buildWorkout, alternativesFor, inventoryOf, available } from "../src/engine/generator.js";
import { MUSCLES, PRESETS, EQUIP_PRESETS } from "../src/engine/data.js";

let failures = 0, checks = 0;
const fail = (msg) => { failures++; if (failures <= 15) console.log("  ❌ " + msg); };
const KITS = {
  "kettlebell + bar": ["wall","chair","table","towel","kettlebell","pullupbar"],
  "bodyweight": EQUIP_PRESETS.bw, "home kit": EQUIP_PRESETS.min, "full gym": EQUIP_PRESETS.gym,
  "nothing": [],
};
const names = (w) => w.exercises.map((e) => e.id).join(",");
let rebuildChanged = 0, rebuildPossible = 0, hidden = 0;

for (const [kit, inv] of Object.entries(KITS)) {
  for (const level of ["beginner", "intermediate", "advanced"]) {
    for (const sel of [...PRESETS.map((p) => p.muscles), Object.keys(MUSCLES)]) {
      const p = { age: 30, height: 175, weight: 75, level, goal: "muscle", equipment: "bw", inventory: inv, customGear: [], sessionMinutes: 45, daysPerWeek: 3, skill: null, excluded: [] };
      const w0 = buildWorkout(p, new Set(sel), []);
      if (!w0 || !w0.exercises.length) continue;
      const w1 = buildWorkout(p, new Set(sel), [], { variant: 1 });
      checks++;
      const couldDiffer = w0.exercises.some((e) => alternativesFor(e, p, [], []).length > 0);
      if (couldDiffer) { rebuildPossible++; if (names(w1) !== names(w0)) rebuildChanged++; }
      for (const e of w1.exercises) {
        if (!sel.includes(e.primary)) fail(`[${kit}/${level}] rebuild put ${e.name} (${e.primary}) into a session that didn't ask for it`);
        if (!available(e, inventoryOf(p))) fail(`[${kit}/${level}] rebuild prescribed ${e.name} the kit can't do`);
      }
      const target = w0.exercises[0];
      const alts = alternativesFor(target, p, [], w0.exercises.map((e) => e.id));
      for (const a of alts) {
        if (a.primary !== target.primary) fail(`[${kit}] alternative ${a.name} is for ${a.primary}, not ${target.primary}`);
        if (!available(a, inventoryOf(p))) fail(`[${kit}] alternative ${a.name} needs gear the kit lacks`);
      }
      const px = { ...p, excluded: [target.id] };
      const wx = buildWorkout(px, new Set(sel), []);
      hidden++;
      if (wx.exercises.some((e) => e.id === target.id) && alts.length)
        fail(`[${kit}/${level}] hidden ${target.name} came back although ${alts.length} alternatives exist`);
      const stillTrains = wx.exercises.some((e) => e.primary === target.primary || e.secondary.includes(target.primary)) || wx.deferred.includes(target.primary) || wx.light.includes(target.primary);
      if (!stillTrains && !wx.coverage.find((c) => c.muscle === target.primary)) fail(`[${kit}/${level}] hiding ${target.name} lost ${target.primary} entirely`);
    }
  }
}
console.log(`checked ${checks} sessions across ${Object.keys(KITS).length} kits`);
console.log(`rebuild changed the session in ${rebuildChanged} of ${rebuildPossible} cases where a different option existed (${Math.round(100 * rebuildChanged / rebuildPossible)}%)`);
console.log(`hidden movements tested: ${hidden}`);
if (rebuildChanged / rebuildPossible < 0.9) fail(`rebuild changes fewer than 90% of sessions that have alternatives`);
console.log(failures ? `\n❌ ${failures} FAILURES` : "\n✅ rebuild / swap / hide contract holds");
process.exitCode = failures ? 1 : 0;
