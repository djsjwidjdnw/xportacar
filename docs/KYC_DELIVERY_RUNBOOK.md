# KYC documents + rejection reasons + email confirmation — delivery runbook

This change set adds KYC document collection at signup, an admin review flow with
rejection reasons, bid/Buy-Now gating on verified KYC, and turns on email
confirmation. It reuses the **existing** KYC model (`kyc_submissions` table +
`profiles.kyc_status` = `pending | verified | rejected`; **`verified` = approved**).

Web code is committed but **not pushed** until the steps below are done, because
the app writes to columns that migration 024 adds.

---

## DO THESE IN ORDER

### 1. Run migration 024 (Supabase SQL editor) — REQUIRED FIRST
File: `supabase/migrations/024_kyc_documents_and_gating.sql`. Paste + run it in the
Supabase SQL editor (project `klettmjnnttajdyajafn`). It is idempotent. It:
- creates the **private** `kyc-documents` bucket + owner/admin storage RLS,
- adds `profiles.kyc_is_business / kyc_rejection_reason / kyc_submitted_at /
  kyc_reviewed_at / kyc_reviewed_by` and `kyc_submissions.id_subtype`,
- adds `is_kyc_verified()` and gates the **bids INSERT policy** + **`buy_now()` RPC**
  on `kyc_status = 'verified'`.

> Until this runs, web signup/KYC writes fail and mobile bid-gating is not enforced
> at the DB level. Run it before the web deploy goes live.

### 2. Verify Vercel env vars
- [ ] `RESEND_API_KEY` and `RESEND_FROM` set (else all emails — welcome, KYC
      approve/reject — silently no-op).
- [ ] `CRON_SECRET` **or** `SIGNED_URL_SECRET` set — **required**: it signs the
      one-time KYC upload token. Without it, document upload at signup fails once
      email confirmation is on. (`CRON_SECRET` is already used for signed invoice
      URLs, so it's likely present — confirm.)
- [ ] `NEXT_PUBLIC_SITE_URL` = `https://www.xportacar.com` (recommended, so confirm
      links + email CTAs use the canonical host). Empty falls back to
      `https://xportacar.com`.

### 3. Supabase dashboard — enable email confirmation
Follow `docs/SUPABASE_AUTH_EMAIL_SETUP.md` (updated):
- [ ] **Authentication → Providers → Email → Confirm email: ON**.
- [ ] **Custom SMTP → Resend** (host `smtp.resend.com`, user `resend`, pass =
      `RESEND_API_KEY`, sender `noreply@xportacar.com`), and lift the email rate limit.
- [ ] **URL Configuration:** Site URL `https://www.xportacar.com`; Redirect URLs
      include `https://www.xportacar.com/**`, `https://xportacar.com/**`,
      `http://localhost:3000/**` (must cover **`/auth/confirm`** and
      `/reset-password/callback`).
- [ ] **Email Templates → Confirm signup:** paste template **3a** (the
      `token_hash` version — required for mobile to confirm cross-device).

### 4. Deploy
- [ ] **Web:** push `master` → Vercel auto-deploys (commits: "KYC at signup…" +
      "Admin KYC review…"). Do this only after step 1.
- [ ] **Mobile (buyer):** `eas update --branch production --non-interactive
      --message "KYC at signup + verification gating"` from `xportacar-mobile`
      (OTA-safe — no new native modules). Report the Update group ID.

---

## TEST PLAN

1. **Signup + upload (web):** open `/register`, fill details, pick "Business",
   choose an ID type + upload a personal ID + a trade licence, submit. Expect
   "check your email to confirm". In Supabase → Storage → `kyc-documents` you
   should see `<user-id>/...id_document...` and `...trade_license...`. In
   `kyc_submissions`, two rows `status='pending'`; `profiles.kyc_status='pending'`,
   `kyc_is_business=true`, `kyc_submitted_at` set.
2. **Email confirmation:** the Supabase confirm email arrives (check Resend → Logs).
   Click it → lands on `/pending-verification` (signed in). `auth.users.confirmed_at`
   is now set.
3. **Gating:** while pending, open a live auction → bid input is replaced by a
   "verification required" banner; the bid/Buy-Now server actions also refuse.
4. **Approve (admin):** sign in as admin → sidebar "KYC" shows a pending badge →
   `/admin/kyc` → Review → preview both docs → Approve. Buyer gets the approval
   email; `kyc_status='verified'`; the buyer can now bid.
5. **Reject (admin):** create another test buyer → Review → Reject → choose a
   reason (or "Other" + ≥10 chars) → Confirm. Buyer gets the rejection email **with
   the reason**; `/pending-verification` + profile show the reason and a re-submit
   uploader; `kyc_status='rejected'`. Re-submitting flips back to pending.
6. **Mobile:** register in the app (business + ID + trade licence) → docs upload →
   "check your email" → confirm via the phone browser → sign in → Profile shows the
   pending banner; an auction shows the verify-to-bid guard. After admin approval,
   pull-to-focus Profile → verified; bidding works.

## NOTES
- **`verified`, not `approved`:** the gate value is `kyc_status='verified'` (the
  enum has no `approved`; `approved` is the per-document `kyc_submissions.status`).
- **Bucket is private:** documents are served to admins/buyers via short-lived
  signed URLs. No KYC docs existed before this change (bucket didn't exist), so
  there's nothing to migrate.
- **Admin review UI is English** (internal); rejection reasons are stored/emailed
  as canonical English (the email shell localizes around them). All buyer-facing
  strings are EN/DE/FR/AR.
- **HEIC not accepted** (PDF/JPG/PNG only) so admin browser preview always renders;
  iOS pickers deliver JPEG by default.
