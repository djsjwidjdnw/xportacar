# Launch-day key swap — Claude Code prompt

Paste everything below the line into Claude Code, started in `C:\Users\chase\projects\xportacar`.
It moves the platform's outside services from Chase's accounts to Simon's, switches the UAE vs EU
market prices on, and proves each service is live. Written 2026-10-15 with the market prices feature
(migration 034, Edge Function `market-prices`, admin page `/admin/integrations`, which links here).

---

XPORTACAR — LAUNCH DAY: MOVE SERVICE KEYS TO SIMON'S ACCOUNTS + SWITCH ON MARKET PRICES
Long-run mode. Run long, report once. No subagents, no Workflow tool.

CONTEXT
- Web: C:\Users\chase\projects\xportacar   Buyer app: ...\xportacar-mobile   Inspector app: ...\xportacar-inspection
- Supabase project klettmjnnttajdyajafn, no DATABASE_URL. SQL runs through the signed-in dashboard tab in
  the Chrome profile C:\Users\chase\chrome-xportacar (port 9222) via the pg-meta query endpoint, or with
  `supabase db query --linked`. Check the fingerprint first:
  `select system_identifier from pg_control_system()` must be 7634664568297872568.
- Read CLAUDE.md first (grants rule, brand rule, App Store state). `git status --short` and
  `git log --oneline -5` in all three repos; report anything unexpected.
- Keys page: https://www.xportacar.com/admin/integrations (Chase's admin login in that Chrome profile).
  Market price keys are written there into Supabase Vault through admin_set_market_price_key(), which
  returns at most the last 4 characters. The page also shows the last 4 of the Edge Function secrets.

WHERE EVERY KEY LIVES TODAY (all on Chase's accounts unless noted)

| Service | Used by | Where the key lives | Move to Simon |
|---|---|---|---|
| Vincario, vehicle market value | market-prices Edge Function | Vault `market_vincario_api_key`, `market_vincario_secret_key` (empty until today) | yes, Integrations page |
| Apify | market-prices Edge Function | Vault `market_apify_token` (empty until today) | yes, Integrations page |
| Vincario, VIN decoding | vin-decoder-proxy | Edge Function secrets `VINCARIO_API_KEY`, `VINCARIO_SECRET_KEY` | yes |
| Auto.dev | vin-decoder-proxy; valuation-proxy (inspector app) | Edge Function secret `AUTODEV_API_KEY`; Vercel `AUTODEV_API_KEY` and `VALUATION_API_KEY` (no longer read by the web since 2026-10-15) | yes |
| Resend | web emails; Supabase Auth emails | Vercel `RESEND_API_KEY` (Production + Preview), `RESEND_PRELAUNCH_AUDIENCE_ID`, `EMAIL_FROM`; Supabase Auth custom SMTP password | yes, see STEP 3 |
| Vercel | hosting | Chase's Vercel account | only if Chase says so |
| Supabase | database, auth, functions | Chase's Supabase org; keys in Vercel env and in both apps' app.json (publishable key) | only if Chase says so |

Not part of this swap; list them in the report as still Chase's: Apple developer team and App Store
Connect API keys, Expo/EAS (owner chasebitz), GitHub (djsjwidjdnw), the domain registrar and DNS,
Stripe (not live).

HARD STOPS — stop and ask; never work around one
- No plan purchases: no top-ups, credit packs, subscriptions, upgrades, or trials that need a card.
- No adding or changing payment cards or billing details on any account.
- No deleting accounts or projects, and no deleting API keys on Chase's accounts. Only replace the values
  listed above.
- Never print a key. Never put one in a command line, a repo file, a commit, a log line or chat. Never ask
  Simon or Chase to send a key in chat.
- A login, 2FA code or email confirmation: stop and ask the person to do that step in the Chrome window.
- Simon's Vincario account has no Vehicle Market Value lookups ("Not Enough Lookups"), or his Apify free
  credit is used up: stop. Buying is Simon's decision.

HOW TO MOVE A KEY WITHOUT SEEING IT
Keys travel only through this machine's clipboard, never through your tool output:
1. In the provider console, use its own Copy button (or select the key and press Ctrl+C).
2. Integrations page field: focus it, paste with a real key event (CDP `Input.dispatchKeyEvent`, key "v",
   code "KeyV", modifiers 2, `commands: ["paste"]`), press Save. Never read the field's value. After the
   reload the field shows only ••••last4.
3. Edge Function secret (the value never appears in a command):
   `$k = Get-Clipboard; Set-Content -NoNewline -Path "$env:TEMP\xpc.env" -Value "NAME=$k"; Remove-Variable k; supabase secrets set --env-file "$env:TEMP\xpc.env" --project-ref klettmjnnttajdyajafn; Remove-Item "$env:TEMP\xpc.env"`
   Secrets apply on the next function call; nothing to redeploy.
4. Vercel env: Project → Settings → Environment Variables → Edit → paste from the clipboard, for every
   environment the variable already has (Production, Preview). Or with the CLI:
   `vercel env rm NAME production -y; Get-Clipboard | vercel env add NAME production` (same for preview).
   Then redeploy production (Deployments → latest production → Redeploy, or `vercel --prod`).
5. Clear the clipboard after each key: `Set-Clipboard -Value " "`.
6. Check a value landed by its last 4 only (Integrations page, the provider's masked key).

STEP 0 — ONE LINE
Open the Chrome profile (start Chrome with `--user-data-dir=C:\Users\chase\chrome-xportacar
--remote-debugging-port=9222` if it isn't running) and print exactly one line, then wait:
"Sign in with Simon's accounts in the Chrome window: vincario.com, console.apify.com, resend.com, auto.dev (plus vercel.com and supabase.com only if their keys move)."

STEP 1 — VINCARIO (market prices and VIN decoding)
- Simon's Vincario account: profile menu → API. Copy the API key, then the secret key. If none exist,
  the form there requests them; if that needs payment, hard stop.
- Read the balance on the same page. No Vehicle Market Value lookups → note it; skip the Vincario test
  lookup in STEP 6 and report it.
- Integrations page → "Vincario — EU market prices": paste the API key, Save; paste the secret key, Save.
- VIN decoding uses the same account: set Edge Function secrets VINCARIO_API_KEY and VINCARIO_SECRET_KEY
  (method 3).

STEP 2 — APIFY
- console.apify.com → Settings → API & Integrations → Personal API tokens → create "XportACar market
  prices". Copy it with the copy button.
- Integrations page → "Apify — UAE market prices": paste, Save.
- Leave the actor as set (memo23/dubizzle-search-listing-s-scraper) unless Chase asked to change it. It is
  pay per result and runs on the free plan's monthly credit; no rental.

STEP 3 — RESEND
- The sending domain must be verified in Simon's Resend account (Domains → xportacar.com). If it isn't,
  adding it needs DNS records at the domain's DNS host: do NOT switch the key (every email would fail).
  Report the DNS records Resend lists and stop this step.
- resend.com → API Keys → create "XportACar production" with Full access (the prelaunch signup sync uses
  Audiences). Copy it.
- Vercel RESEND_API_KEY (Production and Preview) = the new key. Supabase dashboard → Authentication →
  Emails → SMTP Settings → password = the same key (paste from the clipboard). Redeploy production.
- RESEND_PRELAUNCH_AUDIENCE_ID points at an audience in Chase's Resend account. Creating one in Simon's
  account and moving the contacts is Chase's decision: report it, don't do it.
- EMAIL_FROM: leave as is (the code reads RESEND_FROM and defaults to "XportACar <noreply@xportacar.com>").
- Test: request a password reset on www.xportacar.com for Chase's own test account and confirm the email
  appears under Emails in Simon's Resend dashboard.

STEP 4 — AUTO.DEV
- auto.dev dashboard → copy the API key.
- Edge Function secret AUTODEV_API_KEY = the new key (method 3). Vercel AUTODEV_API_KEY and
  VALUATION_API_KEY are no longer read by the web: replace them with the new key too, or list them as
  unused for Chase to remove. Don't delete them without asking.
- Test: as the admin in the browser, call the vin-decoder-proxy function with a real VIN from the
  vehicles table and check that the response's `sources` include "autodev".

STEP 5 — VERCEL / SUPABASE (only if Chase said these move)
- A Supabase project transfer to another org keeps the project ref and keys: nothing changes in env.
  A new project instead is a migration, not a key swap: stop.
- A Vercel project transfer to another team: afterwards check `vercel env ls production` still lists every
  variable and the domain still points at the project.

STEP 6 — SWITCH ON MARKET PRICES AND TEST
- Integrations page: the three requirement ticks are green → "Switch on" (confirm). The database refuses
  while any key is missing.
- Test lookup: pick a real listed car with a valid VIN. Run "Test lookup: Vincario" (about €1.99) and
  "Test lookup: Apify" (about $0.05), once each. Repeat only after fixing a key problem.
- Reload the page: both market price services must read "Live"; the Resend, Auto.dev and Vincario VIN
  decoding rows read "Live" with Simon's last 4s.
- Error codes on the page: vincario_auth_failed / apify_auth_failed (wrong key), vincario_out_of_lookups /
  apify_payment_required (hard stop), apify_actor_not_found (actor id). "not_enough_uae_data" and
  "vincario_insufficient_data" are honest results, not failures: try one other car at most.
- Open that car's buyer page and screenshot the "Market prices" card.

STEP 7 — NOTHING POINTS AT CHASE
- Compare last 4s: Integrations page (Vincario x2, Apify; AUTODEV_API_KEY, VINCARIO_API_KEY,
  VINCARIO_SECRET_KEY in the read-only rows), Vercel (`vercel env pull` to a temp file OUTSIDE the repo,
  read only the last 4 of each changed variable, delete the file), Supabase Auth SMTP (can't be read
  back: record that it was replaced and the test email arrived).
- List every location: old owner → new owner, last 4, how it was verified.

CONSTRAINTS
- No code changes should be needed. If one is: type-check and build in that repo before committing, commit
  per step, git grep for secrets before every push.
- No keys printed anywhere, none pasted into chat, no .env file committed.
- Brand rule in CLAUDE.md applies: don't touch logos or icons.

OUTPUT
- The one sign-in line you printed.
- Table: service · location · moved? · new last 4 · test result.
- Market prices: on/off, the two test lookups (result, listings, estimated cost), screenshot of the card.
- Everything not moved and why (hard stop hit, DNS needed, not covered by this swap).
- Total spent today (from the Integrations page usage lines).
