import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { createRoot } from "react-dom/client";
import "../index.css";
import { HeartPulse, CalendarDays, PersonStanding, Dumbbell, Zap, User, Timer, X, LineChart } from "lucide-react";
import { MUSCLES, GOALS, EQUIP_PRESETS } from "../engine/data.js";
import {
  inventoryOf, buildWorkout, alternativesFor, replaceExercise, weeklyReadout,
} from "../engine/generator.js";
import { upsertEntry, weeklyVolume, sessionsInWindow, daysSince, totalSessions, currentBlock, planLog, isQuick, sessionHistory } from "../engine/history.js";
import { getConfig, saveConfig, clearConfig, getClient } from "../data/client.js";
import { createRepo } from "../data/repo.js";
import { uuid } from "../data/mapping.js";
import { buildQuickWorkout, newSeed } from "../engine/quick.js";
import { ICONS, cx, SelectPanel } from "./ui.jsx";
import { Onboarding } from "./onboarding.jsx";
import { WorkoutPanel, RestTimer, roundsDone } from "./workout.jsx";
import { PlanPanel, WeekPreview } from "./plan.jsx";
import { SkillPicker, SkillBlock, SkillLadder } from "./skillui.jsx";
import { BootScreen, AuthScreen, SetupScreen } from "./auth.jsx";
import { SyncBadge, SyncBanner } from "./sync.jsx";
import { ProgressPanel } from "./progress.jsx";
import { ProfilePanel } from "./profile.jsx";
import { QuickPanel } from "./quickui.jsx";
import { planWeek, weekProgress } from "../engine/week.js";

const DEFAULT_PROFILE = {
  age: 28, height: 175, weight: 75, level: null, goal: null, equipment: "bw",
  inventory: [...EQUIP_PRESETS.bw], customGear: [], skill: null, excluded: [],
  sessionMinutes: 30, daysPerWeek: 3, quickPrefs: null,
};

function normalize(p) {
  const out = { ...DEFAULT_PROFILE, ...p };
  if (!Array.isArray(out.inventory) || !out.inventory.length) out.inventory = [...(EQUIP_PRESETS[out.equipment] || EQUIP_PRESETS.min)];
  if (!Array.isArray(out.customGear)) out.customGear = [];
  if (!Array.isArray(out.excluded)) out.excluded = [];
  return out;
}

/** Everything that should change the plan's session. If this changes, the session is stale. */
function signature(profile, selected) {
  return JSON.stringify({
    muscles: [...selected].sort(), minutes: profile.sessionMinutes, level: profile.level, goal: profile.goal,
    skill: profile.skill || null, inventory: [...(profile.inventory || [])].sort(),
    custom: (profile.customGear || []).map((g) => g.actsAs).filter(Boolean).sort(),
    age: profile.age, weight: profile.weight,
  });
}

// Session ids are made on the device so an offline write can be retried safely.
const newSessionId = () => uuid();

const dropIndex = (obj, i) => { const n = { ...obj }; delete n[i]; return n; };
const withoutSets = (set, i) => new Set([...set].filter((k) => !k.startsWith(`${i}:`)));

function App() {
  const [phase, setPhase] = useState("loading"); // loading · setup · auth · ready
  const [cfg, setCfg] = useState(() => getConfig());
  const [account, setAccount] = useState(null);  // { id, email, name }
  const [authNotice, setAuthNotice] = useState(null);
  const [sync, setSync] = useState({ state: "idle", pending: 0, dead: 0 });
  const [offlineLoad, setOfflineLoad] = useState(false);
  const repoRef = useRef(null);

  const [profile, setProfile] = useState(() => normalize({}));
  const [onboarded, setOnboarded] = useState(false);
  const [selected, setSelected] = useState(() => new Set());
  const [log, setLog] = useState([]);

  // the plan's session
  const [workout, setWorkout] = useState(null);
  const [done, setDone] = useState(() => new Set());
  const [feels, setFeels] = useState({});
  // the single session — separate state, so it never disturbs the plan's session
  const [quick, setQuick] = useState(null);
  const [qDone, setQDone] = useState(() => new Set());
  const [qFeels, setQFeels] = useState({});
  const [qError, setQError] = useState(null);

  const [rest, setRest] = useState(null);
  const [tab, setTab] = useState("body");
  const [drawer, setDrawer] = useState(false);
  const ready = useRef(false);

  const client = useMemo(() => (cfg ? getClient(cfg) : null), [cfg]);

  /* ── boot: which project, who's signed in ───────────────────────────────── */
  useEffect(() => {
    if (!cfg) { setPhase("setup"); return; }
    let alive = true;
    (async () => {
      const { data } = await client.auth.getSession();
      if (!alive) return;
      if (data?.session?.user) await openAccount(data.session.user);
      else setPhase("auth");
    })();
    const { data: sub } = client.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") { closeAccount(); setPhase("auth"); }
    });
    return () => { alive = false; sub?.subscription?.unsubscribe(); };
  }, [client]); // eslint-disable-line react-hooks/exhaustive-deps

  // back online → push anything waiting
  useEffect(() => {
    const on = () => repoRef.current?.kick();
    window.addEventListener("online", on);
    return () => window.removeEventListener("online", on);
  }, []);

  const closeAccount = () => {
    repoRef.current?.stop(); repoRef.current = null;
    ready.current = false;
    setAccount(null);
  };

  const openAccount = async (user) => {
    closeAccount();
    setPhase("loading");
    const repo = createRepo(client, user.id, { onStatus: setSync });
    repoRef.current = repo;
    let data;
    try { data = await repo.load(); }
    catch (e) { setAuthNotice(`Couldn't load your data: ${e.message}`); setPhase("auth"); return; }
    const name = data.name || user.user_metadata?.display_name || user.email.split("@")[0];
    setProfile(normalize(data.profile));
    setOnboarded(data.onboarded);
    setSelected(new Set(data.selected));
    setLog(data.log);
    setOfflineLoad(!!data.offline);
    setWorkout(null); setDone(new Set()); setFeels({});
    setQuick(null); setQDone(new Set()); setQFeels({}); setQError(null);
    setRest(null); setTab(data.onboarded ? "plan" : "body");
    setAccount({ id: user.id, email: user.email, name });
    setPhase("ready");
    setTimeout(() => { ready.current = true; }, 0);
  };

  const signIn = async (email, password) => {
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error) throw error;
    setAuthNotice(null);
    await openAccount(data.user);
  };
  const signUp = async (email, password, displayName) => {
    const { data, error } = await client.auth.signUp({ email, password, options: { data: { display_name: displayName }, emailRedirectTo: window.location.origin } });
    if (error) throw error;
    if (!data.session) return { confirm: true }; // project requires email confirmation
    await openAccount(data.user);
  };
  const signOut = async () => {
    await repoRef.current?.flush();
    closeAccount();
    setDrawer(false);
    await client.auth.signOut();
    setPhase("auth");
  };
  const connectProject = async (c) => {
    // probe: the auth endpoint answers for a real project
    const res = await fetch(`${c.url}/auth/v1/settings`, { headers: { apikey: c.anonKey } }).catch(() => null);
    if (!res || !res.ok) throw new Error("Couldn't reach that project — check the URL and key.");
    saveConfig(c);
    setCfg({ ...c, source: "device" });
  };

  /* ── persistence: everything goes through the repository's outbox ──────── */
  useEffect(() => {
    if (!ready.current || !account || !repoRef.current) return;
    const t = setTimeout(() => {
      repoRef.current?.saveProfile({ name: account.name, profile, selected, onboarded });
    }, 400);
    return () => clearTimeout(t);
  }, [profile, selected, onboarded, account]);

  const updateLog = (fn) => setLog((prev) => fn(prev));
  useEffect(() => {
    if (!ready.current || !repoRef.current) return;
    repoRef.current.syncLog(log);
  }, [log]);

  /* ── rest timer ─────────────────────────────────────────────────────────── */
  useEffect(() => {
    if (!rest) return;
    if (rest.remaining <= 0) {
      try { navigator.vibrate && navigator.vibrate([120, 60, 120]); } catch {}
      const t = setTimeout(() => setRest(null), 350);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setRest((r) => r && { ...r, remaining: r.remaining - 1 }), 1000);
    return () => clearTimeout(t);
  }, [rest]);
  const startRest = (secs, label) => setRest({ total: secs, remaining: secs, label });

  /* ── derived readouts ───────────────────────────────────────────────────── */
  const blockInfo = useMemo(() => currentBlock(profile.blockStarted), [profile.blockStarted]);
  const volume = useMemo(() => weeklyVolume(7, log), [log]);
  const readout = useMemo(() => weeklyReadout(volume, profile.daysPerWeek, sessionsInWindow(7, planLog(log))), [volume, profile.daysPerWeek, log]);
  const quickVolume = useMemo(() => weeklyVolume(7, log.filter(isQuick)), [log]);
  const history = useMemo(() => sessionHistory(log), [log]);
  // Which plan days are ticked off: plan sessions only.

  /* ── the week: the selection, split into days ──────────────────────────── */
  // Nothing picked means "everything". Toggling muscles settles for a beat
  // before the split is recomputed, so the map stays responsive.
  const [settledSel, setSettledSel] = useState(selected);
  useEffect(() => { const t = setTimeout(() => setSettledSel(selected), 220); return () => clearTimeout(t); }, [selected]);
  const logRef = useRef(log); logRef.current = log;
  const weekSig = JSON.stringify([signature(profile, settledSel), profile.daysPerWeek]);
  const weekPlan = useMemo(() => {
    const focus = settledSel.size ? settledSel : new Set(Object.keys(MUSCLES));
    return { ...planWeek(profile, focus, planLog(logRef.current)), wholeBody: settledSel.size === 0 };
  }, [weekSig]); // eslint-disable-line react-hooks/exhaustive-deps
  const progress = useMemo(() => weekProgress(weekPlan, log), [weekPlan, log]);
  const staleness = useMemo(() => {
    const days = {};
    for (const m of Object.keys(MUSCLES)) days[m] = daysSince(m, log);
    const stale = Object.keys(MUSCLES).map((m) => ({ muscle: m, days: days[m] }))
      .filter((r) => r.days == null || r.days >= 7)
      .sort((a, b) => (b.days ?? 999) - (a.days ?? 999)).slice(0, 5);
    return Object.assign(days, { stale: log.length ? stale : [] });
  }, [log]);
  const inv = useMemo(() => inventoryOf(profile), [profile]);

  /* ── the plan's session ─────────────────────────────────────────────────── */
  /** Build one day of the week (default: the next one not done yet). */
  const generate = useCallback((dayIndex, { jump = true, variant = 0 } = {}) => {
    const idx = Number.isInteger(dayIndex) ? dayIndex : (progress.next ?? 0);
    const day = weekPlan.days[idx];
    if (!day) return;
    const sel = new Set(day.muscles);
    const w = buildWorkout(profile, sel, log, { variant });
    if (!w || (!w.exercises.length && !w.skill)) return;
    w.signature = weekSig;
    w.sessionId = newSessionId();
    w.label = day.label;
    w.dayKey = day.key; w.dayIndex = idx; w.dayCount = weekPlan.days.length;
    setWorkout(w); setDone(new Set()); setFeels({}); setRest(null);
    if (jump) setTab("workout");
  }, [profile, weekPlan, weekSig, progress, log]);

  const currentSig = weekSig;
  const touched = done.size > 0 || Object.keys(feels).length > 0;
  const stale = !!workout && workout.signature !== currentSig;
  useEffect(() => { if (stale && !touched) generate(undefined, { jump: false }); }, [stale, touched, generate]);

  /* ── the single session ─────────────────────────────────────────────────── */
  const startQuick = (cfg, seed = newSeed()) => {
    const w = buildQuickWorkout(profile, { ...cfg, seed }, log);
    if (!w || !w.exercises.length) { setQError("Nothing in your kit covers that focus yet — add gear in your profile."); return; }
    w.cfg = cfg;
    w.sessionId = newSessionId();
    w.label = w.focusLabel;
    setQuick(w); setQDone(new Set()); setQFeels({}); setQError(null); setRest(null);
    setProfile((p) => ({ ...p, quickPrefs: { focus: cfg.focus, minutes: cfg.minutes } }));
    setTab("quick");
    try { window.scrollTo({ top: 0 }); } catch {}
  };
  const shuffleQuick = () => {
    if (!quick) return;
    let seed = newSeed();
    while (seed === quick.seed) seed = newSeed();
    startQuick(quick.cfg, seed);
  };

  /* ── session operations, shared by both kinds ───────────────────────────── */
  const S = (kind) => kind === "quick"
    ? { w: quick, setW: setQuick, done: qDone, setDone: setQDone, feels: qFeels, setFeels: setQFeels }
    : { w: workout, setW: setWorkout, done, setDone, feels, setFeels };

  const toggleSet = (kind, i, s) => {
    const { w, done: d, setDone: sd } = S(kind);
    if (!w) return;
    const key = `${i}:${s}`;
    const next = new Set(d);
    if (next.has(key)) { next.delete(key); sd(next); return; }
    next.add(key);
    sd(next);
    const ex = w.exercises[i];
    const exDone = w.exercises.reduce((t, e, j) => t + e.setsArr.filter((_, k) => next.has(`${j}:${k}`)).length, 0);
    if (exDone >= w.totalSets) { setRest(null); return; }
    if (w.format === "circuit") {
      const before = roundsDone(w, d), after = roundsDone(w, next);
      if (after > before) { startRest(w.roundRest, `round ${after} of ${w.rounds} done`); return; }
      // next move in this round that isn't ticked yet
      const n = w.exercises.length;
      let j = (i + 1) % n, guard = 0;
      while (next.has(`${j}:${s}`) && guard++ < n) j = (j + 1) % n;
      startRest(ex.rest, `next: ${w.exercises[j].name}`);
      return;
    }
    startRest(ex.rest, ex.name);
  };

  const loadStep = (kind, i, delta) => {
    S(kind).setW((w) => w && {
      ...w, exercises: w.exercises.map((e, j) => (j === i ? { ...e, load: Math.max(0, +((e.load || 0) + delta).toFixed(1)) } : e)),
    });
  };

  const rate = (kind, i, feel) => {
    const { w, setFeels: sf } = S(kind);
    const ex = w.exercises[i];
    sf((f) => ({ ...f, [i]: feel }));
    updateLog((prev) => upsertEntry(prev, entryFor(kind, w, i, ex.sets, feel)));
  };

  const entryFor = (kind, w, i, sets, feel) => {
    const ex = w.exercises[i];
    return {
      exerciseId: ex.id, ladder: ex.ladder, rank: ex.rank, sets, reps: ex.reps, holdSecs: ex.holdSecs,
      load: ex.load, feel, muscles: [ex.primary, ...ex.secondary], source: kind, format: w.format,
      sessionId: w.sessionId, slot: i, label: w.label, dayKey: kind === "plan" ? w.dayKey : null,
    };
  };

  /** Stop here and log what was actually done — rated or not, full or partial. */
  const finish = (kind) => {
    const { w, setW, done: d, feels: f } = S(kind);
    if (!w) return;
    updateLog((prev) => {
      let next = prev;
      w.exercises.forEach((ex, i) => {
        const ticked = ex.setsArr.filter((_, k) => d.has(`${i}:${k}`)).length;
        if (ticked && !f[i]) next = upsertEntry(next, entryFor(kind, w, i, ticked, null));
      });
      // skill practice counts too — the sets you did, even if you didn't rate them
      const sk = w.skill, skillTicked = [...d].filter((k) => k.startsWith("skill:")).length;
      if (sk && skillTicked && !f.skill) {
        next = upsertEntry(next, {
          exerciseId: `skill:${sk.skillId}:${sk.stageName}`, ladder: `skill:${sk.skillId}`, stageName: sk.stageName,
          sets: skillTicked, reps: sk.reps, holdSecs: sk.holdSecs, load: null, feel: null, muscles: sk.muscles, source: "plan",
          sessionId: w.sessionId, slot: "skill", label: w.label, dayKey: w.dayKey,
        });
      }
      return next;
    });
    setW((x) => x && { ...x, finished: true });
    setRest(null);
  };

  const alts = (kind, i) => {
    const { w } = S(kind);
    if (!w) return [];
    return alternativesFor(w.exercises[i], profile, log, w.exercises.map((e) => e.id));
  };

  const swap = (kind, i, id) => {
    const { w, setW, setDone: sd, setFeels: sf } = S(kind);
    const alt = alts(kind, i).find((a) => a.id === id);
    if (!alt || !w) return;
    setW(replaceExercise(w, i, alt, profile, log));
    sd((d) => withoutSets(d, i)); sf((f) => dropIndex(f, i));
  };

  const hide = (kind, i) => {
    const { w, setW, setDone: sd, setFeels: sf } = S(kind);
    const ex = w?.exercises[i];
    if (!ex) return;
    const excluded = profile.excluded.includes(ex.id) ? profile.excluded : [...profile.excluded, ex.id];
    const options = alts(kind, i);
    setProfile((p) => ({ ...p, excluded }));
    if (options.length) {
      setW(replaceExercise(w, i, options[0], { ...profile, excluded }, log));
      sd((d) => withoutSets(d, i)); sf((f) => dropIndex(f, i));
    }
  };

  /* skill practice lives on the plan's session only */
  const toggleSkillSet = (i) => {
    const key = `skill:${i}`;
    const next = new Set(done);
    if (next.has(key)) next.delete(key);
    else { next.add(key); if (workout?.skill) startRest(workout.skill.rest, workout.skill.stageName); }
    setDone(next);
  };
  const rateSkill = (feel) => {
    const sk = workout?.skill;
    if (!sk) return;
    setFeels((f) => ({ ...f, skill: feel }));
    updateLog((prev) => upsertEntry(prev, {
      exerciseId: `skill:${sk.skillId}:${sk.stageName}`, ladder: `skill:${sk.skillId}`, stageName: sk.stageName,
      sets: sk.sets, reps: sk.reps, holdSecs: sk.holdSecs, load: null, feel, muscles: sk.muscles, source: "plan",
      sessionId: workout.sessionId, slot: "skill", label: workout.label, dayKey: workout.dayKey,
    }));
  };

  const resetProfile = () => {
    setProfile({ ...DEFAULT_PROFILE, inventory: [...EQUIP_PRESETS.bw], customGear: [], blockStarted: Date.now() });
    setOnboarded(false); setSelected(new Set());
    setWorkout(null); setDone(new Set()); setFeels({});
    setQuick(null); setQDone(new Set()); setQFeels({});
    setRest(null); setDrawer(false); setTab("body");
    repoRef.current?.resetAll();
    setLog([]);
  };

  /* ── screens ───────────────────────────────────────────────────────────── */
  if (phase === "setup") return <SetupScreen onSave={connectProject} initial={cfg} />;
  if (phase === "loading") return <BootScreen label="Loading your training…" />;
  if (phase === "auth" || !account) {
    return <AuthScreen onSignIn={signIn} onSignUp={signUp} notice={authNotice}
      projectHost={cfg ? new URL(cfg.url).host : null}
      onChangeProject={cfg?.source === "device" ? () => { clearConfig(); setCfg(null); setPhase("setup"); } : null} />;
  }
  if (!onboarded) return <Onboarding initial={profile} onDone={(p) => { setProfile(p); setOnboarded(true); }} />;

  const goal = GOALS[profile.goal];
  const patch = (x) => setProfile((p) => ({ ...p, ...x }));

  const selectPanel = (
    <SelectPanel profile={profile} selected={selected} setSelected={setSelected}
      onGenerate={() => generate()} hasWorkout={!!workout} onTime={(m) => patch({ sessionMinutes: m })}
      onQuick={() => setTab("quick")}
      weekSlot={<WeekPreview weekPlan={weekPlan} progress={progress} profile={profile} selectedCount={selected.size} />}
      nextLabel={weekPlan.days[progress.next ?? 0]?.label}
      skillSlot={<SkillPicker chosen={profile.skill} inv={inv} log={log} onPick={(id) => patch({ skill: id })} />} />
  );

  const sessionProps = (kind) => ({
    onToggleSet: (i, s) => toggleSet(kind, i, s),
    onLoad: (i, d) => loadStep(kind, i, d),
    onRest: (ex) => startRest(ex.rest, ex.name),
    onFeel: (i, f) => rate(kind, i, f),
    alternativesFor: (i) => alts(kind, i),
    onSwap: (i, id) => swap(kind, i, id),
    onHide: (i) => hide(kind, i),
    onFinish: () => finish(kind),
  });

  const workoutPanel = (
    <WorkoutPanel workout={workout} done={done} feels={feels} stale={stale} {...sessionProps("plan")}
      onRegenerate={() => generate(undefined, { jump: false, variant: stale ? 0 : (workout?.variant || 0) + 1 })}
      nextDay={(() => { const n = weekPlan.days.findIndex((d, i) => !progress.done[i] && d.key !== workout?.dayKey); return n >= 0 ? weekPlan.days[n] : null; })()}
      onNewSelection={() => {
        const n = weekPlan.days.findIndex((d, i) => !progress.done[i] && d.key !== workout?.dayKey);
        if (n >= 0) generate(n, { jump: true });
        else { setWorkout(null); setDone(new Set()); setFeels({}); setTab("plan"); }
      }}
      onRepeat={() => { setDone(new Set()); setRest(null); }}
      skillSlot={workout?.skill && (
        <SkillBlock skill={workout.skill}
          doneSets={new Set([...done].filter((k) => k.startsWith("skill:")).map((k) => +k.split(":")[1]))}
          onToggleSet={toggleSkillSet} onRest={() => startRest(workout.skill.rest, workout.skill.stageName)}
          feel={feels.skill} onFeel={rateSkill} />
      )} />
  );

  const quickPanel = (
    <div className="flex flex-col gap-3">
      {qError && !quick && (
        <p className="rounded-xl border border-amberGold/50 bg-amberGold/10 px-4 py-3 text-[13px] text-amberGold">{qError}</p>
      )}
      <QuickPanel profile={profile} log={log} quick={quick} onStart={(cfg) => startQuick(cfg)}
        onChangeFocus={() => { setQuick(null); setRest(null); }}>
        <WorkoutPanel mode="quick" workout={quick} done={qDone} feels={qFeels} stale={false} {...sessionProps("quick")}
          onRegenerate={shuffleQuick}
          onNewSelection={() => { setQuick(null); setRest(null); }}
          onRepeat={() => { setQDone(new Set()); setRest(null); }}
          onRoundRest={() => quick && startRest(quick.roundRest, "between rounds")} />
      </QuickPanel>
    </div>
  );

  const planPanel = (
    <PlanPanel profile={profile} readout={readout} staleness={staleness} blockInfo={blockInfo}
      sessionsDone={progress.doneCount} weekPlan={weekPlan} progress={progress} quickVolume={quickVolume}
      recent={history.filter((h) => h.at >= Date.now() - 7 * 864e5)}
      onPickDay={(i) => generate(i, { jump: true })}
      skillSlot={<SkillLadder skillId={profile.skill} inv={inv} log={log} />} />
  );

  const profilePanel = (
    <ProfilePanel profile={profile} onChange={patch} onReset={resetProfile}
      sessions={totalSessions(log)} history={history} account={account} onSignOut={signOut}
      onRename={(name) => setAccount((a) => ({ ...a, name }))} log={log} sync={sync} />
  );

  const nav = [
    { id: "plan", label: "Week", icon: CalendarDays },
    { id: "body", label: "Body", icon: PersonStanding },
    { id: "workout", label: "Workout", icon: Dumbbell, dot: !!workout },
    { id: "quick", label: "Now", icon: Zap, dot: !!quick },
    { id: "progress", label: "Progress", icon: LineChart },
  ];
  const deskTab = ["plan", "quick", "progress"].includes(tab) ? tab : "workout";
  const openProfile = () => {
    if (window.matchMedia && window.matchMedia("(min-width: 768px)").matches) setDrawer(true);
    else setTab("profile");
  };
  const progressPanel = <ProgressPanel log={log} profile={profile} />;

  return (
    <div className="min-h-dvh bg-ink text-text">
      <header className="sticky top-0 z-30 bg-ink/90 backdrop-blur border-b border-line pt-safe px-safe" data-testid="app-header">
        <div className="max-w-6xl mx-auto flex items-center gap-3 px-4 md:px-6 h-14">
          <span className="flex items-center gap-2 text-ember">
            <HeartPulse size={20} aria-hidden />
            <span className="font-display font-bold text-lg tracking-widest uppercase text-text">Atlas <span className="text-ember">Trainer</span></span>
          </span>
          <div className="ml-auto flex items-center gap-2">
            <SyncBadge sync={sync} offline={offlineLoad} />
            <button onClick={openProfile} aria-label="Open profile"
              className="inline-flex items-center gap-1.5 rounded-full bg-surface border border-line px-3 py-1 text-xs font-semibold text-mute max-w-[140px] hover:text-text hover:border-edge">
              <User size={13} className="text-emberSoft shrink-0" /><span className="truncate">{account.name}</span>
            </button>
            <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-surface border border-line px-3 py-1 text-xs font-semibold text-mute">
              <Timer size={13} className="text-emberSoft" />{profile.sessionMinutes} min
            </span>
            {goal && (() => { const Icon = ICONS[goal.icon]; return (
              <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-surface border border-line px-3 py-1 text-xs font-semibold text-mute">
                <Icon size={13} className="text-emberSoft" />{goal.label}
              </span>
            ); })()}
          </div>
        </div>
      </header>
      <SyncBanner sync={sync} deadOps={() => repoRef.current?.deadOps() || []}
        onRetry={() => repoRef.current?.kick()} onDismiss={() => repoRef.current?.clearDead()} />

      <main className="hidden md:block max-w-6xl mx-auto px-6 py-6">
        <div className="grid grid-cols-[400px,1fr] gap-8 items-start">
          <div className="sticky top-[calc(72px+var(--sat))] max-h-[calc(100dvh-90px-var(--sat))] overflow-y-auto pr-1">{selectPanel}</div>
          <div className="min-w-0 min-h-[70vh]">
            <div className="flex gap-2 mb-5">
              {[{ id: "workout", label: "Today's session" }, { id: "quick", label: "Single session" }, { id: "plan", label: "Your week" }, { id: "progress", label: "Progress" }].map((t) => (
                <button key={t.id} onClick={() => setTab(t.id)}
                  className={cx("rounded-xl px-4 py-2 text-sm font-semibold transition-colors border inline-flex items-center gap-1.5",
                    deskTab === t.id ? "bg-ember/15 border-ember/60 text-emberSoft" : "bg-surface border-line text-mute hover:text-text hover:border-edge")}>
                  {t.id === "quick" && <Zap size={14} />}{t.label}
                </button>
              ))}
            </div>
            {deskTab === "plan" ? planPanel : deskTab === "quick" ? quickPanel : deskTab === "progress" ? progressPanel : workoutPanel}
          </div>
        </div>
      </main>

      <main className="md:hidden px-4 py-4 pb-[calc(7rem+var(--sab))]">
        {tab === "plan" && planPanel}
        {tab === "body" && selectPanel}
        {tab === "workout" && workoutPanel}
        {tab === "quick" && quickPanel}
        {tab === "progress" && progressPanel}
        {tab === "profile" && profilePanel}
      </main>

      <nav className="md:hidden fixed inset-x-0 bottom-0 z-30 bg-surface/95 backdrop-blur border-t border-line pb-safe px-safe" data-testid="bottom-nav">
        <div className="grid grid-cols-5">
          {nav.map(({ id, label, icon: Icon, dot }) => (
            <button key={id} onClick={() => setTab(id)} aria-current={tab === id ? "page" : undefined}
              className={cx("relative flex flex-col items-center gap-1 py-2.5 text-[11px] font-semibold uppercase tracking-wider transition-colors",
                tab === id ? "text-ember" : "text-faint hover:text-mute")}>
              <Icon size={20} />{label}
              {dot && <span className="absolute top-2 right-[calc(50%-16px)] w-1.5 h-1.5 rounded-full bg-ember" />}
            </button>
          ))}
        </div>
      </nav>

      {drawer && (
        <div className="hidden md:block fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/60" onClick={() => setDrawer(false)} />
          <aside className="absolute right-0 top-0 h-full w-[440px] bg-ink border-l border-line p-6 pt-[calc(1.5rem+var(--sat))] pb-[calc(1.5rem+var(--sab))] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-display text-2xl font-bold uppercase text-text">Profile</h2>
              <button onClick={() => setDrawer(false)} aria-label="Close profile"
                className="grid place-items-center w-9 h-9 rounded-xl bg-surface border border-line text-mute hover:text-text"><X size={17} /></button>
            </div>
            {profilePanel}
          </aside>
        </div>
      )}

      <RestTimer rest={rest} onSkip={() => setRest(null)}
        onAddTime={(s) => setRest((r) => r && { ...r, total: r.total + s, remaining: r.remaining + s })} />
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);

// installable + opens with no signal (production builds only)
if (import.meta.env.PROD && "serviceWorker" in navigator && !window.__ATLAS_NO_SW__) {
  window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => {}));
}
