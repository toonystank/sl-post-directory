const CACHE_VERSION = "v10";
const STATIC_CACHE = `sl-post-static-${CACHE_VERSION}`;
const PAGES_CACHE = `sl-post-pages-${CACHE_VERSION}`;
const RSC_CACHE = `sl-post-rsc-${CACHE_VERSION}`;
const API_CACHE = `sl-post-api-${CACHE_VERSION}`;
const ALL_CACHES = [STATIC_CACHE, PAGES_CACHE, RSC_CACHE, API_CACHE];

const IS_DEV_HOST =
  self.location.hostname === "localhost" ||
  self.location.hostname === "127.0.0.1" ||
  self.location.hostname.startsWith("ais-dev-");

// Install ONLY lightweight static icons & manifest so SW install NEVER causes
// a multi-page SSR stampede competing with the user's first paint / LCP.
const INSTALL_STATIC_URLS = [
  "/icon-192x192.png",
  "/icon-512x512.png",
  "/icon-maskable-512x512.png",
  "/apple-touch-icon.png",
  "/manifest.webmanifest",
];

const APP_SHELL_PATH_RE = /^\/(?:(?:si|ta)\/)?(?:|calculator|browse|track|blog|offline|rates(?:\/.*)?|district(?:\/.*)?)$/;

const STATIC_EXT_RE = /\.(?:png|jpg|jpeg|webp|avif|svg|ico|woff2?|css|js|webmanifest)$/i;
// Next.js / Turbopack development chunks have mutable paths and `no-store` headers;
// never cache them in the Service Worker or HMR/restarts will hit missing module factories.
const DEV_CHUNK_RE = /^\/_next\/static\/(?:development\/|chunks\/(?:%5B|\[|src_|app_|node_modules_|turbopack-|_))/i;
const CACHEABLE_API_PREFIXES = [
  "/api/autocomplete",
  "/api/offices",
  "/api/exchange-rate",
  "/api/posts",
  "/api/public/config",
];

function isCacheableResponse(res) {
  if (!res || !res.ok || res.redirected) return false;
  const cc = (res.headers.get("cache-control") || "").toLowerCase();
  if (cc.includes("no-store")) return false;
  return true;
}

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
    <p>This page hasn't been saved for offline use yet. Your postage calculator and offline Sri Lanka Post office search still work.</p>
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
    if (!DEV_CHUNK_RE.test(match[1])) {
      assets.add(match[1]);
    }
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
    if (!isCacheableResponse(res)) return;
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
          if (isCacheableResponse(assetRes)) {
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
    caches.open(STATIC_CACHE).then(async (staticCache) => {
      await Promise.allSettled(
        INSTALL_STATIC_URLS.map((url) =>
          fetch(url, { credentials: "omit" }).then((res) => {
            if (res.ok && !res.redirected) return staticCache.put(url, res);
          })
        )
      );
    })
  );
  // Activate immediately so stale cache versions (e.g. cached dev chunks) are purged right away
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const cacheNames = await caches.keys();
      let purgedLegacy = false;
      await Promise.all(
        cacheNames.map((cacheName) => {
          const isStaleVersion = !ALL_CACHES.includes(cacheName);
          const isDevStale =
            IS_DEV_HOST &&
            (cacheName === STATIC_CACHE || cacheName === PAGES_CACHE || cacheName === RSC_CACHE);
          if (isStaleVersion || isDevStale) {
            if (isStaleVersion) purgedLegacy = true;
            return caches.delete(cacheName);
          }
        })
      );
      await self.clients.claim();
      if (purgedLegacy) {
        const clientList = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
        for (const client of clientList) {
          client.postMessage({ type: "SW_FORCE_RELOAD_AFTER_PURGE" });
        }
      }
    })()
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
    const urls = Array.isArray(data.urls) ? data.urls : INSTALL_STATIC_URLS;
    event.waitUntil(
      Promise.all([
        caches.open(PAGES_CACHE),
        caches.open(STATIC_CACHE),
        caches.open(API_CACHE),
      ]).then(async ([pagesCache, staticCache, apiCache]) => {
        // Warm sequentially in small steps so background warming stays low-priority
        for (const url of urls) {
          if (typeof url !== "string") continue;
          if (url.startsWith("/api/")) {
            try {
              const existing = await apiCache.match(url);
              if (!existing) {
                const res = await fetch(url, { credentials: "omit" });
                if (res.ok && !res.redirected) await apiCache.put(url, res);
              }
            } catch {
              // Ignore
            }
            continue;
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
            continue;
          }
          const existingPage = await pagesCache.match(url);
          if (!existingPage) {
            await cachePageWithStaticAssets(url, pagesCache, staticCache);
          }
        }
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

  // Never intercept Next.js HMR, Turbopack dev chunks, auth sessions, admin endpoints, or Digital Asset Links
  if (
    url.pathname.startsWith("/_next/webpack-hmr") ||
    url.pathname.includes("hot-update") ||
    DEV_CHUNK_RE.test(url.pathname) ||
    url.pathname.startsWith("/api/auth") ||
    url.pathname.startsWith("/api/admin") ||
    url.pathname.startsWith("/.well-known/")
  ) {
    return;
  }

  // On dev hosts (localhost / ais-dev-*), NEVER cache or intercept Next.js chunks, HTML navigations,
  // or RSC payloads so Turbopack rebuilds always load fresh matching module factories.
  if (
    IS_DEV_HOST &&
    (url.pathname.startsWith("/_next/") ||
      request.mode === "navigate" ||
      request.headers.get("RSC") === "1" ||
      url.searchParams.has("_rsc"))
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
          if (isCacheableResponse(networkRes)) {
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

  // 2. Stale-While-Revalidate for read-only Directory Index, Autocomplete, Public Config & Exchange Rate APIs
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
        const cached = await cache.match(request);
        try {
          // Only use a short timeout when we already have a cached RSC fallback
          const networkRes = cached
            ? await fetchWithTimeout(request, 2500)
            : await fetch(request);
          if (isCacheableResponse(networkRes)) {
            cache.put(request, networkRes.clone());
          }
          return networkRes;
        } catch {
          if (cached) return cached;
          return Response.error();
        }
      })
    );
    return;
  }

  // 4. Full document navigations:
  //    - If a cached app shell exists, race network (1.2s) so slow connections paint fast & refresh in background.
  //    - If uncached, let network finish cleanly without premature timeout, falling back only on real offline/failure.
  if (request.mode === "navigate") {
    event.respondWith(
      caches.open(PAGES_CACHE).then(async (cache) => {
        const isAppShell = !url.search && APP_SHELL_PATH_RE.test(url.pathname);
        const existingHit = isAppShell ? await cache.match(url.pathname) : await cache.match(request);

        try {
          const networkRes = existingHit
            ? await fetchWithTimeout(request, isAppShell ? 1200 : 2500)
            : await fetch(request);
          if (isCacheableResponse(networkRes)) {
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
            if (hit) {
              event.waitUntil(
                fetch(request)
                  .then((fresh) => {
                    if (isCacheableResponse(fresh)) {
                      cache.put(request, fresh.clone());
                      if (!url.search) cache.put(url.pathname, fresh.clone());
                    }
                  })
                  .catch(() => {})
              );
              return hit;
            }
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
          if (isCacheableResponse(networkRes)) {
            cache.put(request, networkRes.clone());
          }
          return networkRes;
        })
        .catch(() => null);

      return cached || (await networkPromise) || buildOfflineHtmlFallback();
    })
  );
});
