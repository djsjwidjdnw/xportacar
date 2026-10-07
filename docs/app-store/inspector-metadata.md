# App Store metadata — XportACar Inspection (Inspector app)

- **Bundle ID:** `com.xportacar.inspector`
- **Team:** Chase Bitz (2FVWM2KU8D) — transferred from Jon Anderson's team in 2026
- **Price:** Free
- **Primary category:** Business
- **Secondary category:** Productivity
- **Age rating:** 17+ (per project decision — see note below)
- **Support URL:** https://www.xportacar.com/support
- **Marketing URL:** https://www.xportacar.com
- **Privacy policy URL:** https://xportacar.vercel.app/support _(placeholder — replace with /privacy when available)_
- **Privacy contact email:** privacy@xportacar.com _(placeholder)_
- **Copyright:** © 2026 XportACar _(placeholder — finalize with Simon)_

> Distribution note: this is an **internal field tool for XportACar inspectors**,
> not a consumer app. Consider TestFlight-only or a restricted release rather
> than full public App Store distribution. See SUBMISSION_CHECKLIST.md.

---

## Subtitle (max 30)
```
Vehicle inspection field tool
```
(29 chars)

> **Fixed-price marketplace wording (2026-10-07).** en-US is the only App Store
> localization. **Promotional text is live.** Description, keywords, promotional
> text and What's New below were pasted into App Store version **1.0.1** (Prepare
> for Submission, build 9) and re-read on 2026-10-07, together with 5 new
> screenshots per size (real 1.0.1 UI, see `screenshots.md`).

## Promotional text (max 170) — LIVE
```
The field tool for XportACar inspectors: capture vehicle details, photos, damage and paint-thickness readings, then submit vehicles for listing — all from your phone.
```
(166 chars)

## Keywords (max 100, comma-separated)
```
vehicle inspection,car inspection,damage report,VIN,paint gauge,condition report,auto inspector
```
(95 chars)

## Description (max 4000) — in 1.0.1
```
XportACar Inspection is the field tool used by XportACar's inspection teams in the United Arab Emirates to document privately owned vehicles and prepare them for sale on the XportACar marketplace.

This app is intended for authorized XportACar inspectors. A valid inspector account is required to sign in.

GUIDED INSPECTION WIZARD
• Capture vehicle details: VIN, make, model, year, mileage, colour, transmission and fuel type
• Take the required exterior, interior and engine photos with on-device guidance
• Record a Paint Thickness Test photo to document the gauge reading
• Log damage by panel with severity and a photo for each issue
• Attach documents (registration, service book, insurance)
• Suggest an asking price from market data for the admin team to review

DESIGNED FOR THE FIELD
• Works step by step so nothing is missed before submission
• Auto-saves your progress as a draft
• Uploads photos to secure storage as you go
• Submits the completed inspection for office review and listing

Once submitted, the office team reviews the inspection, sets the final fixed price and lists the vehicle for sale in the XportACar buyer app.

Support: https://www.xportacar.com/support
```
(1188 chars)

## What's New — version 1.0.1 (max 4000)
```
XportACar Inspection 1.0.1

• Suggest an asking price for each vehicle — the admin team sets the final fixed price when it is listed for sale
• Clearer email-confirmation and sign-in messages for inspector accounts
• Refreshed XportACar logo and app icon

Feedback is welcome at contact@xportacar.com.
```
(Sourced from the inspector commits between build 8 and build 9: 767577d asking
price, 562e35a confirm/sign-in copy, 2d8f871 brand assets.)

---

## Age rating questionnaire (project decision: 17+)
This is a B2B inspection tool with **no buying, selling, payment, violence,
sexual or gambling content**, so the questionnaire will compute a **low rating
(≈4+)**. The 17+ here is a project-wide decision for consistency with the buyer
app; it is **not driven by content**. Recommend either accepting the computed
rating or restricting distribution to inspectors via TestFlight.

| Questionnaire item | Answer |
|---|---|
| Cartoon/Fantasy/Realistic Violence | None |
| Profanity or Crude Humor | None |
| Mature/Suggestive Themes | None |
| Horror/Fear Themes | None |
| Alcohol, Tobacco, or Drug Use | None |
| Sexual Content or Nudity | None |
| Gambling (simulated/real) / Contests | None / No |
| Unrestricted Web Access | No |
| Medical/Treatment Information | None |

## Data collected (for App Store Connect "App Privacy")
- Contact info: inspector account email/name
- Identifiers: user ID
- User content: vehicle photos, document scans, damage photos, paint-thickness photo
- Other data: vehicle/seller details entered during inspection
- Camera & Photo Library: used to capture/select inspection photos
- **Tracking:** None.
```
