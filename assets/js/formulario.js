/* ==========================================================================
   FORMULARIO.JS — Confirmación de asistencia
   - Muestra u oculta los campos de nombre según el número de personas.
   - Valida antes de enviar.
   - En modo demo (confirmacion.modoDemo = true) NO envía nada: solo muestra
     cómo se vería la confirmación para el invitado.
   - En modo normal envía los datos a Google Apps Script
     (confirmacion.urlGoogleAppsScript) y lleva a gracias.html.
   ========================================================================== */

window.InvitacionFormulario = (function () {
  function iniciar(config) {
    const form = document.getElementById("formulario-rsvp");
    const select = document.getElementById("form-cantidad");
    const estado = document.getElementById("formulario-estado");
    if (!form || !select) return;

    const conf = (config && config.confirmacion) || {};

    select.addEventListener("change", function () {
      const cantidad = parseInt(this.value, 10);
      document.querySelectorAll(".campo-persona").forEach((campo) => {
        const numero = parseInt(campo.dataset.persona, 10);
        const visible = numero <= cantidad;
        campo.classList.toggle("visible", visible);
        const input = campo.querySelector("input");
        if (input) {
          input.required = visible;
          if (!visible) input.value = "";
        }
      });
    });

    function validar() {
      let ok = true;
      form.querySelectorAll(".campo").forEach((campo) => {
        const control = campo.querySelector("input, select, textarea");
        const malo = control && control.required && !control.value.trim();
        campo.classList.toggle("con-error", !!malo);
        if (malo) ok = false;
      });
      return ok;
    }

    function mostrar(texto, tipo) {
      if (!estado) return;
      estado.textContent = texto;
      estado.className = "formulario__estado visible formulario__estado--" + tipo;
    }

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!validar()) {
        mostrar("Revisa los campos marcados.", "error");
        return;
      }

      if (conf.modoDemo || !conf.urlGoogleAppsScript) {
        mostrar("¡Listo! Así confirman tus invitados. Esta es una muestra, así que no se envió nada.", "exito");
        if (window.InvitacionAnimaciones) window.InvitacionAnimaciones.lanzarConfetiExplosion();
        return;
      }

      const datos = new URLSearchParams(new FormData(form));
      mostrar("Enviando tu confirmación…", "exito");
      fetch(conf.urlGoogleAppsScript + "?" + datos.toString(), { method: "GET", mode: "no-cors" })
        .then(() => { window.location.href = "gracias.html"; })
        .catch(() => mostrar("No se pudo enviar. Revisa tu conexión e inténtalo de nuevo.", "error"));
    });
  }

  return { iniciar };
})();
