// Dinner Roulette service worker: keeps the grocery list (and recently viewed
// pages) opening in a store with no signal. Changes made offline are queued by
// the page itself and synced when the connection returns.

const VERSION = "v2";
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
  // In development, file names don't change between edits; never cache there.
  if (self.location.hostname === "localhost" || self.location.hostname === "127.0.0.1") return;

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

// Reminders from the server (start cooking, thaw, rate it, next week planned).
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "Dinner Roulette", body: event.data ? event.data.text() : "" };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "Dinner Roulette", {
      body: data.body || "",
      tag: data.tag,
      icon: "/icon",
      badge: "/icon",
      data: { url: data.url || "/" },
    }),
  );
});

// Tapping a notification opens the page it's about (or brings a cooking
// timer's recipe back to the front).
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = event.notification.data && event.notification.data.url;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      if (target) {
        const url = new URL(target, self.location.origin).href;
        const open = windows.find((w) => w.url === url);
        if (open) return open.focus();
        if (windows[0] && "navigate" in windows[0]) {
          await windows[0].focus();
          return windows[0].navigate(url);
        }
        return self.clients.openWindow(url);
      }
      const recipe = windows.find((w) => {
        const path = new URL(w.url).pathname;
        return path.startsWith("/recipes/") || path.startsWith("/cook/");
      }) ?? windows[0];
      if (recipe) return recipe.focus();
      return self.clients.openWindow("/");
    })(),
  );
});
