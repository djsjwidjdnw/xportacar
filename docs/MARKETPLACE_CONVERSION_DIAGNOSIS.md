# Auction → fixed-price marketplace: diagnosis (Step 2)

Written 2026-10-07, **before any code change** in this run. Line numbers refer to
the commits current at the time (web `20c3fc8`, buyer `62ea496`, inspector
`deca851`). Live DB facts were read from project `klettmjnnttajdyajafn`
(PostgreSQL 17.6, system_identifier 7634664568297872568).

## Live data snapshot (why the blast radius is small)

| table | rows | notes |
|---|---|---|
| vehicles | 2 | 2022 AMG GT `d05628ec…` (sold), 2014 SLS Black Series `0210be9c…` (listed) |
| auctions | 2 | AMG GT `sold` (Buy Now, 2026-06-11), SLS `ended` (0 bids) |
| bids | 7 | all on the AMG GT auction, placed 13:22–13:28 on 2026-06-11 |
| counter_offers | **0** | the table has never been used |
| invoices | 1 | XPC-2026-000001, AMG GT, `pending` |
| vehicle_status_events | 0 | |
| notifications | 22 | 19 status_update, 3 auction_won |

## (a) User-facing bidding surfaces

### Web (`xportacar`)
- **Bid panel** — `src/components/auction/BidPanel.tsx:61-518`: current bid (L249-268),
  bid/bidder counts (L273-277), countdown (L280), bid input + ± stepper (L303-326),
  proxy/max bid (L328-361, hardcoded English L340, L356), Place bid (L363-384),
  Buy Now dialog (L386-413, hardcoded English L396-400), counter-offer dialog
  (L415-463, hardcoded English), bid history (L469-515), won/outbid banners (L212-246).
- **Bid actions** — `src/app/(buyer)/auction/actions.ts`: `placeBidAction` L46-126,
  `buyNowAction` L131-230 (**does not use the `buy_now()` RPC**, see (c)),
  `placeCounterOfferAction` L235-265, `notifyOutbid` L271-309, `cascadeProxies` L321-390.
- **Realtime** — `src/hooks/useAuction.ts` (bids INSERT + auctions UPDATE channel).
- **Countdown timers** — `src/components/auction/AuctionCountdown.tsx`;
  `src/components/marketplace/VehicleCard.tsx:45-61,119-127`; `src/hooks/useAuctionTick.ts`;
  `src/lib/utils.ts:103-133` (`formatTimeRemaining`, `formatCountdown`, "Ended" literal).
- **Status chips (Live / Ending soon / Scheduled / Ended)** — `VehicleCard.tsx:99-118`;
  `src/app/(buyer)/vehicle/[id]/page.tsx:200-263` (hardcoded "Auction live · N bids" L209,
  "Auction coming soon" L233, "Listed price" L235), `:272-280`;
  `src/app/(buyer)/auction/[id]/page.tsx:88-101`.
- **Starting price / current bid labels** — `VehicleCard.tsx:70-72,151`;
  `src/components/vehicle/VehiclePriceCard.tsx:59,63-71`.
- **Reserve price shown to buyers** — `VehicleCard.tsx:175-185` ("Reserve met/not met");
  `VehiclePriceCard.tsx:128-130` (hardcoded "Reserve" row).
- **Bid CTAs** — `VehicleCard.tsx:189-200` ("Bid now"); `VehiclePriceCard.tsx:75-111`
  ("Bid now", "View auction", "View result", Buy Now link).
- **"Live auction(s)" copy** — nav `src/components/layout/BuyerNav.tsx:35`;
  `/auctions` page `src/app/(buyer)/auctions/page.tsx` (whole page, hardcoded L70);
  `src/components/layout/Footer.tsx:43,67`; `src/app/not-found.tsx:9,60-63`;
  `src/app/layout.tsx:26-28,40-42` (site title/description/keywords);
  `src/components/landing/LandingHeroStats.tsx:19` ("N live now");
  `src/components/landing/MarketingHome.tsx:39-47,102-103`;
  `src/components/shared/WelcomeToast.tsx:23` ("See you next auction.").
- **My Bids** — nav `BuyerNav.tsx:37` (`/dashboard#bids`); dashboard
  `src/app/(buyer)/dashboard/page.tsx` (title "My bids" L16, "Active bids"/"Won auctions"
  L121-122, "Your bids"/"Live auctions" L130-131, "Outbid" badge L179 — all hardcoded English).
- **Watchlist auction language** — `src/app/(buyer)/watchlist/page.tsx:38-59`
  (drops ended auctions, settles them lazily).
- **Won page** — `src/app/(buyer)/auction/[id]/won/page.tsx:118-128,162-190` (hardcoded
  English "Congratulations! You won this auction", "Auction closed", "View auction page");
  `src/components/buyer/WonInvoice.tsx:289` ("Hammer price").
- **Invoice PDF** — `src/lib/invoice/pdf.ts:123` ("Winning hammer bid").
- **i18n keys (en/de/fr/ar)** — `nav.auctions`, `nav.myBids`, `common.*` (bids, bidders,
  currentBid, startingPrice, placeBid, reserveMet/NotMet, noBids, bidNow, viewAuction,
  viewResult, live, scheduled, endingSoon, comingSoon*), whole `auction.*` namespace,
  `landing.*` (heroTitle, heroSubtitle, statCycles, feature2*, feature3Body, feature5Body,
  howStep2*, howStep3Body, ctaTitle, ctaBody, footerTagline, footerLinkAuctions),
  `auth.loginSubtitle`, `auth.kycSectionHint`, `kyc.pendingBody`, `kyc.verifiedBody`,
  `kyc.banner*`, `kyc.bidLocked*`, `prelaunch.subheadline`, `prelaunch.vp1*`,
  `prelaunch.footerAbout`, `support.subtitle`, `support.q1*`, `support.q2*`, `support.q3a`,
  `support.q6a`, `privacy.s2Body`, `privacy.s3Body`, `privacy.s4Body`, `terms.s2Body`,
  `terms.s4*` (Auction mechanics, reserve), `terms.s5Body` ("hammer price"), `terms.s14Body`
  (shill bidding), `deleteAccount.loseBids`, `admin.statLiveAuctions`, `admin.pipelineInAuction`.

### Buyer app (`xportacar-mobile`)
- **Auction screen** — `src/screens/AuctionScreen.tsx`: bid increment ladder L24-30, realtime
  outbid alert L101-117, current bid L283-290, countdown L292-302, bid input L304-338,
  proxy L340-387, Place bid L389-402, Buy Now (RPC) L233-252/L404-409/L444-461,
  bid history L412-441.
- **Cards** — `src/components/VehicleCard.tsx:19-26` (CTA "Bid now"/"View result"/"Coming soon"),
  L119-136 timers, L182-199 price label + bid counts; `src/components/LiveAuctionCard.tsx`
  (whole component: countdown banner L119-140, "N bids" hardcoded English plural L156-158,
  Bid Now CTA L162-181).
- **Marketplace** — `src/screens/MarketplaceScreen.tsx:23-30` (price = current bid),
  L99-157 Live tab + "ending soon" tiers, L173 header "N live", L203-220 All/Live pills,
  L232-253 Live card + Bid route.
- **Vehicle detail** — `src/screens/VehicleDetailScreen.tsx:163-208` (phase + Bid/Buy routes),
  L237-266 live/scheduled banners, L402-470 sticky Bid Now / Buy Now bar.
- **My Bids** — tab `src/navigation.tsx:178-182` (hammer icon), stacks L115-125;
  `src/screens/MyBidsScreen.tsx` (whole screen: Winning/Outbid/Won chips L102-120).
- **Profile** — `src/screens/ProfileScreen.tsx:104-120` (bids query), L255-270, L412-492
  (My Bids carousel: "Your bid"/"Current"), L496-516 ("Won auctions").
- **Won screen** — `src/screens/AuctionWonScreen.tsx:330` (hammer), L427, L582 (`won.hammer`).
- **Watchlist** — `src/screens/WatchlistScreen.tsx:153-154` (routes active auctions to the bid screen).
- **Helpers** — `src/lib/theme.ts:112-185` (formatRemaining/formatCountdown "Ended" literal,
  isAuctionLive/Ended/Scheduled).
- **i18n** — `src/lib/i18n.tsx` (four embedded dictionaries; namespaces `auction.*`, `bids.*`,
  `card.*`, `vehicle.bidNow/viewAuction/viewResult/liveBadge/startingPrice`,
  `marketplace.liveTab/liveCount/headerBar/noLive*`, `nav.auction/auctionWon/myBids`,
  `profile.myBids/yourBid/wonAuctions/wonAt/viewAuction`, `won.*`).

### Inspector app (`xportacar-inspection`)
- No bidding UI. Pricing step `src/screens/InspectionWizardScreen.tsx:365-369,410-437,
  988-995,1055-1056,1504-1520,1977-1986` captures "Starting price (AED)" and
  "Reserve price (AED)" (`details.startingPrice`, `details.reservePrice`, `review.reserve`,
  `submit.reserveLow*` in `src/lib/i18n.tsx`).

## (b) Counter-offers
- Buyer UI: web only — `BidPanel.tsx:415-463` ("Make counter-offer", all hardcoded English),
  action `placeCounterOfferAction` (`auction/actions.ts:235-265`). The buyer app has none.
- Admin: `src/app/(admin)/admin/counter-offers/page.tsx`, `counter-offers/actions.ts`
  (accept → closes the auction as sold and marks the vehicle sold, L45-67),
  `src/components/admin/CounterOfferActions.tsx`, sidebar entry `admin.navCounterOffers`.
- RLS: insert = `auth.uid() = bidder_id` (no KYC check), select own/staff, update staff.
- **Real usage: 0 rows ever.**

## (c) Where an auction's lifecycle is written
1. **`close-expired-auctions` edge function** (pg_cron job 1, every 2 min) —
   `supabase/functions/close-expired-auctions/index.ts:37-105`: expired `active` auctions →
   `sold` (+winner, vehicle `sold`, notification, won email via `/api/internal/notify`) when the
   top bid meets reserve, else `ended` + vehicle back to `listed`.
2. **`settleEndedAuctions`** (lazy, web) — `src/lib/auctions.ts:28-97`, called from
   dashboard, watchlist and won pages. Same rules as (1) but **leaves the vehicle status
   unchanged on a no-sale** (cron sets `listed`) — the two writers disagree. Its header comment
   ("There is no cron/trigger…") is stale.
3. **`buy_now(p_auction_id)` RPC** (live definition, SECURITY DEFINER) — KYC gate, row lock,
   status/end_time/price checks, inserts the bid, sets auction `sold` + winner, vehicle `sold`.
   Used by the buyer app (`AuctionScreen.tsx:243`). **The web `buyNowAction` re-implements it
   non-atomically** (user-scoped bid insert, then service-role updates; no row lock → two
   buyers can both "win"; the second overwrites `winner_id` on an invoice issued to the first).
4. **Invoice-on-sold trigger** — `trg_auctions_invoice` → `create_invoice_for_sold_auction()`
   on `auctions` update to `sold` (fee hardcoded 0.029, amount = current_bid_eur).
   `buyNowAction` also inserts an invoice defensively if none exists.
5. **Counter-offer accept** — `counter-offers/actions.ts:45-67` (service role).
6. **Admin create/edit auction** — `src/app/(admin)/admin/actions.ts:690-749`
   (`createAuctionAction`, upsert on the unique `auctions.vehicle_id`, vehicle → `in_auction`),
   `updateVehicleAction` L100-177 (mirrors price/end-time to the auction, audit-logged).
7. **`update_auction_on_bid` trigger** on `bids` insert (current_bid/bid_count/bidder_count).
8. **status_events** — `vehicle_status_events` is written only by the post-sale lifecycle
   (`src/app/(admin)/admin/vehicles/lifecycle-actions.ts`: picked_up → in_transit → delivered).
   No auction writer touches it (0 rows live).

**Drift found:** live `sync_vehicle_eur_from_aed()` is the *first* version of migration 015.
Commit `e57586f` (2026-06-11) edited 015 in place to derive `*_eur` only when the `*_aed`
value changed, but that edit was never applied — so any admin EUR price edit on an
AED-priced vehicle is silently overwritten on the next vehicle update.

## (d) Deposit mentions
None. `git grep -i` for deposit / Anzahlung / Kaution / acompte / caution / عربون / إيداع
across all three repos (code, i18n, legal scripts, email templates) finds no deposit wording;
the only Arabic hits are تأمين used as "insurance"/"securing". No deposit column, table or
code path exists in the DB or code. **Confirmed: no deposit is implemented; nothing to sweep.**

## (e) The "30-day sold-visibility rule"
**It does not exist in code.** Migration 015 added `vehicles.sold_at` with a comment
"drives the 30-day SOLD window", but no query reads it for a window: both marketplaces filter
`status in ('listed','in_auction')` (web `marketplace/query.ts:82,98`, buyer
`MarketplaceScreen.tsx:62`), so a sold vehicle leaves the marketplace **immediately**; its
detail page stays reachable by URL indefinitely (vehicles RLS exposes sold statuses publicly).
Interaction with a 7-day window: none to reconcile — sold listings already vanish at once, so
"sold keeps its existing behaviour" is satisfied by leaving that filter alone; the 7-day window
only governs unsold listings.

## (f) Emails and crons that reference bidding / auctions ending
- Templates (`src/lib/email/templates/`): `outbid.ts`, `bidConfirmation.ts` (no caller),
  `auctionEndingSoon.ts`, `auctionWon.ts` ("You won the auction!"), `welcome.ts:23-24`
  ("start bidding in live auctions"), `kycApproved.ts:23-24` ("cleared to bid", "Start bidding"),
  `statusDelivered.ts:26` ("next auction cycle"), `watchlistMatch.ts:27` ("before it goes to
  auction"), `layout.ts:90,124` (footer "UAE-to-EU vehicle auctions"), `orderInvoice.ts`
  (hammer amount row).
- Admin approval notification `admin/actions.ts:585` ("you can now bid on live auctions").
- Crons (pg_cron → edge functions): job 1 `close-expired-auctions` (*/2), job 3
  `notify-auctions-ending-soon` (hourly; watchers + bidders, outbid flag), job 2
  `notify-watchlist-matches` (*/30; not bidding-specific). `/api/internal/notify` routes
  `auction_ending` and `auction_won` kinds.

## Other findings (not changed by this run unless stated)
- `invoices` RLS "buyers update own invoices" has no column limits or WITH CHECK; the finalize
  flow relies on it, but it also lets a buyer rewrite their own invoice's status/total over REST.
  **Fixed 2026-10-07 — migration 032** (`finalize_my_invoice()`; buyer UPDATE removed).
- `notifications` insert policy is `with check (true)` (any user can insert for anyone).
  **Fixed 2026-10-07 — migration 033** (own-user inserts only; server writes via the service role).
- The cron secret is stored in plain text inside `cron.job.command`.
  **Fixed 2026-10-07** — moved to Vault secret `cron_secret` (`supabase/manual/20261007_cron_secret_to_vault.sql`).
- 27/27 public tables rely on the default-ACL auto-grant (see CLAUDE.md, Supabase grants rule).
