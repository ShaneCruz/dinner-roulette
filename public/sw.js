// Dinner Roulette service worker: keeps the grocery list (and recently viewed
// pages) opening in a store with no signal. Changes made offline are queued by
// the page itself and synced when the connection returns.

const VERSION = "v1";
const PAGES = `pages-${VERSION}`;
const ASSETS = `assets-${VERSION}`;

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keep = new Set([PAGES, ASSETS]);
      for (const key of await caches.keys()) if (!keep.has(key)) await caches.delete(key);
      await self.clients.claim();
    })(),
  );
});

function isCacheablePage(response) {
  return response && response.ok && !response.redirected && response.type === "basic";
}

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (isCacheablePage(response)) cache.put(request, response.clone());
    return response;
  } catch (error) {
    const cached = await cache.match(request, { ignoreSearch: false });
    if (cached) return cached;
    // Last resort for a navigation: the most recent grocery list.
    if (request.mode === "navigate") {
      const keys = await cache.keys();
      const grocery = keys.find((k) => new URL(k.url).pathname === "/grocery");
      if (grocery) return cache.match(grocery);
    }
    throw error;
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(ASSETS);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/auth")) return;

  // Build output is content-hashed, so it never changes once fetched.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Client-side navigations fetch React Server Component payloads; let those
  // go straight to the network (the app handles being offline itself).
  if (request.headers.get("RSC") === "1" || url.searchParams.has("_rsc")) return;

  if (request.mode === "navigate" || url.pathname.startsWith("/api/grocery/")) {
    event.respondWith(networkFirst(request, PAGES));
  }
});
