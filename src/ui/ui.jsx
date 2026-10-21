import React, { useState, useCallback } from "react";
import {
  Flame, Dumbbell, Zap, Activity, Search, X, Check, Timer, Sparkles, Target,
  PersonStanding, Cable, Building2, ChevronRight,
} from "lucide-react";
import { MUSCLES, PRESETS, GOALS, LEVELS, TIME_OPTIONS, WARMUP_WHY } from "../engine/data.js";
import { BASE, MUSCLE_SHAPES, ABS_LINES } from "../engine/anatomy.js";

export const ICONS = { Flame, Dumbbell, Zap, Activity, PersonStanding, Cable, Building2 };
export const cx = (...a) => a.filter(Boolean).join(" ");
export const fmtTime = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

/* ── tiny UI atoms ─────────────────────────────────────────────────────────── */
export const SectionTitle = ({ icon: Icon, children, aside }) => (
  <div className="flex items-center justify-between mb-3">
    <h3 className="flex items-center gap-2 font-display text-xl font-semibold uppercase tracking-wide text-text">
      {Icon && <Icon size={17} className="text-ember" aria-hidden />}
      {children}
    </h3>
    {aside}
  </div>
);

export const Chip = ({ active, onClick, children, dim }) => (
  <button
    onClick={onClick}
    aria-pressed={active ? true : undefined}
    className={cx(
      "px-3 py-1.5 rounded-full text-[13px] font-medium border transition-colors select-none",
      active
        ? "bg-ember/15 border-ember/70 text-emberSoft"
        : dim
        ? "bg-transparent border-line text-faint hover:text-mute"
        : "bg-surface border-line text-mute hover:border-edge hover:text-text"
    )}
  >
    {children}
  </button>
);

/* ── interactive SVG body map ──────────────────────────────────────────────── */
export function BodyMap({ view, selected, hovered, onToggle, onHover }) {
  const shapes = MUSCLE_SHAPES[view];
  const fillFor = (id) =>
    selected.has(id) ? "url(#emberFill)" : hovered === id ? "#3E4E6B" : "#2A3547";

  const musclePath = (m, d, i, mirrored) => (
    <path
      key={`${m.id}-${i}-${mirrored ? "m" : "o"}`}
      d={d}
      fill={fillFor(m.id)}
      stroke={selected.has(m.id) ? "#FF7A50" : "#0B1016"}
      strokeWidth={selected.has(m.id) ? 0.8 : 1}
      transform={mirrored ? "translate(200,0) scale(-1,1)" : undefined}
      style={{
        cursor: "pointer",
        transition: "fill 150ms ease",
        filter: selected.has(m.id) ? "drop-shadow(0 0 5px rgba(255,92,56,0.55))" : "none",
      }}
    />
  );

  return (
    <svg viewBox="0 0 200 420" className="w-full h-full" role="group"
      aria-label={`${view === "front" ? "Front" : "Back"} muscle map`}>
      <defs>
        <linearGradient id="emberFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FF8A5C" />
          <stop offset="100%" stopColor="#E8431F" />
        </linearGradient>
      </defs>
      <g fill="#1A2230">
        <ellipse cx={BASE.head.cx} cy={BASE.head.cy} rx={BASE.head.rx} ry={BASE.head.ry} />
        <path d={BASE.neck} />
        <path d={BASE.bodyHalf} />
        <path d={BASE.bodyHalf} transform="translate(200,0) scale(-1,1)" />
        <path d={BASE.armHalf} />
        <path d={BASE.armHalf} transform="translate(200,0) scale(-1,1)" />
      </g>
      {shapes.map((m) => (
        <g key={m.id}
          onClick={() => onToggle(m.id)}
          onMouseEnter={() => onHover(m.id)}
          onMouseLeave={() => onHover(null)}
          role="button"
          aria-pressed={selected.has(m.id)}
          aria-label={MUSCLES[m.id].label}
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onToggle(m.id); } }}
          className="focus:outline-none">
          {m.d.map((d, i) => musclePath(m, d, i, false))}
          {m.mirror && m.d.map((d, i) => musclePath(m, d, i, true))}
        </g>
      ))}
      {view === "front" && (
        <g stroke="#0B1016" strokeWidth="0.8" fill="none" opacity="0.7" pointerEvents="none">
          {ABS_LINES.map((d, i) => <path key={i} d={d} />)}
        </g>
      )}
    </svg>
  );
}

/* ── selection panel: map + search + chips + presets + time budget ─────────── */
export function SelectPanel({ profile, selected, setSelected, onGenerate, hasWorkout, onTime, skillSlot, onQuick, weekSlot, nextLabel }) {
  const [view, setView] = useState("front");
  const [hovered, setHovered] = useState(null);
  const [query, setQuery] = useState("");

  const toggle = useCallback((id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, [setSelected]);

  const allIds = Object.keys(MUSCLES);
  const q = query.trim().toLowerCase();
  const matches = q ? allIds.filter((id) => MUSCLES[id].label.toLowerCase().includes(q)) : allIds;
  const activePreset = PRESETS.find(
    (p) => p.muscles.length === selected.size && p.muscles.every((m) => selected.has(m))
  );

  return (
    <div className="flex flex-col gap-4">
      {/* the other way in: one workout, right now, no plan attached */}
      {onQuick && (
        <button onClick={onQuick}
          className="w-full text-left rounded-2xl border border-ember/40 bg-ember/[0.06] hover:border-ember/70 px-4 py-3 flex items-center gap-3 transition-colors">
          <span className="grid place-items-center w-10 h-10 rounded-xl bg-ember text-ink shrink-0"><Zap size={18} /></span>
          <span className="min-w-0 flex-1">
            <span className="block font-display text-lg font-bold uppercase tracking-wide text-text leading-tight">Single session</span>
            <span className="block text-[12px] text-mute leading-snug">Want to train right now? One focused workout — core, arms, full body — without touching your plan.</span>
          </span>
          <ChevronRight size={18} className="text-emberSoft shrink-0" />
        </button>
      )}

      <div>
        <SectionTitle icon={Timer}>How long have you got?</SectionTitle>
        <div className="flex flex-wrap gap-2">
          {TIME_OPTIONS.map((t) => (
            <Chip key={t.mins} active={profile.sessionMinutes === t.mins} onClick={() => onTime(t.mins)}>
              {t.label}
            </Chip>
          ))}
        </div>
        <p className="text-xs text-faint mt-2">
          {TIME_OPTIONS.find((t) => t.mins === profile.sessionMinutes)?.blurb}
        </p>
      </div>

      {skillSlot}

      <div>
        <SectionTitle icon={Target}>Quick split</SectionTitle>
        <div className="flex flex-wrap gap-2">
          <Chip active={selected.size === allIds.length} onClick={() => setSelected(new Set(allIds))}>Everything</Chip>
          {PRESETS.map((p) => (
            <Chip key={p.id} active={activePreset?.id === p.id} onClick={() => setSelected(new Set(p.muscles))}>
              {p.label}
            </Chip>
          ))}
          {selected.size > 0 && (
            <Chip dim onClick={() => setSelected(new Set())}>
              <span className="inline-flex items-center gap-1"><X size={13} /> Clear</span>
            </Chip>
          )}
        </div>
      </div>

      <div className="rounded-2xl bg-well border border-line overflow-hidden">
        <div className="flex items-center justify-between px-4 pt-3">
          <div className="flex rounded-lg bg-surface border border-line p-0.5">
            {["front", "back"].map((v) => (
              <button key={v} onClick={() => setView(v)}
                className={cx("px-4 py-1.5 rounded-md text-[13px] font-semibold uppercase tracking-wider transition-colors",
                  view === v ? "bg-ember text-ink" : "text-mute hover:text-text")}>
                {v}
              </button>
            ))}
          </div>
          <span className="text-xs text-faint min-h-[1rem]">
            {hovered ? MUSCLES[hovered].label : selected.size ? `${selected.size} selected` : "Tap a muscle"}
          </span>
        </div>
        <div className="mx-auto max-w-[290px] px-4 pb-2 pt-1 h-[380px] md:h-[430px]">
          <BodyMap view={view} selected={selected} hovered={hovered} onToggle={toggle} onHover={setHovered} />
        </div>
      </div>

      <div>
        <div className="relative mb-3">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-faint" aria-hidden />
          <input value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="Search target areas — try “hamstrings”" aria-label="Search muscles"
            className="w-full rounded-xl bg-surface border border-line pl-9 pr-9 py-2.5 text-sm text-text placeholder:text-faint focus:outline-none focus:border-ember/60" />
          {query && (
            <button onClick={() => setQuery("")} aria-label="Clear search"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-faint hover:text-text"><X size={15} /></button>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {matches.map((id) => (
            <Chip key={id} active={selected.has(id)} onClick={() => toggle(id)}>
              {selected.has(id) && <Check size={13} className="inline mr-1 -mt-px" />}
              {MUSCLES[id].label}
            </Chip>
          ))}
          {matches.length === 0 && <p className="text-sm text-faint">No muscle matches “{query}”.</p>}
        </div>
      </div>

      {weekSlot}

      <button onClick={onGenerate}
        className="w-full rounded-xl py-3.5 font-display text-lg font-bold uppercase tracking-widest transition-all bg-ember text-ink hover:bg-emberSoft active:scale-[0.99] shadow-ember">
        <span className="inline-flex items-center gap-2">
          <Sparkles size={18} />{hasWorkout ? "Rebuild routine" : "Build my routine"}
        </span>
        {nextLabel && <span className="block text-[11px] font-body font-semibold normal-case tracking-normal opacity-80">Starts with {nextLabel}</span>}
      </button>
      <p className="text-xs text-faint text-center -mt-2">
        {profile.sessionMinutes} min · {LEVELS[profile.level]?.label.toLowerCase()} · {GOALS[profile.goal]?.label.toLowerCase()} · {profile.inventory.length} items of gear
      </p>
    </div>
  );
}

/* ── warm-up off: a short, non-nagging note on why it exists ──────────────── */
export function WarmupWhy({ onTurnOn, defaultOpen = false, compact = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl border border-amberGold/40 bg-amberGold/5 px-4 py-3" data-testid="warmup-why" role="note">
      <div className="flex items-center gap-2">
        <Flame size={15} className="text-amberGold shrink-0" aria-hidden />
        <p className="flex-1 min-w-0 text-[13px] text-text font-semibold">{compact ? "Skipping the warm-up" : "Warm-up skipped (your choice)"}</p>
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}
          className="shrink-0 text-[12px] font-semibold text-amberGold hover:underline">{open ? "Hide" : "Why it matters"}</button>
      </div>
      {open && (
        <div className="mt-2">
          <p className="text-[12px] text-mute">{WARMUP_WHY.title}:</p>
          <ul className="mt-1 grid gap-1 text-[12px] text-mute list-disc pl-4">
            {WARMUP_WHY.points.map((p) => <li key={p}>{p}</li>)}
          </ul>
          <p className="mt-2 text-[12px] text-text">{WARMUP_WHY.shortcut}</p>
        </div>
      )}
      {onTurnOn && (
        <button type="button" onClick={onTurnOn} className="mt-2 text-[12px] font-semibold text-emberSoft hover:underline" data-testid="warmup-on">
          Add the warm-up back
        </button>
      )}
    </div>
  );
}
