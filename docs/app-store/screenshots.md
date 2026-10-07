# App Store screenshots — what is on the store, and the capture route (no iPhone needed)

## 1.0.1 uses the 1.0 screenshots (Chase's decision, 2026-10-07)
Both 1.0.1 versions carry the live 1.0 screenshots, copied byte for byte at every
size the 1.0 versions have (iPhone 6.5" and iPad 13"): buyer 3 + 3, inspector 5 + 5.
Checked before submission against Apple's recorded source MD5: same files, same
order as the live 1.0, every asset COMPLETE, and identical to these repo copies:
- `docs/app-store/screenshots/buyer/{6.5,ipad-13}/` — the buyer set (shows the
  earlier bidding screens)
- `docs/app-store/screenshots/inspector/{6.5,ipad-13}/` — the inspector set

The new inspector captures made for 1.0.1 (details, pricing, photos, damage, paint)
were not used. They are kept in commit a6f6410, e.g.
`git show a6f6410:docs/app-store/screenshots/inspector/6.5/1-details.png`.

## Capture route for a future version
New screenshots can be captured from the **real app code**, built for web from the
exact commit of the App Store build and rendered in Chrome device emulation at App
Store pixel sizes — no device, no Simulator. Text renders in the Windows system font
instead of San Francisco; layout, colours and copy are the app's own. Tools:
`scripts/screenshots/` (see its README for the commands).

## Sizes App Store Connect asks for (checked in its Media Manager, 2026-10-07)
| Set (API display type) | Pixels | Status |
|---|---|---|
| iPhone 6.5" — `APP_IPHONE_65` | 1284 × 2778 | uploaded; App Store Connect scales it to the **required** iPhone 6.1"/6.3" size ("Using Existing Assets") |
| iPad 13" — `APP_IPAD_PRO_3GEN_129` | 2064 × 2752 | **required** (both apps set `supportsTablet: true`) |
| iPhone Duo, Apple Watch | — | optional (iPhone Duo becomes required for iOS 27.1-SDK builds from April 2027) |

PNG, RGB, no alpha. 3–10 per set.

If the buyer set is re-shot, the wanted screens are **marketplace**, **vehicle**
(price + Buy now), **report** (inspection report), **purchases** and **invoice**
(headlines in `make-store-shots.py`). The App Review demo listing
(`demo-photo-credits.md`) is live until 2026-10-14 and is deleted after review.

## Accounts used for capture
- Inspector: `inspector@xportacar.com` / `Demo!1234`
- Buyer: the App Review buyer `chasebitz0613+appreview@gmail.com` (KYC verified;
  password only in App Store Connect's Sign-In Information — never commit it).

## 1.0 set (history)
The 1.0 screenshots (`buyer/*`, `inspector/*`) were phone captures framed by
`make-mockups.py` / `make-ipad.py`. The `6.7` and `5.5` folders of both apps are
sizes that are not on the store (neither the 1.0 nor the 1.0.1 version has those sets).
