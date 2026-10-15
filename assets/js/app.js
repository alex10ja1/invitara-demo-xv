/* ==========================================================================
   APP.JS — Orquestador principal de la invitación
   --------------------------------------------------------------------------
   Qué hace este archivo, en orden:
   1. Carga data/configuracion.json (nombre, fecha, lugar, etc.)
   2. Rellena automáticamente todos los elementos [data-config="..."]
   3. Prepara galería, mapa, botón de WhatsApp, botón de calendario y QR
   4. Llama a los inicializadores de los demás módulos (contador, música,
      scroll, animaciones, formulario)
   5. Oculta la pantalla de carga cuando todo está listo

   IMPORTANTE: si abres index.html haciendo doble clic (file://) el
   navegador puede bloquear la lectura de configuracion.json por
   seguridad (CORS). Para probarlo en tu computadora usa un servidor
   local (ver README.md, sección "Probar en tu computadora"). En
   GitHub Pages funciona sin ningún problema porque ahí sí es http(s).
   ========================================================================== */

window.Invitacion = window.Invitacion || {};

document.addEventListener('DOMContentLoaded', () => {
  registrarServiceWorkerPWA();

  const RUTA_CONFIG = 'data/configuracion.json';

  fetch(RUTA_CONFIG)
    .then((respuesta) => {
      if (!respuesta.ok) throw new Error('No se pudo leer configuracion.json');
      return respuesta.json();
    })
    .then((config) => {
      window.Invitacion.config = config;
      inicializarTodo(config);
    })
    .catch((error) => {
      console.error('[Invitación] Error al cargar la configuración:', error);
      // Si falla la carga (por ejemplo probando con doble clic), igual
      // quitamos la pantalla de carga para no dejar al usuario atascado.
      ocultarPantallaCarga();
    });
});

/**
 * Punto de entrada: una vez que tenemos la configuración, prepara
 * todo el sitio y arranca cada módulo.
 */
function inicializarTodo(config) {
  poblarTextosDesdeConfig(config);
  construirGaleria(config);
  prepararCompartirWhatsApp(config);
  prepararAgregarCalendario(config);
  prepararCodigoQR(config);
  prepararModoOscuro();

  // Módulos independientes (cada uno vive en su propio archivo .js)
  if (window.InvitacionContador) window.InvitacionContador.iniciar(config.fechaHora.fechaISO);
  if (window.InvitacionMusica) window.InvitacionMusica.iniciar(config.musica.archivo);
  if (window.InvitacionMaps) window.InvitacionMaps.iniciar(config.lugar);
  if (window.InvitacionScroll) window.InvitacionScroll.iniciar();
  if (window.InvitacionAnimaciones) window.InvitacionAnimaciones.iniciarConfetiAmbiental();
  if (window.InvitacionFormulario) window.InvitacionFormulario.iniciar(config);

  // Pequeño respiro estético antes de mostrar el sitio (que no se sienta abrupto)
  setTimeout(ocultarPantallaCarga, 900);
}

/**
 * Recorre todos los elementos con [data-config="clave.anidada"] y
 * les asigna el valor correspondiente de configuracion.json.
 * Si el elemento tiene además [data-config-attr="href"], en vez de
 * texto se rellena ese atributo (útil para enlaces).
 */
function poblarTextosDesdeConfig(config) {
  document.querySelectorAll('[data-config]').forEach((el) => {
    const ruta = el.getAttribute('data-config');
    const valor = obtenerValorPorRuta(config, ruta);
    if (valor === undefined || valor === null) return;

    const atributoDestino = el.getAttribute('data-config-attr');
    if (atributoDestino) {
      el.setAttribute(atributoDestino, valor);
    } else {
      el.textContent = valor;
    }
  });

  // Título de la pestaña y meta etiquetas dinámicas
  document.title = `${config.evento.nombreFestejada} · ${config.evento.edad} años`;
}

/** Lee un valor anidado de un objeto usando una ruta tipo "lugar.direccion" */
function obtenerValorPorRuta(objeto, ruta) {
  return ruta.split('.').reduce((acc, llave) => (acc ? acc[llave] : undefined), objeto);
}

/** Construye dinámicamente la cuadrícula de la galería a partir del arreglo config.galeria */
function construirGaleria(config) {
  const contenedor = document.getElementById('galeria-grid');
  if (!contenedor || !Array.isArray(config.galeria)) return;

  contenedor.innerHTML = '';
  config.galeria.forEach((foto, indice) => {
    const item = document.createElement('button');
    item.className = 'galeria__item revelar';
    item.setAttribute('type', 'button');
    item.setAttribute('aria-label', `Ampliar foto ${indice + 1}`);
    item.innerHTML = `<img src="${foto.src}" alt="${foto.alt || ''}" loading="lazy">`;
    item.addEventListener('click', () => abrirLightbox(foto.src, foto.alt));
    contenedor.appendChild(item);
  });

  if (window.InvitacionScroll) window.InvitacionScroll.observarNuevosElementos(contenedor.querySelectorAll('.revelar'));
}

/** Abre el visor de foto ampliada (lightbox) */
function abrirLightbox(src, alt) {
  const lightbox = document.getElementById('lightbox');
  const img = document.getElementById('lightbox-img');
  if (!lightbox || !img) return;
  img.src = src;
  img.alt = alt || '';
  lightbox.classList.add('activo');
}

function cerrarLightbox() {
  document.getElementById('lightbox')?.classList.remove('activo');
}

// Delegación de eventos para cerrar el lightbox (clic en la X o fuera de la imagen)
document.addEventListener('click', (evento) => {
  if (evento.target.id === 'lightbox' || evento.target.id === 'lightbox-cerrar') {
    cerrarLightbox();
  }
});
document.addEventListener('keydown', (evento) => {
  if (evento.key === 'Escape') cerrarLightbox();
});

/** Prepara el botón "Compartir por WhatsApp" con un texto y enlace ya armados */
function prepararCompartirWhatsApp(config) {
  const boton = document.getElementById('boton-whatsapp');
  if (!boton) return;
  const texto = encodeURIComponent(`${config.compartir.textoWhatsapp} ${config.compartir.urlSitio}`);
  boton.href = `https://wa.me/?text=${texto}`;
  boton.target = '_blank';
  boton.rel = 'noopener noreferrer';
}

/**
 * Prepara el botón "Agregar al calendario". Ofrece dos formas:
 * - Enlace directo a Google Calendar (abre en una pestaña nueva)
 * - Descarga de un archivo .ics universal (funciona en cualquier calendario)
 */
function prepararAgregarCalendario(config) {
  const botonGoogle = document.getElementById('boton-calendario-google');
  const botonIcs = document.getElementById('boton-calendario-ics');
  const { fechaISO } = config.fechaHora;
  const inicio = new Date(fechaISO);
  const fin = new Date(inicio.getTime() + 4 * 60 * 60 * 1000); // evento de 4 horas por defecto

  const formatoGoogle = (fecha) => fecha.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const detalle = `Celebración de los ${config.evento.edad} años de ${config.evento.nombreFestejada}`;

  if (botonGoogle) {
    const parametros = new URLSearchParams({
      action: 'TEMPLATE',
      text: detalle,
      dates: `${formatoGoogle(inicio)}/${formatoGoogle(fin)}`,
      location: config.lugar.direccion,
      details: config.evento.fraseElegante,
    });
    botonGoogle.href = `https://calendar.google.com/calendar/render?${parametros.toString()}`;
    botonGoogle.target = '_blank';
    botonGoogle.rel = 'noopener noreferrer';
  }

  if (botonIcs) {
    botonIcs.addEventListener('click', (evento) => {
      evento.preventDefault();
      const icsContenido = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'BEGIN:VEVENT',
        `SUMMARY:${detalle}`,
        `DTSTART:${formatoGoogle(inicio)}`,
        `DTEND:${formatoGoogle(fin)}`,
        `LOCATION:${config.lugar.direccion}`,
        `DESCRIPTION:${config.evento.fraseElegante}`,
        'END:VEVENT',
        'END:VCALENDAR',
      ].join('\r\n');
      const archivo = new Blob([icsContenido], { type: 'text/calendar' });
      const enlace = document.createElement('a');
      enlace.href = URL.createObjectURL(archivo);
      enlace.download = 'invitacion-evento.ics';
      enlace.click();
      URL.revokeObjectURL(enlace.href);
    });
  }
}

/**
 * Genera el código QR usando la API pública y gratuita de qrserver.com
 * (no requiere clave / registro). Si prefieres no depender de un
 * servicio externo, puedes sustituir esta imagen por un QR generado
 * y exportado manualmente desde cualquier generador de QR.
 */
function prepararCodigoQR(config) {
  const imagenQR = document.getElementById('qr-imagen');
  if (!imagenQR) return;
  const datos = encodeURIComponent(config.compartir.urlSitio);
  imagenQR.src = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&color=8A5248&bgcolor=FFFBFA&data=${datos}`;
  imagenQR.alt = 'Código QR con el enlace a esta invitación';
}

/** Modo oscuro opcional: alterna atributo data-tema y lo recuerda en localStorage */
function prepararModoOscuro() {
  const boton = document.getElementById('boton-tema');
  if (!boton) return;

  const temaGuardado = localStorage.getItem('invitacion-tema');
  if (temaGuardado === 'oscuro') document.documentElement.setAttribute('data-tema', 'oscuro');

  boton.addEventListener('click', () => {
    const esOscuro = document.documentElement.getAttribute('data-tema') === 'oscuro';
    if (esOscuro) {
      document.documentElement.removeAttribute('data-tema');
      localStorage.setItem('invitacion-tema', 'claro');
    } else {
      document.documentElement.setAttribute('data-tema', 'oscuro');
      localStorage.setItem('invitacion-tema', 'oscuro');
    }
  });
}

function ocultarPantallaCarga() {
  document.getElementById('pantalla-carga')?.classList.add('oculta');
}

// registrarServiceWorkerPWA();

function registrarServiceWorkerPWA() {
  if (!('serviceWorker' in navigator)) return;

  navigator.serviceWorker.register('sw.js').catch((error) => {
    console.warn('[Invitación] No se pudo registrar el Service Worker (PWA):', error);
  });
}