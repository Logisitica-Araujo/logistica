/* App Gestores 2 — sw.js
 * Guarda la app en el celular para que abra al instante y sin señal.
 * Nunca guarda respuestas del servidor (esas las maneja app.js).
 * Al cambiar cualquier archivo de la app, sube VERSION. */
const VERSION = 'gestores2-v2';
const ARCHIVOS = ['./', './index.html', './estilos.css', './app.js', './config.js', './manifest.json',
  '../lib/barcode-detector.js', '../lib/zxing_reader.wasm', '../iconos/icono-192.png', '../iconos/favicon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => Promise.all(ARCHIVOS.map(a =>
    fetch(new Request(a, { cache: 'reload' })).then(r => { if (r.ok) return c.put(a, r); }).catch(() => {})
  ))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ns => Promise.all(ns.filter(n => n.indexOf('gestores2-') === 0 && n !== VERSION).map(n => caches.delete(n))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (/google\.com$|googleusercontent\.com$/.test(url.hostname) && url.hostname.indexOf('fonts') < 0) return;   // el servidor y Drive: directo
  // config.js y la pantalla: internet primero (para recibir versiones nuevas), copia si no hay señal
  if (req.mode === 'navigate' || url.pathname.endsWith('/config.js')) {
    e.respondWith(fetch(req).then(r => { const c = r.clone(); caches.open(VERSION).then(x => x.put(req, c)); return r; })
      .catch(() => caches.match(req).then(h => h || caches.match('./index.html'))));
    return;
  }
  // lo demás (css, js, lector, íconos, tipografías): la copia primero, abre al instante
  e.respondWith(caches.match(req).then(h => h || fetch(req).then(r => {
    if (r.ok && (r.type === 'basic' || r.type === 'cors')) { const c = r.clone(); caches.open(VERSION).then(x => x.put(req, c)); }
    return r;
  })));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window' }).then(cs => cs.length ? cs[0].focus() : self.clients.openWindow('./')));
});
