// Capture the WEB buyer app at the three App Store device sizes.
//
// IMPORTANT: these are screenshots of the responsive WEB app, not the native
// iOS app. Use them for the marketing site or as quick references. The ACTUAL
// App Store screenshots must come from the iOS app (Simulator/TestFlight) —
// see docs/app-store/screenshots.md. Feed real iOS captures into
// make-mockups.py for framed listing images.
//
// Usage:
//   cd scripts/screenshots && npm install && npx playwright install chromium
//   BASE_URL=https://xportacar.vercel.app \
//   BUYER_EMAIL=buyer@xportacar.com BUYER_PASSWORD=Demo!1234 \
//   AUCTION_ID=22222222-0001-0000-0000-000000000999 \
//   npm run capture
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const BASE = process.env.BASE_URL ?? "https://xportacar.vercel.app";
const EMAIL = process.env.BUYER_EMAIL ?? "buyer@xportacar.com";
const PASSWORD = process.env.BUYER_PASSWORD ?? "Demo!1234";
const AUCTION_ID = process.env.AUCTION_ID ?? "";

// width/height are CSS px; deviceScaleFactor scales to the App Store pixel size.
const DEVICES = {
  "6.7-inch_1290x2796": { width: 430, height: 932, deviceScaleFactor: 3 },
  "6.5-inch_1284x2778": { width: 428, height: 926, deviceScaleFactor: 3 },
  "5.5-inch_1242x2208": { width: 414, height: 736, deviceScaleFactor: 3 },
};

// label -> path (relative to BASE). Auction/won require AUCTION_ID.
const SCREENS = () => {
  const s = [
    ["marketplace", "/marketplace"],
    ["vehicle", null], // resolved by clicking the first card
  ];
  if (AUCTION_ID) {
    s.push(["auction", `/auction/${AUCTION_ID}`]);
    s.push(["won", `/auction/${AUCTION_ID}/won`]);
  }
  return s;
};

async function login(page) {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  try {
    await page.fill('input[name="email"]', EMAIL);
    await page.fill('input[name="password"]', PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForLoadState("networkidle");
  } catch {
    console.warn("Login form not found / changed — capturing public pages only.");
  }
}

async function run() {
  const browser = await chromium.launch();
  for (const [sizeName, vp] of Object.entries(DEVICES)) {
    const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: vp.deviceScaleFactor });
    const page = await context.newPage();
    await login(page);

    const outDir = path.join("web-capture", sizeName);
    await mkdir(outDir, { recursive: true });

    for (const [label, rel] of SCREENS()) {
      try {
        if (rel) {
          await page.goto(`${BASE}${rel}`, { waitUntil: "networkidle" });
        } else {
          await page.goto(`${BASE}/marketplace`, { waitUntil: "networkidle" });
          const card = page.locator('a[href^="/vehicle/"]').first();
          if (await card.count()) { await card.click(); await page.waitForLoadState("networkidle"); }
        }
        await page.waitForTimeout(800);
        await page.screenshot({ path: path.join(outDir, `${label}.png`) }); // viewport-sized
        console.log(`captured ${sizeName}/${label}.png`);
      } catch (e) {
        console.warn(`skip ${sizeName}/${label}: ${e.message}`);
      }
    }
    await context.close();
  }
  await browser.close();
  console.log("Done. Raw web captures in scripts/screenshots/web-capture/.");
}

run().catch((e) => { console.error(e); process.exit(1); });
