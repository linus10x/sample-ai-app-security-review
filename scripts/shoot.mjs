// node scripts/shoot.mjs <html file> <out.png> [width height] [anchor id]
import { chromium } from "playwright";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

const [html, out, w = "1000", h = "750", anchor] = process.argv.slice(2);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: Number(w), height: Number(h) }, deviceScaleFactor: 1 });
await page.goto(pathToFileURL(resolve(html)).href + (anchor ? `#${anchor}` : ""));
if (anchor) await page.evaluate((id) => document.getElementById(id)?.scrollIntoView(), anchor);
await page.screenshot({ path: out });
await browser.close();
