// Service worker: app offline. Código y catálogo: red primero (para recibir cambios), caché de respaldo.
// Fotos externas: caché primero, máximo 600 entradas.
const SHELL = "iglu-shell-v2", IMGS = "iglu-img-v1";
const FILES = ["./", "index.html", "css/app.css", "js/app.js", "data/catalog.json", "manifest.webmanifest", "icons/icon.svg", "icons/icon-192.png"];
self.addEventListener("install", e => { e.waitUntil(caches.open(SHELL).then(c => c.addAll(FILES))); self.skipWaiting() });
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => ![SHELL, IMGS].includes(k)).map(k => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener("fetch", e => {
  const req = e.request; if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin === location.origin) {
    e.respondWith(fetch(req).then(r => { if (r.ok) { const cp = r.clone(); caches.open(SHELL).then(c => c.put(req, cp)) } return r })
      .catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || caches.match("index.html"))));
  } else if (req.destination === "image") {
    e.respondWith(caches.open(IMGS).then(async c => {
      const hit = await c.match(req); if (hit) return hit;
      const r = await fetch(req, { mode: "no-cors" });
      c.put(req, r.clone()).then(async () => { const ks = await c.keys(); if (ks.length > 600) c.delete(ks[0]) });
      return r;
    }).catch(() => fetch(req)));
  }
});
