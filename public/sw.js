/* XportACar Service Worker — offline shell + stale-while-revalidate for static assets */

const SW_VERSION = "xpc-v1";
const STATIC_CACHE = `${SW_VERSION}-static`;
const RUNTIME_CACHE = `${SW_VERSION}-runtime`;

// Things we want available offline even on the first run after install.
const PRECACHE_URLS = [
  "/",
  "/marketplace",
  "/manifest.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) =>
      cache.addAll(PRECACHE_URLS).catch(() => {
        // Soft-fail: some URLs (e.g. /marketplace in incognito) may 401/302.
        // We still want install to succeed so future requests are cached.
      })
    )
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => !k.startsWith(SW_VERSION))
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// Strategy per request type:
//   - HTML navigations: network-first, fall back to cached / index.
//   - Static assets (Next.js _next, images, icons, fonts): stale-while-revalidate.
//   - Supabase + dynamic API: network-only — don't cache personalised data.
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Skip cross-origin Supabase / API requests.
  if (url.hostname.includes("supabase.co") || url.pathname.startsWith("/api/")) {
    return;
  }

  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(RUNTIME_CACHE).then((c) => c.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(req).then((r) => r || caches.match("/marketplace")))
    );
    return;
  }

  if (
    url.pathname.startsWith("/_next/") ||
    url.pathname.startsWith("/icons/") ||
    /\.(?:png|jpg|jpeg|webp|avif|svg|woff2?|css|js)$/.test(url.pathname)
  ) {
    event.respondWith(
      caches.match(req).then((cached) => {
        const fetchPromise = fetch(req)
          .then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(RUNTIME_CACHE).then((c) => c.put(req, copy)).catch(() => {});
            }
            return res;
          })
          .catch(() => cached);
        return cached || fetchPromise;
      })
    );
  }
});
