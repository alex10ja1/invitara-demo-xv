/**
 * ============================================================================
 * APPSCRIPT.JS — Google Apps Script para "Invitación Digital Premium"
 * ----------------------------------------------------------------------------
 * QUÉ HACE:
 * Recibe los datos del formulario de confirmación de asistencia (RSVP)
 * enviados desde formulario.js y los guarda como una fila nueva en una
 * Google Sheet, junto con la fecha/hora del envío, el user-agent del
 * navegador y (si está disponible) la IP del visitante.
 *
 * CÓMO INSTALARLO: sigue "instrucciones.txt" en esta misma carpeta.
 * No necesitas modificar nada de este archivo salvo, opcionalmente,
 * el nombre de la hoja (NOMBRE_HOJA) si tú le pusiste otro nombre.
 * ============================================================================
 */

const NOMBRE_HOJA = 'Confirmaciones';

// Encabezados de las columnas, en el orden en que se guardarán.
const ENCABEZADOS = [
  'Fecha registro',
  'Hora registro',
  'Responsable',
  'Cantidad de personas',
  'Persona 1',
  'Persona 2',
  'Persona 3',
  'Persona 4',
  'Comentarios',
  'Dirección IP',
  'Navegador (User Agent)',
];

/**
 * Punto de entrada: se ejecuta automáticamente cada vez que el sitio
 * hace un POST a la URL de este Apps Script desplegado como Web App.
 */
function doPost(peticion) {
  try {
    const hoja = obtenerOCrearHoja();
    const datos = peticion.parameter; // Los campos enviados desde formulario.js

    const fila = [
      datos.fecha || '',
      datos.hora || '',
      datos.responsable || '',
      datos.cantidad || '',
      datos.persona1 || '',
      datos.persona2 || '',
      datos.persona3 || '',
      datos.persona4 || '',
      datos.comentarios || '',
      datos.ip || '',
      datos.userAgent || '',
    ];

    hoja.appendRow(fila);

    return construirRespuestaJSON({ resultado: 'ok', mensaje: 'Confirmación registrada correctamente.' });
  } catch (error) {
    return construirRespuestaJSON({ resultado: 'error', mensaje: error.message });
  }
}

/**
 * Permite comprobar que el despliegue funciona abriendo la URL del
 * script directamente en el navegador (una petición GET normal).
 */
function doGet() {
  return construirRespuestaJSON({
    resultado: 'ok',
    mensaje: 'El Apps Script de la invitación está activo. Usa POST para registrar confirmaciones.',
  });
}

/** Busca la hoja "Confirmaciones"; si no existe, la crea con sus encabezados. */
function obtenerOCrearHoja() {
  const libro = SpreadsheetApp.getActiveSpreadsheet();
  let hoja = libro.getSheetByName(NOMBRE_HOJA);

  if (!hoja) {
    hoja = libro.insertSheet(NOMBRE_HOJA);
    hoja.appendRow(ENCABEZADOS);
    hoja.getRange(1, 1, 1, ENCABEZADOS.length).setFontWeight('bold');
    hoja.setFrozenRows(1);
  }

  return hoja;
}

function construirRespuestaJSON(objeto) {
  return ContentService
    .createTextOutput(JSON.stringify(objeto))
    .setMimeType(ContentService.MimeType.JSON);
}
