import React, { useState, useMemo } from "react";
import { Check, Plus, X, Package, AlertTriangle, Sparkles } from "lucide-react";
import { ITEMS, ITEM_GROUPS, EQUIP_PRESETS, EXERCISES, MUSCLES } from "../engine/data.js";
import { available, BELL_SIZES } from "../engine/generator.js";
import { cx } from "./ui.jsx";

const KITS = [
  { id: "bw",  label: "Bodyweight", blurb: "Floor, wall, a chair" },
  { id: "min", label: "Home kit",   blurb: "Bands and dumbbells too" },
  { id: "gym", label: "Full gym",   blurb: "Everything on the floor" },
];

/** What this kit can and can't reach — shown live as boxes get ticked. */
export function kitCoverage(inventory, customGear = []) {
  const inv = new Set([...inventory, ...customGear.map((g) => g.actsAs).filter(Boolean)]);
  const movements = EXERCISES.filter((e) => available(e, inv));
  const gaps = Object.keys(MUSCLES).filter((m) => !movements.some((e) => e.primary === m));
  return { count: movements.length, gaps, inv };
}

const WEIGHT_ITEMS = {
  kettlebell: { title: "Which bells do you have?", sizes: BELL_SIZES, hint: "Workouts only ask for bells you own. When you outgrow the heaviest, reps and tempo take over." },
  dumbbells:  { title: "Which dumbbells do you have?", sizes: [1, 2, 2.5, 3, 4, 5, 6, 7.5, 8, 10, 12, 12.5, 14, 15, 16, 17.5, 20, 22.5, 25, 27.5, 30, 32.5, 35, 40], hint: "Pairs, kg each. Leave empty for adjustable dumbbells — any weight can be suggested." },
};

/** Tap the weights you own; the generator only prescribes those. */
export function WeightPicker({ item, values = [], onChange }) {
  const cfg = WEIGHT_ITEMS[item];
  const [draft, setDraft] = useState("");
  const set = new Set(values.map(Number));
  const toggle = (w) => onChange([...(set.has(w) ? [...set].filter((x) => x !== w) : [...set, w])].sort((a, b) => a - b));
  const sizes = [...new Set([...cfg.sizes, ...set])].sort((a, b) => a - b);
  const add = () => { const w = +String(draft).replace(",", "."); if (w > 0 && w <= 200) { if (!set.has(w)) toggle(w); setDraft(""); } };
  return (
    <div className="rounded-xl border border-line bg-well p-3" data-testid={`weights-${item}`}>
      <p className="text-[12px] font-semibold text-text">{cfg.title} <span className="font-normal text-faint">(kg)</span></p>
      <div className="flex flex-wrap gap-1.5 mt-2">
        {sizes.map((w) => (
          <button key={w} type="button" onClick={() => toggle(w)} aria-pressed={set.has(w)} aria-label={`${w} kg ${item}`}
            className={cx("min-w-[40px] rounded-lg border px-2 py-1 text-[12px] font-semibold tabular-nums",
              set.has(w) ? "border-ember bg-ember/15 text-emberSoft" : "border-line text-faint hover:text-mute")}>
            {w}
          </button>
        ))}
        <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
          inputMode="decimal" placeholder="other" aria-label={`Add another ${item} weight`}
          className="w-16 rounded-lg bg-surface border border-line px-2 py-1 text-base sm:text-[12px] text-text placeholder:text-faint focus:outline-none focus:border-ember/60" />
      </div>
      <p className="text-[11px] text-faint mt-2">{set.size ? `You own: ${[...set].sort((a, b) => a - b).join(", ")} kg. ` : ""}{cfg.hint}</p>
    </div>
  );
}

export function GearList({ inventory, customGear, onChange, compact, weights = {} }) {
  const [draft, setDraft] = useState("");
  const [actsAs, setActsAs] = useState("");
  const owned = useMemo(() => new Set(inventory), [inventory]);
  const { count, gaps } = useMemo(() => kitCoverage(inventory, customGear), [inventory, customGear]);

  const toggle = (id) => {
    const next = owned.has(id) ? inventory.filter((i) => i !== id) : [...inventory, id];
    onChange({ inventory: next });
  };
  const applyKit = (id) => onChange({ inventory: [...EQUIP_PRESETS[id]], equipment: id });

  const addCustom = () => {
    const label = draft.trim();
    if (!label) return;
    onChange({ customGear: [...customGear, { id: `c${Date.now()}`, label, actsAs: actsAs || null }] });
    setDraft(""); setActsAs("");
  };
  const removeCustom = (id) => onChange({ customGear: customGear.filter((g) => g.id !== id) });

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-mute mb-2">Start from a kit</p>
        <p className="text-xs text-faint mb-2">These replace your whole list — they don&rsquo;t add to it.</p>
        <div className="grid grid-cols-3 gap-2">
          {KITS.map((k) => {
            const isActive = EQUIP_PRESETS[k.id].length === inventory.length &&
              EQUIP_PRESETS[k.id].every((i) => owned.has(i));
            return (
              <button key={k.id} onClick={() => applyKit(k.id)}
                className={cx("rounded-xl border px-2 py-2.5 text-left transition-all active:scale-[0.99]",
                  isActive ? "border-ember/70 bg-ember/10" : "border-line bg-surface hover:border-edge")}>
                <span className={cx("block font-display text-sm font-bold leading-tight", isActive ? "text-emberSoft" : "text-text")}>{k.label}</span>
                <span className="block text-[11px] text-mute leading-tight mt-0.5">{k.blurb}</span>
              </button>
            );
          })}
        </div>
      </div>

      {ITEM_GROUPS.map((group) => (
        <div key={group}>
          <p className="text-xs font-semibold uppercase tracking-wider text-mute mb-2">{group}</p>
          <div className={cx("grid gap-2", compact ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2")}>
            {ITEMS.filter((i) => i.group === group).map((item) => {
              const on = owned.has(item.id);
              return (
                <button key={item.id} onClick={() => toggle(item.id)} aria-pressed={on}
                  className={cx("flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-colors",
                    on ? "border-ember/60 bg-ember/10" : "border-line bg-surface hover:border-edge")}>
                  <span className={cx("grid place-items-center w-5 h-5 rounded-md border shrink-0",
                    on ? "bg-ember border-ember text-ink" : "border-edge text-transparent")}>
                    <Check size={13} />
                  </span>
                  <span className={cx("text-sm", on ? "text-text font-medium" : "text-mute")}>{item.label}</span>
                  {on && WEIGHT_ITEMS[item.id] && (weights[item.id] || []).length > 0 && (
                    <span className="ml-auto text-[11px] text-faint tabular-nums">{weights[item.id].join(" · ")} kg</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {Object.keys(WEIGHT_ITEMS).filter((id) => owned.has(id)).map((id) => (
        <WeightPicker key={id} item={id} values={weights[id] || []}
          onChange={(list) => onChange({ weights: { ...weights, [id]: list } })} />
      ))}

      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-mute mb-2">Anything else</p>
        {customGear.length > 0 && (
          <ul className="flex flex-col gap-2 mb-2">
            {customGear.map((g) => (
              <li key={g.id} className="flex items-center gap-2 rounded-xl bg-surface border border-line px-3 py-2">
                <Package size={14} className="text-emberSoft shrink-0" aria-hidden />
                <span className="text-sm text-text flex-1 min-w-0 truncate">{g.label}</span>
                <span className="text-[11px] text-faint shrink-0">
                  {g.actsAs ? `used as ${ITEMS.find((i) => i.id === g.actsAs)?.label.toLowerCase()}` : "note only"}
                </span>
                <button onClick={() => removeCustom(g.id)} aria-label={`Remove ${g.label}`}
                  className="shrink-0 text-faint hover:text-text"><X size={14} /></button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-col gap-2">
          <input value={draft} onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustom(); } }}
            placeholder="Sandbag, TRX straps, ab wheel…" aria-label="Add your own equipment"
            className="w-full rounded-xl bg-surface border border-line px-3 py-2.5 text-sm text-text placeholder:text-faint focus:outline-none focus:border-ember/60" />
          <div className="flex gap-2">
            <select value={actsAs} onChange={(e) => setActsAs(e.target.value)} aria-label="What it works like"
              className="flex-1 min-w-0 rounded-xl bg-surface border border-line px-3 py-2.5 text-sm text-mute focus:outline-none focus:border-ember/60">
              <option value="">Just a note — don't build with it</option>
              {ITEMS.map((i) => <option key={i.id} value={i.id}>Works like: {i.label}</option>)}
            </select>
            <button onClick={addCustom} disabled={!draft.trim()}
              className={cx("shrink-0 inline-flex items-center gap-1 rounded-xl px-4 py-2.5 text-sm font-bold transition-colors",
                draft.trim() ? "bg-ember text-ink hover:bg-emberSoft" : "bg-surface text-faint border border-line cursor-not-allowed")}>
              <Plus size={15} /> Add
            </button>
          </div>
          <p className="text-xs text-faint">
            Tell us what a piece of kit stands in for and routines will use it. Left as a note, it&rsquo;s just for your own reference.
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-line bg-well p-3.5 flex flex-col gap-2">
        <p className="text-[13px] text-mute flex gap-2">
          <Sparkles size={14} className="text-emberSoft shrink-0 mt-0.5" aria-hidden />
          <span>Your kit unlocks <span className="text-text font-semibold tabular-nums">{count}</span> of {EXERCISES.length} movements.</span>
        </p>
        {gaps.length > 0 && (
          <p className="text-[13px] text-mute flex gap-2">
            <AlertTriangle size={14} className="text-amberGold shrink-0 mt-0.5" aria-hidden />
            <span>
              Nothing here trains{" "}
              <span className="text-text font-semibold">{gaps.map((g) => MUSCLES[g].label).join(", ")}</span> directly.
              Tick one more item, or leave {gaps.length > 1 ? "them" : "it"} out of your sessions.
            </span>
          </p>
        )}
      </div>
    </div>
  );
}
