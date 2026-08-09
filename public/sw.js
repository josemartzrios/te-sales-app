// Service worker minimo: app shell precacheado + cache-first para el resto del origen.
// Los assets de Vite llevan hash en el nombre, por eso cache-first no sirve contenido viejo:
// un build nuevo pide URLs nuevas. Subir CACHE limpia lo anterior.
const CACHE = 'refreskte-v14';
const SHELL = ['/', '/index.html', '/manifest.webmanifest', '/icono-192.png', '/icono-512.png'];

self.addEventListener('install', (evento) => {
  evento.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .catch(() => undefined)
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches
      .keys()
      .then((claves) => Promise.all(claves.filter((c) => c !== CACHE).map((c) => caches.delete(c))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (evento) => {
  const peticion = evento.request;
  if (peticion.method !== 'GET') return;

  const url = new URL(peticion.url);
  if (url.origin !== self.location.origin) return;

  evento.respondWith(
    caches.match(peticion).then((enCache) => {
      if (enCache) return enCache;
      return fetch(peticion)
        .then((respuesta) => {
          if (respuesta && respuesta.ok && respuesta.type === 'basic') {
            const copia = respuesta.clone();
            caches.open(CACHE).then((cache) => cache.put(peticion, copia));
          }
          return respuesta;
        })
        .catch(() => {
          // Sin senal: cualquier navegacion cae al shell cacheado.
          if (peticion.mode === 'navigate') {
            return caches.match('/index.html').then((shell) => shell || Response.error());
          }
          return Response.error();
        });
    })
  );
});
