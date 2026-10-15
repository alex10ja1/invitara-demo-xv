/* ==========================================================================
   SW.JS — Service Worker (PWA opcional)
   Guarda en caché los archivos estáticos principales para que la
   invitación cargue más rápido y funcione parcialmente sin conexión.
   No es necesario para que el sitio funcione: es un extra de rendimiento.

   Si cambias archivos CSS/JS y no ves tus cambios reflejados, sube el
   número de NOMBRE_CACHE (ej. 'invitacion-v2') para forzar la
   actualización de la caché de tus visitantes.
   ========================================================================== */

const NOMBRE_CACHE = 'invitacion-v1';

const ARCHIVOS_ESENCIALES = [
  './',
  './index.html',
  './gracias.html',
  './assets/css/variables.css',
  './assets/css/style.css',
  './assets/css/responsive.css',
  './assets/css/animaciones.css',
  './assets/js/app.js',
  './assets/js/contador.js',
  './assets/js/formulario.js',
  './assets/js/scroll.js',
  './assets/js/musica.js',
  './assets/js/maps.js',
  './assets/js/animaciones.js',
  './data/configuracion.json',
  './manifest.json',
];

self.addEventListener('install', (evento) => {
  evento.waitUntil(
    caches.open(NOMBRE_CACHE).then((cache) => cache.addAll(ARCHIVOS_ESENCIALES))
  );
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches.keys().then((claves) =>
      Promise.all(claves.filter((clave) => clave !== NOMBRE_CACHE).map((clave) => caches.delete(clave)))
    )
  );
});

// Estrategia: primero intenta la red (para tener datos frescos); si falla
// (sin conexión), responde con la copia guardada en caché.
self.addEventListener('fetch', (evento) => {
  if (evento.request.method !== 'GET') return;

  evento.respondWith(
    fetch(evento.request)
      .then((respuesta) => {
        const copia = respuesta.clone();
        caches.open(NOMBRE_CACHE).then((cache) => cache.put(evento.request, copia));
        return respuesta;
      })
      .catch(() => caches.match(evento.request))
  );
});
