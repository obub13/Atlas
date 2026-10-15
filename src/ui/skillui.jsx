import React from "react";
import { Target, Lock, Check, Sparkles, X, TrendingUp, Info, Timer } from "lucide-react";
import { SKILL_LIST, SKILLS, criterionLabel, stageNeeds } from "../engine/skills.js";
import { ITEM_LABEL } from "../engine/data.js";
import { skillProgress } from "../engine/generator.js";
import { cx, SectionTitle } from "./ui.jsx";

const missingFor = (skill, inv) => {
  const req = stageNeeds(skill, skill.stages[0]);
  const miss = [...(req.needs || []).filter((i) => !inv.has(i))];
  if (req.needsAny && !req.needsAny.some((i) => inv.has(i))) miss.push(req.needsAny[0]);
  return [...new Set(miss)].map((i) => ITEM_LABEL[i] || i);
};

/* ── choose the move you're chasing ───────────────────────────────────────── */
export function SkillPicker({ chosen, inv, log, onPick }) {
  return (
    <div>
      <SectionTitle icon={Target}
        aside={chosen && (
          <button onClick={() => onPick(null)} className="inline-flex items-center gap-1 text-xs text-faint hover:text-text">
            <X size={12} /> Clear
          </button>
        )}>
        Skill goal
      </SectionTitle>
      <p className="text-xs text-faint mb-3 -mt-1">
        Pick a move to master. It gets practised first every session, while you&rsquo;re fresh.
      </p>
      <div className="flex flex-col gap-2">
        {SKILL_LIST.map((skill) => {
          const missing = missingFor(skill, inv);
          const locked = missing.length > 0;
          const prog = locked ? null : skillProgress(skill.id, log, inv);
          const active = chosen === skill.id;
          return (
            <button key={skill.id} onClick={() => !locked && onPick(active ? null : skill.id)}
              disabled={locked} aria-pressed={active}
              className={cx("w-full text-left rounded-xl border px-3.5 py-3 transition-all",
                locked ? "border-line bg-well opacity-60 cursor-not-allowed"
                : active ? "border-ember/70 bg-ember/10 shadow-ember"
                : "border-line bg-surface hover:border-edge active:scale-[0.99]")}>
              <div className="flex items-center gap-2.5">
                <span className={cx("grid place-items-center w-7 h-7 rounded-lg shrink-0",
                  active ? "bg-ember text-ink" : locked ? "bg-raised text-faint" : "bg-raised text-emberSoft")}>
                  {locked ? <Lock size={13} /> : active ? <Check size={14} /> : <Sparkles size={13} />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className={cx("font-display text-base font-semibold leading-tight",
                    active ? "text-emberSoft" : locked ? "text-faint" : "text-text")}>
                    {skill.name}
                  </p>
                  <p className="text-[12px] text-mute leading-snug mt-0.5">{skill.blurb}</p>
                </div>
                {!locked && prog && (
                  <span className="shrink-0 text-[11px] text-faint tabular-nums">{prog.index + 1}/{prog.stages.length}</span>
                )}
              </div>
              {locked && <p className="text-[11px] text-amberGold mt-1.5 pl-9">Needs {missing.join(" + ")}</p>}
              {!locked && prog && (
                <div className="mt-2 pl-9">
                  <div className="flex gap-1">
                    {prog.stages.map((_, i) => (
                      <span key={i} className={cx("h-1 flex-1 rounded-full",
                        i <= prog.index ? (active ? "bg-ember" : "bg-edge") : "bg-raised")} />
                    ))}
                  </div>
                  <p className="text-[11px] text-mute mt-1">{prog.stage.name}</p>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ── the practice block, first thing after the warm-up ────────────────────── */
export function SkillBlock({ skill, doneSets, onToggleSet, onRest, feel, onFeel }) {
  if (!skill) return null;
  const allDone = doneSets.size === skill.sets;
  const FEELS = [
    { id: "easy",  label: "Easy",  hint: "Clean, room to spare" },
    { id: "right", label: "Right", hint: "Hit it, only just" },
    { id: "hard",  label: "Hard",  hint: "Missed the target" },
  ];
  return (
    <section>
      <SectionTitle icon={Target} aside={<span className="text-xs text-faint">stage {skill.stageIndex + 1} of {skill.stageCount}</span>}>
        Skill practice
      </SectionTitle>
      <article className={cx("min-w-0 rounded-2xl border p-4", feel ? "border-mint/40 bg-mint/5" : "border-ember/40 bg-ember/[0.06]")}>
        <div className="flex items-baseline justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-widest text-emberSoft">{skill.name}</p>
            <h4 className="font-display text-xl font-bold text-text leading-tight">{skill.stageName}</h4>
          </div>
          <span className="shrink-0 rounded-lg bg-raised border border-line px-2.5 py-1 text-[13px] font-semibold text-text tabular-nums">
            {skill.sets} × {skill.target}
          </span>
        </div>
        {skill.promoted ? (
          <p className="text-[13px] text-mint leading-snug flex gap-1.5 mt-2.5">
            <TrendingUp size={14} className="shrink-0 mt-0.5" aria-hidden /><span>{skill.note}</span>
          </p>
        ) : (
          <p className="text-[13px] text-mute leading-snug mt-2.5">{skill.note}</p>
        )}
        <div className="flex items-center gap-2 mt-3.5 flex-wrap">
          {skill.setsArr.map((_, i) => {
            const isDone = doneSets.has(i);
            return (
              <button key={i} onClick={() => onToggleSet(i)} aria-pressed={isDone} aria-label={`Skill set ${i + 1}`}
                className={cx("w-11 h-11 rounded-xl border font-semibold text-sm transition-all active:scale-95 grid place-items-center",
                  isDone ? "bg-ember border-ember text-ink shadow-ember" : "bg-raised border-line text-mute hover:border-ember/50 hover:text-text")}>
                {isDone ? <Check size={17} /> : i + 1}
              </button>
            );
          })}
          <button onClick={onRest}
            className="ml-auto shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-line bg-raised px-3 py-1.5 text-[13px] font-semibold text-sky hover:border-sky/50">
            <Timer size={14} /> {skill.rest}s
          </button>
        </div>
        <p className="text-[13px] text-mute leading-snug flex gap-1.5 mt-3">
          <Info size={14} className="text-sky shrink-0 mt-0.5" aria-hidden /><span>{skill.tip}</span>
        </p>
        {allDone && (
          <div className="mt-4 pt-3.5 border-t border-line">
            <p className="text-[11px] uppercase tracking-widest text-faint mb-2">
              {feel ? "Logged — next session is set" : `Did you hit ${skill.target}?`}
            </p>
            <div className="grid grid-cols-3 gap-2">
              {FEELS.map((f) => (
                <button key={f.id} onClick={() => onFeel(f.id)} title={f.hint}
                  className={cx("rounded-xl border py-2 px-1 transition-all active:scale-[0.98]",
                    feel === f.id ? "border-mint bg-mint/15 text-mint" : "border-line bg-raised text-mute hover:border-edge hover:text-text")}>
                  <span className="block font-display text-base font-bold">{f.label}</span>
                  <span className="block text-[10px] leading-tight mt-0.5 opacity-80">{f.hint}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </article>
      <p className="text-xs text-faint mt-2">{skill.frequency}</p>
    </section>
  );
}

/* ── the full ladder, on the week screen ──────────────────────────────────── */
export function SkillLadder({ skillId, inv, log }) {
  const prog = skillId ? skillProgress(skillId, log, inv) : null;
  if (!prog || prog.locked) return null;
  const skill = SKILLS[skillId];
  return (
    <section>
      <SectionTitle icon={Target}>Skill: {skill.name}</SectionTitle>
      <p className="text-[13px] text-mute mb-3 -mt-1">{skill.coaching}</p>
      <ol className="flex flex-col gap-2">
        {prog.stages.map((st, i) => {
          const done = i < prog.index;
          const current = i === prog.index;
          return (
            <li key={st.name}
              className={cx("min-w-0 flex items-start gap-3 rounded-xl border px-4 py-3",
                current ? "border-ember/60 bg-ember/10" : done ? "border-line bg-well" : "border-line bg-surface")}>
              <span className={cx("grid place-items-center w-6 h-6 rounded-md shrink-0 mt-0.5 text-[11px] font-bold",
                done ? "bg-mint/20 text-mint" : current ? "bg-ember text-ink" : "bg-raised text-faint")}>
                {done ? <Check size={13} /> : i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className={cx("text-sm font-semibold", current ? "text-emberSoft" : done ? "text-mute" : "text-text")}>{st.name}</p>
                <p className="text-xs text-mute mt-0.5">{st.tip}</p>
              </div>
              <span className="shrink-0 text-[12px] font-semibold text-faint tabular-nums">{criterionLabel(st)}</span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
