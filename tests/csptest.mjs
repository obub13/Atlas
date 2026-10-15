// The production Content-Security-Policy from netlify.toml, applied to the real
// build: nothing the app needs may be blocked (scripts, styles, fonts, icons,
// the service worker, and the database connection).
import { chromium } from "playwright";
import http from "http";
import { readFileSync, existsSync, statSync } from "fs";
import path from "path";
import { startFakeSupabase } from "./fake-supabase.mjs";

const toml = readFileSync("netlify.toml", "utf8");
const csp = /Content-Security-Policy = "([^"]+)"/.exec(toml)[1];
const fake = await startFakeSupabase();
// production allows https://*.supabase.co; the local stand-in's origin is added for the test only
const testCsp = csp.replace("connect-src 'self'", `connect-src 'self' ${fake.url}`);
const DIST = path.resolve("dist");
const web = http.createServer((req, res) => {
  let f = path.join(DIST, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (!existsSync(f) || statSync(f).isDirectory()) f = path.join(DIST, "index.html");
  const t = { ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".webmanifest": "application/manifest+json" }[path.extname(f)] || "text/html";
  res.writeHead(200, { "content-type": t, "content-security-policy": testCsp }); res.end(readFileSync(f));
});
await new Promise((r) => web.listen(0, "127.0.0.1", r));
const b = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
const p = await ctx.newPage();
const violations = [];
p.on("console", (m) => { if (/Content Security Policy|Refused to/i.test(m.text())) violations.push(m.text()); });
await p.goto(`http://127.0.0.1:${web.address().port}/`);
await p.getByPlaceholder("https://abcd1234.supabase.co").fill(fake.url);
await p.getByPlaceholder("sb_publishable_… or eyJhbGciOi…").fill(fake.anonKey);
await p.getByRole("button", { name: /Connect/ }).click();
await p.getByRole("button", { name: /Create an account/ }).click();
await p.getByPlaceholder("Ofek").fill("Ofek");
await p.getByPlaceholder("you@example.com").fill("csp@example.com");
await p.getByPlaceholder("At least 6 characters").fill("password-1");
await p.getByRole("button", { name: /Create account/ }).click();
await p.getByRole("button", { name: /Continue/ }).waitFor();
const swOk = await p.evaluate(async () => { try { await navigator.serviceWorker.register("/sw.js"); return true; } catch { return false; } });
const real = violations;
console.log(real.length ? real.map((v) => "  ❌ " + v).join("\n") : "  ✓ no CSP violations through connect → sign up → onboarding");
console.log(swOk ? "  ✓ service worker registers under the CSP" : "  ❌ service worker blocked");
await b.close(); await fake.close(); web.close();
const failed = real.length > 0 || !swOk;
console.log(failed ? "\n❌ CSP blocks the app" : "\n✅ production CSP fits the app");
process.exit(failed ? 1 : 0);
