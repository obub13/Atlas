import React, { useState } from "react";
import { ChevronRight, ChevronLeft, Check, HeartPulse, Timer, CalendarDays } from "lucide-react";
import { GOALS, LEVELS, TIME_OPTIONS, SPLITS } from "../engine/data.js";
import { GearList } from "./equipment.jsx";
import { cx, ICONS } from "./ui.jsx";

export const NumField = ({ label, unit, value, onChange, min, max }) => (
  <label className="block">
    <span className="text-xs font-semibold uppercase tracking-wider text-mute">{label}</span>
    <div className="mt-1.5 flex items-center rounded-xl bg-surface border border-line focus-within:border-ember/60">
      <input type="number" inputMode="numeric" value={value} min={min} max={max}
        onChange={(e) => onChange(e.target.value === "" ? "" : +e.target.value)}
        className="w-full bg-transparent px-4 py-3 text-lg font-semibold text-text focus:outline-none tabular-nums" />
      <span className="pr-4 text-sm text-faint">{unit}</span>
    </div>
  </label>
);

const OptionCard = ({ active, onClick, icon: Icon, title, blurb }) => (
  <button onClick={onClick}
    className={cx("w-full text-left rounded-2xl border p-4 transition-all active:scale-[0.99]",
      active ? "border-ember/70 bg-ember/10 shadow-ember" : "border-line bg-surface hover:border-edge")}>
    <div className="flex items-center gap-3">
      {Icon && (
        <span className={cx("grid place-items-center w-10 h-10 rounded-xl shrink-0", active ? "bg-ember text-ink" : "bg-raised text-mute")}>
          <Icon size={20} />
        </span>
      )}
      <div className="min-w-0">
        <p className={cx("font-display text-lg font-semibold leading-tight", active ? "text-emberSoft" : "text-text")}>{title}</p>
        <p className="text-[13px] text-mute leading-snug mt-0.5">{blurb}</p>
      </div>
      <span className={cx("ml-auto grid place-items-center w-6 h-6 rounded-full border shrink-0",
        active ? "bg-ember border-ember text-ink" : "border-edge text-transparent")}>
        <Check size={14} />
      </span>
    </div>
  </button>
);

const STEPS = ["Stats", "Level", "Goal", "Gear", "Schedule"];

export function Onboarding({ initial, onDone }) {
  const [step, setStep] = useState(0);
  const [p, setP] = useState(initial);
  const set = (k, v) => setP((prev) => ({ ...prev, [k]: v }));

  const statsValid = p.age >= 13 && p.age <= 100 && p.height >= 120 && p.height <= 230 && p.weight >= 30 && p.weight <= 250;
  const canNext = [statsValid, !!p.level, !!p.goal, p.inventory.length > 0, !!p.sessionMinutes && !!p.daysPerWeek][step];
  const last = step === STEPS.length - 1;
  const split = SPLITS[p.daysPerWeek];

  return (
    <div className="min-h-screen-safe bg-ink flex flex-col px-safe">
      <div className="w-full max-w-md mx-auto flex-1 flex flex-col px-5 pt-8 pb-6">
        <div className="flex items-center gap-2 text-ember mb-1">
          <HeartPulse size={20} />
          <span className="font-display font-bold text-xl tracking-widest uppercase">Atlas Trainer</span>
        </div>
        <div className="flex gap-1.5 my-5" role="progressbar" aria-valuenow={step + 1} aria-valuemax={STEPS.length}>
          {STEPS.map((s, i) => (
            <div key={s} className={cx("h-1 flex-1 rounded-full transition-colors", i <= step ? "bg-ember" : "bg-raised")} />
          ))}
        </div>

        <div className="flex-1">
          {step === 0 && (
            <>
              <h1 className="font-display text-4xl font-bold uppercase text-text leading-none">Your numbers</h1>
              <p className="text-mute text-sm mt-2 mb-6">
                Age sets your rest periods and volume ceiling. Bodyweight sets your starting loads. Nothing leaves this device.
              </p>
              <div className="grid grid-cols-1 gap-4">
                <NumField label="Age" unit="years" value={p.age} min={13} max={100} onChange={(v) => set("age", v)} />
                <div className="grid grid-cols-2 gap-4">
                  <NumField label="Height" unit="cm" value={p.height} min={120} max={230} onChange={(v) => set("height", v)} />
                  <NumField label="Weight" unit="kg" value={p.weight} min={30} max={250} onChange={(v) => set("weight", v)} />
                </div>
              </div>
            </>
          )}
          {step === 1 && (
            <>
              <h1 className="font-display text-4xl font-bold uppercase text-text leading-none">Training age</h1>
              <p className="text-mute text-sm mt-2 mb-6">Be honest — this decides which movements you're handed, not just how many sets.</p>
              <div className="grid gap-3">
                {Object.entries(LEVELS).map(([id, l]) => (
                  <OptionCard key={id} active={p.level === id} onClick={() => set("level", id)} title={l.label} blurb={l.blurb} />
                ))}
              </div>
            </>
          )}
          {step === 2 && (
            <>
              <h1 className="font-display text-4xl font-bold uppercase text-text leading-none">Primary goal</h1>
              <p className="text-mute text-sm mt-2 mb-6">This sets your rep ranges and rest periods.</p>
              <div className="grid gap-3">
                {Object.entries(GOALS).map(([id, g]) => (
                  <OptionCard key={id} active={p.goal === id} onClick={() => set("goal", id)} icon={ICONS[g.icon]} title={g.label} blurb={g.blurb} />
                ))}
              </div>
            </>
          )}
          {step === 3 && (
            <>
              <h1 className="font-display text-4xl font-bold uppercase text-text leading-none">Your gear</h1>
              <p className="text-mute text-sm mt-2 mb-6">
                We&rsquo;ve assumed only furniture — a wall, a chair, a table, a towel. Untick anything
                you haven&rsquo;t got, and tick the equipment you own. Routines are built from exactly
                this list and nothing else.
              </p>
              <GearList inventory={p.inventory} customGear={p.customGear} weights={p.weights || {}}
                onChange={(patch) => setP((prev) => ({ ...prev, ...patch }))} compact />
            </>
          )}
          {step === 4 && (
            <>
              <h1 className="font-display text-4xl font-bold uppercase text-text leading-none">Your week</h1>
              <p className="text-mute text-sm mt-2 mb-6">Time is the constraint every session is built around. Be realistic — a 30-minute session you actually do beats a 60-minute one you skip.</p>
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-mute mb-2">
                <Timer size={14} className="text-ember" /> Minutes per session
              </p>
              <div className="grid grid-cols-3 gap-2 mb-6">
                {TIME_OPTIONS.map((t) => (
                  <button key={t.mins} onClick={() => set("sessionMinutes", t.mins)}
                    className={cx("rounded-xl border py-3 font-display text-lg font-bold transition-all",
                      p.sessionMinutes === t.mins ? "border-ember bg-ember/10 text-emberSoft shadow-ember" : "border-line bg-surface text-mute hover:border-edge")}>
                    {t.mins}
                  </button>
                ))}
              </div>
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-mute mb-2">
                <CalendarDays size={14} className="text-ember" /> Days per week
              </p>
              <div className="grid grid-cols-5 gap-2">
                {[2, 3, 4, 5, 6].map((d) => (
                  <button key={d} onClick={() => set("daysPerWeek", d)}
                    className={cx("rounded-xl border py-3 font-display text-lg font-bold transition-all",
                      p.daysPerWeek === d ? "border-ember bg-ember/10 text-emberSoft shadow-ember" : "border-line bg-surface text-mute hover:border-edge")}>
                    {d}
                  </button>
                ))}
              </div>
              {split && (
                <p className="text-[13px] text-mute mt-4">
                  We'll plan your week as <span className="text-emberSoft font-semibold">{split.name}</span> — {p.daysPerWeek} sessions of about {p.sessionMinutes} minutes.
                </p>
              )}
            </>
          )}
        </div>

        <div className="flex gap-3 mt-8">
          {step > 0 && (
            <button onClick={() => setStep(step - 1)} aria-label="Back"
              className="rounded-xl border border-line px-5 py-3.5 text-mute hover:text-text hover:border-edge transition-colors">
              <ChevronLeft size={20} />
            </button>
          )}
          <button onClick={() => (last ? onDone(p) : setStep(step + 1))} disabled={!canNext}
            className={cx("flex-1 rounded-xl py-3.5 font-display text-lg font-bold uppercase tracking-widest transition-all inline-flex items-center justify-center gap-1.5",
              canNext ? "bg-ember text-ink hover:bg-emberSoft active:scale-[0.99] shadow-ember" : "bg-surface text-faint border border-line cursor-not-allowed")}>
            {last ? "Start training" : "Continue"} <ChevronRight size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
