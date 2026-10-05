// node scripts/print-pdf.mjs <html file> <out.pdf>
import { chromium } from "playwright";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

const [html, out] = process.argv.slice(2);
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(pathToFileURL(resolve(html)).href);
await page.pdf({ path: out, format: "Letter", margin: { top: "0.6in", right: "0.6in", bottom: "0.6in", left: "0.6in" }, printBackground: true });
await browser.close();
