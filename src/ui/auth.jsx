import React, { useState } from "react";
import { HeartPulse, ChevronRight, Mail, Lock, User, Database, AlertTriangle, Check, Eye, EyeOff } from "lucide-react";
import { cx } from "./ui.jsx";
import { validateConfig } from "../data/client.js";

export function BootScreen({ label }) {
  return (
    <div className="min-h-dvh bg-ink grid place-items-center">
      <div className="text-center">
        <div className="flex items-center gap-2 text-ember animate-pulse justify-center">
          <HeartPulse size={22} />
          <span className="font-display font-bold text-xl tracking-widest uppercase">Atlas Trainer</span>
        </div>
        {label && <p className="text-xs text-faint mt-3">{label}</p>}
      </div>
    </div>
  );
}

const Shell = ({ children }) => (
  <div className="min-h-dvh bg-ink flex flex-col">
    <div className="w-full max-w-md mx-auto flex-1 flex flex-col px-5 pt-10 pb-8">
      <div className="flex items-center gap-2 text-ember mb-8">
        <HeartPulse size={20} />
        <span className="font-display font-bold text-xl tracking-widest uppercase">Atlas Trainer</span>
      </div>
      {children}
    </div>
  </div>
);

function Field({ label, icon: Icon, type = "text", value, onChange, placeholder, autoComplete, right, onEnter }) {
  return (
    <label className="block mt-4">
      <span className="text-xs font-semibold uppercase tracking-wider text-mute">{label}</span>
      <span className="mt-1.5 flex items-center rounded-xl bg-surface border border-line focus-within:border-ember/60">
        {Icon && <Icon size={16} className="ml-3.5 text-faint shrink-0" aria-hidden />}
        <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
          autoComplete={autoComplete} onKeyDown={(e) => { if (e.key === "Enter" && onEnter) onEnter(); }}
          className="w-full min-w-0 bg-transparent px-3 py-3 text-base text-text placeholder:text-faint focus:outline-none" />
        {right}
      </span>
    </label>
  );
}

const Primary = ({ children, onClick, disabled, busy }) => (
  <button onClick={onClick} disabled={disabled || busy}
    className={cx("mt-6 w-full rounded-xl py-3.5 font-display text-lg font-bold uppercase tracking-widest transition-all inline-flex items-center justify-center gap-1.5",
      !disabled && !busy ? "bg-ember text-ink hover:bg-emberSoft active:scale-[0.99] shadow-ember" : "bg-surface text-faint border border-line cursor-not-allowed")}>
    {busy ? "One moment…" : children} {!busy && <ChevronRight size={18} />}
  </button>
);

/* ── sign in / create account ─────────────────────────────────────────────── */
export function AuthScreen({ onSignIn, onSignUp, notice, onChangeProject, projectHost }) {
  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [sent, setSent] = useState(false);

  const valid = /\S+@\S+\.\S+/.test(email) && password.length >= 6 && (mode === "signin" || name.trim());
  const submit = async () => {
    if (!valid || busy) return;
    setBusy(true); setError(null);
    try {
      const r = mode === "signin" ? await onSignIn(email.trim(), password) : await onSignUp(email.trim(), password, name.trim());
      if (r?.confirm) setSent(true);
    } catch (e) {
      setError(friendly(e));
    } finally { setBusy(false); }
  };

  if (sent) {
    return (
      <Shell>
        <h1 className="font-display text-4xl font-bold uppercase text-text leading-none">Check your email</h1>
        <p className="text-mute text-sm mt-3">
          We sent a confirmation link to <span className="text-text font-semibold">{email}</span>. Open it on this device, then come back and sign in.
        </p>
        <Primary onClick={() => { setSent(false); setMode("signin"); }}>Back to sign in</Primary>
      </Shell>
    );
  }

  return (
    <Shell>
      <h1 className="font-display text-4xl font-bold uppercase text-text leading-none">
        {mode === "signin" ? "Welcome back" : "Create your account"}
      </h1>
      <p className="text-mute text-sm mt-2">
        {mode === "signin"
          ? "Sign in and your plan, history and progress are right where you left them — on any device."
          : "One account keeps your training safe in the database and private to you."}
      </p>
      {notice && <p className="mt-4 rounded-xl border border-sky/40 bg-sky/10 px-3.5 py-2.5 text-[13px] text-sky">{notice}</p>}

      {mode === "signup" && (
        <Field label="Your name" icon={User} value={name} onChange={setName} placeholder="Ofek" autoComplete="name" onEnter={submit} />
      )}
      <Field label="Email" icon={Mail} type="email" value={email} onChange={setEmail} placeholder="you@example.com" autoComplete="email" onEnter={submit} />
      <Field label="Password" icon={Lock} type={show ? "text" : "password"} value={password} onChange={setPassword}
        placeholder={mode === "signup" ? "At least 6 characters" : ""} autoComplete={mode === "signup" ? "new-password" : "current-password"} onEnter={submit}
        right={<button type="button" onClick={() => setShow(!show)} aria-label={show ? "Hide password" : "Show password"} className="px-3 text-faint hover:text-text">{show ? <EyeOff size={16} /> : <Eye size={16} />}</button>} />

      {error && (
        <p role="alert" className="mt-4 text-[13px] text-crit flex gap-2"><AlertTriangle size={15} className="shrink-0 mt-0.5" />{error}</p>
      )}
      <Primary onClick={submit} disabled={!valid} busy={busy}>{mode === "signin" ? "Sign in" : "Create account"}</Primary>

      <button onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setError(null); }}
        className="mt-4 text-sm text-mute hover:text-text">
        {mode === "signin" ? "New here? Create an account" : "Already have an account? Sign in"}
      </button>

      <p className="mt-auto pt-10 text-xs text-faint flex items-center gap-2">
        <Database size={13} className="shrink-0" aria-hidden />
        <span>Data lives in {projectHost || "your Supabase project"}, readable only by you.{" "}
          {onChangeProject && <button onClick={onChangeProject} className="underline hover:text-text">Change project</button>}
        </span>
      </p>
    </Shell>
  );
}

function friendly(e) {
  const m = String(e?.message || e || "");
  if (/invalid login|invalid_credentials/i.test(m)) return "That email and password don't match.";
  if (/already registered|already exists/i.test(m)) return "There's already an account with that email — sign in instead.";
  if (/email not confirmed/i.test(m)) return "Confirm your email first — check your inbox for the link.";
  if (/weak|at least 6/i.test(m)) return "Pick a password with at least 6 characters.";
  if (/fetch|network|failed to/i.test(m)) return "Can't reach the server. Check your connection and try again.";
  if (/rate limit/i.test(m)) return "Too many attempts — wait a minute and try again.";
  return m || "Something went wrong. Try again.";
}

/* ── one-time: which Supabase project? ───────────────────────────────────── */
export function SetupScreen({ onSave, initial }) {
  const [url, setUrl] = useState(initial?.url || "");
  const [key, setKey] = useState(initial?.anonKey || "");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    const v = validateConfig({ url, anonKey: key });
    if (v.error) { setError(v.error); return; }
    setBusy(true); setError(null);
    try { await onSave(v); } catch (e) { setError(e?.message || "Couldn't reach that project."); } finally { setBusy(false); }
  };

  return (
    <Shell>
      <h1 className="font-display text-4xl font-bold uppercase text-text leading-none">Connect your database</h1>
      <p className="text-mute text-sm mt-2">
        One time only. In Supabase open <span className="text-text font-semibold">Project Settings → API</span> and copy the Project URL and the <span className="text-text font-semibold">anon public</span> key.
      </p>
      <Field label="Project URL" icon={Database} value={url} onChange={setUrl} placeholder="https://abcd1234.supabase.co" autoComplete="off" onEnter={save} />
      <Field label="Anon public key" icon={Lock} value={key} onChange={setKey} placeholder="eyJhbGciOi…" autoComplete="off" onEnter={save} />
      <p className="text-xs text-faint mt-3 flex gap-2">
        <Check size={14} className="shrink-0 text-mint mt-0.5" />
        The anon key is meant to be public. Your data is protected by row-level security in the database — never paste the service_role key here.
      </p>
      {error && <p role="alert" className="mt-4 text-[13px] text-crit flex gap-2"><AlertTriangle size={15} className="shrink-0 mt-0.5" />{error}</p>}
      <Primary onClick={save} disabled={!url || !key} busy={busy}>Connect</Primary>
    </Shell>
  );
}
