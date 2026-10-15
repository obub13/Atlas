// Screenshots of the app with six weeks of simulated training (docs + review).
import { chromium } from "playwright";
import http from "http";
import { readFileSync, existsSync, statSync } from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import { startFakeSupabase } from "./fake-supabase.mjs";
import { seedDemo } from "./seed-demo.mjs";

const fake = await startFakeSupabase();
const c = createClient(fake.url, fake.anonKey, { auth: { persistSession: false } });
const { data } = await c.auth.signUp({ email: "demo@example.com", password: "demo-password", options: { data: { display_name: "Ofek" } } });
await seedDemo(c, data.user.id);
const DIST = path.resolve("dist");
const web = http.createServer((req, res) => {
  let f = path.join(DIST, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (!existsSync(f) || statSync(f).isDirectory()) f = path.join(DIST, "index.html");
  const t = { ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png" }[path.extname(f)] || "text/html";
  res.writeHead(200, { "content-type": t }); res.end(readFileSync(f));
});
await new Promise((r) => web.listen(0, "127.0.0.1", r));
const b = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
for (const [name, vp] of [["mobile", { width: 390, height: 844 }], ["desktop", { width: 1360, height: 900 }]]) {
  const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: 2 });
  await ctx.addInitScript(([u, k]) => { window.__ATLAS_NO_SW__ = true; localStorage.setItem("atlas:supabase", JSON.stringify({ url: u, anonKey: k })); }, [fake.url, fake.anonKey]);
  const p = await ctx.newPage();
  await p.goto(`http://127.0.0.1:${web.address().port}/`);
  await p.getByPlaceholder("you@example.com").fill("demo@example.com");
  await p.locator("input[type=password]").fill("demo-password");
  await p.getByRole("button", { name: /^Sign in/ }).click();
  await p.getByRole("button", { name: "Progress", exact: true }).first().waitFor();
  await p.getByRole("button", { name: "Progress", exact: true }).click();
  await p.waitForTimeout(500);
  const sel = p.locator("main:visible").getByLabel("Exercise");
  const opts = await sel.locator("option").allTextContents();
  const pick = opts.findIndex((o) => /Goblet|Press|Row|Squat/.test(o));
  if (pick >= 0) await sel.selectOption({ index: pick });
  await p.waitForTimeout(300);
  await p.locator("main:visible").getByTestId("progress-panel").screenshot({ path: `tests/shots/demo-progress-${name}.png` });
  await ctx.close();
}
await b.close(); await fake.close(); web.close();
console.log("shots written to tests/shots/");
