# App Store metadata — XportACar (Buyer app)

- **Bundle ID:** `com.xportacar.buyer`
- **Team:** Chase Bitz (2FVWM2KU8D) — transferred from Jon Anderson's team in 2026
- **Price:** Free
- **Primary category:** Business
- **Secondary category:** Shopping
- **Age rating:** 17+ (see questionnaire below)
- **Support URL:** https://www.xportacar.com/support
- **Marketing URL:** https://www.xportacar.com
- **Privacy policy URL:** https://xportacar.vercel.app/support _(placeholder — replace with a dedicated /privacy page when available)_
- **Privacy contact email:** privacy@xportacar.com _(placeholder)_
- **Copyright:** © 2026 XportACar _(placeholder — finalize once Simon provides the legal entity)_

---

> **Fixed-price marketplace wording (2026-10-07).** Sourced from the live site
> (`landing.*`, `support.q*`, `listing.*` in `src/i18n/en.json`). en-US is the only
> App Store localization. **Promotional text is live** (saved + re-read via the App
> Store Connect API). **Description and keywords below are NOT live yet:** Apple
> refuses edits on the live 1.0 version (`409 STATE_ERROR … cannot be edited at
> this time`); they go in when the next App Store version (1.0.1) is created.

## Subtitle (max 30)
```
UAE-to-EU vehicle marketplace
```
(29 chars — the live listing currently has no subtitle)

## Promotional text (max 170) — LIVE
```
Buy inspected UAE vehicles at a fixed price and import them to Europe. 7-day listings, transparent condition reports and door-to-door shipping in one app.
```
(154 chars)

## Keywords (max 100, comma-separated) — for the next version
```
car marketplace,vehicle import,used cars,Dubai,UAE,Europe,luxury cars,car shipping,RoRo,buy car
```
(95 chars)

## Description (max 4000) — for the next version
```
XportACar connects European buyers with quality, privately owned vehicles in the United Arab Emirates — inspected on the ground, listed at a fixed price, and shipped to the EU.

Browse a curated marketplace of inspected cars, buy any live listing at its listed price, and manage the full purchase through to delivery — all from your phone.

WHY XPORTACAR
• Every vehicle is inspected by a UAE field team before listing
• Transparent condition reports with photos, damage details and a paint-thickness reading
• Fixed prices and 7-day listings — one clear price per car, no haggling, no waiting
• Transparent pricing: vehicle price + 2.9% platform fee + shipping — no hidden margins

BUYING
• Every car carries one clear price and stays listed for 7 days
• Review the full inspection, then buy instantly at the listed price
• The first confirmed purchase secures the vehicle

ORDER & PAYMENT
• A clear two-step flow after you buy: confirm payment within 36 hours, then complete your wire transfer within 5 working days
• Upload proof of payment directly in the app
• Itemized invoice with vehicle price, platform fee and your chosen shipping

SHIPPING & DELIVERY
• Choose warehouse pickup in Dubai, RoRo or container shipping to major EU ports, or door-to-door delivery
• Add optional German Registration (TÜV)
• Import duties, customs and VAT are clearly disclosed as the buyer's responsibility

ACCOUNTS
• Register as a business or individual buyer
• Complete KYC verification before you buy
• Track your purchases, orders and watchlist

XportACar is built for serious cross-border buyers. Purchases are binding and involve real financial commitments, so the app is intended for adults.

Questions? Visit https://www.xportacar.com/support
```
(1739 chars)

## What's New — version 1.0.1 (max 4000)
```
XportACar is now a fixed-price marketplace.

• Every car has one clear price and stays listed for 7 days — buy instantly at the listed price
• New Purchases tab with your orders and invoices
• Refreshed XportACar logo and app icon
• Detailed condition reports with photos, damage entries and paint-thickness readings
• Two-step payment: confirm within 36 hours, then wire within 5 working days, with in-app proof upload
• Flexible shipping: Dubai warehouse pickup, RoRo/container to EU ports, or door-to-door, plus optional German Registration (TÜV)
• Available in English, German, French and Arabic

Thank you for using XportACar. We'd love your feedback at support@xportacar.com.
```

---

## Age rating questionnaire (target: 17+)
Answer honestly in App Store Connect. The content descriptors below do **not**
themselves force 17+ (this app has no violence, sexual content, gambling, etc.),
so Apple's questionnaire is likely to **compute a lower rating (≈4+/9+)**. The
17+ intent reflects that the app facilitates **real, binding financial
transactions intended for adult business buyers**. See the flag at the bottom.

| Questionnaire item | Answer |
|---|---|
| Cartoon or Fantasy Violence | None |
| Realistic Violence | None |
| Prolonged Graphic/Sadistic Violence | None |
| Profanity or Crude Humor | None |
| Mature/Suggestive Themes | None |
| Horror/Fear Themes | None |
| Medical/Treatment Information | None |
| Alcohol, Tobacco, or Drug Use or References | None |
| Sexual Content or Nudity | None |
| Gambling (simulated) | None |
| Contests | None |
| Unrestricted Web Access | No |
| Gambling and Contests (real) | No |

**To present 17+:** in the current App Store Connect age-rating flow you may set
the rating to reflect mature/financial use. If the questionnaire computes a
lower minimum and Apple does not allow manually raising it, accept the computed
rating and rely on the in-app terms (binding purchases, adult B2B audience). **Confirm
the achievable rating in App Store Connect — see SUBMISSION_CHECKLIST.md.**

## Data collected (for App Store Connect "App Privacy")
- Contact info: name, email, phone, company details
- Identifiers: user ID; device token (push notifications)
- Financial info: payment-proof documents (uploaded by the buyer)
- User content: uploaded files/photos (payment proof)
- Usage data: purchases, watchlist, app interactions (for app functionality)
- **Tracking:** None. Data is not used for third-party advertising or tracking.
```
