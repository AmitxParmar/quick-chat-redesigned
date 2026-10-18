"use strict";

const STATIC_CACHE = "qc-static-v1";
const RUNTIME_CACHE = "qc-runtime-v1";
const NAV_CACHE = "qc-pages-v1";
const MAX_RUNTIME_ENTRIES = 60;

// App shell to warm on install (best-effort; failures don't block install).
const SHELL = ["/", "/chat-bg.png"];

self.addEventListener("install", (event) => {
  console.log("[Service Worker] Installing...");
  event.waitUntil(
    (async () => {
      const cache = await caches.open(STATIC_CACHE);
      await Promise.allSettled(SHELL.map((u) => cache.add(u)));
      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  console.log("[Service Worker] Activating...");
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k.startsWith("qc-") && ![STATIC_CACHE, RUNTIME_CACHE, NAV_CACHE].includes(k))
          .map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

async function trimCache(cacheName, max) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length > max) {
    await Promise.all(keys.slice(0, keys.length - max).map((k) => cache.delete(k)));
  }
}

// Runtime caching strategy router.
self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Only handle same-origin requests; let cross-origin (APIs, CDNs) be network-only
  // to avoid leaking auth and stale data.
  if (url.origin !== self.location.origin) return;

  // Never cache Next.js RSC payloads or API routes.
  if (url.searchParams.has("_rsc") || url.pathname.startsWith("/api/")) return;

  // Navigation requests: network-first with cached fallback.
  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const networkRes = await fetch(req);
          const cache = await caches.open(NAV_CACHE);
          cache.put(req, networkRes.clone()).catch(() => {});
          trimCache(NAV_CACHE, 10).catch(() => {});
          return networkRes;
        } catch {
          const cached = await caches.match(req);
          if (cached) return cached;
          return (await caches.match("/")) || Response.error();
        }
      })()
    );
    return;
  }

  // Immutable build assets: cache-first.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(req);
        if (cached) return cached;
        const networkRes = await fetch(req);
        const cache = await caches.open(STATIC_CACHE);
        cache.put(req, networkRes.clone()).catch(() => {});
        return networkRes;
      })()
    );
    return;
  }

  // Static media/fonts: cache-first, cap entries.
  if (/\.(png|jpg|jpeg|gif|webp|avif|svg|ico|woff2?|ttf|otf)$/i.test(url.pathname)) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(req);
        if (cached) return cached;
        try {
          const networkRes = await fetch(req);
          const cache = await caches.open(RUNTIME_CACHE);
          cache.put(req, networkRes.clone()).catch(() => {});
          trimCache(RUNTIME_CACHE, MAX_RUNTIME_ENTRIES).catch(() => {});
          return networkRes;
        } catch {
          return Response.error();
        }
      })()
    );
    return;
  }

  // Everything else: plain network with fallback to cache.
  event.respondWith(
    fetch(req).catch(() => caches.match(req).then((m) => m || Response.error()))
  );
});

self.addEventListener("push", (event) => {
  console.log("[Service Worker] Push Received.");
  if (!event.data) return;

  var data = {};
  try {
    data = event.data.json();
  } catch (e) {
    data = { title: "New Message", body: event.data.text() };
  }

  var title = data.title || "New Message";
  var options = {
    body: data.body || "You have a new message.",
    icon: data.icon || "/icon.png",
    badge: "/badge.png",
    vibrate: [100, 50, 100],
    data: { url: (data.data && data.data.url) || "/" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  console.log("[Service Worker] Notification click received.");
  event.notification.close();
  var url =
    event.notification.data && event.notification.data.url
      ? event.notification.data.url
      : "/";
  event.waitUntil(self.clients.openWindow(url));
});