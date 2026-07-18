const CACHE_NAME = "atoms-demo-v7";
const ASSETS = [
  "./",
  "./index.html",
  "./styles.css?v=7",
  "./js/app.js?v=7",
  "./js/planner.js?v=7",
  "./js/storage.js?v=7",
  "./assets/atoms-mark.svg",
  "./assets/agents/mike.webp",
  "./assets/agents/emma.webp",
  "./assets/agents/bob.webp",
  "./assets/agents/alex.webp",
  "./assets/agents/david.webp",
  "./assets/agents/iris.webp",
  "./assets/agents/sarah.webp",
  "./assets/agents/adrian.png",
  "./favicon.ico",
  "./manifest.webmanifest"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET" || new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(() => caches.match(event.request).then((cached) => cached || caches.match("./index.html")))
  );
});
