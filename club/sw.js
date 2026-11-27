/* Service worker "red primero" con tiempo límite — estándar anti pantalla en blanco (iPhone/WebKit).
   - Solo mismo dominio y GET; Supabase y otros dominios pasan directo (datos siempre en vivo).
   - Intenta la red (cache:'no-cache'); si tarda más de 6 s o falla, usa la copia guardada.
   - Solo guarda respuestas r.ok. version.json nunca se guarda. */
const V = "19";
const CACHE = "mcg-club-v" + V;
const TIMEOUT = 6000;
self.addEventListener("install", e => { self.skipWaiting(); });
self.addEventListener("activate", e => { e.waitUntil((async () => {
  const ks = await caches.keys(); await Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)));
  await self.clients.claim(); })()); });
// iOS rechaza respuestas con redirect servidas desde un SW en navegaciones: se reconstruyen limpias
const clean = r => r.redirected ? r.blob().then(b => new Response(b, { status: r.status, statusText: r.statusText, headers: r.headers })) : r;
self.addEventListener("fetch", e => {
  const req = e.request, u = new URL(req.url);
  if (req.method !== "GET" || u.origin !== self.location.origin) return;
  if (u.pathname.endsWith("/version.json") || u.pathname.endsWith("/sw.js")) return;
  e.respondWith((async () => {
    const net = fetch(req.url, { cache: "no-cache", credentials: "same-origin" }).then(clean).then(r => {
      if (r.ok) { const c = r.clone(); caches.open(CACHE).then(ca => ca.put(u.origin + u.pathname, c)).catch(() => {}); }
      return r; });
    const late = new Promise(res => setTimeout(() => res(null), TIMEOUT));
    try {
      const r = await Promise.race([net, late]);
      if (r) return r;
      const hit = await caches.match(req.url, { ignoreSearch: true });
      return hit || await net;
    } catch (err) {
      const hit = await caches.match(req.url, { ignoreSearch: true });
      if (hit) return hit; throw err;
    }
  })());
});
