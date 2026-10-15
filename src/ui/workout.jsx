import React, { useState } from "react";
import {
  Check, Anchor, Minus, Plus, Timer, TrendingUp, Info, ArrowLeftRight, X, ChevronRight, EyeOff,
  AlertTriangle, Clock, Package, RotateCcw, Trophy, Repeat, Sparkles, Flame, Dumbbell, Wind, Zap,
} from "lucide-react";
import { MUSCLES, GOALS } from "../engine/data.js";
import { cx, fmtTime, SectionTitle } from "./ui.jsx";

const FEELS = [
  { id: "easy",  label: "Easy",  hint: "3+ reps left in the tank" },
  { id: "right", label: "Right", hint: "1–2 reps left" },
  { id: "hard",  label: "Hard",  hint: "Nothing left, or form broke" },
];
const RELATION = { easier: "easier rung", harder: "harder rung", similar: "similar", bigger: "bigger movement", lighter: "lighter movement" };

/* ── one exercise: prescription, load stepper, set ticks, swap, feel ──────── */
function ExerciseCard({ ex, index, doneSets, onToggleSet, onLoad, onRest, feel, onFeel,
  swapOpen, alternatives, onSwapToggle, onSwap, onHide, circuit }) {
  const complete = doneSets.size === ex.sets;
  const target = ex.holdSecs ? `${ex.holdSecs}s hold` : `${ex.reps[0]}–${ex.reps[1]} reps`;
  const step = ex.loadUnit === "perHand" ? 2.5 : 5;

  return (
    <article className={cx("min-w-0 rounded-2xl border p-4 transition-colors",
      feel ? "border-mint/40 bg-mint/5" : complete ? "border-ember/40 bg-ember/5" : "border-line bg-surface")}>
      <div className="flex items-start gap-3">
        <span className={cx("grid place-items-center w-8 h-8 rounded-lg font-display font-bold text-base shrink-0 mt-0.5",
          feel ? "bg-mint/20 text-mint" : "bg-raised text-emberSoft")}>
          {feel ? <Check size={16} /> : index + 1}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <h4 className="font-display text-lg font-semibold text-text leading-tight">{ex.name}</h4>
            <span className="text-[11px] uppercase tracking-wider text-faint shrink-0 text-right">{ex.needsLabel}</span>
          </div>
          <p className="text-xs text-mute mt-0.5">
            {[ex.primary, ...ex.secondary].filter((m) => MUSCLES[m]).map((m) => MUSCLES[m].label).join(" · ")}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 mt-3">
        <span className="rounded-lg bg-raised border border-line px-2.5 py-1 text-[13px] font-semibold text-text tabular-nums">
          {circuit ? `${target} per round` : `${ex.sets} × ${target}`}
        </span>
        {ex.role === "anchor" && !circuit && (
          <span className="inline-flex items-center gap-1 rounded-lg border border-line px-2 py-1 text-[11px] uppercase tracking-wider text-faint">
            <Anchor size={11} /> Anchor
          </span>
        )}
        {ex.deload && (
          <span className="rounded-lg border border-amberGold/40 bg-amberGold/10 px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-amberGold">Deload</span>
        )}
        {ex.loadable && (
          <div className="ml-auto flex items-center gap-1 rounded-xl bg-raised border border-line px-1 py-1">
            <button onClick={() => onLoad(-step)} aria-label={`Less weight on ${ex.name}`}
              className="w-8 h-8 grid place-items-center rounded-lg text-mute hover:text-text hover:bg-line/50"><Minus size={14} /></button>
            <span className="text-[13px] font-semibold text-text tabular-nums min-w-[70px] text-center">
              {ex.load != null ? `${ex.load} kg` : "—"}
              <span className="block text-[9px] uppercase tracking-wider text-faint leading-none">{ex.loadUnit === "perHand" ? "each" : "total"}</span>
            </span>
            <button onClick={() => onLoad(step)} aria-label={`More weight on ${ex.name}`}
              className="w-8 h-8 grid place-items-center rounded-lg text-mute hover:text-text hover:bg-line/50"><Plus size={14} /></button>
          </div>
        )}
      </div>

      {ex.coachNote && (
        <p className="text-[13px] text-emberSoft/90 leading-snug flex gap-1.5 mt-3">
          <TrendingUp size={14} className="shrink-0 mt-0.5" aria-hidden /><span>{ex.coachNote}</span>
        </p>
      )}

      <div className="flex items-center gap-2 mt-3.5 flex-wrap">
        {ex.setsArr.map((_, i) => {
          const on = doneSets.has(i);
          return (
            <button key={i} onClick={() => onToggleSet(i)} aria-pressed={on} aria-label={`Set ${i + 1} of ${ex.name}`}
              title={circuit ? `Round ${i + 1}` : undefined}
              className={cx("w-11 h-11 rounded-xl border font-semibold text-sm transition-all active:scale-95 grid place-items-center",
                on ? "bg-ember border-ember text-ink shadow-ember" : "bg-raised border-line text-mute hover:border-ember/50 hover:text-text")}>
              {on ? <Check size={17} /> : i + 1}
            </button>
          );
        })}
        <div className="ml-auto flex items-center gap-1.5 shrink-0">
          {!feel && (
            <button onClick={onSwapToggle} aria-expanded={swapOpen} aria-label={`Swap ${ex.name} for another movement`}
              className={cx("inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[13px] font-semibold transition-colors",
                swapOpen ? "border-ember/60 bg-ember/10 text-emberSoft" : "border-line bg-raised text-mute hover:text-text hover:border-edge")}>
              <ArrowLeftRight size={14} /> Swap
            </button>
          )}
          <button onClick={() => onRest(ex)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-raised px-3 py-1.5 text-[13px] font-semibold text-sky hover:border-sky/50 transition-colors">
            <Timer size={14} /> {ex.rest}s
          </button>
        </div>
      </div>

      {swapOpen && (
        <div className="mt-3 rounded-xl border border-ember/30 bg-well p-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[11px] uppercase tracking-widest text-faint">Instead of {ex.name}</p>
            <button onClick={onSwapToggle} aria-label="Close" className="text-faint hover:text-text"><X size={14} /></button>
          </div>
          {alternatives.length === 0 ? (
            <p className="text-[13px] text-mute">Nothing else in your kit trains {MUSCLES[ex.primary]?.label} — add gear in your profile to unlock more.</p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {alternatives.slice(0, 4).map((a) => (
                <button key={a.id} onClick={() => onSwap(a.id)}
                  className="w-full text-left flex items-center gap-2.5 rounded-lg border border-line bg-surface hover:border-ember/50 px-3 py-2 transition-colors">
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-text truncate">{a.name}</span>
                    <span className="block text-[11px] text-mute">{RELATION[a.relation]} · {a.needsLabel}</span>
                  </span>
                  <ChevronRight size={15} className="text-faint shrink-0" />
                </button>
              ))}
            </div>
          )}
          <button onClick={onHide}
            className="mt-2.5 w-full inline-flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-line px-3 py-2 text-[12px] font-semibold text-mute hover:text-crit hover:border-crit/40">
            <EyeOff size={13} /> I can’t do {ex.name} — never suggest it again
          </button>
        </div>
      )}

      <p className="text-[13px] text-mute leading-snug flex gap-1.5 mt-3">
        <Info size={14} className="text-sky shrink-0 mt-0.5" aria-hidden /><span>{ex.tip}</span>
      </p>

      {complete && (
        <div className="mt-4 pt-3.5 border-t border-line">
          <p className="text-[11px] uppercase tracking-widest text-faint mb-2">
            {feel ? "Logged — next session is set" : "How did that feel?"}
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
  );
}

/* ── how many full rounds of a circuit are done ─────────────────────────────── */
export function roundsDone(workout, done) {
  if (!workout || !workout.exercises.length) return 0;
  let r = 0;
  while (r < workout.rounds && workout.exercises.every((_, i) => done.has(`${i}:${r}`))) r++;
  return r;
}

/* ── the session: summary, notes, warm-up, work, cool-down ──────────────────── */
export function WorkoutPanel({ workout, done, onToggleSet, onLoad, onRest, feels, onFeel, onRegenerate,
  onNewSelection, onRepeat, skillSlot, stale, alternativesFor, onSwap, onHide, mode = "plan", onRoundRest, onFinish, nextDay }) {
  const [swapIdx, setSwapIdx] = useState(null);
  const quick = mode === "quick";

  if (!workout) {
    return (
      <div className="h-full min-h-[300px] grid place-items-center rounded-2xl border border-dashed border-line">
        <div className="text-center px-6 py-10">
          <Dumbbell size={34} className="mx-auto text-faint mb-3" aria-hidden />
          <h3 className="font-display text-2xl font-semibold uppercase text-mute">No routine yet</h3>
          <p className="text-sm text-faint mt-1.5 max-w-[260px]">
            Pick your muscles and how long you've got, then hit <span className="text-emberSoft font-semibold">Build my routine</span>.
          </p>
        </div>
      </div>
    );
  }

  const w = workout;
  const circuit = w.format === "circuit";
  const goal = GOALS[w.goal];
  const total = w.totalSets + (w.skill ? w.skill.sets : 0);
  const doneCount = w.exercises.reduce((t, ex, i) => t + ex.setsArr.filter((_, s) => done.has(`${i}:${s}`)).length, 0)
    + (w.skill ? [...done].filter((k) => k.startsWith("skill:")).length : 0);
  const pct = total > 0 ? Math.round((doneCount / total) * 100) : 0;
  const allRated = (w.exercises.length > 0 || !!w.skill) && w.exercises.every((_, i) => feels[i]) && (!w.skill || !!feels.skill);
  const logged = allRated || !!w.finished;
  const canFinish = !logged && doneCount > 0 && !!onFinish;
  const trainedLabels = w.trained.map((m) => MUSCLES[m].label);
  const indirect = w.coverage.filter((c) => c.status === "indirect");
  const rounds = circuit ? roundsDone(w, done) : 0;

  const title = quick
    ? w.focusLabel
    : w.label || (trainedLabels.length ? trainedLabels.slice(0, 3).join(" · ") : w.skill ? w.skill.name : "Session");
  const stats = [
    [`~${w.estMinutes}`, `of ${w.budgetMinutes} min`],
    [w.exercises.length, "exercises"],
    circuit ? [w.rounds, "rounds"] : [total, "total sets"],
  ];

  return (
    <div className="flex flex-col gap-6 pb-4">
      {stale && (
        <div className="rounded-2xl border border-amberGold/50 bg-amberGold/10 p-4">
          <p className="text-[13px] text-text flex gap-2">
            <AlertTriangle size={15} className="text-amberGold shrink-0 mt-0.5" />
            <span><span className="font-semibold">This session no longer matches your selection.</span>{" "}
              You’ve already logged sets here, so it hasn’t been replaced — rebuild when you’re ready.</span>
          </p>
          <button onClick={onRegenerate}
            className="mt-3 w-full rounded-xl bg-amberGold/20 border border-amberGold/50 py-2.5 text-sm font-bold text-amberGold hover:bg-amberGold/30">
            Rebuild for the new selection
          </button>
        </div>
      )}

      <div className="rounded-2xl bg-gradient-to-br from-raised to-surface border border-line p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-widest text-faint">
              {quick ? "Single session · not part of your plan"
                : w.dayCount ? <>Day {w.dayIndex + 1} of {w.dayCount} · block {w.block.index + 1}, week {w.block.week}</>
                : <>Today’s session · block {w.block.index + 1}, week {w.block.week}</>}
            </p>
            <h2 className="font-display text-2xl font-bold uppercase text-text leading-tight">
              {title}

            </h2>
          </div>
          <button onClick={onRegenerate} title="Rebuild with different movements" aria-label="Rebuild with different movements"
            className="inline-flex items-center gap-1.5 rounded-xl bg-raised border border-line px-3 py-2 text-[12px] font-semibold text-mute hover:text-emberSoft hover:border-ember/50 transition-colors shrink-0">
            <RotateCcw size={14} /> {quick ? "Shuffle" : "Rebuild"}
          </button>
        </div>
        <div className="grid grid-cols-3 gap-2 mt-4 text-center">
          {stats.map(([v, l]) => (
            <div key={l} className="rounded-xl bg-ink/60 border border-line py-2">
              <p className="font-display text-xl font-bold text-emberSoft tabular-nums">{v}</p>
              <p className="text-[11px] uppercase tracking-wider text-faint">{l}</p>
            </div>
          ))}
        </div>
        <div className="mt-4">
          <div className="flex justify-between text-[11px] uppercase tracking-wider text-faint mb-1.5">
            <span>{goal.label} · {circuit ? "circuit" : "rest scaled per movement"}</span>
            <span className="tabular-nums">{pct}%</span>
          </div>
          <div className="h-2 rounded-full bg-ink overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full rounded-full bg-gradient-to-r from-emberDeep to-ember transition-all duration-300" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </div>

      {!quick && w.variant > 0 && (
        <p className="text-[13px] text-mute flex gap-2 -mt-2">
          <RotateCcw size={14} className="text-emberSoft shrink-0 mt-0.5" />
          <span>Rebuilt with different movements (option {w.variant + 1}). Your usual anchor lifts come back next session so progress keeps tracking — if there’s one you can’t do, use <span className="text-text font-semibold">Swap → never suggest it again</span> on its card.</span>
        </p>
      )}

      {circuit && w.exercises.length > 0 && (
        <div className="rounded-2xl border border-sky/40 bg-sky/[0.07] p-4" data-testid="circuit-card">
          <div className="flex items-center justify-between gap-3">
            <p className="font-display text-lg font-bold uppercase tracking-wide text-text flex items-center gap-2">
              <Repeat size={16} className="text-sky" aria-hidden /> Circuit · {w.rounds} rounds
            </p>
            <span className="text-[13px] font-semibold text-sky tabular-nums shrink-0">{rounds}/{w.rounds} done</span>
          </div>
          <p className="text-[13px] text-mute mt-1.5">
            One set of each move back-to-back, {w.circuitRest}s between moves, {w.roundRest}s after each round.
            Tick a move’s set as you finish it — the timer picks the right rest for you.
          </p>
          <div className="flex gap-1 mt-3" aria-hidden>
            {Array.from({ length: w.rounds }, (_, r) => (
              <span key={r} className={cx("h-1.5 flex-1 rounded-full", r < rounds ? "bg-sky" : "bg-raised")} />
            ))}
          </div>
          <button onClick={onRoundRest}
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-sky/40 bg-sky/10 px-3 py-1.5 text-[13px] font-semibold text-sky hover:bg-sky/20">
            <Timer size={14} /> Rest between rounds · {w.roundRest}s
          </button>
        </div>
      )}

      {(w.deferred.length > 0 || w.light.length > 0 || w.oversubscribed || indirect.length > 0 || w.ageNote || w.balance || w.ceilingNote) && (
        <div className="rounded-2xl border border-line bg-surface p-4 flex flex-col gap-2.5">
          {w.ceilingNote && (
            <p className="text-[13px] text-mute flex gap-2">
              <Info size={14} className="text-sky shrink-0 mt-0.5" /><span>{w.ceilingNote}</span>
            </p>
          )}
          {w.oversubscribed && !quick && (
            <p className="text-[13px] text-mute flex gap-2">
              <AlertTriangle size={14} className="text-amberGold shrink-0 mt-0.5" />
              <span><span className="text-text font-semibold">{w.budgetMinutes} minutes realistically covers about {w.capacityAreas} area{w.capacityAreas === 1 ? "" : "s"}</span>, and this day has {w.muscles.length}. So today is the movements that cover the most ground — your week view shows what each area gets overall.</span>
            </p>
          )}
          {indirect.length > 0 && (
            <p className="text-[13px] text-mute flex gap-2">
              <Check size={14} className="text-mint shrink-0 mt-0.5" />
              <span><span className="text-text font-semibold">{indirect.map((c) => MUSCLES[c.muscle].label).join(", ")}</span>{" "}
                got enough work from your compounds — no separate exercise needed today.</span>
            </p>
          )}
          {w.light.length > 0 && (
            <p className="text-[13px] text-mute flex gap-2">
              <Info size={14} className="text-sky shrink-0 mt-0.5" />
              <span><span className="text-text font-semibold">{w.light.map((m) => MUSCLES[m].label).join(", ")}</span>{" "}
                got some work from these compounds, but not enough to call it trained.</span>
            </p>
          )}
          {w.outOfTime.length > 0 && (
            <p className="text-[13px] text-mute flex gap-2">
              <Clock size={14} className="text-amberGold shrink-0 mt-0.5" />
              <span><span className="text-text font-semibold">{w.outOfTime.map((m) => MUSCLES[m].label).join(", ")}</span>{" "}
                {quick
                  ? <>didn’t fit in {w.budgetMinutes} minutes. Pick a longer session if you want them in.</>
                  : <>didn’t fit in {w.budgetMinutes} minutes today. A bit more time per session, or one more day a week, gets {w.outOfTime.length > 1 ? "them" : "it"} in.</>}
              </span>
            </p>
          )}
          {w.noGear.length > 0 && (
            <p className="text-[13px] text-mute flex gap-2">
              <Package size={14} className="text-amberGold shrink-0 mt-0.5" />
              <span>Nothing in your kit trains{" "}
                <span className="text-text font-semibold">{w.noGear.map((m) => MUSCLES[m].label).join(", ")}</span>{" "}
                directly. Add gear in your profile, or leave {w.noGear.length > 1 ? "them" : "it"} out.</span>
            </p>
          )}
          {w.balance && !quick && (
            <p className="text-[13px] text-mute flex gap-2">
              <AlertTriangle size={14} className="text-amberGold shrink-0 mt-0.5" /><span>{w.balance.note}</span>
            </p>
          )}
          {w.ageNote && (
            <p className="text-[13px] text-mute flex gap-2">
              <Info size={14} className="text-sky shrink-0 mt-0.5" /><span>{w.ageNote}</span>
            </p>
          )}
        </div>
      )}

      {logged && (
        <div className="rounded-2xl border border-mint/40 bg-mint/10 p-5 text-center">
          <Trophy size={30} className="mx-auto text-mint mb-2" aria-hidden />
          <h3 className="font-display text-2xl font-bold uppercase text-mint">Session logged</h3>
          <p className="text-sm text-mute mt-1">
            {quick
              ? `${doneCount} sets saved to your history. It counts toward your volume and your lifts’ progress — not toward your weekly plan.`
              : allRated
                ? `${total} sets across ${w.exercises.length} exercises. Next time these lifts will come back with new targets.`
                : `${doneCount} sets saved. Moves you rated will come back with new targets; the rest repeat as they were.`}
          </p>
          <div className="flex gap-2 justify-center mt-4 flex-wrap">
            <button onClick={onRepeat}
              className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-surface px-4 py-2.5 text-sm font-semibold text-text hover:border-edge">
              <Repeat size={15} /> Clear ticks
            </button>
            <button onClick={onNewSelection}
              className="inline-flex items-center gap-1.5 rounded-xl bg-ember px-4 py-2.5 text-sm font-bold text-ink hover:bg-emberSoft">
              {quick ? <Zap size={15} /> : <Sparkles size={15} />} {quick ? "Another session" : nextDay ? `Up next: ${nextDay.label}` : "Week done"}
            </button>
          </div>
        </div>
      )}

      <section>
        <SectionTitle icon={Flame}>
          Warm-up{" "}
          <span className="text-faint text-sm normal-case font-body font-normal">{Math.round(w.warmup.reduce((t, x) => t + x.secs, 0) / 60)} min</span>
        </SectionTitle>
        <ol className="grid gap-2">
          {w.warmup.map((x) => (
            <li key={x.name} className="min-w-0 flex items-center gap-3 rounded-xl bg-surface border border-line px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-text">{x.name}</p>
                <p className="text-xs text-mute mt-0.5">{x.note}</p>
              </div>
              <span className="shrink-0 text-[13px] font-semibold text-amberGold tabular-nums">{x.secs}s</span>
            </li>
          ))}
        </ol>
      </section>

      {skillSlot}

      {w.exercises.length > 0 && (
        <section>
          <SectionTitle icon={circuit ? Repeat : Dumbbell}>{circuit ? "The circuit" : "The work"}</SectionTitle>
          <div className="grid gap-3">
            {w.exercises.map((ex, i) => (
              <ExerciseCard key={`${w.id}-${ex.id}`} ex={ex} index={i} circuit={circuit}
                doneSets={new Set([...done].filter((k) => k.startsWith(`${i}:`)).map((k) => +k.split(":")[1]))}
                onToggleSet={(s) => onToggleSet(i, s)} onLoad={(d) => onLoad(i, d)} onRest={onRest}
                feel={feels[i]} onFeel={(f) => onFeel(i, f)}
                swapOpen={swapIdx === i} alternatives={swapIdx === i ? alternativesFor(i) : []}
                onSwapToggle={() => setSwapIdx(swapIdx === i ? null : i)}
                onSwap={(id) => { onSwap(i, id); setSwapIdx(null); }}
                onHide={() => { onHide(i); setSwapIdx(null); }} />
            ))}
          </div>
        </section>
      )}

      {canFinish && (
        <div className="rounded-2xl border border-line bg-surface p-4">
          <button onClick={onFinish}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-ember px-4 py-3 font-display text-base font-bold uppercase tracking-widest text-ink hover:bg-emberSoft">
            <Check size={17} /> Finish &amp; log {quick ? "session" : "workout"}
          </button>
          <p className="text-xs text-faint mt-2 text-center">
            Saves the {doneCount} set{doneCount === 1 ? "" : "s"} you’ve ticked{quick ? " to your history" : ""}. Rate a move first if you want its target to move.
          </p>
        </div>
      )}

      {w.stretches.length > 0 && (
        <section>
          <SectionTitle icon={Wind}>Cool-down stretches</SectionTitle>
          <ol className="grid gap-2">
            {w.stretches.map((x) => (
              <li key={x.name} className="min-w-0 flex items-center gap-3 rounded-xl bg-surface border border-line px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-text">{x.name} <span className="text-faint font-normal">— {MUSCLES[x.muscle].label}</span></p>
                  <p className="text-xs text-mute mt-0.5">{x.note}</p>
                </div>
                <span className="shrink-0 text-[13px] font-semibold text-sky tabular-nums">{x.secs}s</span>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}

/* ── floating rest timer ───────────────────────────────────────────────────── */
export function RestTimer({ rest, onSkip, onAddTime }) {
  if (!rest) return null;
  const pct = (rest.remaining / rest.total) * 100;
  return (
    <div className="fixed inset-x-0 bottom-[68px] md:bottom-6 z-40 px-4 pointer-events-none">
      <div className="pointer-events-auto mx-auto max-w-md rounded-2xl bg-raised/95 backdrop-blur border border-sky/40 shadow-lg shadow-black/40 overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3">
          <Timer size={18} className="text-sky shrink-0" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] uppercase tracking-widest text-faint leading-none truncate">Resting · {rest.label}</p>
            <p className="font-display text-2xl font-bold text-text tabular-nums leading-tight" role="timer">{fmtTime(rest.remaining)}</p>
          </div>
          <button onClick={() => onAddTime(15)} className="rounded-lg border border-line px-2.5 py-1.5 text-xs font-semibold text-mute hover:text-text">+15s</button>
          <button onClick={onSkip} className="inline-flex items-center gap-1 rounded-lg bg-sky/15 border border-sky/40 px-3 py-1.5 text-xs font-bold text-sky hover:bg-sky/25">
            Skip <ChevronRight size={13} />
          </button>
        </div>
        <div className="h-1 bg-ink">
          <div className="h-full bg-sky transition-all duration-1000 ease-linear" style={{ width: `${pct}%` }} />
        </div>
      </div>
    </div>
  );
}
