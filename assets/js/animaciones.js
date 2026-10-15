/* ==========================================================================
   ANIMACIONES.JS — Confeti dorado
   Dos modos:
   - iniciarConfetiAmbiental(): muy pocas partículas cayendo de forma
     continua y sutil durante toda la visita (efecto "fiesta elegante",
     no "cañón de confeti").
   - lanzarConfetiExplosion(): ráfaga breve de partículas, usada cuando
     el invitado confirma su asistencia.
   ========================================================================== */

window.InvitacionAnimaciones = (function () {
  const COLORES = ['#C6A15B', '#E8D5A6', '#9C7A3C', '#F3E5D0'];

  function obtenerContenedor() {
    let contenedor = document.getElementById('contenedor-confeti');
    if (!contenedor) {
      contenedor = document.createElement('div');
      contenedor.id = 'contenedor-confeti';
      contenedor.className = 'contenedor-confeti';
      document.body.appendChild(contenedor);
    }
    return contenedor;
  }

  function crearParticula({ burst = false } = {}) {
    const particula = document.createElement('span');
    const esRedonda = Math.random() > 0.5;
    particula.className = `confeti-particula ${esRedonda ? 'confeti-particula--redonda' : ''} ${burst ? 'confeti-particula--burst' : ''}`;

    particula.style.setProperty('--x', `${Math.random() * 100}%`);
    particula.style.setProperty('--tamano', `${6 + Math.random() * 6}px`);
    particula.style.setProperty('--color', COLORES[Math.floor(Math.random() * COLORES.length)]);
    particula.style.setProperty('--rotacion', `${360 + Math.random() * 360}deg`);

    if (burst) {
      particula.style.setProperty('--dx', `${(Math.random() - 0.5) * 300}px`);
      particula.style.setProperty('--duracion', `${1 + Math.random() * 0.8}s`);
      particula.style.top = '30%';
    } else {
      particula.style.setProperty('--duracion', `${5 + Math.random() * 5}s`);
      particula.style.setProperty('--retraso', `${Math.random() * 6}s`);
    }

    return particula;
  }

  /** Confeti sutil y continuo: una partícula nueva cada par de segundos */
  function iniciarConfetiAmbiental() {
    const contenedor = obtenerContenedor();
    const CANTIDAD_INICIAL = 8;

    for (let i = 0; i < CANTIDAD_INICIAL; i++) {
      const particula = crearParticula();
      contenedor.appendChild(particula);
    }

    setInterval(() => {
      const particula = crearParticula();
      contenedor.appendChild(particula);
      setTimeout(() => particula.remove(), 11000);
    }, 2200);
  }

  /** Ráfaga de confeti al confirmar asistencia */
  function lanzarConfetiExplosion() {
    const contenedor = obtenerContenedor();
    const CANTIDAD_BURST = 40;

    for (let i = 0; i < CANTIDAD_BURST; i++) {
      const particula = crearParticula({ burst: true });
      contenedor.appendChild(particula);
      setTimeout(() => particula.remove(), 2200);
    }
  }

  return { iniciarConfetiAmbiental, lanzarConfetiExplosion };
})();
