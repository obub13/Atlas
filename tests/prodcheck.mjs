// The production build has the live project baked in: it must open straight on sign-in.
import { chromium } from "playwright";
import http from "http";
import { readFileSync, existsSync, statSync } from "fs";
import path from "path";
const DIST = path.resolve("dist");
const web = http.createServer((req, res) => {
  let f = path.join(DIST, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (!existsSync(f) || statSync(f).isDirectory()) f = path.join(DIST, "index.html");
  const t = { ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml" }[path.extname(f)] || "text/html";
  res.writeHead(200, { "content-type": t }); res.end(readFileSync(f));
});
await new Promise((r) => web.listen(0, "127.0.0.1", r));
const b = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const p = await b.newPage();
await p.goto(`http://127.0.0.1:${web.address().port}/`);
const ok = await p.getByRole("heading", { name: "Welcome back" }).isVisible({ timeout: 10000 }).catch(() => false)
  || await p.getByRole("heading", { name: "Welcome back" }).waitFor({ timeout: 10000 }).then(() => true).catch(() => false);
const host = await p.locator("text=jhtbqxozscfgxwtsdzjs.supabase.co").count();
console.log(ok && host ? "✅ production build opens on sign-in, wired to jhtbqxozscfgxwtsdzjs.supabase.co" : "❌ production build didn't open on sign-in");
await b.close(); web.close(); process.exit(ok && host ? 0 : 1);
