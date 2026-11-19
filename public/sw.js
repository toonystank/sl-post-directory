const CACHE_VERSION = "v6";
const STATIC_CACHE = `sl-post-static-${CACHE_VERSION}`;
const PAGES_CACHE = `sl-post-pages-${CACHE_VERSION}`;
const RSC_CACHE = `sl-post-rsc-${CACHE_VERSION}`;
const API_CACHE = `sl-post-api-${CACHE_VERSION}`;
const ALL_CACHES = [STATIC_CACHE, PAGES_CACHE, RSC_CACHE, API_CACHE];

const PRECACHE_SHELL_URLS = [
  "/",
  "/si",
  "/ta",
  "/calculator",
  "/browse",
  "/track",
  "/blog",
  "/offline",
  "/si/offline",
  "/ta/offline",
  "/icon-192x192.png",
  "/icon-512x512.png",
  "/icon-maskable-512x512.png",
  "/apple-touch-icon.png",
  "/manifest.webmanifest",
];

const STATIC_EXT_RE = /\.(?:png|jpg|jpeg|webp|avif|svg|ico|woff2?|css|js|webmanifest)$/i;
const CACHEABLE_API_PREFIXES = [
  "/api/autocomplete",
  "/api/offices",
  "/api/exchange-rate",
  "/api/posts",
];

function buildOfflineHtmlFallback() {
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Offline · Lanka Post Directory</title>
  <style>
    body { margin: 0; font-family: system-ui, -apple-system, sans-serif; background: #FBF7EF; color: #1A1714; display: grid; place-items: center; min-height: 100dvh; padding: 24px; }
    .card { max-width: 420px; width: 100%; background: #FFFDF8; border: 2px solid #1A1714; border-radius: 10px; padding: 24px; box-shadow: 4px 4px 0 #1A1714; }
    h1 { margin: 0 0 8px; font-size: 1.4rem; }
    p { margin: 0 0 18px; color: #5c534a; line-height: 1.5; font-size: 0.95rem; }
    .actions { display: flex; flex-wrap: wrap; gap: 10px; }
    a, button { font: inherit; font-weight: 700; font-size: 0.9rem; padding: 10px 14px; border-radius: 6px; border: 2px solid #1A1714; text-decoration: none; cursor: pointer; }
    .primary { background: #B4161B; color: #FFFDF8; }
    .secondary { background: #F5B700; color: #1A1714; }
  </style>
</head>
<body>
  <main class="card">
    <h1>You're offline</h1>
    <p>This page hasn't been saved for offline use yet. Your postage calculator and cached directory pages still work offline.</p>
    <div class="actions">
      <a class="primary" href="/calculator">Open Calculator</a>
      <a class="secondary" href="/">Go Home</a>
      <button type="button" onclick="window.location.reload()">Retry</button>
    </div>
  </main>
</body>
</html>`;
  return new Response(html, {
    status: 503,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function resolveOfflineFallbackKeys(url) {
  const keys = [];
  const full = `${url.pathname}${url.search}`;
  const pathname = url.pathname || "/";
  const pushUnique = (val) => {
    if (val && !keys.includes(val)) keys.push(val);
  };

  pushUnique(full);
  pushUnique(pathname);

  const localeMatch = pathname.match(/^\/(si|ta|en)(\/.*)?$/);
  if (localeMatch) {
    const locale = localeMatch[1];
    const rest = localeMatch[2] || "/";
    if (locale !== "en") {
      pushUnique(`/${locale}`);
    }
    pushUnique(rest);
    pushUnique(`/${locale}/offline`);
  }

  pushUnique("/offline");
  pushUnique("/");
  return keys;
}

function extractStaticAssetsFromHtml(html) {
  const assets = new Set();
  const re = /(?:src|href)=["'](\/_next\/static\/[^"']+)["']/g;
  let match;
  while ((match = re.exec(html)) !== null) {
    assets.add(match[1]);
  }
  return Array.from(assets);
}

async function cachePageWithStaticAssets(url, pagesCache, staticCache) {
  try {
    // Use credentials: "omit" + X-SW-Precache so precaching /si or /ta NEVER mutates
    // the user's NEXT_LOCALE cookie and NEVER follows a cookie-based locale redirect.
    const res = await fetch(url, {
      credentials: "omit",
      headers: { "X-SW-Precache": "1" },
    });
    if (!res.ok || res.redirected) return;
    const contentType = res.headers.get("content-type") || "";
    if (contentType.includes("text/html")) {
      const html = await res.clone().text();
      await pagesCache.put(url, res);
      const staticAssets = extractStaticAssetsFromHtml(html);
      await Promise.allSettled(
        staticAssets.map(async (assetUrl) => {
          const existing = await staticCache.match(assetUrl);
          if (existing) return;
          const assetRes = await fetch(assetUrl, { credentials: "omit" });
          if (assetRes.ok && !assetRes.redirected) {
            await staticCache.put(assetUrl, assetRes);
          }
        })
      );
    } else {
      await pagesCache.put(url, res);
    }
  } catch {
    // Ignore individual precache failures
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    Promise.all([caches.open(PAGES_CACHE), caches.open(STATIC_CACHE)]).then(
      async ([pagesCache, staticCache]) => {
        await Promise.allSettled(
          PRECACHE_SHELL_URLS.map((url) =>
            STATIC_EXT_RE.test(url)
              ? fetch(url, { credentials: "omit" }).then((res) => {
                  if (res.ok && !res.redirected) return staticCache.put(url, res);
                })
              : cachePageWithStaticAssets(url, pagesCache, staticCache)
          )
        );
      }
    )
  );
  // Activate immediately only on initial install (when no active SW controls clients yet)
  if (!self.registration.active) {
    self.skipWaiting();
  }
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames.map((cacheName) => {
            if (!ALL_CACHES.includes(cacheName)) {
              return caches.delete(cacheName);
            }
          })
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  const data = event.data;
  if (!data) return;

  if (data.type === "SKIP_WAITING") {
    self.skipWaiting();
    return;
  }

  if (data.type === "PRECACHE_APP_SHELL") {
    const urls = Array.isArray(data.urls) ? data.urls : PRECACHE_SHELL_URLS;
    event.waitUntil(
      Promise.all([
        caches.open(PAGES_CACHE),
        caches.open(STATIC_CACHE),
        caches.open(API_CACHE),
      ]).then(async ([pagesCache, staticCache, apiCache]) => {
        await Promise.allSettled(
          urls.map(async (url) => {
            if (typeof url !== "string") return;
            if (url.startsWith("/api/")) {
              try {
                const res = await fetch(url, { credentials: "omit" });
                if (res.ok && !res.redirected) await apiCache.put(url, res);
              } catch {
                // Ignore
              }
              return;
            }
            if (STATIC_EXT_RE.test(url)) {
              try {
                const existing = await staticCache.match(url);
                if (!existing) {
                  const res = await fetch(url, { credentials: "omit" });
                  if (res.ok && !res.redirected) await staticCache.put(url, res);
                }
              } catch {
                // Ignore
              }
              return;
            }
            await cachePageWithStaticAssets(url, pagesCache, staticCache);
          })
        );
      })
    );
  }
});

async function fetchWithTimeout(request, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(request, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Never intercept Next.js HMR, auth sessions, or admin endpoints
  if (
    url.pathname.startsWith("/_next/webpack-hmr") ||
    url.pathname.includes("hot-update") ||
    url.pathname.startsWith("/api/auth") ||
    url.pathname.startsWith("/api/admin")
  ) {
    return;
  }

  // 1. Cache-First for immutable static assets, icons, fonts, and manifest
  if (url.pathname.startsWith("/_next/static/") || STATIC_EXT_RE.test(url.pathname)) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        try {
          const networkRes = await fetch(request);
          if (networkRes.ok) {
            cache.put(request, networkRes.clone());
          }
          return networkRes;
        } catch {
          return cached || new Response("", { status: 504, statusText: "Offline" });
        }
      })
    );
    return;
  }

  // 2. Stale-While-Revalidate for read-only Directory, Autocomplete & Exchange Rate APIs
  if (CACHEABLE_API_PREFIXES.some((prefix) => url.pathname.startsWith(prefix))) {
    event.respondWith(
      caches.open(API_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        const networkPromise = fetch(request)
          .then((networkRes) => {
            if (networkRes.ok) {
              cache.put(request, networkRes.clone());
            }
            return networkRes;
          })
          .catch(() => null);

        if (cached) {
          event.waitUntil(networkPromise);
          return cached;
        }

        const live = await networkPromise;
        if (live) return live;

        return new Response(
          JSON.stringify({ offline: true, offices: [], suggestions: [] }),
          {
            status: 503,
            headers: { "Content-Type": "application/json" },
          }
        );
      })
    );
    return;
  }

  // Pass through other API routes without caching
  if (url.pathname.startsWith("/api/")) {
    return;
  }

  // 3. Next.js App Router RSC payload fetches: keep strictly separate from HTML documents
  const isRsc = request.headers.get("RSC") === "1" || url.searchParams.has("_rsc");
  if (isRsc) {
    event.respondWith(
      caches.open(RSC_CACHE).then(async (cache) => {
        try {
          const networkRes = await fetchWithTimeout(request, 3500);
          if (networkRes.ok) {
            cache.put(request, networkRes.clone());
          }
          return networkRes;
        } catch {
          const cached = await cache.match(request);
          if (cached) return cached;
          return Response.error();
        }
      })
    );
    return;
  }

  // 4. Full document navigations: Network-First (2.5s timeout) with smart pathname & offline-page fallback
  if (request.mode === "navigate") {
    event.respondWith(
      caches.open(PAGES_CACHE).then(async (cache) => {
        try {
          const networkRes = await fetchWithTimeout(request, 2500);
          if (networkRes.ok && !networkRes.redirected) {
            cache.put(request, networkRes.clone());
            if (!url.search) {
              cache.put(url.pathname, networkRes.clone());
            }
          }
          return networkRes;
        } catch {
          const keys = resolveOfflineFallbackKeys(url);
          for (const key of keys) {
            const hit = await cache.match(key);
            if (hit) return hit;
          }
          return buildOfflineHtmlFallback();
        }
      })
    );
    return;
  }

  // 5. Fallback SWR for any other same-origin GET asset
  event.respondWith(
    caches.open(PAGES_CACHE).then(async (cache) => {
      const cached = await cache.match(request);
      const networkPromise = fetch(request)
        .then((networkRes) => {
          if (networkRes.ok) {
            cache.put(request, networkRes.clone());
          }
          return networkRes;
        })
        .catch(() => null);

      return cached || (await networkPromise) || buildOfflineHtmlFallback();
    })
  );
});
