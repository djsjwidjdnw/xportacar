# Supabase Auth emails via Resend SMTP

Password reset, magic-link, email-confirmation and change-email messages are
sent by **Supabase Auth itself**, not by our app code (`src/lib/email/` only
handles our own transactional emails). To make these deliver reliably and look
branded, point Supabase Auth at **Resend's SMTP**.

Everything below is done in the **Supabase dashboard** (project
`klettmjnnttajdyajafn`). Claude can't change these settings — follow the checklist.

---

## 1. Enable custom SMTP (Resend)

Dashboard → **Authentication → Emails → SMTP Settings** (older UIs:
**Project Settings → Auth → SMTP Settings**) → enable **Custom SMTP** and set:

- [ ] **Sender email:** `noreply@xportacar.com`  (must be on the Resend-verified `xportacar.com` domain)
- [ ] **Sender name:** `XportACar`
- [ ] **Host:** `smtp.resend.com`
- [ ] **Port:** `465`  (implicit TLS; use `587` if 465 is blocked)
- [ ] **Username:** `resend`
- [ ] **Password:** your **`RESEND_API_KEY`** (the `re_…` value — same key already in Vercel)
- [ ] Save.

> Resend SMTP uses the literal username `resend` and the API key as the password.

Then raise the auth email rate limit if needed: **Authentication → Rate Limits
→ "Emails per hour"** (the built-in Supabase SMTP caps at ~3–4/hour; with Resend
you can lift it).

## 2. Confirm the redirect URLs

Dashboard → **Authentication → URL Configuration**:
- [ ] **Site URL:** `https://xportacar.com`
- [ ] **Redirect URLs:** include `https://xportacar.com/**` (and any preview URLs).
      This wildcard must cover **`https://xportacar.com/reset-password/callback`**,
      which is where the "Forgot password" flow (web + both mobile apps) lands —
      the reset email's link redirects there to set a new password. For local
      dev also add `http://localhost:3000/**`. If a recovery link shows
      "invalid or expired", the callback URL is almost always not allow-listed.

(Auto-confirm note: signups are auto-confirmed, so the "Confirm signup" email is
usually not sent — the template is included below for completeness / if you ever
turn confirmation on.)

## 3. Paste the branded templates

Dashboard → **Authentication → Email Templates**. For each template below, switch
the editor to HTML and paste the corresponding block. Supabase fills the
`{{ … }}` variables at send time — **leave them exactly as written**.

Common variables: `{{ .ConfirmationURL }}` (the action link), `{{ .SiteURL }}`,
`{{ .Email }}`, `{{ .NewEmail }}` (change-email only), `{{ .Token }}` (6-digit OTP).

All four share the same shell (blue `#1570EF` header, matching `src/lib/email/`).

### 3a. Confirm signup
Subject: `Confirm your XportACar account`
```html
<!doctype html><html><body style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f9fafb;padding:24px;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;border:1px solid #eaecf0;overflow:hidden;">
    <div style="background:#1570EF;color:#fff;padding:24px;"><h1 style="margin:0;font-size:20px;font-weight:800;">XportACar</h1></div>
    <div style="padding:24px;color:#101828;">
      <h2 style="margin:0 0 16px;font-size:18px;">Confirm your email</h2>
      <div style="font-size:14px;line-height:1.6;color:#475467;">Tap the button below to confirm your email and activate your XportACar account.</div>
      <div style="margin-top:24px;"><a href="{{ .ConfirmationURL }}" style="display:inline-block;background:#1570EF;color:#fff;text-decoration:none;padding:11px 20px;border-radius:8px;font-weight:600;font-size:14px;">Confirm email</a></div>
      <div style="margin-top:16px;font-size:12px;color:#98a2b3;">If the button doesn't work, paste this link into your browser:<br/>{{ .ConfirmationURL }}</div>
    </div>
    <div style="border-top:1px solid #eaecf0;padding:16px 24px;font-size:11px;color:#98a2b3;">© XportACar — UAE-to-EU vehicle auctions. If you didn't create an account, ignore this email.</div>
  </div>
</body></html>
```

### 3b. Reset password
Subject: `Reset your XportACar password`
```html
<!doctype html><html><body style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f9fafb;padding:24px;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;border:1px solid #eaecf0;overflow:hidden;">
    <div style="background:#1570EF;color:#fff;padding:24px;"><h1 style="margin:0;font-size:20px;font-weight:800;">XportACar</h1></div>
    <div style="padding:24px;color:#101828;">
      <h2 style="margin:0 0 16px;font-size:18px;">Reset your password</h2>
      <div style="font-size:14px;line-height:1.6;color:#475467;">We received a request to reset the password for <strong>{{ .Email }}</strong>. Tap below to choose a new one. This link expires in 1 hour.</div>
      <div style="margin-top:24px;"><a href="{{ .ConfirmationURL }}" style="display:inline-block;background:#1570EF;color:#fff;text-decoration:none;padding:11px 20px;border-radius:8px;font-weight:600;font-size:14px;">Reset password</a></div>
      <div style="margin-top:16px;font-size:12px;color:#98a2b3;">If the button doesn't work, paste this link into your browser:<br/>{{ .ConfirmationURL }}</div>
    </div>
    <div style="border-top:1px solid #eaecf0;padding:16px 24px;font-size:11px;color:#98a2b3;">© XportACar. If you didn't request this, you can safely ignore this email — your password won't change.</div>
  </div>
</body></html>
```

### 3c. Magic link
Subject: `Your XportACar sign-in link`
```html
<!doctype html><html><body style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f9fafb;padding:24px;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;border:1px solid #eaecf0;overflow:hidden;">
    <div style="background:#1570EF;color:#fff;padding:24px;"><h1 style="margin:0;font-size:20px;font-weight:800;">XportACar</h1></div>
    <div style="padding:24px;color:#101828;">
      <h2 style="margin:0 0 16px;font-size:18px;">Sign in to XportACar</h2>
      <div style="font-size:14px;line-height:1.6;color:#475467;">Tap below to sign in. This link is single-use and expires shortly.</div>
      <div style="margin-top:24px;"><a href="{{ .ConfirmationURL }}" style="display:inline-block;background:#1570EF;color:#fff;text-decoration:none;padding:11px 20px;border-radius:8px;font-weight:600;font-size:14px;">Sign in</a></div>
      <div style="margin-top:16px;font-size:12px;color:#98a2b3;">Or use this code: <strong>{{ .Token }}</strong></div>
    </div>
    <div style="border-top:1px solid #eaecf0;padding:16px 24px;font-size:11px;color:#98a2b3;">© XportACar. If you didn't try to sign in, ignore this email.</div>
  </div>
</body></html>
```

### 3d. Change email address
Subject: `Confirm your new XportACar email`
```html
<!doctype html><html><body style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f9fafb;padding:24px;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;border:1px solid #eaecf0;overflow:hidden;">
    <div style="background:#1570EF;color:#fff;padding:24px;"><h1 style="margin:0;font-size:20px;font-weight:800;">XportACar</h1></div>
    <div style="padding:24px;color:#101828;">
      <h2 style="margin:0 0 16px;font-size:18px;">Confirm your email change</h2>
      <div style="font-size:14px;line-height:1.6;color:#475467;">You asked to change your XportACar email from <strong>{{ .Email }}</strong> to <strong>{{ .NewEmail }}</strong>. Tap below to confirm.</div>
      <div style="margin-top:24px;"><a href="{{ .ConfirmationURL }}" style="display:inline-block;background:#1570EF;color:#fff;text-decoration:none;padding:11px 20px;border-radius:8px;font-weight:600;font-size:14px;">Confirm change</a></div>
    </div>
    <div style="border-top:1px solid #eaecf0;padding:16px 24px;font-size:11px;color:#98a2b3;">© XportACar. If you didn't request this change, contact support immediately.</div>
  </div>
</body></html>
```

## 4. Test
- [ ] Trigger a password reset from the web login ("Forgot password") → email arrives from `noreply@xportacar.com`, branded, link works.
- [ ] Check Resend dashboard → Logs to confirm delivery.
- [ ] (If confirmation is on) sign up a throwaway address and confirm.

## Notes
- These auth emails are **not** localized by Supabase per-user out of the box
  (Supabase has one template set). Our own app emails (`src/lib/email/`) are
  localized per `profiles.language`; these auth templates are English.
- The `RESEND_API_KEY` is the SMTP password here AND the API key used by
  `src/lib/email/`. One key, two uses.
