// End to end: the production build in a real browser, talking to a local
// Supabase stand-in (real supabase-js over HTTP, real Postgres + RLS).
// Covers: connect → sign up → onboard → train → every write lands in the DB →
// offline logging survives a closed tab → single sessions → weekly split →
// Progress tab → log a workout done without the app (custom move) → delete it → sign out / wrong password / sign in → a second user sees
// nothing → layout at 360px and on desktop.
//   npm run build && node tests/e2e.mjs
import { chromium } from "playwright";
import http from "http";
import { readFileSync, existsSync, statSync } from "fs";
import path from "path";
import { startFakeSupabase } from "./fake-supabase.mjs";

const DIST = path.resolve("dist");
if (!existsSync(path.join(DIST, "index.html"))) { console.error("build first: npm run build"); process.exit(1); }

let failures = 0;
const ok = (c, m) => { if (!c) { failures++; console.log("  ❌ " + m); } else console.log("  ✓ " + m); };
const errors = [];

// ── servers ──────────────────────────────────────────────────────────────────
const fake = await startFakeSupabase();
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".webmanifest": "application/manifest+json", ".map": "application/json" };
const web = http.createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, "http://x").pathname);
  let f = path.join(DIST, p);
  if (!f.startsWith(DIST) || !existsSync(f) || statSync(f).isDirectory()) f = path.join(DIST, "index.html");
  res.writeHead(200, { "content-type": types[path.extname(f)] || "application/octet-stream" });
  res.end(readFileSync(f));
});
await new Promise((r) => web.listen(0, "127.0.0.1", r));
const APP = `http://127.0.0.1:${web.address().port}/`;

const db = {
  user: async (email) => (await fake.query("select id from auth.users where email = $1", [email])).rows[0]?.id,
  profile: async (uid) => (await fake.query("select * from public.profiles where user_id = $1", [uid])).rows[0],
  logs: async (uid) => (await fake.query(`select l.*, s.source, s.format, s.day_key, s.label from public.exercise_logs l join public.workout_sessions s on s.id = l.session_id where l.user_id = $1 order by l.logged_at`, [uid])).rows,
  sessions: async (uid) => (await fake.query("select * from public.workout_sessions where user_id = $1", [uid])).rows,
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (fn, ms = 6000) => { const t = Date.now(); while (Date.now() - t < ms) { try { if (await fn()) return true; } catch {} await wait(80); } return false; };
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
async function newContext(viewport) {
  const ctx = await browser.newContext({ viewport });
  await ctx.addInitScript(() => { window.__ATLAS_NO_SW__ = true; });
  return ctx;
}
async function open(ctx) {
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(APP);
  return page;
}
const main = (page) => page.locator("main:visible");
const cardPrimaries = async (page) => main(page).locator("article").evaluateAll((arts) => arts.map((a) => {
  const muscles = a.querySelector("p.text-xs")?.textContent || "";
  return { name: a.querySelector("h4")?.textContent, primary: muscles.split(" · ")[0] };
}));
const names = async (page) => (await cardPrimaries(page)).map((c) => c.name).join("|");
const badgeState = (page) => page.getByTestId("sync-badge").getAttribute("data-state");
const synced = (page) => until(async () => (await badgeState(page)) === "idle");
const tickAll = async (page, name) => {
  const sets = main(page).getByRole("button", { name: new RegExp(`^Set \\d+ of ${esc(name)}$`) });
  for (let i = 0, n = await sets.count(); i < n; i++) if ((await sets.nth(i).getAttribute("aria-pressed")) !== "true") await sets.nth(i).click();
  await page.getByRole("button", { name: /Skip/ }).click({ timeout: 500 }).catch(() => {});
};

const EMAIL = "ofek@example.com", PASS = "kettlebell-31";

/* ── 1. connect + sign up ────────────────────────────────────────────────── */
console.log("connect + account");
const ctx = await newContext({ width: 390, height: 844 });
let page = await open(ctx);
ok(await page.getByRole("heading", { name: "Connect your database" }).isVisible(), "first launch asks which Supabase project");
await page.getByPlaceholder("https://abcd1234.supabase.co").fill(fake.url);
await page.getByPlaceholder("sb_publishable_… or eyJhbGciOi…").fill("eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.x");
await page.getByRole("button", { name: /Connect/ }).click();
ok(await page.getByRole("alert").filter({ hasText: "secret key" }).isVisible(), "pasting the service_role key is refused");
await page.getByPlaceholder("sb_publishable_… or eyJhbGciOi…").fill(fake.anonKey);
await page.getByRole("button", { name: /Connect/ }).click();
await page.getByRole("heading", { name: "Welcome back" }).waitFor();
ok(true, "connected → sign-in screen");
await page.getByRole("button", { name: /Create an account/ }).click();
await page.getByPlaceholder("Ofek").fill("Ofek");
await page.getByPlaceholder("you@example.com").fill(EMAIL);
await page.getByPlaceholder("At least 6 characters").fill(PASS);
await page.getByRole("button", { name: /Create account/ }).click();
await page.getByRole("button", { name: /Continue/ }).waitFor();
const uid = await db.user(EMAIL);
ok(!!uid && (await db.profile(uid))?.display_name === "Ofek", "account created; profile row exists with the name");

/* ── 2. onboarding → saved to the database ───────────────────────────────── */
console.log("onboarding");
await page.getByRole("button", { name: /Continue/ }).click();
await page.getByRole("button", { name: /Intermediate/ }).click();
await page.getByRole("button", { name: /Continue/ }).click();
await page.getByRole("button", { name: /Muscle Building/ }).click();
await page.getByRole("button", { name: /Continue/ }).click();
await page.getByRole("button", { name: /^Kettlebell$/ }).click();
await page.getByRole("button", { name: /^Pull-up bar$/ }).click();
await page.getByRole("button", { name: /Continue/ }).click();
await page.getByRole("button", { name: /Start training/ }).click();
await until(async () => (await db.profile(uid))?.onboarded);
const prof = await db.profile(uid);
ok(prof?.onboarded && prof.settings.level === "intermediate" && prof.settings.inventory.includes("kettlebell") && !prof.settings.inventory.includes("dumbbells"),
  "onboarding answers are in the profiles table (level, gear — kettlebell yes, dumbbells no)");

/* ── 3. a plan workout: every rating is a row ─────────────────────────────── */
console.log("plan workout");
await main(page).getByRole("button", { name: /Build my routine/ }).click();
ok(/day 1 of 3/i.test(await main(page).innerText()), "Build my routine → Day 1 of 3");
const planMoves = await cardPrimaries(page);
await tickAll(page, planMoves[0].name);
await main(page).getByRole("button", { name: /^Right/ }).first().click();
await until(async () => (await db.logs(uid)).length === 1);
let rows = await db.logs(uid);
ok(rows.length === 1 && rows[0].feel === "right" && rows[0].source === "plan" && !!rows[0].day_key, "rating a move writes one exercise_logs row under a plan session with its day");
await main(page).getByRole("button", { name: /^Easy/ }).first().click();
await until(async () => (await db.logs(uid))[0]?.feel === "easy");
rows = await db.logs(uid);
ok(rows.length === 1 && rows[0].feel === "easy", "changing the rating updates the row — no duplicate");
ok(await synced(page), "header says Saved");

/* ── 4. offline: log, close the tab, come back online ─────────────────────── */
console.log("offline");
await ctx.setOffline(true);
if (planMoves[1]) {
  await tickAll(page, planMoves[1].name);
  await main(page).getByRole("button", { name: /^Right/ }).nth(1).click();
}
const finishBtn = main(page).getByRole("button", { name: /Finish & log workout/ });
if (await finishBtn.count()) await finishBtn.click();
ok(await until(async () => (await badgeState(page)) === "waiting"), "offline → the header shows changes waiting");
ok(await page.getByTestId("offline-banner").isVisible(), "…and says they're saved on this device");
ok((await db.logs(uid)).length === 1, "nothing reached the server while offline");
await page.close();                       // the tab is closed, still offline
await ctx.setOffline(false);
page = await open(ctx);                   // reopened later with signal
await until(async () => (await db.logs(uid)).length >= 2, 10000);
rows = await db.logs(uid);
ok(rows.length >= 2 && new Set(rows.map((r) => r.session_id)).size === 1, `the offline sets uploaded on reopen, into the same session (${rows.length} rows)`);
ok(await synced(page), "…and the header is back to Saved");

/* ── 5. single session ────────────────────────────────────────────────────── */
console.log("single session");
await page.getByRole("button", { name: "Now", exact: true }).click();
await main(page).getByRole("button", { name: /^Core & Abs/ }).click();
await main(page).getByRole("button", { name: "20", exact: true }).click();
await main(page).getByRole("button", { name: /Start 20-min Core & Abs/ }).click();
const cards = await cardPrimaries(page);
ok(cards.length >= 2 && cards.every((c) => ["Abs", "Core"].includes(c.primary)), `core session targets abs/core only (${cards.map((c) => c.name).join(", ")})`);
ok(await main(page).getByTestId("circuit-card").isVisible(), "core defaults to a circuit");
const before = await names(page);
let changed = false;
for (let i = 0; i < 3 && !changed; i++) { await main(page).getByRole("button", { name: "Rebuild with different movements" }).click(); changed = (await names(page)) !== before; }
ok(changed, "Shuffle hands over different movements");
for (const m of await cardPrimaries(page)) await tickAll(page, m.name);
const right = main(page).getByRole("button", { name: /^Right/ });
for (let i = 0, n = await right.count(); i < n; i++) await right.nth(i).click();
ok(await main(page).getByText("Session logged").isVisible(), "single session completes");
await until(async () => (await db.sessions(uid)).some((s) => s.source === "quick"));
const qs = (await db.sessions(uid)).find((s) => s.source === "quick");
ok(qs && qs.format === "circuit" && qs.label === "Core & Abs" && qs.day_key === null, "stored as a quick circuit session, not a plan day");
await until(async () => (await db.profile(uid)).settings.quickPrefs?.focus === "core");
ok((await db.profile(uid)).settings.quickPrefs?.minutes === 20, "focus + length remembered in the profile");
await page.getByRole("button", { name: "Week", exact: true }).click();
ok(await main(page).getByTestId("extra-sessions").isVisible(), "Week tab shows it as extra work, not a plan day");

/* ── 6. weekly split: everything, 20 min, 3 days, L-sit ──────────────────── */
console.log("weekly split");
await page.getByRole("button", { name: "Body", exact: true }).click();
await main(page).getByRole("button", { name: "20 min", exact: true }).click();
await main(page).getByRole("button", { name: /^L-Sit/ }).click();
await main(page).getByRole("button", { name: "Everything", exact: true }).click();
await wait(700);
const readDays = (loc) => loc.evaluateAll((rs) => rs.map((r) => { const ps = r.querySelectorAll("p"); return { label: ps[0]?.textContent || "", muscles: (ps[1]?.textContent || "").split(" · ") }; }));
const days3 = await readDays(main(page).getByTestId("week-preview").getByTestId("week-day"));
const covered = new Set(days3.flatMap((d) => d.muscles));
ok(days3.length === 3 && covered.size === 14, `14 areas split across 3 days (${days3.map((d) => d.label).join(" / ")})`);
for (let d = 0; d < 3; d++) {
  await page.getByRole("button", { name: "Week", exact: true }).click();
  const { label, muscles } = (await readDays(main(page).getByTestId("week-day")))[d];
  await main(page).getByTestId("week-day").nth(d).click();
  const prim = (await cardPrimaries(page)).map((c) => c.primary).filter(Boolean);
  ok(prim.length > 0 && prim.every((m) => muscles.includes(m)), `Day ${d + 1} (${label}) only trains its own muscles`);
  await main(page).getByRole("button", { name: /^Set 1 of / }).first().click();
  if (d === 0) await main(page).getByRole("button", { name: "Skill set 1" }).click(); // one L-sit set too
  await page.getByRole("button", { name: /Skip/ }).click({ timeout: 500 }).catch(() => {});
  await main(page).getByRole("button", { name: /Finish & log workout/ }).click();
}
await until(async () => (await db.logs(uid)).some((r) => r.slot === "skill"));
ok((await db.logs(uid)).some((r) => r.slot === "skill" && r.ladder === "skill:lsit"), "Finish & log saves the skill practice too");
await until(async () => (await db.sessions(uid)).filter((s) => s.source === "plan").length >= 4);
const planSessions = (await db.sessions(uid)).filter((s) => s.source === "plan");
ok(planSessions.length >= 4 && planSessions.every((s) => s.day_key), `every plan session is stored with its day (${planSessions.length})`);
await page.getByRole("button", { name: "Week", exact: true }).click();
ok(await main(page).getByText("3/3 done").isVisible(), "all three days logged → 3/3 done");
ok(/This week runs (Sunday to Saturday|Monday to Sunday)/.test(await main(page).getByTestId("week-status").innerText()), "the Week tab says when the week resets");
ok(await main(page).getByTestId("day-last").count() === 3, "each done day shows when it was done");

/* ── 7. Progress tab ──────────────────────────────────────────────────────── */
console.log("progress");
await page.getByRole("button", { name: "Progress", exact: true }).click();
await synced(page);
const statsText = await main(page).getByTestId("progress-stats").innerText();
const totalSessions = (await db.sessions(uid)).length;
ok(new RegExp(`SESSIONS LOGGED\\s*${totalSessions}\\b`, "i").test(statsText), `stats count every session in the database (${totalSessions})`);
ok(await main(page).getByTestId("lift-chart").isVisible(), "lift progress chart renders");
const opts = await main(page).getByLabel("Exercise").locator("option").count();
ok(opts >= 3, `every logged exercise is selectable (${opts})`);
await main(page).getByLabel("Exercise").selectOption({ index: 1 });
ok(await main(page).getByTestId("lift-change").isVisible(), "picking another exercise updates the chart");
await main(page).getByTestId("lift-card").getByRole("button", { name: "Table" }).click();
ok(await main(page).getByTestId("lift-card").locator("tbody tr").count() >= 1, "table view lists the data points");
ok(await main(page).getByTestId("cal-day-trained").count() >= 1, "calendar marks today as a training day");
ok(await main(page).getByTestId("volume-card").locator("rect").count() > 10, "weekly volume heatmap renders");
ok(/L-Sit/.test(await main(page).getByTestId("skills-card").innerText()), "skill ladder shows the L-sit");
await page.screenshot({ path: "tests/shots/progress-mobile.png", fullPage: true }).catch(() => {});

/* ── 7b. a workout done without the app ───────────────────────────────────── */
console.log("log a workout");
const MSG = "today i did these workouts with a kettlebell : 3x10 all\n\nrussian twist, tridents, leg raises, kettlebell pushup pass through and halos";
const sessionsBeforeLog = (await db.sessions(uid)).length;
await main(page).getByTestId("progress-log-workout").click();
await main(page).getByTestId("log-panel").waitFor();
await main(page).getByTestId("log-text").fill(MSG);
await main(page).getByTestId("log-fill").click();
const logRows = main(page).getByTestId("log-row");
ok(await logRows.count() === 5, `the message becomes five exercises (${await logRows.count()})`);
const statuses = await main(page).getByTestId("row-status").evaluateAll((els) => els.map((e) => e.dataset.status));
ok(statuses.join() === "library,none,library,library,library", `russian twist, leg raises, pass-through and halos from the library, tridents new (${statuses.join()})`);
ok(await main(page).getByTestId("log-save").isDisabled(), "can't save while tridents has no muscles");
ok(/Which muscle/.test(await main(page).getByTestId("log-blocker").innerText()), "…and it says why");
const trident = logRows.nth(1);
await trident.getByTestId("primary-core").click();
await trident.getByTestId("secondary-frontDelts").click();
await logRows.nth(0).getByTestId("row-kg").fill("12");
await logRows.nth(0).getByRole("button", { name: "Right", exact: true }).click();
await main(page).getByTestId("log-title").fill("Kettlebell core");
ok(await main(page).getByTestId("log-save").isEnabled(), "with muscles picked, it can be saved");
ok(/Save 5 exercises · 15 sets/i.test(await main(page).getByTestId("log-save").innerText()), "the button says what will be saved (5 exercises, 15 sets)");
await main(page).getByTestId("log-save").click();
await main(page).getByTestId("log-success").waitFor();
ok(true, "saved → confirmation");
await until(async () => (await db.sessions(uid)).some((s) => s.source === "manual"));
const ms = (await db.sessions(uid)).find((s) => s.source === "manual");
const mlogs = (await db.logs(uid)).filter((l) => l.session_id === ms?.id);
ok(ms && ms.label === "Kettlebell core" && ms.day_key === null, "stored as a manual session with its name, no plan day");
await until(async () => (await db.logs(uid)).filter((l) => l.session_id === ms.id).length === 5);
const ml = (await db.logs(uid)).filter((l) => l.session_id === ms.id);
const rt = ml.find((l) => l.exercise_id === "russiantwist"), tr = ml.find((l) => l.exercise_id === "custom:tridents");
ok(ml.length === 5 && ml.every((l) => l.sets === 3 && l.reps_min === 10 && l.reps_max === 10), "five rows, each 3 × 10");
ok(rt && +rt.load_kg === 12 && rt.feel === "right", "russian twist keeps its library id, 12 kg and the rating");
ok(tr && tr.muscles.join() === "core,frontDelts" && tr.feel === null, "tridents saved under a custom id with the muscles picked");
await until(async () => ((await db.profile(uid)).settings.customExercises || []).some((c) => c.id === "custom:tridents"));
ok(((await db.profile(uid)).settings.customExercises || []).some((c) => c.id === "custom:tridents" && c.primary === "core"), "the new move is remembered in the profile");
void mlogs;
await main(page).getByRole("button", { name: /View progress/ }).click();
const optNames = await main(page).getByLabel("Exercise").locator("option").allInnerTexts();
ok(optNames.some((t) => /Tridents/.test(t)) && optNames.some((t) => /Kettlebell Halo/.test(t)), "Progress lists the logged moves by name (Tridents, Kettlebell Halo)");
ok(new RegExp(`SESSIONS LOGGED\\s*${sessionsBeforeLog + 1}\\b`, "i").test(await main(page).getByTestId("progress-stats").innerText()), "the session count includes it");
await page.getByRole("button", { name: "Week", exact: true }).click();
ok(await main(page).getByText("3/3 done").isVisible(), "the weekly plan is untouched (still 3/3)");
const mrow = main(page).getByTestId("history-row").filter({ hasText: "Kettlebell core" });
ok(await mrow.isVisible() && /Logged/i.test(await mrow.innerText()), "Week lists it under Logged this week");
// next time, tridents is recognised
await main(page).getByRole("button", { name: /Log a workout/ }).click();
await main(page).getByTestId("log-text").fill("tridents 3x12");
await main(page).getByTestId("log-fill").click();
ok((await main(page).getByTestId("row-status").first().getAttribute("data-status")) === "custom", "the next time, Tridents is recognised with its muscles");
await main(page).getByRole("button", { name: /Back/ }).click();
// delete it
await main(page).getByTestId("history-row").filter({ hasText: "Kettlebell core" }).getByRole("button", { name: /Delete Kettlebell core/ }).click();
await main(page).getByTestId("history-row").filter({ hasText: "Kettlebell core" }).getByRole("button", { name: "Delete", exact: true }).click();
await until(async () => !(await db.sessions(uid)).some((s) => s.source === "manual"));
ok(!(await db.sessions(uid)).some((s) => s.source === "manual") && !(await db.logs(uid)).some((l) => l.session_id === ms.id), "deleting it removes the session and its sets from the database");
ok(!(await main(page).getByTestId("history-row").filter({ hasText: "Kettlebell core" }).count()) && await main(page).getByText("3/3 done").isVisible(), "…and from the Week tab, plan still 3/3");

/* ── 8. sign out, wrong password, sign back in ────────────────────────────── */
console.log("auth");
await page.getByRole("button", { name: "Open profile" }).click();
ok(new RegExp(esc(EMAIL)).test(await main(page).innerText()), "profile shows the account email");
await main(page).getByRole("button", { name: /Sign out/ }).click();
await page.getByRole("heading", { name: "Welcome back" }).waitFor();
ok(true, "signed out → sign-in screen");
await page.getByPlaceholder("you@example.com").fill(EMAIL);
await page.locator("input[type=password]").fill("wrong-password");
await page.getByRole("button", { name: /^Sign in/ }).click();
// the refusal comes back over the network: wait for it rather than looking once
ok(await page.getByRole("alert").filter({ hasText: "don't match" }).waitFor({ timeout: 5000 }).then(() => true, () => false), "a wrong password is refused with a clear message");
await page.locator("input[type=password]").fill(PASS);
await page.getByRole("button", { name: /^Sign in/ }).click();
await page.getByRole("button", { name: "Week", exact: true }).waitFor();
await page.getByRole("button", { name: "Week", exact: true }).click();
ok(await main(page).getByText("3/3 done").isVisible(), "signed back in: the week is exactly as it was");
await page.reload();
await page.getByRole("button", { name: "Week", exact: true }).waitFor();
await page.getByRole("button", { name: "Week", exact: true }).click();
ok(await main(page).getByText("3/3 done").isVisible(), "a reload keeps you signed in with everything loaded");

/* ── 9. a second user sees nothing ────────────────────────────────────────── */
console.log("isolation");
const ctx2 = await newContext({ width: 390, height: 844 });
const p2 = await open(ctx2);
await p2.getByPlaceholder("https://abcd1234.supabase.co").fill(fake.url);
await p2.getByPlaceholder("sb_publishable_… or eyJhbGciOi…").fill(fake.anonKey);
await p2.getByRole("button", { name: /Connect/ }).click();
await p2.getByRole("button", { name: /Create an account/ }).click();
await p2.getByPlaceholder("Ofek").fill("Someone");
await p2.getByPlaceholder("you@example.com").fill("someone@example.com");
await p2.getByPlaceholder("At least 6 characters").fill("password-2");
await p2.getByRole("button", { name: /Create account/ }).click();
await p2.getByRole("button", { name: /Continue/ }).waitFor();
const uid2 = await db.user("someone@example.com");
ok(!(await p2.getByText(/Ofek/).count()) && (await db.logs(uid2)).length === 0, "a second account starts empty — none of Ofek's data");
await ctx2.close();

/* ── 10. layout ───────────────────────────────────────────────────────────── */
console.log("layout");
await page.setViewportSize({ width: 360, height: 780 });
for (const tab of ["Week", "Body", "Workout", "Now", "Progress"]) {
  await page.getByRole("button", { name: tab, exact: true }).click();
  await wait(150);
  const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  ok(over <= 0, `${tab} fits 360px (overflow ${over}px)`);
}
await page.getByRole("button", { name: "Now", exact: true }).click();
await main(page).getByTestId("now-log-workout").click();
await main(page).getByTestId("log-text").fill("3x10 all: tridents, halos, renegade rows");
await main(page).getByTestId("log-fill").click();
await wait(150);
ok((await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)) <= 0, "Log a workout fits 360px (with the muscle picker open)");
await page.screenshot({ path: "tests/shots/log-mobile.png", fullPage: true }).catch(() => {});
await page.getByRole("button", { name: "Open profile" }).click();
ok((await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)) <= 0, "Profile fits 360px");

const desk = await open(ctx);
await desk.setViewportSize({ width: 1360, height: 900 });
await desk.getByRole("button", { name: "Progress", exact: true }).waitFor();
await desk.getByRole("button", { name: "Progress", exact: true }).click();
ok(await main(desk).getByTestId("progress-panel").isVisible(), "desktop: Progress tab");
await desk.screenshot({ path: "tests/shots/progress-desktop.png" }).catch(() => {});
await desk.getByRole("button", { name: "Open profile" }).click();
ok(await desk.getByRole("heading", { name: "Profile" }).isVisible(), "desktop: profile opens as a drawer");

/* ── 11. the bells you own ─────────────────────────────────────────────────── */
console.log("owned bells");
await page.setViewportSize({ width: 390, height: 844 });
await page.getByRole("button", { name: "Open profile" }).click();
const picker = main(page).getByTestId("weights-kettlebell");
ok(await picker.isVisible(), "owning a kettlebell asks which bells");
await picker.getByRole("button", { name: "6 kg kettlebell", exact: true }).click();
await picker.getByRole("button", { name: "14 kg kettlebell", exact: true }).click();
await until(async () => JSON.stringify((await db.profile(uid)).settings.weights?.kettlebell) === "[6,14]");
ok(JSON.stringify((await db.profile(uid)).settings.weights?.kettlebell) === "[6,14]", "the bells are saved to the profile (6 and 14 kg)");
await page.getByRole("button", { name: "Week", exact: true }).click();
await main(page).getByTestId("week-day").first().click();
await wait(300);
const loads = await main(page).locator("article").evaluateAll((arts) => arts.map((a) => {
  const t = a.innerText; const m = /(\d+(?:\.\d+)?) kg\s*(YOUR BELL|HEAVIEST|EACH|TOTAL)/i.exec(t); return m ? { kg: +m[1], label: m[2].toLowerCase() } : null;
}).filter(Boolean));
ok(loads.length > 0 && loads.every((l) => l.kg === 6 || l.kg === 14), `every weight asked for is a bell you own (${loads.map((l) => l.kg).join(", ")})`);
const bellCard = main(page).locator("article").filter({ hasText: /your bell|heaviest/i }).first();
const less = bellCard.getByRole("button", { name: /^Less weight/ }), more = bellCard.getByRole("button", { name: /^More weight/ });
if (await less.isEnabled()) await less.click();
ok(/\b6 kg/.test(await bellCard.innerText()) && await less.isDisabled(), "− goes to the 6 kg bell and stops there");
await more.click();
ok(/\b14 kg/.test(await bellCard.innerText()) && await more.isDisabled(), "+ goes straight to the 14 kg bell — nothing in between, nothing heavier");

/* ── 12. the week starts on your day, in your zone ────────────────────────── */
console.log("week start");
await page.getByRole("button", { name: "Open profile" }).click();
const ws = main(page).getByTestId("week-settings");
for (const [day, n, text] of [["Monday", 1, "Monday to Sunday"], ["Sunday", 0, "Sunday to Saturday"]]) {
  await ws.getByRole("button", { name: day, exact: true }).click();
  await until(async () => (await db.profile(uid)).settings.weekStartsOn === n);
  await page.getByRole("button", { name: "Week", exact: true }).click();
  ok((await db.profile(uid)).settings.weekStartsOn === n && new RegExp(text).test(await main(page).getByTestId("week-status").innerText()), `week starts on ${day}: saved, and the Week tab says "${text}"`);
  await page.getByRole("button", { name: "Open profile" }).click();
}
ok(!!(await db.profile(uid)).settings.timeZone, `the home time zone is saved with the profile (${(await db.profile(uid)).settings.timeZone})`);

ok(errors.length === 0, `no page errors${errors.length ? ": " + errors.join(" | ") : ""}`);
await browser.close();
await fake.close();
web.close();
console.log(failures ? `\n❌ ${failures} FAILURES` : "\n✅ end-to-end contract holds");
process.exit(failures ? 1 : 0);
