/* ==========================================================================
   MAPS.JS — Mapa incrustado + botón "Cómo llegar"
   No requiere clave de API: usa el modo "output=embed" de Google Maps,
   que funciona de forma gratuita para cualquier sitio público.
   ========================================================================== */

window.InvitacionMaps = (function () {
  function iniciar(lugar) {
    const iframe = document.getElementById('mapa-iframe');
    const botonAbrir = document.getElementById('boton-abrir-maps');

    if (iframe) {
      const consulta = encodeURIComponent(lugar.direccion || `${lugar.latitud},${lugar.longitud}`);
      iframe.src = `https://maps.google.com/maps?q=${consulta}&z=15&output=embed`;
      iframe.loading = 'lazy';
      iframe.setAttribute('title', 'Ubicación del evento en Google Maps');
    }

    if (botonAbrir) {
      botonAbrir.href = lugar.urlGoogleMaps;
      botonAbrir.target = '_blank';
      botonAbrir.rel = 'noopener noreferrer';
    }
  }

  return { iniciar };
})();
