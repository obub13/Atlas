// Installed on a phone, the app draws under the status bar (clock, signal,
// battery) and above the home indicator. Simulate an iPhone with a Dynamic
// Island (47px top, 34px bottom) and check nothing tappable sits under either.
import { chromium } from "playwright";
import http from "http";
import { readFileSync, existsSync, statSync } from "fs";
import path from "path";
import { startFakeSupabase } from "./fake-supabase.mjs";

const TOP = 47, BOTTOM = 34, W = 390, H = 844;
let failures = 0;
const ok = (c, m) => { if (!c) { failures++; console.log("  ❌ " + m); } else console.log("  ✓ " + m); };
const fake = await startFakeSupabase();
const DIST = path.resolve("dist");
const web = http.createServer((req, res) => {
  let f = path.join(DIST, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (!existsSync(f) || statSync(f).isDirectory()) f = path.join(DIST, "index.html");
  const t = { ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml" }[path.extname(f)] || "text/html";
  res.writeHead(200, { "content-type": t }); res.end(readFileSync(f));
});
await new Promise((r) => web.listen(0, "127.0.0.1", r));
const b = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const ctx = await b.newContext({ viewport: { width: W, height: H } });
await ctx.addInitScript(([t, bt]) => {
  window.__ATLAS_NO_SW__ = true;
  document.addEventListener("DOMContentLoaded", () => {
    const s = document.createElement("style");
    s.textContent = `:root { --sat: ${t}px !important; --sab: ${bt}px !important; }`;
    document.head.appendChild(s);
  });
}, [TOP, BOTTOM]);
const p = await ctx.newPage();
await p.goto(`http://127.0.0.1:${web.address().port}/`);

// every visible button/input must sit fully inside the safe area
const unsafe = () => p.evaluate(([top, bottom, h]) => [...document.querySelectorAll("button, input, select, a")]
  .filter((el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width && r.height && cs.visibility !== "hidden" && r.bottom > 0 && r.top < h; })
  .filter((el) => { const r = el.getBoundingClientRect(); const fixed = el.closest("header, nav, [data-testid=rest-timer]"); return fixed ? r.top < top || r.bottom > h - bottom : false; })
  .map((el) => (el.getAttribute("aria-label") || el.textContent || el.tagName).trim().slice(0, 30)), [TOP, BOTTOM, H]);
const firstTop = (sel) => p.locator(sel).first().evaluate((el) => el.getBoundingClientRect().top);

ok(await firstTop("h1") >= TOP, "setup screen title clears the status bar");
await p.getByPlaceholder("https://abcd1234.supabase.co").fill(fake.url);
await p.getByPlaceholder("sb_publishable_… or eyJhbGciOi…").fill(fake.anonKey);
await p.getByRole("button", { name: /Connect/ }).click();
await p.getByRole("button", { name: /Create an account/ }).click();
ok(await firstTop("h1") >= TOP, "sign-in screen title clears the status bar");
await p.getByPlaceholder("Ofek").fill("Ofek");
await p.getByPlaceholder("you@example.com").fill("safe@example.com");
await p.getByPlaceholder("At least 6 characters").fill("password-1");
await p.getByRole("button", { name: /Create account/ }).click();
await p.getByRole("button", { name: /Continue/ }).waitFor();
ok(await firstTop("h1") >= TOP, "onboarding clears the status bar");
await p.getByRole("button", { name: /Continue/ }).click();
await p.getByRole("button", { name: /Intermediate/ }).click();
await p.getByRole("button", { name: /Continue/ }).click();
await p.getByRole("button", { name: /Muscle Building/ }).click();
await p.getByRole("button", { name: /Continue/ }).click();
await p.getByRole("button", { name: /Continue/ }).click();
const startBtn = p.getByRole("button", { name: /Start training/ });
const sb = await startBtn.boundingBox();
ok(sb && sb.y + sb.height <= H, "onboarding's last button is on screen");
await startBtn.click();

const header = await p.getByTestId("app-header").boundingBox();
const brandTop = await p.getByTestId("app-header").locator("span").first().evaluate((el) => el.getBoundingClientRect().top);
ok(brandTop >= TOP, `header content starts below the status bar (${Math.round(brandTop)}px ≥ ${TOP})`);
ok(header.height >= 56 + TOP - 1, `header grows by the inset (${Math.round(header.height)}px)`);
const navBtns = await p.getByTestId("bottom-nav").locator("button").evaluateAll((els) => els.map((e) => e.getBoundingClientRect().bottom));
ok(navBtns.every((b) => b <= H - BOTTOM + 0.5), "bottom tabs sit above the home indicator");
for (const tab of ["Week", "Body", "Now", "Progress"]) {
  await p.getByRole("button", { name: tab, exact: true }).click();
  const bad = await unsafe();
  ok(bad.length === 0, `${tab}: nothing tappable under the status bar or home indicator${bad.length ? " — " + bad.join(", ") : ""}`);
}
// rest timer above the tab bar
await p.getByRole("button", { name: "Body", exact: true }).click();
await p.locator("main:visible").getByRole("button", { name: /Build my routine/ }).click();
await p.locator("main:visible").getByRole("button", { name: /^Set 1 of / }).first().click();
const timer = await p.getByTestId("rest-timer").locator("[role=timer]").boundingBox();
const navTop = (await p.getByTestId("bottom-nav").boundingBox()).y;
ok(timer && timer.y + timer.height <= navTop, "rest timer floats above the tab bar");
// last content scrolls clear of the tab bar
await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
const lastBottom = await p.locator("main:visible > *").last().evaluate((el) => el.getBoundingClientRect().bottom);
ok(lastBottom <= navTop + 1, "the end of the page scrolls fully clear of the tab bar");
// sticky header still covers the inset while scrolled
const hdrTop = (await p.getByTestId("app-header").boundingBox()).y;
ok(Math.abs(hdrTop) < 1, "header stays pinned to the very top while scrolling (its background covers the status bar)");
await p.screenshot({ path: "tests/shots/safearea.png" });

await b.close(); await fake.close(); web.close();
console.log(failures ? `\n❌ ${failures} FAILURES` : "\n✅ safe areas respected");
process.exit(failures ? 1 : 0);
