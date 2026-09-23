/***********************************************************************
 * LOGÍSTICA FADERMEX — sw.js  (service worker)
 * ---------------------------------------------------------------------
 * Es lo que hace que la app abra aunque el gestor no tenga señal:
 * guarda una copia de la pantalla en el celular la primera vez.
 *
 * NUNCA guarda respuestas del Apps Script: esos datos deben ser frescos.
 * Lo que se captura sin señal lo maneja app.js con su propia cola.
 *
 * Cada vez que cambies algo de la app, sube el número de VERSION.
 * Eso obliga a todos los celulares a bajar la versión nueva.
 *
 * ---------------------------------------------------------------------
 * CAMBIO DE LA v4 (importante):
 *   config.js YA NO se sirve desde la copia guardada.
 *   Siempre se pide fresco a internet, y solo si no hay señal se usa
 *   la copia. ¿Por qué? Porque config.js lleva la dirección del
 *   Apps Script. Si se quedaba pegada una copia vieja, la app decía
 *   "Falta configurar la app" aunque en GitHub ya estuviera correcta,
 *   y no había forma de que se enterara sola.
 ***********************************************************************/

const VERSION = 'fdx-logistica-v4';

const ARCHIVOS = [
  './',
  './index.html',
  './estilos.css',
  './app.js',
  './config.js',
  './manifest.json',
  './iconos/icono-192.png',
  './iconos/icono-512.png',
  './iconos/icono-maskable-512.png',
  './iconos/apple-touch-icon.png',
  './iconos/favicon.png'
];

/* Archivos que SIEMPRE se piden frescos a internet.
   La copia guardada solo se usa si de plano no hay señal.        */
const SIEMPRE_FRESCOS = ['config.js'];

function esFresco(url) {
  for (let i = 0; i < SIEMPRE_FRESCOS.length; i++) {
    if (url.pathname.endsWith(SIEMPRE_FRESCOS[i])) return true;
  }
  return false;
}

/* ---------- Instalación: guarda la copia ---------- */
self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(VERSION)
      .then(function (c) {
        // cache:'reload' obliga a bajarlos de internet, no del caché del navegador
        return Promise.all(ARCHIVOS.map(function (a) {
          return fetch(new Request(a, { cache: 'reload' }))
            .then(function (res) { if (res && res.ok) return c.put(a, res); })
            .catch(function () { /* si uno falla, la instalación sigue */ });
        }));
      })
      .then(function () { return self.skipWaiting(); })
  );
});

/* ---------- Activación: tira las copias viejas ---------- */
self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (nombres) {
      return Promise.all(nombres.map(function (n) {
        if (n !== VERSION) return caches.delete(n);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

/* ---------- Cada petición ---------- */
self.addEventListener('fetch', function (e) {
  const req = e.request;
  if (req.method !== 'GET') return;                       // los POST van directo

  const url = new URL(req.url);

  // Todo lo que va a Google (la API, las fotos de Drive) pasa de largo
  if (url.hostname.indexOf('google.com') >= 0 ||
      url.hostname.indexOf('googleusercontent.com') >= 0) return;

  // config.js: internet primero, copia solo como último recurso
  if (url.origin === self.location.origin && esFresco(url)) {
    e.respondWith(
      fetch(new Request(req.url, { cache: 'reload' })).then(function (res) {
        if (res && res.ok) {
          const copia = res.clone();
          caches.open(VERSION).then(function (c) { c.put(req, copia); });
        }
        return res;
      }).catch(function () {
        return caches.match(req);
      })
    );
    return;
  }

  // Librerías externas: si ya la tengo guardada, la uso
  if (url.origin !== self.location.origin) {
    e.respondWith(
      caches.match(req).then(function (hit) {
        return hit || fetch(req).then(function (res) {
          if (res && res.ok) {
            const copia = res.clone();
            caches.open(VERSION).then(function (c) { c.put(req, copia); });
          }
          return res;
        }).catch(function () { return hit; });
      })
    );
    return;
  }

  // La pantalla: primero intento bajar la última, si no hay red uso la copia
  if (req.mode === 'navigate' || url.pathname.endsWith('.html')) {
    e.respondWith(
      fetch(req).then(function (res) {
        const copia = res.clone();
        caches.open(VERSION).then(function (c) { c.put(req, copia); });
        return res;
      }).catch(function () {
        return caches.match(req).then(function (h) { return h || caches.match('./index.html'); });
      })
    );
    return;
  }

  // El resto (css, js, iconos): la copia primero, que abre al instante
  e.respondWith(
    caches.match(req).then(function (hit) {
      return hit || fetch(req).then(function (res) {
        if (res && res.ok && res.type === 'basic') {
          const copia = res.clone();
          caches.open(VERSION).then(function (c) { c.put(req, copia); });
        }
        return res;
      });
    })
  );
});

/* ---------- Mensajes desde la app ---------- */
self.addEventListener('message', function (e) {
  if (e.data === 'ACTUALIZAR') self.skipWaiting();

  // Botón de emergencia: borra TODA la copia guardada.
  if (e.data === 'BORRAR_TODO') {
    caches.keys().then(function (ns) {
      return Promise.all(ns.map(function (n) { return caches.delete(n); }));
    }).then(function () {
      self.clients.matchAll({ includeUncontrolled: true, type: 'window' })
        .then(function (cs) { cs.forEach(function (c) { c.postMessage('CACHE_BORRADO'); }); });
    });
  }
});

/* ---------- Reintento en segundo plano ----------
   Cuando Android recupera la señal, despierta la app para que
   suba lo que quedó pendiente, aunque esté cerrada.            */
self.addEventListener('sync', function (e) {
  if (e.tag === 'subir-cola') {
    e.waitUntil(
      self.clients.matchAll({ includeUncontrolled: true, type: 'window' })
        .then(function (cs) { cs.forEach(function (c) { c.postMessage('SUBIR_COLA'); }); })
    );
  }
});
