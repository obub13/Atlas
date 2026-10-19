import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { LineChart, CalendarDays, BarChart3, Target, Table2, TrendingUp, TrendingDown, Minus, Flame, Check, PenLine } from "lucide-react";
import { MUSCLES, WEEKLY } from "../engine/data.js";
import { summary, exercisesLogged, liftSeries, calendar, weeklyVolumeSeries, skillTimeline, niceTicks } from "../engine/progress.js";
import { cx, SectionTitle } from "./ui.jsx";

/* Chart tokens — validated against the card surface (#141B26) with the
   dataviz validator: categorical pair passes every dark-mode gate; the volume
   ramp passes the ordinal checks (more = lighter on a dark surface). */
const C = {
  plan: "#3987e5",
  quick: "#d95926",
  line: "#3987e5",
  empty: "#1C2635",
  grid: "#232D3D",
  axis: "#33425E",
  ink: "#E9EEF6",
  ink2: "#93A1B5",
  surface: "#141B26",
  ramp: [
    { max: WEEKLY.low,  fill: "#1c5cab", label: `under ${WEEKLY.low}` },
    { max: WEEKLY.good, fill: "#2a78d6", label: `${WEEKLY.low}–${WEEKLY.good}` },
    { max: WEEKLY.high, fill: "#5598e7", label: `${WEEKLY.good}–${WEEKLY.high}` },
    { max: Infinity,    fill: "#9ec5f4", label: `${WEEKLY.high}+` },
  ],
};

// dates read in the user's home zone (their profile), not whatever zone this device is in
const TimeZone = createContext(undefined);
function useFmt() {
  const timeZone = useContext(TimeZone);
  return useMemo(() => ({
    day: (t) => new Date(t).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", timeZone }),
    short: (t) => new Date(t).toLocaleDateString(undefined, { day: "numeric", month: "short", timeZone }),
    month: (t) => new Date(t).toLocaleDateString(undefined, { month: "short", timeZone }),
  }), [timeZone]);
}

function useWidth() {
  const ref = useRef(null);
  const [w, setW] = useState(320);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(240, Math.floor(e.contentRect.width))));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

const Card = ({ icon, title, aside, children, testid }) => (
  <section className="rounded-2xl bg-surface border border-line p-4 min-w-0" data-testid={testid}>
    <SectionTitle icon={icon} aside={aside}>{title}</SectionTitle>
    {children}
  </section>
);

const TableToggle = ({ on, setOn }) => (
  <button onClick={() => setOn(!on)} aria-pressed={on}
    className={cx("inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-semibold",
      on ? "border-ember/60 bg-ember/10 text-emberSoft" : "border-line text-mute hover:text-text")}>
    <Table2 size={12} /> Table
  </button>
);

const Tip = ({ x, y, w, children }) => (
  <div role="tooltip" className="pointer-events-none absolute z-10 rounded-lg border border-edge bg-raised px-2.5 py-1.5 text-[12px] text-text shadow-lg shadow-black/40 whitespace-nowrap"
    style={{ left: Math.min(Math.max(x, 70), w - 70), top: y, transform: "translate(-50%, calc(-100% - 10px))" }}>
    {children}
  </div>
);

/* ── KPI row ─────────────────────────────────────────────────────────────── */
function Stats({ s }) {
  const tiles = [
    { label: "Sessions logged", value: s.sessions },
    { label: "This week", value: s.thisWeek, sub: s.thisWeek ? `${s.thisWeekPlan} plan · ${s.thisWeekQuick} single` : "none yet" },
    { label: "Week streak", value: s.streakWeeks, sub: s.streakWeeks === 1 ? "week" : "weeks in a row" },
    { label: "Sets, 30 days", value: s.sets30 },
  ];
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2" data-testid="progress-stats">
      {tiles.map((t) => (
        <div key={t.label} className="rounded-xl bg-surface border border-line px-3.5 py-3 min-w-0">
          <p className="text-[11px] uppercase tracking-wider text-faint truncate">{t.label}</p>
          <p className="font-display text-3xl font-bold text-text leading-tight">{t.value}</p>
          {t.sub && <p className="text-[11px] text-mute truncate">{t.sub}</p>}
        </div>
      ))}
    </div>
  );
}

/* ── one lift over time ──────────────────────────────────────────────────── */
function LiftChart({ series }) {
  const fmt = useFmt();
  const [ref, width] = useWidth();
  const [hover, setHover] = useState(null);
  const pts = series.points;
  const H = 190, m = { l: 38, r: 44, t: 14, b: 24 };
  const iw = width - m.l - m.r, ih = H - m.t - m.b;
  const vals = pts.map((p) => p.value);
  let lo = Math.min(...vals), hi = Math.max(...vals);
  if (lo === hi) { lo = Math.max(0, lo - (lo || 1) * 0.25); hi = hi + (hi || 1) * 0.25; }
  const pad = (hi - lo) * 0.12; lo = Math.max(0, lo - pad); hi = hi + pad;
  const ticks = niceTicks(lo, hi, 3).filter((v) => v >= 0);
  lo = ticks[0]; hi = ticks[ticks.length - 1];
  const t0 = pts[0].at, t1 = pts.length > 1 ? pts[pts.length - 1].at : t0 + 864e5;
  const x = (t) => m.l + (pts.length > 1 ? ((t - t0) / (t1 - t0)) * iw : iw / 2);
  const y = (v) => m.t + ih - ((v - lo) / (hi - lo)) * ih;
  const path = pts.map((p, i) => `${i ? "L" : "M"}${x(p.at).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");
  const nearest = (px) => pts.reduce((best, p, i) => (Math.abs(x(p.at) - px) < Math.abs(x(pts[best].at) - px) ? i : best), 0);
  const onMove = (ev) => {
    const r = ev.currentTarget.getBoundingClientRect();
    setHover(nearest(ev.clientX - r.left));
  };
  const last = pts[pts.length - 1];
  const h = hover != null ? pts[hover] : null;
  const unit = series.unit;
  return (
    <div ref={ref} className="relative" data-testid="lift-chart">
      <svg width={width} height={H} role="img" aria-label={`${series.name}: ${pts.map((p) => `${fmt.short(p.at)} ${p.value} ${unit}`).join(", ")}`}>
        {ticks.map((v, i) => (
          <g key={i}>
            <line x1={m.l} x2={width - m.r} y1={y(v)} y2={y(v)} stroke={C.grid} strokeWidth="1" />
            <text x={m.l - 6} y={y(v)} textAnchor="end" dominantBaseline="middle" fontSize="11" fill={C.ink2} className="tabular-nums">{v}</text>
          </g>
        ))}
        <line x1={m.l} x2={width - m.r} y1={m.t + ih} y2={m.t + ih} stroke={C.axis} strokeWidth="1" />
        <text x={m.l} y={H - 6} fontSize="11" fill={C.ink2}>{fmt.short(t0)}</text>
        {pts.length > 1 && <text x={width - m.r} y={H - 6} fontSize="11" fill={C.ink2} textAnchor="end">{fmt.short(t1)}</text>}
        {h && <line x1={x(h.at)} x2={x(h.at)} y1={m.t} y2={m.t + ih} stroke={C.axis} strokeWidth="1" strokeDasharray="3 3" />}
        <path d={path} fill="none" stroke={C.line} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {pts.map((p, i) => (
          <circle key={i} cx={x(p.at)} cy={y(p.value)} r={hover === i ? 5.5 : 4} fill={C.line} stroke={C.surface} strokeWidth="2" />
        ))}
        {/* selective direct label: the latest value only */}
        <text x={x(last.at) + 9} y={y(last.value)} dominantBaseline="middle" fontSize="12" fontWeight="600" fill={C.ink}>
          {last.value}{unit === "kg" ? " kg" : unit === "s" ? "s" : ""}
        </text>
        <rect x={m.l} y={m.t} width={iw} height={ih} fill="transparent"
          onPointerMove={onMove} onPointerDown={onMove} onPointerLeave={() => setHover(null)} style={{ touchAction: "pan-y" }} />
      </svg>
      {h && (
        <Tip x={x(h.at)} y={y(h.value)} w={width}>
          <span className="block text-mute">{fmt.day(h.at)} · {h.source === "quick" ? "single session" : h.source === "manual" ? "logged workout" : "plan"}</span>
          <span className="block font-semibold">
            {h.value} {unit}
            <span className="font-normal text-mute"> · {h.sets} × {h.holdSecs ? `${h.holdSecs}s` : h.reps ? `${h.reps[0]}–${h.reps[1]}` : ""}{h.feel ? ` · felt ${h.feel}` : ""}</span>
          </span>
        </Tip>
      )}
    </div>
  );
}

function LiftCard({ log, customs = [] }) {
  const fmt = useFmt();
  const list = useMemo(() => exercisesLogged(log, customs), [log, customs]);
  const [pick, setPick] = useState(null);
  const [table, setTable] = useState(false);
  const id = pick && list.some((l) => l.id === pick) ? pick : list[0]?.id;
  const series = useMemo(() => (id ? liftSeries(log, id, customs) : null), [log, id, customs]);
  if (!list.length) {
    return (
      <Card icon={LineChart} title="Lift progress" testid="lift-card">
        <p className="text-sm text-mute">Rate a few exercises and each one gets its own progress line here.</p>
      </Card>
    );
  }
  const ch = series.change;
  const repsUp = ch && ch.delta === 0 && ch.fromReps && ch.toReps && ch.toReps[1] > ch.fromReps[1];
  const Trend = !ch ? Minus : ch.delta > 0 || repsUp ? TrendingUp : ch.delta < 0 ? TrendingDown : Minus;
  const what = series.metric === "load" ? "Working weight" : series.metric === "hold" ? "Hold time" : "Target reps";
  return (
    <Card icon={LineChart} title="Lift progress" testid="lift-card" aside={<TableToggle on={table} setOn={setTable} />}>
      <label className="block">
        <span className="sr-only">Exercise</span>
        <select value={id} onChange={(e) => setPick(e.target.value)} aria-label="Exercise"
          className="w-full rounded-xl bg-raised border border-line px-3 py-2.5 text-sm text-text focus:outline-none focus:border-ember/60">
          {list.map((l) => <option key={l.id} value={l.id}>{l.name} · {l.sessions} session{l.sessions === 1 ? "" : "s"}</option>)}
        </select>
      </label>
      <p className="text-[13px] text-mute mt-3 flex items-center gap-1.5" data-testid="lift-change">
        <Trend size={15} className={cx("shrink-0", ch && (ch.delta > 0 || repsUp) ? "text-mint" : "text-faint")} aria-hidden />
        {ch
          ? <span>
              <span className="text-text font-semibold">{what}: {ch.delta === 0 ? `${ch.to} ${series.unit}` : `${ch.from} → ${ch.to} ${series.unit}`}</span>
              {ch.delta === 0 && series.metric === "load" && ch.fromReps && ch.toReps && ch.fromReps[1] !== ch.toReps[1]
                ? <> held while reps climbed <span className="text-text font-semibold">{ch.fromReps[0]}–{ch.fromReps[1]} → {ch.toReps[0]}–{ch.toReps[1]}</span></>
                : ch.delta === 0 ? " — holding steady" : null}
              {" "}since {fmt.short(ch.since)}{ch.pct != null && ch.delta !== 0 ? ` (${ch.delta > 0 ? "+" : ""}${ch.pct}%)` : ""}
            </span>
          : <span>{what}: <span className="text-text font-semibold">{series.points[0]?.value} {series.unit}</span> — log it again to see a trend.</span>}
      </p>
      <div className="mt-2">
        {table ? (
          <table className="w-full text-[13px]">
            <thead><tr className="text-faint text-left"><th className="font-semibold py-1">Date</th><th className="font-semibold">{what}</th><th className="font-semibold">Sets</th><th className="font-semibold">Felt</th></tr></thead>
            <tbody>
              {[...series.points].reverse().map((p, i) => (
                <tr key={i} className="border-t border-line text-text"><td className="py-1.5">{fmt.day(p.at)}</td><td className="tabular-nums">{p.value} {series.unit}</td><td className="tabular-nums">{p.sets}</td><td className="text-mute">{p.feel || "—"}</td></tr>
              ))}
            </tbody>
          </table>
        ) : <LiftChart series={series} />}
      </div>
    </Card>
  );
}

/* ── training calendar ───────────────────────────────────────────────────── */
function CalendarCard({ log, calSettings }) {
  const fmt = useFmt();
  const [ref, width] = useWidth();
  const [hover, setHover] = useState(null);
  const weeks = Math.max(8, Math.min(26, Math.floor((width - 22) / 23)));
  const cal = useMemo(() => calendar(log, weeks, Date.now(), calSettings), [log, weeks, calSettings]);
  const left = 22, top = 16, gap = 3;
  const cell = Math.max(10, Math.min(20, Math.floor((width - left) / weeks) - gap));
  const H = top + 7 * (cell + gap);
  const fillOf = (d) => (d.plan ? C.plan : d.quick ? C.quick : C.empty);
  const months = [];
  cal.days.forEach((d, i) => {
    const col = Math.floor(i / 7);
    if (i % 7 === 0) {
      const label = fmt.month(d.date);
      const prev = months[months.length - 1];
      if (col === 0) months.push({ col, label });
      else if (d.dom <= 7) {
        if (prev && col - prev.col < 3) months[months.length - 1] = { col, label }; // too close: the newer month wins
        else months.push({ col, label });
      }
    }
  });
  const trained = cal.days.filter((d) => d.plan || d.quick).length;
  const h = hover != null ? cal.days[hover] : null;
  const pos = (i) => ({ x: left + Math.floor(i / 7) * (cell + gap), y: top + (i % 7) * (cell + gap) });
  return (
    <Card icon={CalendarDays} title="Training calendar" testid="calendar-card" aside={<span className="text-xs text-faint">{trained} day{trained === 1 ? "" : "s"} · {weeks} weeks</span>}>
      <div ref={ref} className="relative">
        <svg width={width} height={H} role="img" aria-label={`${trained} training days in the last ${weeks} weeks`}>
          {months.map((mo) => <text key={mo.col} x={left + mo.col * (cell + gap)} y={10} fontSize="10" fill={C.ink2}>{mo.label}</text>)}
          {[0, 2, 4, 6].map((r) => ({ r, l: "SMTWTFS"[(cal.weekStartsOn + r) % 7] })).map(({ l, r }) => (
            <text key={r} x={0} y={top + r * (cell + gap) + cell / 2} dominantBaseline="middle" fontSize="10" fill={C.ink2}>{l}</text>
          ))}
          {cal.days.map((d, i) => {
            const { x, y } = pos(i);
            if (d.future) return null;
            return (
              <g key={i} onPointerEnter={() => setHover(i)} onPointerDown={() => setHover(i)} onPointerLeave={() => setHover(null)} data-testid={d.plan || d.quick ? "cal-day-trained" : undefined}>
                <rect x={x} y={y} width={cell} height={cell} rx="3" fill={fillOf(d)} stroke={hover === i ? C.ink : "none"} strokeWidth="1.5" />
                {d.plan > 0 && d.quick > 0 && <circle cx={x + cell / 2} cy={y + cell / 2} r={Math.max(2.5, cell / 5)} fill={C.quick} stroke={C.plan} strokeWidth="1" />}
              </g>
            );
          })}
        </svg>
        {h && (() => { const p = pos(hover); return (
          <Tip x={p.x + cell / 2} y={p.y} w={width}>
            <span className="block text-mute">{fmt.day(h.date)}</span>
            <span className="block font-semibold">
              {h.plan || h.quick ? <>{[h.plan && `${h.plan} plan`, h.quick && `${h.quick} single`].filter(Boolean).join(" + ")} · {h.sets} sets</> : "Rest day"}
            </span>
            {h.labels.length > 0 && <span className="block text-mute">{h.labels.join(", ")}</span>}
          </Tip>
        ); })()}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-[12px] text-mute" aria-label="Legend">
        <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded-[3px]" style={{ background: C.plan }} />Plan session</span>
        <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded-[3px]" style={{ background: C.quick }} />Single session</span>
        <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded-[3px] grid place-items-center" style={{ background: C.plan }}><span className="w-1.5 h-1.5 rounded-full" style={{ background: C.quick }} /></span>Both</span>
        <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded-[3px] border border-line" style={{ background: C.empty }} />Rest</span>
      </div>
    </Card>
  );
}

/* ── weekly volume per muscle ────────────────────────────────────────────── */
const binOf = (v) => C.ramp.find((r) => v < r.max) || C.ramp[C.ramp.length - 1];

function VolumeCard({ log, calSettings }) {
  const fmt = useFmt();
  const [ref, width] = useWidth();
  const [hover, setHover] = useState(null);
  const [table, setTable] = useState(false);
  const weeks = width < 400 ? 6 : 8;
  const data = useMemo(() => weeklyVolumeSeries(log, weeks, Date.now(), calSettings), [log, weeks, calSettings]);
  if (!data.muscles.length) {
    return <Card icon={BarChart3} title="Weekly volume" testid="volume-card"><p className="text-sm text-mute">Sets per muscle, week by week, appear once you’ve logged a session.</p></Card>;
  }
  const labelW = 86, gap = 2, top = 18;
  const cellW = Math.max(14, Math.floor((width - labelW) / weeks) - gap);
  const cellH = 18;
  const H = top + data.muscles.length * (cellH + gap);
  const h = hover;
  return (
    <Card icon={BarChart3} title="Weekly volume" testid="volume-card" aside={<TableToggle on={table} setOn={setTable} />}>
      <p className="text-xs text-faint -mt-1 mb-3">Hard sets per muscle each week (a secondary muscle counts half). About {WEEKLY.good}–{WEEKLY.high} is the growth range.</p>
      {table ? (
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead><tr className="text-faint"><th className="text-left font-semibold py-1">Muscle</th>{data.weeks.map((w) => <th key={w.start} className="font-semibold text-right">{fmt.short(w.start)}</th>)}</tr></thead>
            <tbody>{data.muscles.map((m) => (
              <tr key={m} className="border-t border-line text-text"><td className="py-1.5">{MUSCLES[m].label}</td>{data.weeks.map((w) => <td key={w.start} className="text-right tabular-nums">{w.muscles[m] || 0}</td>)}</tr>
            ))}</tbody>
          </table>
        </div>
      ) : (
        <div ref={ref} className="relative">
          <svg width={width} height={H} role="img" aria-label="Weekly sets per muscle">
            {data.weeks.map((w, c) => (c === 0 || c === data.weeks.length - 1 || c % 2 === 0) && (
              <text key={w.start} x={labelW + c * (cellW + gap) + cellW / 2} y={11} textAnchor="middle" fontSize="10" fill={C.ink2}>
                {c === data.weeks.length - 1 ? "this wk" : fmt.short(w.start)}
              </text>
            ))}
            {data.muscles.map((m, r) => (
              <g key={m}>
                <text x={0} y={top + r * (cellH + gap) + cellH / 2} dominantBaseline="middle" fontSize="11" fill={C.ink2}>{MUSCLES[m].label}</text>
                {data.weeks.map((w, c) => {
                  const v = w.muscles[m] || 0;
                  const x = labelW + c * (cellW + gap), y = top + r * (cellH + gap);
                  const on = h && h.m === m && h.c === c;
                  return (
                    <rect key={c} x={x} y={y} width={cellW} height={cellH} rx="3" fill={v > 0 ? binOf(v).fill : C.empty}
                      stroke={on ? C.ink : "none"} strokeWidth="1.5"
                      onPointerEnter={() => setHover({ m, c, v, x: x + cellW / 2, y })} onPointerDown={() => setHover({ m, c, v, x: x + cellW / 2, y })}
                      onPointerLeave={() => setHover(null)} />
                  );
                })}
              </g>
            ))}
          </svg>
          {h && (
            <Tip x={h.x} y={h.y} w={width}>
              <span className="block text-mute">{MUSCLES[h.m].label} · week of {fmt.short(data.weeks[h.c].start)}</span>
              <span className="block font-semibold">{h.v} sets{h.v > 0 ? ` · ${h.v >= WEEKLY.high ? "above the useful range" : h.v >= WEEKLY.good ? "growth range" : h.v >= WEEKLY.low ? "light" : "barely touched"}` : ""}</span>
            </Tip>
          )}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-[12px] text-mute" aria-label="Legend">
        <span className="text-faint">sets/week</span>
        {C.ramp.map((r) => (
          <span key={r.label} className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded-[3px]" style={{ background: r.fill }} />{r.label}</span>
        ))}
      </div>
    </Card>
  );
}

/* ── skill ladders ───────────────────────────────────────────────────────── */
function SkillsCard({ log }) {
  const fmt = useFmt();
  const skills = useMemo(() => skillTimeline(log), [log]);
  if (!skills.length) {
    return <Card icon={Target} title="Skills" testid="skills-card"><p className="text-sm text-mute">Pick a skill like the L-sit on the Body tab — every stage you reach shows up here with its date.</p></Card>;
  }
  return (
    <Card icon={Target} title="Skills" testid="skills-card">
      <div className="flex flex-col gap-4">
        {skills.map((s) => (
          <div key={s.id}>
            <p className="text-sm font-semibold text-text">{s.name} <span className="text-mute font-normal">· stage {s.currentIndex + 1} of {s.stages.length} · {s.sessions} practice{s.sessions === 1 ? "" : "s"}</span></p>
            <ol className="mt-2 flex flex-col gap-1.5">
              {s.stages.map((st) => {
                const reached = st.firstAt != null, current = st.index === s.currentIndex;
                return (
                  <li key={st.name} className="flex items-center gap-2.5 text-[13px]">
                    <span className={cx("grid place-items-center w-5 h-5 rounded-md shrink-0 text-[10px] font-bold",
                      current ? "bg-ember text-ink" : reached ? "bg-mint/20 text-mint" : "bg-raised text-faint")}>
                      {reached && !current ? <Check size={11} /> : st.index + 1}
                    </span>
                    <span className={cx("flex-1 min-w-0 truncate", current ? "text-text font-semibold" : reached ? "text-mute" : "text-faint")}>{st.name}</span>
                    <span className="shrink-0 text-[12px] text-faint tabular-nums">{reached ? `since ${fmt.short(st.firstAt)}` : "—"}</span>
                  </li>
                );
              })}
            </ol>
          </div>
        ))}
      </div>
    </Card>
  );
}

/* ── the tab ─────────────────────────────────────────────────────────────── */
export function ProgressPanel({ log, profile, onLogWorkout, cal }) {
  const customs = profile?.customExercises || [];
  const s = useMemo(() => summary(log, Date.now(), cal), [log, cal]);
  return (
    <TimeZone.Provider value={cal?.timeZone}>
    <div className="flex flex-col gap-4 pb-4" data-testid="progress-panel">
      <div className="rounded-2xl bg-gradient-to-br from-raised to-surface border border-line p-4">
        <p className="text-[11px] uppercase tracking-widest text-faint">Your progress</p>
        <h2 className="font-display text-2xl font-bold uppercase text-text leading-tight flex items-center gap-2">
          <Flame size={20} className="text-ember" aria-hidden />
          {s.sessions ? `${s.sessions} session${s.sessions === 1 ? "" : "s"} in the books` : "Nothing logged yet"}
        </h2>
        <p className="text-[13px] text-mute mt-1">Everything here is worked out from the sets you’ve logged — plan days, single sessions and workouts you logged yourself.</p>
        {onLogWorkout && (
          <button onClick={onLogWorkout} data-testid="progress-log-workout"
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-1.5 text-[12px] font-semibold text-mute hover:text-text hover:border-edge">
            <PenLine size={13} /> Log a workout you did without the app
          </button>
        )}
      </div>
      <Stats s={s} />
      <LiftCard log={log} customs={customs} />
      <CalendarCard log={log} calSettings={cal} />
      <VolumeCard log={log} calSettings={cal} />
      <SkillsCard log={log} />
    </div>
    </TimeZone.Provider>
  );
}
