// Render public/icon.svg to the PNG sizes the manifest and iOS need.
import { chromium } from "playwright";
import { readFileSync } from "fs";
const svg = readFileSync(new URL("../public/icon.svg", import.meta.url), "utf8");
const b = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
for (const size of [192, 512]) {
  const p = await b.newPage({ viewport: { width: size, height: size } });
  await p.setContent(`<html><body style="margin:0;background:#0B1016">${svg.replace("<svg ", `<svg width="${size}" height="${size}" `)}</body></html>`);
  await p.screenshot({ path: new URL(`../public/icon-${size}.png`, import.meta.url).pathname });
}
await b.close();
