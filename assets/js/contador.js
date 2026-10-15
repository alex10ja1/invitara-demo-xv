/* ==========================================================================
   CONTADOR.JS — Cuenta regresiva hacia la fecha del evento
   Expone window.InvitacionContador.iniciar(fechaISO) para que app.js
   lo llame una vez que conoce la fecha desde configuracion.json.
   ========================================================================== */

window.InvitacionContador = (function () {
  let intervaloId = null;

  function iniciar(fechaISO) {
    const elementoDias = document.getElementById('contador-dias');
    const elementoHoras = document.getElementById('contador-horas');
    const elementoMinutos = document.getElementById('contador-minutos');
    const elementoSegundos = document.getElementById('contador-segundos');
    const contenedorContador = document.getElementById('contador-bloques');
    const mensajeFinalizado = document.getElementById('contador-finalizado');

    if (!elementoDias || !elementoHoras || !elementoMinutos || !elementoSegundos) return;

    const fechaObjetivo = new Date(fechaISO).getTime();

    function actualizar() {
      const ahora = Date.now();
      const diferencia = fechaObjetivo - ahora;

      if (diferencia <= 0) {
        clearInterval(intervaloId);
        if (contenedorContador) contenedorContador.style.display = 'none';
        if (mensajeFinalizado) mensajeFinalizado.style.display = 'block';
        return;
      }

      const dias = Math.floor(diferencia / (1000 * 60 * 60 * 24));
      const horas = Math.floor((diferencia / (1000 * 60 * 60)) % 24);
      const minutos = Math.floor((diferencia / (1000 * 60)) % 60);
      const segundos = Math.floor((diferencia / 1000) % 60);

      elementoDias.textContent = String(dias).padStart(2, '0');
      elementoHoras.textContent = String(horas).padStart(2, '0');
      elementoMinutos.textContent = String(minutos).padStart(2, '0');
      elementoSegundos.textContent = String(segundos).padStart(2, '0');
    }

    actualizar();
    intervaloId = setInterval(actualizar, 1000);
  }

  return { iniciar };
})();
