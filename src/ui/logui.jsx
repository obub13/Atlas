// ─── Log a workout done without the app ───────────────────────────────────────
// Type it the way you'd text a friend ("3x10 all: russian twist, halos, leg
// raises") or add moves one by one. Library moves keep their id so they feed
// that lift's progression; new moves get muscles picked once and are remembered.
import React, { useMemo, useState } from "react";
import { PenLine, Plus, X, Wand2, Check, ChevronLeft, AlertTriangle, CalendarDays, LineChart, Sparkles, BookOpen, History } from "lucide-react";
import { MUSCLES, EXERCISES } from "../engine/data.js";
import { parseWorkoutText, matchMove, rowProblem, musclesOf, KNOWN_MOVES } from "../engine/logparse.js";
import { cx, SectionTitle } from "./ui.jsx";

const FEELS = [
  { id: "easy", label: "Easy" },
  { id: "right", label: "Right" },
  { id: "hard", label: "Hard" },
];

const pad = (n) => String(n).padStart(2, "0");
export const localDate = (t = Date.now()) => { const d = new Date(t); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };

let rowSeq = 0;
const blankRow = (defaults = {}) => ({
  key: ++rowSeq, name: "", match: null, sets: defaults.sets ?? 3, reps: defaults.reps ?? 10, holdSecs: null,
  load: null, feel: null, primary: null, secondary: null, pickedMuscles: false, openMuscles: false,
});

/** A parsed row → editable state. */
const fromParsed = (r) => ({
  ...blankRow(), name: r.name, match: r.match,
  sets: r.sets ?? 3, reps: r.holdSecs != null ? null : r.reps ?? 10, holdSecs: r.holdSecs ?? null, load: r.load ?? null,
  openMuscles: !r.match,
});

const STATUS = {
  library: { cls: "text-mint", icon: BookOpen, text: "In the library · counts toward its progression" },
  custom:  { cls: "text-sky",  icon: History,  text: "You've logged this before" },
  known:   { cls: "text-amberGold", icon: Sparkles, text: "Muscles filled in · check them" },
  none:    { cls: "text-amberGold", icon: AlertTriangle, text: "New move · pick the muscles it worked" },
};

const num = (v) => (v === "" || v == null ? null : Number(v));

function NumField({ label, value, onChange, step = 1, min = 0, max = 999, testid, width = "w-16" }) {
  return (
    <label className="flex flex-col gap-1 min-w-0">
      <span className="text-[10px] uppercase tracking-widest text-faint">{label}</span>
      <input type="number" inputMode="decimal" step={step} min={min} max={max} value={value ?? ""} data-testid={testid}
        onChange={(e) => onChange(num(e.target.value))}
        className={cx(width, "rounded-lg bg-well border border-line px-2 py-1.5 text-base tabular-nums text-text focus:outline-none focus:border-ember/70")} />
    </label>
  );
}

function MusclePicker({ row, onChange }) {
  const primary = row.primary ?? row.match?.primary ?? null;
  const secondary = row.secondary ?? row.match?.secondary ?? [];
  const setPrimary = (m) => onChange({ primary: m, secondary: secondary.filter((x) => x !== m), pickedMuscles: true });
  const toggleSecondary = (m) => {
    if (m === primary) return;
    onChange({ primary, secondary: secondary.includes(m) ? secondary.filter((x) => x !== m) : [...secondary, m], pickedMuscles: true });
  };
  return (
    <div className="mt-2.5 rounded-lg bg-well border border-line p-2.5" data-testid="muscle-picker">
      <p className="text-[11px] text-mute mb-1.5">Mainly worked</p>
      <div className="flex flex-wrap gap-1.5">
        {Object.entries(MUSCLES).map(([id, m]) => (
          <button key={id} type="button" onClick={() => setPrimary(id)} aria-pressed={primary === id} data-testid={`primary-${id}`}
            className={cx("rounded-full border px-2.5 py-1 text-[12px] font-medium",
              primary === id ? "border-ember bg-ember/15 text-emberSoft" : "border-line text-mute hover:text-text")}>
            {m.label}
          </button>
        ))}
      </div>
      {primary && (
        <>
          <p className="text-[11px] text-mute mt-2.5 mb-1.5">Also worked <span className="text-faint">(optional)</span></p>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(MUSCLES).filter(([id]) => id !== primary).map(([id, m]) => (
              <button key={id} type="button" onClick={() => toggleSecondary(id)} aria-pressed={secondary.includes(id)} data-testid={`secondary-${id}`}
                className={cx("rounded-full border px-2.5 py-1 text-[12px] font-medium",
                  secondary.includes(id) ? "border-sky/60 bg-sky/10 text-sky" : "border-line text-faint hover:text-mute")}>
                {m.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function RowCard({ row, index, customs, onChange, onRemove, canRemove }) {
  const type = row.match?.type || "none";
  const st = STATUS[type];
  const Icon = st.icon;
  const muscles = musclesOf(row);
  const library = type === "library";
  const timed = row.holdSecs != null;
  const problem = rowProblem(row);

  const rename = (name) => {
    const match = matchMove(name, customs);
    // keep muscles the person picked by hand; otherwise follow the new match
    onChange(row.pickedMuscles ? { name, match } : { name, match, primary: null, secondary: null, openMuscles: !match || row.openMuscles });
  };

  return (
    <li className="min-w-0 rounded-xl bg-surface border border-line p-3" data-testid="log-row">
      <div className="flex items-start gap-2">
        <span className="mt-2 w-5 shrink-0 text-center font-display text-sm font-bold text-faint">{index + 1}</span>
        <div className="min-w-0 flex-1">
          <input value={row.name} onChange={(e) => rename(e.target.value)} placeholder="Exercise name" list="atlas-move-names"
            aria-label={`Exercise ${index + 1} name`} data-testid="row-name"
            className="w-full rounded-lg bg-well border border-line px-2.5 py-1.5 text-base font-semibold text-text placeholder:text-faint focus:outline-none focus:border-ember/70" />
          {row.name.trim() && (
            <p className={cx("mt-1 flex items-center gap-1 text-[11px]", st.cls)} data-testid="row-status" data-status={type}>
              <Icon size={12} className="shrink-0" aria-hidden />
              <span className="truncate">{library && row.match.name !== row.name ? `${row.match.name} · ` : ""}{st.text}</span>
            </p>
          )}
        </div>
        {canRemove && (
          <button onClick={onRemove} aria-label={`Remove exercise ${index + 1}`} className="mt-1.5 shrink-0 text-faint hover:text-crit"><X size={16} /></button>
        )}
      </div>

      <div className="mt-2.5 pl-7 flex flex-wrap items-end gap-2.5">
        <NumField label="Sets" value={row.sets} min={1} max={20} onChange={(v) => onChange({ sets: v })} testid="row-sets" width="w-14" />
        {timed
          ? <NumField label="Seconds" value={row.holdSecs} min={1} max={600} onChange={(v) => onChange({ holdSecs: v })} testid="row-secs" />
          : <NumField label="Reps" value={row.reps} min={1} max={200} onChange={(v) => onChange({ reps: v })} testid="row-reps" width="w-14" />}
        <NumField label="kg" value={row.load} step={0.5} max={500} onChange={(v) => onChange({ load: v })} testid="row-kg" />
        <button type="button" onClick={() => onChange(timed ? { holdSecs: null, reps: 10 } : { holdSecs: 30, reps: null })}
          className="mb-0.5 rounded-lg border border-line px-2 py-1.5 text-[11px] font-semibold text-mute hover:text-text">
          {timed ? "Use reps" : "Use seconds"}
        </button>
      </div>

      <div className="mt-2.5 pl-7 flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span className="text-[11px] text-mute min-w-0">
          {muscles ? muscles.map((m, i) => <span key={m} className={i ? "text-faint" : "text-text"}>{i ? ", " : ""}{MUSCLES[m].label}</span>) : <span className="text-amberGold">No muscles yet</span>}
        </span>
        {!library && row.name.trim() && (
          <button type="button" onClick={() => onChange({ openMuscles: !row.openMuscles })} data-testid="row-muscles-toggle"
            className="text-[11px] font-semibold text-emberSoft hover:underline">{row.openMuscles ? "Done" : muscles ? "Change" : "Pick muscles"}</button>
        )}
      </div>
      {!library && row.openMuscles && row.name.trim() && <MusclePicker row={row} onChange={onChange} />}

      <div className="mt-2.5 pl-7 flex items-center gap-1.5">
        <span className="text-[11px] text-faint mr-1">Felt</span>
        {FEELS.map((f) => (
          <button key={f.id} type="button" onClick={() => onChange({ feel: row.feel === f.id ? null : f.id })} aria-pressed={row.feel === f.id}
            className={cx("rounded-md border px-2 py-0.5 text-[11px] font-semibold",
              row.feel === f.id ? "border-ember/70 bg-ember/10 text-emberSoft" : "border-line text-faint hover:text-mute")}>
            {f.label}
          </button>
        ))}
      </div>
      {problem && row.name.trim() && <p className="mt-2 pl-7 text-[11px] text-amberGold" data-testid="row-problem">{problem}</p>}
    </li>
  );
}

export function LogWorkoutPanel({ profile, onSave, onBack, onViewProgress }) {
  const customs = profile.customExercises || [];
  const today = localDate();
  const [text, setText] = useState("");
  const [date, setDate] = useState(today);
  const [title, setTitle] = useState("");
  const [rows, setRows] = useState(() => [blankRow()]);
  const [note, setNote] = useState(null);
  const [saved, setSaved] = useState(null);
  const [saving, setSaving] = useState(false);

  const names = useMemo(() => [...new Set([
    ...customs.map((c) => c.name), ...EXERCISES.map((e) => e.name), ...KNOWN_MOVES.map((k) => k.name),
  ])].sort(), [customs]);

  const fill = () => {
    const { rows: parsed } = parseWorkoutText(text, customs);
    if (!parsed.length) { setNote("Couldn't find any exercises in that. Try one per line or comma-separated, e.g. “3x10 all: halos, russian twists”."); return; }
    const keep = rows.filter((r) => r.name.trim());
    setRows([...keep, ...parsed.map(fromParsed)]);
    const fresh = parsed.filter((r) => !r.match).length;
    setNote(`Added ${parsed.length} exercise${parsed.length === 1 ? "" : "s"}${fresh ? ` — ${fresh} new to Atlas, pick the muscles below` : ""}.`);
  };

  const patchRow = (key, p) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...p } : r)));
  const removeRow = (key) => setRows((rs) => (rs.length > 1 ? rs.filter((r) => r.key !== key) : rs));
  const addRow = () => setRows((rs) => { const last = rs[rs.length - 1]; return [...rs, blankRow({ sets: last?.sets, reps: last?.reps })]; });
  const setAllFeel = (feel) => setRows((rs) => rs.map((r) => ({ ...r, feel })));

  const filled = rows.filter((r) => r.name.trim());
  const blocking = filled.map((r, i) => ({ i, p: rowProblem(r) })).find((x) => x.p);
  const dateOk = date && date <= today;
  const canSave = filled.length > 0 && !blocking && dateOk && !saving;
  const totalSets = filled.reduce((t, r) => t + (r.sets || 0), 0);

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const res = await onSave({ date, title: title.trim(), rows: filled });
      setSaved(res || { moves: filled.length, sets: totalSets });
    } finally { setSaving(false); }
  };

  const reset = () => { setText(""); setTitle(""); setDate(localDate()); setRows([blankRow()]); setNote(null); setSaved(null); };

  if (saved) {
    return (
      <div className="flex flex-col gap-4 pb-4" data-testid="log-success">
        <div className="rounded-2xl border border-mint/40 bg-mint/10 p-5">
          <p className="flex items-center gap-2 font-display text-2xl font-bold uppercase text-mint"><Check size={22} /> Logged</p>
          <p className="text-[13px] text-mute mt-1.5">
            {saved.moves} exercise{saved.moves === 1 ? "" : "s"} · {saved.sets} sets — in your history, weekly volume and progress.
            Your weekly plan stays as it is.
          </p>
          {saved.newMoves > 0 && <p className="text-[12px] text-sky mt-1.5">{saved.newMoves} new move{saved.newMoves === 1 ? "" : "s"} saved — next time Atlas recognises {saved.newMoves === 1 ? "it" : "them"}.</p>}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={onViewProgress} className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-ember py-3 font-display font-bold uppercase tracking-wide text-ink hover:bg-emberSoft">
            <LineChart size={16} /> View progress
          </button>
          <button onClick={reset} className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-line bg-surface py-3 font-display font-bold uppercase tracking-wide text-mute hover:text-text">
            <Plus size={16} /> Log another
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 pb-4" data-testid="log-panel">
      <datalist id="atlas-move-names">{names.map((n) => <option key={n} value={n} />)}</datalist>
      <div className="rounded-2xl bg-gradient-to-br from-raised to-surface border border-line p-4">
        {onBack && (
          <button onClick={onBack} className="mb-2 inline-flex items-center gap-1 text-[12px] font-semibold text-mute hover:text-text"><ChevronLeft size={14} /> Back</button>
        )}
        <p className="text-[11px] uppercase tracking-widest text-faint">Trained without the app · not part of your plan</p>
        <h2 className="font-display text-2xl font-bold uppercase text-text leading-tight flex items-center gap-2"><PenLine size={20} className="text-ember" aria-hidden /> Log a workout</h2>
        <p className="text-[13px] text-mute mt-1">It counts toward your history, weekly volume and progress. Plan days aren’t ticked off.</p>
      </div>

      <section>
        <SectionTitle icon={Wand2}>Type it out</SectionTitle>
        <textarea value={text} onChange={(e) => { setText(e.target.value); setNote(null); }} rows={3} data-testid="log-text"
          placeholder={"3x10 all: russian twist, leg raises, halos\n4x8 goblet squat 16kg"}
          className="w-full rounded-xl bg-well border border-line px-3 py-2.5 text-base text-text placeholder:text-faint focus:outline-none focus:border-ember/70" />
        <div className="mt-2 flex items-center gap-3">
          <button onClick={fill} disabled={!text.trim()} data-testid="log-fill"
            className="inline-flex items-center gap-1.5 rounded-lg bg-ember/15 border border-ember/60 px-3 py-1.5 text-[13px] font-semibold text-emberSoft disabled:opacity-40">
            <Wand2 size={14} /> Fill in
          </button>
          {note && <p className="text-[12px] text-mute min-w-0" data-testid="log-note">{note}</p>}
        </div>
      </section>

      <section className="grid grid-cols-[auto,1fr] gap-3 items-end">
        <label className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-widest text-faint flex items-center gap-1"><CalendarDays size={11} /> Date</span>
          <input type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} data-testid="log-date"
            className="rounded-lg bg-well border border-line px-2 py-1.5 text-base text-text focus:outline-none focus:border-ember/70 [color-scheme:dark]" />
        </label>
        <label className="flex flex-col gap-1 min-w-0">
          <span className="text-[10px] uppercase tracking-widest text-faint">Name <span className="normal-case tracking-normal">(optional)</span></span>
          <input value={title} onChange={(e) => setTitle(e.target.value.slice(0, 60))} placeholder="Kettlebell core" data-testid="log-title"
            className="w-full rounded-lg bg-well border border-line px-2.5 py-1.5 text-base text-text placeholder:text-faint focus:outline-none focus:border-ember/70" />
        </label>
      </section>

      <section>
        <SectionTitle icon={PenLine} aside={filled.length > 1 && (
          <span className="flex items-center gap-1 text-[11px] text-faint">All felt
            {FEELS.map((f) => <button key={f.id} onClick={() => setAllFeel(f.id)} className="rounded-md border border-line px-1.5 py-0.5 font-semibold text-mute hover:text-text">{f.label}</button>)}
          </span>
        )}>Exercises</SectionTitle>
        <ol className="grid gap-2">
          {rows.map((r, i) => (
            <RowCard key={r.key} row={r} index={i} customs={customs} canRemove={rows.length > 1}
              onChange={(p) => patchRow(r.key, p)} onRemove={() => removeRow(r.key)} />
          ))}
        </ol>
        <button onClick={addRow} data-testid="log-add-row"
          className="mt-2 w-full inline-flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-line py-2.5 text-[13px] font-semibold text-mute hover:text-text hover:border-edge">
          <Plus size={14} /> Add exercise
        </button>
        <p className="text-[11px] text-faint mt-2">Rating how it felt lets Atlas move that exercise on next time. Unrated sets still count as volume.</p>
      </section>

      <div className="sticky bottom-above-nav md:bottom-4 z-10 -mx-1 px-1 pt-3 pb-1 bg-gradient-to-t from-ink via-ink/95 to-transparent">
        <button onClick={save} disabled={!canSave} data-testid="log-save"
          className="w-full rounded-xl bg-ember py-3.5 font-display text-lg font-bold uppercase tracking-wide text-ink shadow-ember hover:bg-emberSoft disabled:opacity-40 disabled:shadow-none">
          {saving ? "Saving…" : filled.length ? `Save ${filled.length} exercise${filled.length === 1 ? "" : "s"} · ${totalSets} sets` : "Save workout"}
        </button>
        {(blocking || !dateOk) && filled.length > 0 && (
          <p className="mt-1.5 text-center text-[12px] text-amberGold" data-testid="log-blocker">
            {!dateOk ? "The date can't be in the future." : `Exercise ${rows.indexOf(filled[blocking.i]) + 1}: ${blocking.p}`}
          </p>
        )}
      </div>
    </div>
  );
}
