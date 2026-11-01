// Service worker básico de PrestoBar (B9).
// Guarda la app (HTML, JS, CSS, íconos) para que Mesero, Cocina, Cajero y Delivery abran sin internet.
// Los datos de Supabase NUNCA se guardan aquí: siempre se piden a la red.
const CACHE = "restobar-v1";
const BASICOS = ["/", "/index.html", "/manifest.webmanifest", "/icono.svg"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(BASICOS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", e => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin) return; // Supabase y fuentes van directo a la red
  // Páginas: primero la red; sin internet, la app guardada
  if (req.mode === "navigate") {
    e.respondWith(fetch(req).catch(() => caches.match("/index.html")));
    return;
  }
  // Archivos de la app: primero lo guardado, y se actualiza en segundo plano
  e.respondWith(
    caches.match(req).then(guardado => {
      const red = fetch(req).then(res => {
        if (res.ok) caches.open(CACHE).then(c => c.put(req, res.clone()));
        return res;
      }).catch(() => guardado);
      return guardado || red;
    }),
  );
});
