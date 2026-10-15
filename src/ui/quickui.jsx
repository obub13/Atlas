import React, { useMemo, useState } from "react";
import { Zap, Timer, Repeat, Layers, ChevronLeft, AlertTriangle, Check } from "lucide-react";
import { MUSCLES } from "../engine/data.js";
import { daysSince } from "../engine/history.js";
import { QUICK_FOCUS, QUICK_MINUTES, FORMATS, focusById, buildQuickWorkout } from "../engine/quick.js";
import { cx, SectionTitle } from "./ui.jsx";

/** Most recent direct work on any of the focus muscles, in days (null = never). */
function lastHit(focus, log) {
  const d = focus.muscles.map((m) => daysSince(m, log)).filter((x) => x != null);
  return d.length ? Math.min(...d) : null;
}

/* ── pick what, how long, and how ─────────────────────────────────────────── */
export function QuickSetup({ profile, log, onStart }) {
  const prefs = profile.quickPrefs || {};
  const [focus, setFocus] = useState(prefs.focus || "core");
  const [minutes, setMinutes] = useState(QUICK_MINUTES.includes(prefs.minutes) ? prefs.minutes : 20);
  const [format, setFormat] = useState(null); // null = the focus's natural format
  const f = focusById(focus);
  const fmt = format || f.format;

  // What the kit can actually do, per focus — a probe build at the chosen length.
  const doable = useMemo(() => Object.fromEntries(QUICK_FOCUS.map((q) => {
    const w = buildQuickWorkout(profile, { focus: q.id, minutes: 20, format: q.format, seed: 1 }, log);
    return [q.id, !!w && w.exercises.length > 0];
  })), [profile, log]);

  const ago = lastHit(f, log);
  const recent = ago != null && ago < 2;

  return (
    <div className="flex flex-col gap-6 pb-4">
      <div className="rounded-2xl bg-gradient-to-br from-raised to-surface border border-line p-4">
        <p className="text-[11px] uppercase tracking-widest text-faint">Single session · not part of your plan</p>
        <h2 className="font-display text-2xl font-bold uppercase text-text leading-tight">Train right now</h2>
        <p className="text-[13px] text-mute mt-1">
          One focused workout built from your gear, level and history. Your weekly plan and its anchor lifts stay exactly as they are —
          the sets you log here still count toward your weekly volume.
        </p>
      </div>

      <section>
        <SectionTitle icon={Zap}>What do you want to hit?</SectionTitle>
        <div className="grid grid-cols-2 gap-2">
          {QUICK_FOCUS.map((q) => {
            const on = q.id === focus;
            const ok = doable[q.id];
            return (
              <button key={q.id} onClick={() => { if (ok) { setFocus(q.id); setFormat(null); } }} disabled={!ok} aria-pressed={on}
                className={cx("min-w-0 text-left rounded-xl border px-3 py-2.5 transition-all",
                  !ok ? "border-line bg-well opacity-60 cursor-not-allowed"
                    : on ? "border-ember/70 bg-ember/10 shadow-ember" : "border-line bg-surface hover:border-edge active:scale-[0.99]")}>
                <span className="flex items-center gap-1.5">
                  <span className={cx("font-display text-base font-semibold leading-tight truncate", on ? "text-emberSoft" : "text-text")}>{q.label}</span>
                  {on && <Check size={14} className="text-ember shrink-0 ml-auto" />}
                </span>
                <span className="block text-[11px] text-mute leading-snug mt-0.5">{ok ? q.blurb : "Not with your current gear"}</span>
              </button>
            );
          })}
        </div>
        <p className="text-xs text-faint mt-2">{f.muscles.map((m) => MUSCLES[m].label).join(" · ")}</p>
        {recent && (
          <p className="text-[13px] text-amberGold flex gap-1.5 mt-2">
            <AlertTriangle size={14} className="shrink-0 mt-0.5" aria-hidden />
            <span>You trained this {ago === 0 ? "today" : "yesterday"}. Fine for core or a light pump — for heavy work, another area recovers better.</span>
          </p>
        )}
      </section>

      <section>
        <SectionTitle icon={Timer}>How long have you got?</SectionTitle>
        <div className="grid grid-cols-5 gap-2">
          {QUICK_MINUTES.map((m) => (
            <button key={m} onClick={() => setMinutes(m)} aria-pressed={m === minutes}
              className={cx("rounded-xl border py-2.5 font-display text-lg font-bold transition-all",
                m === minutes ? "border-ember bg-ember/10 text-emberSoft shadow-ember" : "border-line bg-surface text-mute hover:border-edge")}>
              {m}
            </button>
          ))}
        </div>
        <p className="text-xs text-faint mt-2">Minutes, warm-up and cool-down included.</p>
      </section>

      <section>
        <SectionTitle icon={Repeat}>Format</SectionTitle>
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(FORMATS).map(([id, x]) => {
            const on = fmt === id;
            const Icon = id === "circuit" ? Repeat : Layers;
            return (
              <button key={id} onClick={() => setFormat(id)} aria-pressed={on}
                className={cx("min-w-0 text-left rounded-xl border px-3 py-2.5 transition-all",
                  on ? "border-ember/70 bg-ember/10" : "border-line bg-surface hover:border-edge")}>
                <span className={cx("flex items-center gap-1.5 font-display text-base font-semibold", on ? "text-emberSoft" : "text-text")}>
                  <Icon size={14} aria-hidden /> {x.label}
                  {id === f.format && <span className="ml-auto text-[10px] uppercase tracking-wider text-faint font-body">suggested</span>}
                </span>
                <span className="block text-[11px] text-mute leading-snug mt-0.5">{x.blurb}</span>
              </button>
            );
          })}
        </div>
      </section>

      <button onClick={() => onStart({ focus, minutes, format: fmt })} disabled={!doable[focus]}
        className="w-full rounded-xl py-3.5 font-display text-lg font-bold uppercase tracking-widest bg-ember text-ink hover:bg-emberSoft active:scale-[0.99] shadow-ember disabled:opacity-50">
        <span className="inline-flex items-center gap-2"><Zap size={18} /> Start {minutes}-min {f.label}</span>
      </button>
    </div>
  );
}

/* ── the tab: setup until a session exists, then the session itself ─────── */
export function QuickPanel({ profile, log, quick, onStart, onChangeFocus, children }) {
  if (!quick) return <QuickSetup profile={profile} log={log} onStart={onStart} />;
  return (
    <div className="flex flex-col gap-3">
      <button onClick={onChangeFocus}
        className="self-start inline-flex items-center gap-1 text-[13px] font-semibold text-mute hover:text-text">
        <ChevronLeft size={15} /> Change focus or length
      </button>
      {children}
    </div>
  );
}

