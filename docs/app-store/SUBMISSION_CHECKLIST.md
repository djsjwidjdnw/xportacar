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
- [x] **Screenshots (1.0.1):** the live 1.0 screenshots, copied byte for byte
      onto both 1.0.1 versions at every size (iPhone 6.5" + iPad 13"), by Chase's
      decision of 2026-10-07 — see `screenshots.md`.

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
- [x] **Something to buy:** one demo listing is live for App Review — vehicle
      `5f4e3424-89fa-43e8-b05d-d9fe795e31ff`, auction
      `84326b8b-7140-40df-bf21-69f97da3e2a5`, 2019 Mercedes-Benz AMG GT
      "C Roadster — Demo listing for App Review, not for sale", €104,900, live
      2026-10-07 13:02 UTC → 2026-10-14 13:02 UTC. Stock photos, credited in
      `demo-photo-credits.md`. The reviewer's purchase is a real order in
      production (marks it sold, issues an invoice emailed to the Gmail alias);
      a rolled-back rehearsal of exactly that purchase passed on 2026-10-07.
      **If review is still pending on day 6 (2026-10-13), relist it** (admin
      Publish/Relist restarts the 7 days). Since 2026-10-09 this applies to the
      1.0.2 review.

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
- [x] **1.0.1 submitted 2026-10-07** through the App Store Connect API, after a
      pre-submit gate passed (screenshots = live 1.0, no auction/bid/bidding/reserve
      outside What's New, builds attached, contact filled, demo listing live):
      - XportACar 1.0.1 (build 12): submission `9967211e-10bd-43d1-9885-8399333cf223`,
        13:09:01 UTC → **Waiting for Review**
      - XportACar Inspector 1.0.1 (build 9): submission `8966b875-e8ff-4336-bcf1-f25c1218cd82`,
        13:09:12 UTC → **Waiting for Review**
- [x] **1.0.1 approved and released 2026-10-07** (~22:22 UTC buyer, ~22:25 UTC
      inspector). It shipped the Step 6 icons, which Chase then rejected.
- [x] **1.0.2 submitted 2026-10-09** (original icons restored, Chase's call), through
      the same API flow after a pre-submit gate (build VALID with version 1.0.2, export
      compliance false, build attached, What's New set, screenshots COMPLETE, review
      contact, demo account and notes present, demo listing active). The icon Apple
      extracted from each build matches the original icon (mean difference 1.6 buyer,
      2.8 inspector, out of 255).
      - XportACar 1.0.2 (build 14), version `326eee70-8c1d-43e3-b93b-6623e395189d`,
        submission `88300285-1cf9-430e-a64a-556d4b4b94b6`, 14:34:08 UTC → **Waiting for Review**
      - XportACar Inspector 1.0.2 (build 11), version `421c22e6-7bd0-426e-90db-e335768dc8d8`,
        submission `cfe38b5d-848e-4a40-9a05-e71045f34dd7`, 14:41:16 UTC → **Waiting for Review**
      - What's New (both): "Restores the original XportACar app icon, plus minor fixes."
        Description, keywords, URLs, screenshots (same checksums) and review details
        carried over from 1.0.1 automatically. Promotional text does **not** carry over
        to a new version, so it was copied from 1.0.1 by hand.
      - Builds 13/10 (stamped 1.0.1) were uploaded by EAS but never became App Store
        Connect builds, because an approved version closes its build train.
- [x] Release: **automatic after approval** (`AFTER_APPROVAL`) on both versions.
- [ ] Watch for Apple messages in **Resolution Center**; the review notes above
      pre-empt the most common questions (sign-in, how buying works, no
      in-app payment).

## 9) After BOTH 1.0.2 versions are approved — cleanup (pre-approved by Chase)
Chase, 2026-10-09: run this only after both **1.0.2** versions are approved, not
before. The 1.0.1 approvals do not count, because the 1.0.2 reviewers need the demo listing.
1. Copy to recovery tables first: the demo vehicle with its photos, paint
   readings, auction, bids, invoice, payment proofs, notifications, email-log rows
   and audit rows, plus anything the reviewers created (e.g. an inspection the
   inspector reviewer submitted), and the Storage objects' keys.
2. Delete them, including the 20 Storage objects listed in `demo-photo-credits.md`.
3. Restart invoice numbering — `setval('public.invoice_number_seq', 1, false)`
   while no invoice exists — so the first real invoice is **XPC-2026-000001**.

Landing mode (`app_settings.landing_mode_enabled`) stays **ON** until Chase flips it.

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
