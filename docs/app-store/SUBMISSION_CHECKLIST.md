# App Store submission checklist (manual steps in App Store Connect)

Covers both apps. Everything Claude Code could generate is in this `docs/app-store/`
folder; this checklist is the work that must be done by hand in
[App Store Connect](https://appstoreconnect.apple.com) (team: **Jon Anderson,
PJ93UCU3CM**).

| App | Bundle ID | Metadata file |
|---|---|---|
| XportACar (Buyer) | `com.xportacar.buyer` | `buyer-metadata.md` |
| XportACar Inspection | `com.xportacar.inspector` | `inspector-metadata.md` |

> 🚩 **Needs Simon's company info before finalizing** — see the "Blocked on Simon"
> section at the end. Use the temporary placeholders until then.

---

## 0) Prerequisites
- [ ] App records exist in App Store Connect for both bundle IDs (already created).
- [ ] A build is uploaded for each app (`eas build` + `eas submit`).
- [ ] **Inspector build:** rebuild + resubmit so the payment-proof pickers and
      privacy manifest are included (the previously-submitted binary predates them).

## 1) App information (per app)
- [ ] **Name:** "XportACar" / "XportACar Inspection"
- [ ] **Subtitle:** from the metadata file (≤30 chars)
- [ ] **Primary category:** Business
- [ ] **Secondary category:** Shopping (buyer) / Productivity (inspector)
- [ ] **Content rights:** confirm you hold rights to all content
- [ ] **Age rating:** complete the questionnaire (answers in each metadata file).
      ⚠️ The questionnaire will likely compute a **low rating (≈4+)** because there
      is no violence/sexual/gambling content. The 17+ intent is a business choice
      (binding financial transactions, adult B2B audience). Accept the computed
      rating or set the highest the questionnaire allows, and document the
      rationale. Confirm what Apple actually permits here.

## 2) Pricing & availability (per app)
- [ ] **Price:** Free (Tier 0)
- [ ] **Availability:** all territories, or restrict as Simon prefers
- [ ] Inspector app: consider **limiting distribution** (internal tool) — TestFlight
      only or a restricted release rather than public.

## 3) Version / "1.0 Prepare for Submission" (per app)
- [ ] **Promotional text** (≤170) — from metadata file
- [ ] **Description** (≤4000) — from metadata file
- [ ] **Keywords** (≤100) — from metadata file
- [ ] **What's New** (1.0.0) — from metadata file
- [ ] **Support URL:** https://xportacar.vercel.app/support
- [ ] **Marketing URL:** https://xportacar.vercel.app
- [ ] **Copyright:** `© 2026 XportACar` (placeholder — replace per Simon)
- [ ] **App icon:** upload `buyer-icon-1024.png` / `inspector-icon-1024.png`
      (1024×1024, RGB, no alpha — already prepared in this folder; Apple usually
      pulls the icon from the build, but have these ready).
- [ ] **Screenshots:** upload 6.7", 6.5" and 5.5" sets. Capture per
      `screenshots.md`, frame with `scripts/screenshots/make-mockups.py`, upload
      the framed PNGs.

## 4) App Privacy (per app)
- [ ] Complete the **App Privacy** questionnaire using the data types listed in
      `privacy-manifests.md` (buyer vs inspector sections).
- [ ] **Tracking:** answer **No** — neither app tracks users or uses ad SDKs.
- [ ] **Privacy Policy URL:** https://xportacar.vercel.app/privacy
- [ ] **Terms of Service URL** (where the app prompts for it): https://xportacar.vercel.app/terms
- [ ] Both legal pages are translated EN/DE/FR/AR. The in-page notice declares
      English as the governing version in case of discrepancy.

## 5) App Review Information (per app)
- [ ] **Sign-in required:** Yes → provide a demo account:
      - Buyer: `buyer@xportacar.com` / `Demo!1234`
      - Inspector: `inspector@xportacar.com` / `Demo!1234`
- [ ] **Contact:** Simon's name, email, phone (TBD).
- [ ] **Review notes** — paste something like:

  > XportACar is a UAE-to-EU online vehicle auction platform. Field teams in the
  > UAE inspect privately owned cars and list them in timed online auctions;
  > registered European buyers bid and import the vehicles.
  >
  > How to test the BUYER app:
  > 1. Sign in with buyer@xportacar.com / Demo!1234.
  > 2. Open the Marketplace and tap a vehicle to view its condition report.
  > 3. Open the live auction (a demo "Porsche 911 Carrera S" auction is seeded).
  > 4. Place a bid, or tap "Buy Now" to win instantly.
  > 5. On the win screen, tap "Confirm payment" to see the proof-upload flow
  >    (PDF/JPG/PNG). This is upload-only; no real payment is taken in-app —
  >    settlement is a manual bank wire handled off-app.
  >
  > How to test the INSPECTOR app:
  > 1. Sign in with inspector@xportacar.com / Demo!1234.
  > 2. Start a new inspection and step through details → photos → damage →
  >    documents → review. The Damage step includes a "Paint Thickness Test"
  >    photo capture.
  >
  > Note: no in-app purchases or payments occur inside the apps. Auction
  > settlement is a B2B bank transfer arranged outside the app. Bids are binding,
  > so the apps are intended for adult business users.

## 6) Export compliance
- [ ] Both apps set `ITSAppUsesNonExemptEncryption = false` in `app.json`, so the
      build declares it uses **no non-exempt encryption** (only standard HTTPS).
      → Answer the export-compliance question as **"No"** / exempt. No CCATS/ERN
      needed. (If Apple still prompts, the Info.plist key already covers it.)

## 7) Build, version & TestFlight
- [ ] Select the uploaded build for the 1.0.0 version.
- [ ] **Internal testing:** add the team for quick checks.
- [ ] **External TestFlight (optional, for beta testers beyond the team):**
      - Provide a **Beta App Description** and **feedback email**.
      - Add a **Beta App Review** note (reuse the review notes above + demo creds).
      - External builds need a one-time Beta App Review by Apple.
      - Create a public link or add testers by email / groups.

## 8) Submit for review (per app)
- [ ] Version 1.0.0 status → **Prepare for Submission** complete (no missing fields).
- [ ] Add for review → **Submit**.
- [ ] Choose manual or automatic release.
- [ ] Watch for Apple messages in **Resolution Center**; the review notes above
      pre-empt the most common questions (sign-in, what the auctions are, no
      in-app payment).

---

## 🚩 Blocked on Simon (company info)
Finalize these once Simon provides the legal entity + contact details:
- **Copyright line** — replace `© 2026 XportACar` with the legal entity
  (e.g. "© 2026 Global Business Consultancy L.L.C-FZ" if that's the operator).
- **Support page contact block** — company name, address, phone, support email
  are placeholders ("To be completed") in the `/support` page i18n (`support.*`
  keys in `src/i18n/*.json`). Fill in real values.
- **Legal pages** — `/privacy` and `/terms` are live with plain-English content
  in 4 languages, parameterised with Simon's operating entity (Global Business
  Consultancy L.L.C-FZ). **Have both reviewed by a UAE lawyer and an EU
  privacy/consumer lawyer before going live with real money.**
- **Privacy/Review contact email** — `privacy@xportacar.com` / `support@xportacar.com`
  are placeholders; confirm the real inboxes exist.
- **App Review contact** — Simon's name / phone / email.
