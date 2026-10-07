# App Store screenshots — tooling

Isolated from the web app (own `package.json`; generated output is gitignored).
Spec, sizes and per-app screen lists: `docs/app-store/screenshots.md`.

## Current route (1.0.1+): real app UI, no iPhone needed
1. **Build the app for web from the App Store build's commit** (a clean copy, so
   the app repo is untouched):
   ```
   git -C ../xportacar-inspection archive --format=tar -o insp.tar <build-commit>
   mkdir insp && tar -xf insp.tar -C insp && cd insp && npm ci && npm run build:web
   ```
   The buyer app has no web dependencies in its repo; add them in the COPY only:
   ```
   npm ci && npx expo install react-native-web react-dom @expo/metro-runtime
   npx expo export --platform web
   ```
   Both builds use the production Supabase project from `app.json` `extra`.
2. **Serve `dist/`** with any static server that falls back to `index.html`.
3. **Capture** (iPhone 6.5" = 1284×2778 and iPad 13" = 2064×2752):
   ```
   npm install            # playwright
   APP_EMAIL=... APP_PASSWORD=... node capture-app-web.mjs inspector iphone65 http://127.0.0.1:8702/ raw/iphone65
   APP_EMAIL=... APP_PASSWORD=... node capture-app-web.mjs inspector ipad13   http://127.0.0.1:8702/ raw/ipad13
   ```
   Set `CDP_URL=http://127.0.0.1:9222` to drive an already-running Chrome (isolated
   context); otherwise run `npx playwright install chromium` first.
4. **Frame** with the brand background + headline + device frame:
   ```
   python make-store-shots.py inspector raw out
   ```
   Output: `out/<iphone65|ipad13>/<n>-<screen>.png` (PNG, RGB, no alpha).
5. **Upload** to the version's screenshot sets in App Store Connect (6.5" iPhone and
   13" iPad), then delete the old ones.

## 1.0 tooling (history)
- `make-mockups.py` — framed phone captures from `input/<app>/` at 6.7/6.5/5.5".
- `make-ipad.py` — reframed the 6.5" mockups onto a 13" iPad canvas.
- `capture-web.mjs` — captures the Next.js **website**, not the app (reference only).
