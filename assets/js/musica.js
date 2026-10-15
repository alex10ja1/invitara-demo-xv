/* ==========================================================================
   MUSICA.JS — Reproductor de música de fondo con botón flotante
   Reglas del proyecto: NUNCA se reproduce sola. El usuario debe darle
   clic al botón para escucharla, y puede pausarla cuando quiera.
   ========================================================================== */

window.InvitacionMusica = (function () {
  function iniciar(rutaArchivo) {
    const audio = document.getElementById('audio-fondo');
    const boton = document.getElementById('boton-musica');
    if (!audio || !boton) return;
    if (!rutaArchivo) { boton.style.display = "none"; return; }

    audio.setAttribute('src', rutaArchivo);
    audio.loop = true;
    audio.volume = 0.65;

    boton.addEventListener('click', () => {
      if (audio.paused) {
        audio.play().catch(() => {
          // Algunos navegadores móviles bloquean el primer intento;
          // con un segundo toque del usuario ya debería funcionar.
          console.warn('[Invitación] El navegador bloqueó la reproducción automática de audio.');
        });
        boton.classList.add('reproduciendo');
        boton.setAttribute('aria-label', 'Pausar música');
      } else {
        audio.pause();
        boton.classList.remove('reproduciendo');
        boton.setAttribute('aria-label', 'Reproducir música');
      }
    });
  }

  return { iniciar };
})();
