# Market price fixtures

Recorded sample responses for the market-prices engine
(`supabase/functions/_shared/marketPrices.ts`). Used by
`npx tsx scripts/test-market-prices.ts`. No test makes a network call.

| File | Source |
|---|---|
| `vincario-vehicle-market-value.docs-example.json` | Verbatim "Success response" example of Vincario's Vehicle Market Value endpoint (API 3.2 OpenAPI spec, vincario.com/api-docs/3.2; mirror: github.com/api-evangelist/vincario `openapi/vincario-vehicle-market-value-api-openapi.yml`). Retrieved 2026-10-15. 2012 Toyota Yaris, europe group: median €6,700 from 29 listings. |
| `vincario-errors.docs-examples.json` | The error bodies documented in the same spec (unknown key, bad control sum, out of lookups, rate limit, VIN not recognised, insufficient statistical data, odometer errors). |
| `apify-memo23-motors.published-sample.json` | Verbatim "Sample JSON Output for Listings - Motors" from the README of the Apify actor `memo23/dubizzle-search-listing-s-scraper` (apify.com), retrieved 2026-10-15, wrapped in an array (the dataset-items shape). One listing: 2018 Mercedes-Benz GLC 43 AMG, AED 119,000, 128,000 km. |
| `frankfurter-latest.recorded.json` | Live response of `https://api.frankfurter.dev/v1/latest?base=EUR&symbols=USD` (ECB reference rates, free, no key) recorded 2026-10-15: EUR/USD 1.1195 for 2026-10-14. |
| `apify-memo23-motors.glc43-2018.derived.json` | **Synthetic.** 14 listings built from the published sample's shape (ids, prices, years, km and two models changed): 9 valid 2017–2019 GLC comparables plus a duplicate, a 2015 car, an extra-zero typo (AED 1,190,000), an instalment price (AED 2,999) and a GLE. Not market data. |
| `vincario-vehicle-market-value.glc43-2018.derived.json` | **Synthetic.** The docs example's shape with GLC 43 AMG numbers (europe median €38,900 from 41 listings). Not market data. Used for the card screenshot. |
