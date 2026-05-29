# App Store screenshots — spec & capture guide

Both apps are React Native / Expo, so **real App Store screenshots must be
captured from the iOS app** (Simulator or device). This environment (Windows,
no iOS Simulator) cannot produce them automatically — hence this manual guide
plus the tooling in `scripts/screenshots/` for framing them.

## Required sizes (upload at least one set; 6.7" + 6.5" + 5.5" recommended)
| Display | Pixels (portrait) | Simulator device |
|---|---|---|
| 6.7" | 1290 × 2796 | iPhone 16 Pro Max / 15 Pro Max |
| 6.5" | 1284 × 2778 (or 1242 × 2688) | iPhone 11 Pro Max / XS Max |
| 5.5" | 1242 × 2208 | iPhone 8 Plus |

Provide 3–5 per app minimum (Apple allows up to 10).

## How to capture from the iOS Simulator
1. Build/run the app on the simulator (`eas build` install, or `npx expo run:ios`
   with a dev build, or install the TestFlight build on a device).
2. Boot the target device: **Simulator → File → Open Simulator → iPhone 16 Pro Max** (etc.).
3. Put the app in the desired state (see per-screen states below).
4. Capture: **Simulator → File → Save Screen** (⌘S), or:
   `xcrun simctl io booted screenshot ~/Desktop/shot.png`
   The PNG is already at the device's native pixel size.
5. Rename per the lists below and drop into
   `scripts/screenshots/input/buyer/` or `.../inspector/`, then run
   `python scripts/screenshots/make-mockups.py` to produce framed listing images.

> Tip: run the demo seed `supabase/seed_demo_porsche.sql` first so there's a
> Guards-Red Porsche 911 with a **live auction** to photograph.

## Demo state / credentials
- Buyer: `buyer@xportacar.com` / `Demo!1234`
- Inspector: `inspector@xportacar.com` / `Demo!1234`
- Admin (for context): `admin@xportacar.com` / `Demo!1234`

---

## Buyer app (com.xportacar.buyer) — 5 screens
Save as the filename in **bold**; the mockup generator adds the headline.

1. **marketplace.png** — Marketplace tab, grid of vehicles (run the seed so the
   Porsche + demo cars show). Scroll so several cards are visible.
2. **vehicle.png** — A vehicle detail screen showing the photo gallery + specs.
   Open the Porsche 911. Optionally open the condition report to show the
   paint-thickness entry.
3. **auction.png** — The live auction screen with the **countdown timer** and
   current bid visible (the seeded auction ends in 1h, so the timer is live).
4. **bidding.png** — The bid panel in focus: amount input, +/- steppers, and the
   "Set maximum bid" toggle / Buy Now button visible.
5. **won.png** — The "You won" / invoice screen: hammer price, 2.9% fee, shipping,
   total, and the 36h-confirm / 5-working-day payment timeline. (Use Buy Now on
   the seeded auction as the demo buyer to reach this screen.)

## Inspector app (com.xportacar.inspector) — 5 screens
1. **list.png** — The inspector's inspections/dashboard list.
2. **photos.png** — Inspection wizard, Photos step (step 2): the photo-capture grid.
3. **damage.png** — Damage step (step 3): a panel with a damage severity selected.
4. **paint.png** — Damage step showing the **Paint Thickness Test** card with a
   captured reading thumbnail.
5. **review.png** — Review/submit step (step 5) with the summary before submitting.

---

## Notes for the listing
- Keep the status bar clean (Simulator shows a default time/battery — acceptable;
  for a perfect status bar use `xcrun simctl status_bar booted override --time 9:41`).
- Don't show real personal data — the demo accounts/seed are safe placeholders.
- The framed mockups (from `make-mockups.py`) are what you upload; the headlines
  there are defined in that script and can be edited.
