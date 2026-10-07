# App Store submission checklist (manual steps in App Store Connect)

Covers both apps. Everything Claude Code could generate is in this `docs/app-store/`
folder; this checklist is the work that must be done by hand in
[App Store Connect](https://appstoreconnect.apple.com) (team: **Chase Bitz,
2FVWM2KU8D**).

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
- [x] **Sign-in required:** Yes (set on both 1.0.1 versions, 2026-10-07):
      - Buyer app: `chasebitz0613+appreview@gmail.com` — "Lukas Hartmann", a
        KYC-**verified** buyer created for App Review so the reviewer can buy.
        Its password lives ONLY in App Store Connect's Sign-In Information — it
        is a verified buyer that can make binding purchases, so never commit it.
        (`buyer@xportacar.com` is KYC *pending* and cannot buy.)
      - Inspector app: `inspector@xportacar.com` / `Demo!1234` (verified on the
        live backend; `Demo1234!` does NOT work).
- [x] **Contact:** Chase Bitz, phone and email (copied from 1.0; filled before
      the notes, or the notes won't save).
- [x] **Review notes** (saved on both 1.0.1 versions) name both accounts and
      their roles, say purchases are paid by bank transfer outside the app, and
      give account deletion: buyer app → Profile tab → "Delete account";
      inspector app → Profile tab → "Delete account".
- [ ] **Before submitting the buyer app:** at least one REAL live listing must
      exist, or the reviewer has nothing to buy. The reviewer's test purchase is
      a real order in production: it marks that listing sold and issues an
      invoice (emailed to the Gmail alias above) — cancel it and relist after
      review.

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
      pre-empt the most common questions (sign-in, how buying works, no
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
