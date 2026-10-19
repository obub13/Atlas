import React, { useState } from "react";
import { CalendarDays, TrendingUp, AlertTriangle, Check, Flame, Clock, Zap, History, Layers, ChevronRight, PenLine, Trash2, Plus } from "lucide-react";
import { MUSCLES, WEEKLY } from "../engine/data.js";
import { cx, SectionTitle } from "./ui.jsx";

const TONE = {
  high:    { cls: "text-amberGold", bar: "bg-amberGold", note: "above the useful range" },
  good:    { cls: "text-mint",      bar: "bg-mint",      note: "in the growth range" },
  low:     { cls: "text-sky",       bar: "bg-sky",       note: "light week so far" },
  minimal: { cls: "text-faint",     bar: "bg-faint",     note: "barely touched" },
};

/* ── the agenda: what your week is supposed to look like ──────────────────── */
const DAY = 864e5;
export function dayName(at) {
  const d = new Date(at), today = new Date();
  const diff = Math.round((new Date(today.toDateString()) - new Date(d.toDateString())) / DAY);
  return diff === 0 ? "Today" : diff === 1 ? "Yesterday" : d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}

/** "today", "yesterday", "Thu 15 Oct" — for "Last done …". */
const lastLabel = (at) => { const n = dayName(at); return n === "Today" || n === "Yesterday" ? n.toLowerCase() : n; };

/* ── the split itself: one row per training day ───────────────────────────── */
export function WeekDays({ weekPlan, progress, onPickDay, compact }) {
  return (
    <ol className="grid gap-2" data-testid="week-days">
      {weekPlan.days.map((d, i) => {
        const done = progress?.done[i];
        const next = progress?.next === i;
        const last = progress?.lastDone?.[i];
        const Row = onPickDay ? "button" : "div";
        return (
          <li key={d.key + i} className="min-w-0">
            <Row {...(onPickDay ? { onClick: () => onPickDay(i) } : {})} data-testid="week-day"
              className={cx("w-full min-w-0 text-left flex items-center gap-3 rounded-xl bg-surface border px-4",
                compact ? "py-2.5" : "py-3", next ? "border-ember/50" : "border-line", onPickDay && "hover:border-ember/50 transition-colors")}>
              <span className={cx("grid place-items-center rounded-lg font-display font-bold text-sm shrink-0", compact ? "w-8 h-8" : "w-9 h-9",
                done ? "bg-mint/15 text-mint" : next ? "bg-ember text-ink" : "bg-raised text-emberSoft")}>
                {done ? <Check size={16} /> : i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-display text-base font-semibold text-text leading-tight">{d.label}</p>
                <p className="text-xs text-mute mt-0.5 truncate">{d.muscles.map((m) => MUSCLES[m].label).join(" · ")}</p>
                {!compact && last && (
                  <p className="text-[11px] text-faint mt-0.5" data-testid="day-last">{done ? "Done" : "Last done"} {lastLabel(last)}</p>
                )}
              </div>
              {onPickDay ? (
                <span className="text-[11px] uppercase tracking-wider text-emberSoft shrink-0">{done ? "Again" : next ? "Up next" : "Start"}</span>
              ) : next ? (
                <span className="text-[10px] uppercase tracking-wider text-emberSoft shrink-0 font-bold">Next</span>
              ) : null}
            </Row>
          </li>
        );
      })}
    </ol>
  );
}

const LEVEL_UI = {
  direct:   { dot: "bg-mint",      text: "trained directly" },
  indirect: { dot: "bg-sky",       text: "via compound lifts" },
  light:    { dot: "bg-amberGold", text: "only light work" },
  none:     { dot: "bg-crit",      text: "not this week" },
};

/** Does this week train everything that was picked? Per muscle, from real builds. */
export function WeekCoverage({ weekPlan, profile }) {
  const cov = weekPlan.coverage;
  if (!cov) return null;
  const sel = weekPlan.selected;
  const of = (lvl) => sel.filter((m) => cov.status[m]?.level === lvl && !cov.noGear.includes(m));
  const light = of("light"), missing = cov.missing;
  const good = sel.length - light.length - missing.length - cov.noGear.length;
  const all = !light.length && !missing.length && !cov.noGear.length;
  return (
    <div className="rounded-2xl border border-line bg-surface p-4" data-testid="week-coverage">
      <p className={cx("text-[13px] font-semibold flex items-center gap-2", all ? "text-mint" : "text-amberGold")}>
        {all ? <Check size={15} className="shrink-0" /> : <AlertTriangle size={15} className="shrink-0" />}
        {all
          ? `All ${sel.length} area${sel.length === 1 ? "" : "s"} you picked get trained this week.`
          : `${good} of ${sel.length} areas get proper work this week.`}
      </p>
      <ul className="flex flex-wrap gap-1.5 mt-3">
        {sel.map((m) => {
          const st = cov.noGear.includes(m) ? "none" : cov.status[m]?.level || "none";
          const days = [...new Set(cov.status[m]?.days || [])].map((i) => i + 1);
          return (
            <li key={m} title={`${MUSCLES[m].label}: ${LEVEL_UI[st].text}`}
              className="inline-flex items-center gap-1.5 rounded-full bg-raised border border-line px-2.5 py-1 text-[12px] text-text">
              <span className={cx("w-1.5 h-1.5 rounded-full", LEVEL_UI[st].dot)} aria-hidden />
              {MUSCLES[m].label}
              {days.length > 0 && <span className="text-faint tabular-nums">· day {days.join(", ")}</span>}
            </li>
          );
        })}
      </ul>
      {(light.length > 0 || missing.length > 0) && (
        <p className="text-[12px] text-mute mt-3 leading-snug">
          {missing.length > 0 && <><span className="text-text font-semibold">{missing.map((m) => MUSCLES[m].label).join(", ")}</span> won’t fit this week. </>}
          {light.length > 0 && <><span className="text-text font-semibold">{light.map((m) => MUSCLES[m].label).join(", ")}</span> only get{light.length === 1 ? "s" : ""} splash work from compound lifts. </>}
          {profile.sessionMinutes} minutes × {profile.daysPerWeek} days{profile.skill ? ", with skill practice first," : ""} isn’t
          enough time to train all {sel.length} directly — add 15 minutes a session or one more day to fit everything.
        </p>
      )}
      {cov.noGear.length > 0 && (
        <p className="text-[12px] text-mute mt-2">Nothing in your kit trains <span className="text-text font-semibold">{cov.noGear.map((m) => MUSCLES[m].label).join(", ")}</span> — add gear in your profile.</p>
      )}
      <p className="text-[11px] text-faint mt-3 flex flex-wrap gap-x-3 gap-y-1">
        {Object.entries(LEVEL_UI).map(([k, v]) => (
          <span key={k} className="inline-flex items-center gap-1"><span className={cx("w-1.5 h-1.5 rounded-full", v.dot)} aria-hidden />{v.text}</span>
        ))}
      </p>
    </div>
  );
}

/** Body-tab preview: what the current selection turns into across the week. */
export function WeekPreview({ weekPlan, progress, profile, selectedCount }) {
  if (!weekPlan.days.length) return null;
  return (
    <section data-testid="week-preview">
      <SectionTitle icon={Layers} aside={<span className="text-xs text-faint">{weekPlan.days.length} day{weekPlan.days.length === 1 ? "" : "s"}</span>}>
        Your week
      </SectionTitle>
      <p className="text-xs text-faint mb-3 -mt-1">
        {selectedCount
          ? `The ${selectedCount} area${selectedCount === 1 ? "" : "s"} you picked, split across ${weekPlan.days.length} session${weekPlan.days.length === 1 ? "" : "s"} — ${weekPlan.name}.`
          : `Nothing picked, so the week covers your whole body — ${weekPlan.name}. Tap muscles to focus it.`}
        {weekPlan.restDays > 0 && ` The other ${weekPlan.restDays} day${weekPlan.restDays === 1 ? " is" : "s are"} rest — this selection doesn’t need more.`}
      </p>
      <WeekDays weekPlan={weekPlan} progress={progress} compact />
      <div className="mt-3"><WeekCoverage weekPlan={weekPlan} profile={profile} /></div>
    </section>
  );
}

const KIND = {
  plan:   { label: "Plan",   cls: "bg-mint/10 text-mint border border-mint/30", icon: "bg-mint/15 text-mint", fallback: "Plan session" },
  quick:  { label: "Single", cls: "bg-sky/10 text-sky border border-sky/30",    icon: "bg-sky/15 text-sky",   fallback: "Single session" },
  manual: { label: "Logged", cls: "bg-amberGold/10 text-amberGold border border-amberGold/30", icon: "bg-amberGold/15 text-amberGold", fallback: "Logged workout" },
};

/** One past session: when, what, whether it belonged to the plan — and, if allowed, a delete. */
export function SessionRow({ s, onDelete }) {
  const k = KIND[s.source] || KIND.plan;
  const [confirm, setConfirm] = useState(false);
  return (
    <li className="min-w-0 rounded-xl bg-surface border border-line px-4 py-3" data-testid="history-row">
      <div className="flex items-center gap-3">
        <span className={cx("grid place-items-center w-9 h-9 rounded-lg shrink-0", k.icon)}>
          {s.source === "quick" ? <Zap size={16} /> : s.source === "manual" ? <PenLine size={16} /> : <Check size={16} />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-text truncate">{s.label || k.fallback}</p>
          <p className="text-xs text-mute mt-0.5">
            {dayName(s.at)} · {s.moves} move{s.moves === 1 ? "" : "s"} · {s.sets} sets{s.format === "circuit" ? " · circuit" : ""}
          </p>
        </div>
        <span className={cx("shrink-0 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider", k.cls)}>{k.label}</span>
        {onDelete && !confirm && (
          <button onClick={() => setConfirm(true)} aria-label={`Delete ${s.label || k.fallback}`} className="shrink-0 text-faint hover:text-crit">
            <Trash2 size={15} />
          </button>
        )}
      </div>
      {confirm && (
        <div className="flex items-center gap-2 mt-2.5 text-[12px]">
          <span className="flex-1 text-mute">Delete this workout and its sets? Progress is recalculated.</span>
          <button onClick={() => setConfirm(false)} className="rounded-lg border border-line px-2.5 py-1 font-semibold text-mute hover:text-text">Keep</button>
          <button onClick={() => { setConfirm(false); onDelete(s.id); }} className="rounded-lg bg-crit/90 px-2.5 py-1 font-bold text-ink hover:bg-crit">Delete</button>
        </div>
      )}
    </li>
  );
}

export function PlanPanel({ profile, readout, staleness, blockInfo, sessionsDone, onPickDay, skillSlot, weekPlan, progress, quickVolume = {}, recent = [], onLogWorkout, onDeleteSession }) {
  const extras = recent.filter((r) => r.source === "quick" || r.source === "manual").length;
  const total = weekPlan.days.length || profile.daysPerWeek;

  return (
    <div className="flex flex-col gap-6 pb-4">
      <div className="rounded-2xl bg-gradient-to-br from-raised to-surface border border-line p-4">
        <p className="text-[11px] uppercase tracking-widest text-faint">Block {blockInfo.index + 1} · week {blockInfo.week} of 4</p>
        <h2 className="font-display text-2xl font-bold uppercase text-text leading-tight">{weekPlan.name}</h2>
        <p className="text-[13px] text-mute mt-1">
          {total} session{total === 1 ? "" : "s"} a week, about {profile.sessionMinutes} minutes each, built from{" "}
          {weekPlan.wholeBody ? "your whole body" : `the ${weekPlan.selected.length} areas you picked`}.
          Your anchor lifts stay the same for the whole block so the weight on the bar can actually climb.
        </p>
        <div className="flex items-center gap-2 mt-3">
          <div className="flex-1 h-2 rounded-full bg-ink overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-emberDeep to-ember transition-all"
              style={{ width: `${Math.min(100, (sessionsDone / total) * 100)}%` }} />
          </div>
          <span className="text-[13px] font-semibold text-text tabular-nums shrink-0">{sessionsDone}/{total} done</span>
        </div>
        <p className="text-[12px] text-mute mt-2" data-testid="week-status">
          {sessionsDone === 0 && progress.lastWeekCount > 0
            ? <>New week since Monday — last week you did {progress.lastWeekCount} of {total}. </>
            : <>This week runs Monday to Sunday. </>}
          {progress.next != null && (
            <>Up next: <span className="text-text font-semibold">{weekPlan.days[progress.next].label}</span> ({progress.nextReason}).</>
          )}
        </p>
        {extras > 0 && (
          <p className="text-[12px] text-sky mt-2 flex items-center gap-1.5" data-testid="extra-sessions">
            <Zap size={13} className="shrink-0" aria-hidden />
            +{extras} extra workout{extras === 1 ? "" : "s"} this week (single sessions and ones you logged) — in your history and progress, not counted against the plan.
          </p>
        )}
      </div>

      {skillSlot}

      <section>
        <SectionTitle icon={CalendarDays}>Your week</SectionTitle>
        <WeekDays weekPlan={weekPlan} progress={progress} onPickDay={onPickDay} />
        <p className="text-xs text-faint mt-2">
          {progress.complete ? "Every day is done this week — anything more is a bonus. " : "Tap a day to build that session now. "}
          {weekPlan.restDays > 0 && `${weekPlan.restDays} rest day${weekPlan.restDays === 1 ? "" : "s"} — your selection doesn’t need more sessions. `}
          Change what’s in the week on the Body tab.
        </p>
        <div className="mt-3"><WeekCoverage weekPlan={weekPlan} profile={profile} /></div>
      </section>

      <section>
        <SectionTitle icon={History} aside={onLogWorkout ? (
          <button onClick={onLogWorkout} className="inline-flex items-center gap-1 rounded-lg border border-line px-2.5 py-1 text-[12px] font-semibold text-mute hover:text-text hover:border-edge">
            <Plus size={13} /> Log a workout
          </button>
        ) : null}>Logged since Monday</SectionTitle>
        {recent.length > 0
          ? <ol className="grid gap-2">{recent.map((s) => <SessionRow key={s.id} s={s} onDelete={onDeleteSession} />)}</ol>
          : <p className="text-[13px] text-mute">Nothing yet since Monday. Trained without the app? Log it so it counts.</p>}
      </section>

      <section>
        <SectionTitle icon={TrendingUp} aside={<span className="text-xs text-faint">last 7 days</span>}>Volume</SectionTitle>
        {readout.rows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line px-4 py-8 text-center">
            <Flame size={26} className="mx-auto text-faint mb-2" aria-hidden />
            <p className="text-sm text-mute">Nothing logged yet this week.</p>
            <p className="text-xs text-faint mt-1">
              Finish a session and rate how each exercise felt — that&rsquo;s what drives next week&rsquo;s targets.
            </p>
          </div>
        ) : (
          <ol className="grid gap-2">
            {readout.rows.map((r) => {
              const tone = TONE[r.status];
              const pct = Math.min(100, (r.sets / WEEKLY.high) * 100);
              return (
                <li key={r.muscle} className="min-w-0 rounded-xl bg-surface border border-line px-4 py-3">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-sm font-semibold text-text">{MUSCLES[r.muscle]?.label || r.muscle}</p>
                    <p className={cx("text-[13px] font-semibold tabular-nums shrink-0", tone.cls)}>
                      {r.sets} sets <span className="text-faint font-normal">· {tone.note}</span>
                      {quickVolume[r.muscle] > 0 && (
                        <span className="block text-[11px] text-sky font-normal text-right">incl. {+quickVolume[r.muscle].toFixed(1)} from extra workouts</span>
                      )}
                    </p>
                  </div>
                  <div className="h-1.5 rounded-full bg-ink overflow-hidden mt-2">
                    <div className={cx("h-full rounded-full transition-all", tone.bar)} style={{ width: `${pct}%` }} />
                  </div>
                </li>
              );
            })}
          </ol>
        )}
        <p className="text-xs text-faint mt-2">
          Around {WEEKLY.good} hard sets a week per muscle is where growth reliably happens; past {WEEKLY.high} you&rsquo;re
          usually buying fatigue rather than progress. Single sessions count here too.
        </p>
      </section>

      {staleness.stale.length > 0 && (
        <section>
          <SectionTitle icon={AlertTriangle}>Getting stale</SectionTitle>
          <ol className="grid gap-2">
            {staleness.stale.map((s) => (
              <li key={s.muscle} className="min-w-0 flex items-center gap-3 rounded-xl bg-surface border border-line px-4 py-3">
                <Clock size={15} className="text-amberGold shrink-0" aria-hidden />
                <p className="text-sm text-text flex-1 min-w-0">{MUSCLES[s.muscle].label}</p>
                <span className="text-[13px] text-mute tabular-nums shrink-0">{s.days == null ? "never trained" : `${s.days}d ago`}</span>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
