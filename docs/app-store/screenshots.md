# App Store screenshots — spec & capture route (no iPhone needed)

Since 1.0.1 (2026-10-07) the screenshots are captured from the **real app code**,
built for web from the exact commit of the App Store build and rendered in Chrome
device emulation at App Store pixel sizes — no device, no Simulator. Text renders in
the Windows system font instead of San Francisco; layout, colours and copy are the
app's own. Tools: `scripts/screenshots/` (see its README for the commands).

## Sizes App Store Connect asks for (checked in its Media Manager, 2026-10-07)
| Set (API display type) | Pixels | Status |
|---|---|---|
| iPhone 6.5" — `APP_IPHONE_65` | 1284 × 2778 | uploaded; App Store Connect scales it to the **required** iPhone 6.1"/6.3" size ("Using Existing Assets") |
| iPad 13" — `APP_IPAD_PRO_3GEN_129` | 2064 × 2752 | **required** (both apps set `supportsTablet: true`); captured at the real iPad layout |
| iPhone Duo, Apple Watch | — | optional (iPhone Duo becomes required for iOS 27.1-SDK builds from April 2027) |

PNG, RGB, no alpha. 3–10 per set.

## Inspector app (com.xportacar.inspector) — 1.0.1 set, UPLOADED
`docs/app-store/screenshots/inspector/{6.5,ipad-13}/`
1. **1-details.png** — "Capture Vehicle Details" (wizard step 1)
2. **2-pricing.png** — "Suggest an Asking Price" (pricing block of step 1)
3. **3-photos.png** — "Document Every Angle" (step 2)
4. **4-damage.png** — "Tag Damage Panel by Panel" (step 3, with the Paint Thickness Test)
5. **5-paint.png** — "Record Paint Thickness" (step 4)

Captured as `inspector@xportacar.com` via "Start a new inspection"; no data is typed
and Submit is never pressed, so nothing reaches the database (grey values in the
fields are the app's own placeholders).

## Buyer app (com.xportacar.buyer) — 1.0.1 set, NOT YET CAPTURED
Wanted: **marketplace**, **vehicle** (price + Buy now), **report** (inspection
report), **purchases**, **invoice** (headlines in `make-store-shots.py`).
Blocked on 2026-10-07: the marketplace had **0 live listings** and sample vehicles
are not to be created, so the vehicle screens cannot be shown; purchases/invoice
also need an order. The copied 1.0 screenshots (bidding) were removed from the
1.0.1 version so it cannot be submitted with them.

## Accounts used for capture
- Inspector: `inspector@xportacar.com` / `Demo!1234`
- Buyer: the App Review buyer `chasebitz0613+appreview@gmail.com` (KYC verified;
  password only in App Store Connect's Sign-In Information — never commit it).

## 1.0 set (history)
The 1.0 screenshots (`buyer/*`, `inspector/{6.7,5.5}`) were phone captures framed
by `make-mockups.py` / `make-ipad.py`. The buyer ones show bidding and are still
on the live 1.0 listing until 1.0.1 is released.
