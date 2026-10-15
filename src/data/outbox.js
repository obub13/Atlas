// ─── Outbox: every write survives a dead connection ───────────────────────────
// Writes go into a queue that lives in localStorage, then drain to the server
// in order. Offline in the gym basement? The workout is still logged on the
// phone; it uploads the next time the app is open with a connection — even
// after the tab was closed. Every op is an idempotent upsert on a key the
// device chose, so retrying after a timeout can never create a duplicate.
//
//   enqueue(op)  op = { kind: "profile"|"session"|"log"|"reset", key, row }
//                A newer write to the same key replaces the queued one in place
//                (keeps its position, so a log never overtakes its session).
//   flush()      drains in order; consecutive ops of one kind go as one request.
//                Transient failure → retry with backoff. Permanent failure (the
//                server rejected the data) → parked as "dead" and reported, so
//                one bad row can't block everything behind it.

const BACKOFF = [1000, 2000, 5000, 10000, 30000, 60000];
const BATCH = 100;

const defaultStore = {
  get(k) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};

export function createOutbox({ key, send, store = defaultStore, onStatus = () => {}, timers = globalThis }) {
  const saved = store.get(key) || {};
  let ops = Array.isArray(saved.ops) ? saved.ops : [];
  let dead = Array.isArray(saved.dead) ? saved.dead : [];
  let flushing = false, attempt = 0, timer = null, lastError = null, stopped = false, seq = saved.seq || 0;
  const inFlight = new Set();

  const persist = () => store.set(key, { ops, dead, seq });
  const status = () => ({
    pending: ops.length,
    dead: dead.length,
    state: dead.length ? "error" : timer ? "waiting" : flushing || ops.length ? "saving" : "idle",
    lastError,
  });
  const emit = () => onStatus(status());

  function enqueue(op) {
    if (stopped) return;
    if (op.kind === "reset") {
      // everything queued for sessions/logs is about to be deleted anyway
      ops = ops.filter((o) => inFlight.has(o.id) || (o.kind !== "session" && o.kind !== "log"));
    }
    const i = ops.findIndex((o) => o.key === op.key && !inFlight.has(o.id));
    if (i >= 0) ops[i] = { ...ops[i], row: op.row };
    else ops.push({ ...op, id: ++seq });
    persist(); emit();
    schedule(0);
  }

  function schedule(delay) {
    if (stopped || timer) return;
    if (delay === 0 && !flushing) { Promise.resolve().then(flush); return; }
    timer = timers.setTimeout(() => { timer = null; flush(); }, delay);
    emit();
  }

  async function flush() {
    if (flushing || stopped) return;
    if (timer) { timers.clearTimeout(timer); timer = null; }
    flushing = true; emit();
    try {
      while (ops.length && !stopped) {
        const head = ops[0];
        let n = 1;
        if (head.kind === "session" || head.kind === "log") {
          while (n < ops.length && n < BATCH && ops[n].kind === head.kind) n++;
        }
        const batch = ops.slice(0, n);
        batch.forEach((o) => inFlight.add(o.id));
        try {
          await send(head.kind, batch.map((o) => o.row));
          ops = ops.filter((o) => !batch.includes(o));
          attempt = 0; lastError = null;
        } catch (err) {
          lastError = err?.message || String(err);
          if (err?.permanent) {
            if (n > 1) {
              // find the bad row: retry this run one op at a time
              batch.forEach((o) => inFlight.delete(o.id));
              const one = batch[0];
              try { await send(one.kind, [one.row]); ops = ops.filter((o) => o !== one); }
              catch (e2) {
                if (e2?.permanent) { dead.push({ ...one, error: e2.message, at: Date.now() }); ops = ops.filter((o) => o !== one); }
                else throw e2;
              }
              continue;
            }
            dead.push({ ...head, error: lastError, at: Date.now() });
            ops = ops.filter((o) => o !== head);
          } else {
            batch.forEach((o) => inFlight.delete(o.id));
            persist();
            const delay = BACKOFF[Math.min(attempt++, BACKOFF.length - 1)];
            flushing = false;
            schedule(delay);
            return;
          }
        } finally {
          batch.forEach((o) => inFlight.delete(o.id));
          persist();
        }
      }
    } catch (err) {
      lastError = err?.message || String(err);
      flushing = false;
      schedule(BACKOFF[Math.min(attempt++, BACKOFF.length - 1)]);
      return;
    } finally {
      if (flushing) flushing = false;
      emit();
    }
  }

  /** Try now (e.g. the browser just came back online). */
  function kick() { if (timer) { timers.clearTimeout(timer); timer = null; } attempt = 0; flush(); }

  function stop() { stopped = true; if (timer) { timers.clearTimeout(timer); timer = null; } }

  /** Rows still waiting to upload — overlaid on what the server returned at load. */
  const pending = () => ops.map((o) => ({ kind: o.kind, row: o.row }));

  const clearDead = () => { dead = []; persist(); emit(); };

  emit();
  if (ops.length) schedule(0);
  return { enqueue, flush, kick, stop, status, pending, clearDead, deadOps: () => dead.slice() };
}
