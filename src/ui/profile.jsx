import React, { useState } from "react";
import { LogOut, User, Package, EyeOff, CalendarDays, RotateCcw, Database, Download, Pencil, Check } from "lucide-react";
import { GOALS, LEVELS, TIME_OPTIONS, EXERCISES } from "../engine/data.js";
import { bmi } from "../engine/generator.js";
import { SectionTitle, Chip } from "./ui.jsx";
import { SessionRow } from "./plan.jsx";
import { NumField } from "./onboarding.jsx";
import { GearList, kitCoverage } from "./equipment.jsx";

function Choice({ label, options, value, onChange, render }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-mute mb-2">{label}</p>
      <div className="flex flex-wrap gap-2">
        {Object.entries(options).map(([k, v]) => (
          <Chip key={k} active={String(value) === String(k)} onClick={() => onChange(k)}>{render ? render(k, v) : v.label}</Chip>
        ))}
      </div>
    </div>
  );
}

/** Your data, as a file you own — plan, settings and every logged set. */
function exportData(account, profile, log) {
  const blob = new Blob([JSON.stringify({ app: "atlas-trainer", version: 1, exportedAt: new Date().toISOString(),
    account: { email: account.email, name: account.name }, profile, log }, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `atlas-trainer-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export function ProfilePanel({ profile, onChange, onReset, sessions, history = [], account, onSignOut, onRename, log = [], sync, onDeleteSession }) {
  const kit = kitCoverage(profile.inventory, profile.customGear);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(account.name);
  const [confirmReset, setConfirmReset] = useState(false);
  const pending = sync?.pending || 0;
  const b = bmi(profile);
  const band = b == null ? "" : b < 18.5 ? "underweight" : b < 25 ? "healthy range" : b < 30 ? "overweight" : "obese range";
  const minuteOpts = Object.fromEntries(TIME_OPTIONS.map((t) => [t.mins, { label: t.label }]));
  const dayOpts = Object.fromEntries([2, 3, 4, 5, 6].map((d) => [d, { label: `${d} days` }]));

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-2xl bg-surface border border-line p-4">
        <div className="flex items-center gap-3">
          <span className="grid place-items-center w-11 h-11 rounded-xl bg-raised text-emberSoft font-display font-bold text-lg shrink-0">
            {(account.name || "?").slice(0, 1).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            {editing ? (
              <span className="flex items-center gap-1.5">
                <input value={draft} onChange={(e) => setDraft(e.target.value.slice(0, 40))} aria-label="Your name" autoFocus
                  onKeyDown={(e) => { if (e.key === "Enter" && draft.trim()) { onRename(draft.trim()); setEditing(false); } }}
                  className="min-w-0 flex-1 rounded-lg bg-raised border border-line px-2.5 py-1 text-base text-text focus:outline-none focus:border-ember/60" />
                <button onClick={() => { if (draft.trim()) { onRename(draft.trim()); setEditing(false); } }} aria-label="Save name"
                  className="grid place-items-center w-8 h-8 rounded-lg bg-ember text-ink"><Check size={15} /></button>
              </span>
            ) : (
              <p className="font-display text-lg font-semibold text-text leading-tight truncate flex items-center gap-1.5">
                {account.name}
                <button onClick={() => { setDraft(account.name); setEditing(true); }} aria-label="Edit name" className="text-faint hover:text-text"><Pencil size={13} /></button>
              </p>
            )}
            <p className="text-[12px] text-mute truncate mt-0.5">{account.email}</p>
          </div>
          <button onClick={onSignOut}
            className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-[12px] font-semibold text-mute hover:text-text hover:border-edge">
            <LogOut size={13} /> Sign out
          </button>
        </div>
        <p className="text-[12px] text-mute flex items-start gap-1.5 mt-3">
          <Database size={12} className="shrink-0 mt-0.5" aria-hidden />
          <span>
            Saved to your Supabase database, private to this account. Sign in on any device and it's all there.
            {pending > 0 && <span className="text-amberGold"> {pending} change{pending === 1 ? "" : "s"} still waiting to upload.</span>}
          </span>
        </p>
      </div>

      <div className="rounded-2xl bg-surface border border-line p-4">
        <SectionTitle icon={User}>Your stats</SectionTitle>
        <div className="grid grid-cols-3 gap-3">
          <NumField label="Age" unit="y" value={profile.age} min={13} max={100} onChange={(v) => onChange({ age: v })} />
          <NumField label="Height" unit="cm" value={profile.height} min={120} max={230} onChange={(v) => onChange({ height: v })} />
          <NumField label="Weight" unit="kg" value={profile.weight} min={30} max={250} onChange={(v) => onChange({ weight: v })} />
        </div>
        <div className="mt-3 flex flex-col gap-1.5 text-[13px] text-mute">
          <p>
            <span className="text-text font-semibold">Age {profile.age}</span> sets your rest periods
            {profile.age >= 45 && " (lengthened, with extra joint prep)"}
            {profile.age >= 55 && " and caps your per-muscle volume"}
            {profile.age >= 60 && "; jumping and landing drills are screened out"}.
          </p>
          <p>
            <span className="text-text font-semibold">{profile.weight}kg</span> sets your suggested starting loads — a goblet squat opens near{" "}
            {Math.round((profile.weight * 0.25 * (LEVELS[profile.level]?.loadMult || 1)) / 5) * 5}kg for you.
          </p>
          {b != null && <p className="text-faint">BMI {b} — {band}. A rough compass, not a verdict; muscle mass skews it.</p>}
        </div>
      </div>

      <div className="rounded-2xl bg-surface border border-line p-4 flex flex-col gap-5">
        <Choice label="Fitness level" options={LEVELS} value={profile.level} onChange={(v) => onChange({ level: v })} />
        <Choice label="Primary goal" options={GOALS} value={profile.goal} onChange={(v) => onChange({ goal: v })} />
        <Choice label="Minutes per session" options={minuteOpts} value={profile.sessionMinutes} onChange={(v) => onChange({ sessionMinutes: +v })} />
        <Choice label="Days per week" options={dayOpts} value={profile.daysPerWeek} onChange={(v) => onChange({ daysPerWeek: +v })} />
        <p className="text-xs text-faint">Changes apply the next time you build a routine.</p>
      </div>

      <div className="rounded-2xl bg-surface border border-line p-4">
        <SectionTitle icon={Package} aside={<span className="text-xs text-faint">{kit.count} movements</span>}>Your gear</SectionTitle>
        <GearList inventory={profile.inventory} customGear={profile.customGear} onChange={onChange} compact />
      </div>

      {profile.excluded.length > 0 && (
        <div className="rounded-2xl bg-surface border border-line p-4">
          <SectionTitle icon={EyeOff} aside={<span className="text-xs text-faint">{profile.excluded.length}</span>}>Movements you've hidden</SectionTitle>
          <p className="text-[13px] text-mute mb-3 -mt-1">These are never suggested. Restore one if that changes.</p>
          <ul className="flex flex-col gap-2">
            {profile.excluded.map((id) => {
              const ex = EXERCISES.find((e) => e.id === id);
              return (
                <li key={id} className="flex items-center gap-3 rounded-xl bg-well border border-line px-3 py-2">
                  <span className="text-sm text-text flex-1 min-w-0 truncate">{ex ? ex.name : id}</span>
                  <button onClick={() => onChange({ excluded: profile.excluded.filter((x) => x !== id) })}
                    className="shrink-0 rounded-lg border border-line px-2.5 py-1 text-[12px] font-semibold text-mute hover:text-text hover:border-edge">
                    Restore
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div className="rounded-2xl bg-surface border border-line p-4">
        <SectionTitle icon={CalendarDays}>Training log</SectionTitle>
        <p className="text-[13px] text-mute">
          {sessions === 0
            ? "Nothing logged yet. Every set you tick and rate is saved to your profile."
            : `${sessions} session${sessions === 1 ? "" : "s"} logged — plan and single sessions. Your progression targets are derived from them.`}
        </p>
        {history.length > 0 && (
          <ol className="grid gap-2 mt-3">{history.slice(0, 12).map((s) => <SessionRow key={s.id} s={s} onDelete={onDeleteSession} />)}</ol>
        )}
      </div>

      <button onClick={() => exportData(account, profile, log)}
        className="inline-flex items-center justify-center gap-2 rounded-xl border border-line px-4 py-3 text-sm font-semibold text-mute hover:text-text hover:border-edge transition-colors">
        <Download size={15} /> Download my data (JSON)
      </button>
      {confirmReset ? (
        <div className="rounded-xl border border-crit/40 bg-crit/5 p-3.5">
          <p className="text-[13px] text-text">Delete every logged workout and start over? This can't be undone — download your data first if you might want it.</p>
          <div className="flex gap-2 mt-3">
            <button onClick={() => setConfirmReset(false)} className="flex-1 rounded-lg border border-line py-2 text-sm font-semibold text-mute hover:text-text">Keep it</button>
            <button onClick={() => { setConfirmReset(false); onReset(); }} className="flex-1 rounded-lg bg-crit/90 py-2 text-sm font-bold text-ink hover:bg-crit">Delete everything</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setConfirmReset(true)}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-line px-4 py-3 text-sm font-semibold text-mute hover:text-crit hover:border-crit/40 transition-colors">
          <RotateCcw size={15} /> Reset profile and history
        </button>
      )}
    </div>
  );
}
