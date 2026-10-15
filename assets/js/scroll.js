/* ==========================================================================
   SCROLL.JS — Aparición progresiva de secciones + parallax
   - Usa IntersectionObserver para agregar la clase "visible" a todo
     elemento con la clase "revelar" cuando entra en pantalla.
   - Aplica un parallax suave a la imagen principal mientras se scrollea.
   ========================================================================== */

window.InvitacionScroll = (function () {
  let observador = null;

  function iniciar() {
    observador = new IntersectionObserver(
      (entradas) => {
        entradas.forEach((entrada) => {
          if (entrada.isIntersecting) {
            entrada.target.classList.add('visible');
            observador.unobserve(entrada.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: '0px 0px -40px 0px' }
    );

    document.querySelectorAll('.revelar').forEach((el) => observador.observe(el));

    inicializarParallax();
  }

  /** Permite observar elementos creados dinámicamente después del arranque (ej. galería) */
  function observarNuevosElementos(listaElementos) {
    if (!observador) return;
    listaElementos.forEach((el) => observador.observe(el));
  }

  /** Mueve ligeramente los elementos .parallax según la posición del scroll */
  function inicializarParallax() {
    const elementosParallax = document.querySelectorAll('.parallax');
    if (!elementosParallax.length) return;

    let ultimaPosicion = window.scrollY;
    let solicitudEnCurso = false;

    function actualizarParallax() {
      elementosParallax.forEach((el) => {
        const velocidad = parseFloat(el.dataset.velocidad || '0.15');
        const desplazamiento = ultimaPosicion * velocidad * -1;
        el.style.setProperty('--parallax-y', `${desplazamiento}px`);
      });
      solicitudEnCurso = false;
    }

    window.addEventListener('scroll', () => {
      ultimaPosicion = window.scrollY;
      if (!solicitudEnCurso) {
        requestAnimationFrame(actualizarParallax);
        solicitudEnCurso = true;
      }
    });
  }

  return { iniciar, observarNuevosElementos };
})();
