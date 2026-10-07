// Capture the REAL buyer / inspector app UI for App Store screenshots — no iPhone needed.
//
// The Expo apps are built for web from the exact commit of the App Store build and rendered
// in Chrome device emulation at App Store pixel sizes (CSS viewport x device scale factor):
//   iphone65  428 x 926  @3x = 1284 x 2778   (6.5" set; App Store Connect scales it to the
//                                             required 6.1"/6.3" size)
//   ipad13   1032 x 1376 @2x = 2064 x 2752   (13" iPad set, the app's real tablet layout)
// Frame the raw captures afterwards with make-store-shots.py. Full route: README.md.
//
// usage:
//   APP_EMAIL=... APP_PASSWORD=... node capture-app-web.mjs <inspector|buyer> <iphone65|ipad13> <baseUrl> <outDir>
//   CDP_URL=http://127.0.0.1:9222 to drive an already-running Chrome (isolated context),
//   otherwise Playwright's own Chromium is launched (npx playwright install chromium).
//
// Nothing is written to the database: the inspector scenario never presses Submit and types
// no vehicle data (the wizard only writes on Submit; drafts stay in this browser context);
// the buyer scenario only opens screens.
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const [, , app, device, base, outDir] = process.argv;
const DEVICES = {
  iphone65: { viewport: { width: 428, height: 926 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true,
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1" },
  ipad13: { viewport: { width: 1032, height: 1376 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
    userAgent: "Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1" },
};
if (!DEVICES[device] || !["inspector", "buyer"].includes(app) || !base || !outDir) {
  console.error("usage: node capture-app-web.mjs <inspector|buyer> <iphone65|ipad13> <baseUrl> <outDir>");
  process.exit(1);
}
fs.mkdirSync(outDir, { recursive: true });

const browser = process.env.CDP_URL ? await chromium.connectOverCDP(process.env.CDP_URL) : await chromium.launch();
const context = await browser.newContext({ ...DEVICES[device], locale: "en-US", timezoneId: "Asia/Dubai" });
const page = await context.newPage();
const shot = async (name) => { await page.waitForTimeout(1200); await page.screenshot({ path: path.join(outDir, `${name}.png`) }); console.log("captured", name); };
const tapLast = async (text) => {
  const loc = page.getByText(text, { exact: true });
  const n = await loc.count();
  if (!n) throw new Error(`no element with text "${text}"`);
  await loc.nth(n - 1).click();
};

async function signIn() {
  await page.goto(base, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForTimeout(5000);
  const inputs = page.locator("input");
  await inputs.nth(0).fill(process.env.APP_EMAIL ?? "");
  await inputs.nth(1).fill(process.env.APP_PASSWORD ?? "");
  await tapLast("Sign in");
  await page.waitForTimeout(9000);
}

async function inspector() {
  await signIn();
  await tapLast("Start a new inspection");
  await page.waitForTimeout(4000);
  await shot("2-details");
  const price = page.getByText(/^Asking price/).first();
  await price.evaluate((el) => el.scrollIntoView({ block: "center" }));
  await shot("3-pricing");
  for (const name of ["4-photos", "5-damage", "6-paint"]) {
    await tapLast("Next");
    await page.waitForTimeout(2500);
    await shot(name);
  }
}

// Buyer: marketplace + purchases verified on 2026-10-07 (with 0 listings). The vehicle,
// inspection-report and invoice steps need a live listing / an order and are UNTESTED
// until the marketplace has inventory — check the captures on the first run.
async function buyer() {
  await signIn();
  await shot("marketplace");
  const price = page.getByText(/€\s?[\d,.]+/).first();
  if (await price.count()) {
    await price.click();
    await page.waitForTimeout(5000);
    await shot("vehicle");
    const report = page.getByText("Inspection report", { exact: true }).first();
    if (await report.count()) { await report.evaluate((el) => el.scrollIntoView({ block: "start" })); await shot("report"); }
    await page.goBack().catch(() => {});
  } else {
    console.log("no listing in the marketplace - vehicle/report screens skipped");
  }
  await tapLast("Purchases");
  await page.waitForTimeout(4000);
  await shot("purchases");
  const order = page.getByText("View order", { exact: true }).first();
  if (await order.count()) { await order.click(); await page.waitForTimeout(6000); await shot("invoice"); }
  else console.log("no purchases - invoice screen skipped");
}

try {
  await (app === "inspector" ? inspector() : buyer());
} catch (e) {
  console.error("ERROR", e.message);
  await page.screenshot({ path: path.join(outDir, "error.png") });
} finally {
  await context.close();
  // Launched Chromium: close it. Attached Chrome (CDP): only drop our own context and exit —
  // never browser.close(), which can tear down contexts of the user's running Chrome.
  if (process.env.CDP_URL) setTimeout(() => process.exit(0), 50);
  else await browser.close();
}
