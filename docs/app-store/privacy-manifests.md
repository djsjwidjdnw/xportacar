# Privacy manifests (PrivacyInfo.xcprivacy)

Both apps are **Expo SDK 54 managed** apps. Expo generates the
`PrivacyInfo.xcprivacy` file automatically at build time from the
`ios.privacyManifests` block in each app's `app.json` — there is no committed
`ios/` directory, so you do **not** hand-author the `.xcprivacy` file.

## What was added (committed to each mobile repo's app.json)
`expo.ios.privacyManifests`:
- `NSPrivacyTracking: false` — the apps do **no** cross-app/third-party tracking.
- `NSPrivacyTrackingDomains: []` — no tracking domains.
- `NSPrivacyAccessedAPITypes` — required-reason API declarations covering the
  common APIs used by Expo, React Native, AsyncStorage, secure store, file
  system and image pickers:

| API category | Reason code | Why |
|---|---|---|
| `NSPrivacyAccessedAPICategoryUserDefaults` | `CA92.1` | AsyncStorage / settings read-write within the app |
| `NSPrivacyAccessedAPICategoryFileTimestamp` | `C617.1` | File system / cached image handling |
| `NSPrivacyAccessedAPICategorySystemBootTime` | `35F9.1` | RN/Expo timers and uptime measurement |
| `NSPrivacyAccessedAPICategoryDiskSpace` | `E174.1` | Checking available space before writes/uploads |

These reason codes are the set Apple documents for these categories and that
Expo recommends for typical apps. After your next EAS build, confirm the
generated manifest with: `npx expo prebuild -p ios` then inspect
`ios/<App>/PrivacyInfo.xcprivacy` (do not commit the generated `ios/` dir).

## App Store Connect "App Privacy" (nutrition labels)
The `.xcprivacy` manifest is **not** the same as the App Privacy questionnaire
in App Store Connect. Declare the following there:

### Buyer app (com.xportacar.buyer)
- **Contact Info:** Name, Email, Phone Number, Other (company details) — *App Functionality, Account.* Linked to identity.
- **Identifiers:** User ID; Device ID (push token) — *App Functionality.*
- **Financial Info:** Payment Info (proof-of-payment documents the buyer uploads) — *App Functionality.* Linked to identity.
- **User Content:** Photos/Documents (payment proof) — *App Functionality.*
- **Usage Data:** Product Interaction (bids, watchlist) — *App Functionality.*
- **Tracking:** No. Data is **not** used for tracking or third-party ads.

### Inspector app (com.xportacar.inspector)
- **Contact Info:** Name, Email (inspector account) — *App Functionality.*
- **Identifiers:** User ID — *App Functionality.*
- **User Content:** Photos (vehicle, damage, paint-thickness), Documents (vehicle papers) — *App Functionality.*
- **Other Data:** Vehicle / seller details entered during inspection — *App Functionality.*
- **Tracking:** No.

> Supabase (auth, database, storage) is the backend data processor. No analytics
> or advertising SDKs are present in either app.
