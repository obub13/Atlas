import React from "react";
import { Check, CloudOff, AlertTriangle, RefreshCw, CloudUpload } from "lucide-react";
import { cx } from "./ui.jsx";

/** Header chip: is my training safely in the database? */
export function SyncBadge({ sync, offline }) {
  const s = sync || { state: "idle", pending: 0 };
  const view =
    s.state === "error" ? { cls: "bg-crit/10 border-crit/50 text-crit", icon: AlertTriangle, text: "Not saved" }
    : s.state === "waiting" ? { cls: "bg-amberGold/10 border-amberGold/50 text-amberGold", icon: CloudOff, text: `Offline · ${s.pending}` }
    : s.state === "saving" ? { cls: "bg-surface border-line text-mute", icon: CloudUpload, text: "Saving" }
    : offline ? { cls: "bg-amberGold/10 border-amberGold/50 text-amberGold", icon: CloudOff, text: "Offline" }
    : { cls: "bg-surface border-line text-mint", icon: Check, text: "Saved" };
  const Icon = view.icon;
  return (
    <span role="status" aria-label={`Sync: ${view.text}`} data-testid="sync-badge" data-state={s.state}
      title={s.state === "waiting" ? `${s.pending} change${s.pending === 1 ? "" : "s"} saved on this device, uploading when you're back online` : view.text}
      className={cx("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold", view.cls)}>
      <Icon size={13} className={cx("shrink-0", s.state === "saving" && "animate-pulse")} aria-hidden />
      <span className="hidden sm:inline">{view.text}</span>
    </span>
  );
}

/** Only shows up when something needs the person's attention. */
export function SyncBanner({ sync, deadOps, onRetry, onDismiss }) {
  if (!sync) return null;
  if (sync.state === "error") {
    const dead = deadOps();
    return (
      <div role="alert" className="sticky top-below-header z-20 bg-crit/10 border-b border-crit/40 px-4 py-2.5 text-[13px] text-crit">
        <div className="max-w-6xl mx-auto flex items-start gap-2">
          <AlertTriangle size={15} className="shrink-0 mt-0.5" />
          <span className="flex-1 min-w-0">
            The server rejected {dead.length} change{dead.length === 1 ? "" : "s"}, so {dead.length === 1 ? "it wasn't" : "they weren't"} saved
            {dead[0]?.error ? <> — <span className="opacity-80">{dead[0].error}</span></> : null}. Everything else is saved.
          </span>
          <button onClick={onDismiss} className="shrink-0 rounded-lg border border-crit/40 px-2.5 py-1 text-xs font-semibold hover:bg-crit/10">Dismiss</button>
        </div>
      </div>
    );
  }
  if (sync.state === "waiting" && sync.pending > 0) {
    return (
      <div role="status" data-testid="offline-banner" className="sticky top-below-header z-20 bg-amberGold/10 border-b border-amberGold/40 px-4 py-2 text-[13px] text-amberGold">
        <div className="max-w-6xl mx-auto flex items-center gap-2">
          <CloudOff size={15} className="shrink-0" />
          <span className="flex-1 min-w-0">
            No connection. {sync.pending} change{sync.pending === 1 ? " is" : "s are"} saved on this device and will upload automatically.
          </span>
          <button onClick={onRetry} className="shrink-0 inline-flex items-center gap-1 rounded-lg border border-amberGold/40 px-2.5 py-1 text-xs font-semibold hover:bg-amberGold/10">
            <RefreshCw size={12} /> Retry
          </button>
        </div>
      </div>
    );
  }
  return null;
}
