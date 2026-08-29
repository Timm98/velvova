/*
 * Service Worker.
 *
 * Bewusst zurueckhaltend: zwischengespeichert wird ausschliesslich die
 * Huelle der Anwendung - Startseite, Symbol, Manifest. Nutzerinhalte
 * werden NICHT im Cache abgelegt. Ein Geraet, das jemand anderem in die
 * Haende faellt, soll keine Bewerbungsunterlagen offenlegen.
 */

const SHELL_CACHE = "paycheck-shell-v1";
const SHELL_ASSETS = ["/", "/icon.svg", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== SHELL_CACHE).map((k) => caches.delete(k))),
    ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Alles unterhalb von /app enthaelt Nutzerinhalte und wird nie gecacht.
  if (url.pathname.startsWith("/app") || event.request.method !== "GET") return;

  event.respondWith(
    fetch(event.request).catch(async () => {
      const cached = await caches.match(event.request);
      if (cached) return cached;
      return (
        (await caches.match("/")) ??
        new Response("Keine Verbindung. Deine Entwuerfe sind gesichert.", {
          status: 503,
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        })
      );
    }),
  );
});
