/**
 * ============================================================================
 * INVITARA · Confirmación de asistencia (Google Apps Script)
 * ----------------------------------------------------------------------------
 * Va pegado en la hoja de cada cliente: Extensiones → Apps Script → Code.gs.
 * Cómo instalarlo paso a paso: GUIA_GOOGLE.md.
 *
 * Funciones que se ejecutan a mano desde el editor (menú de arriba):
 *   configurarHoja        → una sola vez: crea Confirmaciones, Resumen y Config.
 *   instalarResumenDiario → activa el correo de las 9 pm (opcional).
 *   quitarResumenDiario   → lo desactiva.
 *
 * Lo que usa la invitación (no se ejecutan a mano):
 *   doGet  → dice si las confirmaciones siguen abiertas.
 *   doPost → guarda una confirmación.
 *
 * Solo se guardan las columnas de COLUMNAS. Nada de IP ni navegador.
 * ============================================================================
 */

var ZONA = 'America/Mexico_City';

var HOJAS = { confirmaciones: 'Confirmaciones', resumen: 'Resumen', config: 'Config' };

var COLUMNAS = [
  'Fecha y hora',
  'Nombre de quien confirma',
  'Teléfono',
  '¿Asistirá?',
  'Número de personas',
  'Nombres de los asistentes',
  'Mensaje para la festejada',
  'Posible duplicado'
];
var ANCHOS = [150, 210, 120, 90, 100, 300, 340, 230];

// Etiquetas de la pestaña Config (columna A). La invitación busca por estas etiquetas.
var AJUSTES = {
  evento: 'Evento',
  fechaLimite: 'Fecha límite (AAAA-MM-DD)',
  maximoPersonas: 'Máximo de personas por confirmación',
  abierto: 'Confirmaciones abiertas (SÍ/NO)',
  correo: 'Correo para el resumen diario (opcional)',
  maximoPaquete: 'Máximo de invitados del paquete'
};

var COLORES = {
  vino: '#A44A5C',
  blanco: '#FFFFFF',
  papel: '#F7EBE8',
  tinta: '#3A2328',
  duplicado: '#FFF2B3'
};

// El bloque siguiente es una copia exacta de web/validacion.js.
// No lo edites aquí: cámbialo allá y corre  node herramientas/sincronizar-validacion.js
// ===== INICIO VALIDACION COMPARTIDA (copiar igual a Code.gs) =====

var LIMITES = { nombre: 80, telefono: 20, mensaje: 500, personasTope: 20 };

var MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
  'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

/** Quita espacios de más y recorta a un largo máximo. */
function recortar(texto, maximo) {
  if (texto === undefined || texto === null) return '';
  return String(texto).replace(/\s+/g, ' ').trim().slice(0, maximo);
}

/** Igual que recortar, pero respeta los saltos de línea (para el mensaje). */
function recortarMensaje(texto, maximo) {
  if (texto === undefined || texto === null) return '';
  return String(texto)
    .replace(/\r\n?/g, '\n')
    .split('\n').map(function (linea) { return linea.replace(/[ \t]+/g, ' ').trim(); }).join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, maximo);
}

/** Deja solo los 10 dígitos de un teléfono mexicano (acepta +52, 52 o 521 al inicio). */
function normalizarTelefono(telefono) {
  var digitos = String(telefono === undefined || telefono === null ? '' : telefono).replace(/\D/g, '');
  if (digitos.length === 12 && digitos.indexOf('52') === 0) return digitos.slice(2);
  if (digitos.length === 13 && digitos.indexOf('521') === 0) return digitos.slice(3);
  return digitos;
}

function telefonoValido(telefono) {
  return /^\d{10}$/.test(normalizarTelefono(telefono));
}

/** Acepta "SÍ", "Si", "sí", true… como abierto. Todo lo demás es cerrado. */
function estaAbierto(valor) {
  if (valor === true) return true;
  var texto = String(valor === undefined || valor === null ? '' : valor).trim().toLowerCase();
  return texto === 'sí' || texto === 'si' || texto === 'true';
}

/** "2026-11-20" → { anio, mes, dia } o null si no es una fecha válida. */
function leerFecha(fechaISO) {
  var partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(fechaISO || '').trim());
  if (!partes) return null;
  var anio = +partes[1], mes = +partes[2], dia = +partes[3];
  var prueba = new Date(Date.UTC(anio, mes - 1, dia));
  if (prueba.getUTCMonth() !== mes - 1 || prueba.getUTCDate() !== dia) return null;
  return { anio: anio, mes: mes, dia: dia };
}

/**
 * La fecha límite cuenta COMPLETA (hasta las 11:59 pm hora del centro de México).
 * México ya no cambia de horario: la Ciudad de México está en UTC-6 todo el año.
 * Sin fecha límite (vacía o inválida) nunca vence.
 */
function fechaLimiteVencida(fechaISO, ahora) {
  var f = leerFecha(fechaISO);
  if (!f) return false;
  var finDelDia = Date.UTC(f.anio, f.mes - 1, f.dia + 1, 6, 0, 0);
  var momento = ahora instanceof Date ? ahora.getTime() : (ahora === undefined ? Date.now() : +ahora);
  return momento >= finDelDia;
}

/** "2026-11-20" → "20 de noviembre de 2026" */
function fechaEnTexto(fechaISO) {
  var f = leerFecha(fechaISO);
  if (!f) return String(fechaISO || '');
  return f.dia + ' de ' + MESES[f.mes - 1] + ' de ' + f.anio;
}

function normalizarAsistencia(valor) {
  var texto = String(valor === undefined || valor === null ? '' : valor).trim().toLowerCase();
  if (texto === 'sí' || texto === 'si') return 'Sí';
  if (texto === 'no') return 'No';
  return '';
}

function maximoPersonasValido(valor) {
  var n = parseInt(valor, 10);
  if (!(n >= 1)) return 1;
  return Math.min(n, LIMITES.personasTope);
}

/**
 * Revisa una confirmación completa.
 * datos:  { nombre, telefono, asistira, personas, asistentes: [], mensaje }
 * config: { abierto, fechaLimite, maximoPersonas }
 * Devuelve { ok, errores: { campo: 'mensaje' }, limpio: {...} }.
 * Los errores que no son de un campo van en errores.general.
 */
function validarConfirmacion(datos, config, ahora) {
  datos = datos || {};
  config = config || {};
  var errores = {};
  var maximo = maximoPersonasValido(config.maximoPersonas);

  if (!estaAbierto(config.abierto)) {
    errores.general = 'Las confirmaciones ya están cerradas.';
  } else if (fechaLimiteVencida(config.fechaLimite, ahora)) {
    errores.general = 'Las confirmaciones cerraron el ' + fechaEnTexto(config.fechaLimite) + '.';
  }

  var nombre = recortar(datos.nombre, LIMITES.nombre);
  if (!nombre) errores.nombre = 'Escribe tu nombre.';

  var telefono = normalizarTelefono(recortar(datos.telefono, LIMITES.telefono));
  if (!telefono) errores.telefono = 'Escribe tu teléfono de WhatsApp.';
  else if (!/^\d{10}$/.test(telefono)) errores.telefono = 'El teléfono debe tener 10 dígitos.';

  var asistira = normalizarAsistencia(datos.asistira);
  if (!asistira) errores.asistira = 'Elige si asistirás o no.';

  var personas = 0;
  var asistentes = [];
  if (asistira === 'Sí') {
    var textoPersonas = String(datos.personas === undefined || datos.personas === null ? '' : datos.personas).trim();
    personas = /^\d+$/.test(textoPersonas) ? parseInt(textoPersonas, 10) : NaN;
    if (!(personas >= 1 && personas <= maximo)) {
      errores.personas = maximo === 1
        ? 'Este pase es para 1 persona.'
        : 'Elige entre 1 y ' + maximo + ' personas.';
      personas = 0;
    } else {
      var lista = Array.isArray(datos.asistentes) ? datos.asistentes : [];
      var faltan = [];
      for (var i = 0; i < personas; i++) {
        var nombreAsistente = recortar(lista[i], LIMITES.nombre);
        if (!nombreAsistente) faltan.push(i + 1);
        asistentes.push(nombreAsistente);
      }
      if (faltan.length) {
        errores.asistentes = faltan.length === 1
          ? 'Falta el nombre de la persona ' + faltan[0] + '.'
          : 'Faltan los nombres de las personas ' + faltan.join(', ') + '.';
        for (var j = 0; j < faltan.length; j++) errores['asistente' + faltan[j]] = 'Escribe el nombre de la persona ' + faltan[j] + '.';
      }
    }
  }

  var mensaje = recortarMensaje(datos.mensaje, LIMITES.mensaje);

  var ok = true;
  for (var llave in errores) { if (Object.prototype.hasOwnProperty.call(errores, llave)) { ok = false; break; } }

  return {
    ok: ok,
    errores: errores,
    limpio: {
      nombre: nombre,
      telefono: telefono,
      asistira: asistira,
      personas: personas,
      asistentes: asistentes,
      mensaje: mensaje
    }
  };
}

/** El primer error en el orden del formulario (para respuestas de una sola línea). */
function primerError(errores) {
  var orden = ['general', 'nombre', 'telefono', 'asistira', 'personas', 'asistentes'];
  for (var i = 0; i < orden.length; i++) if (errores[orden[i]]) return errores[orden[i]];
  for (var llave in errores) if (Object.prototype.hasOwnProperty.call(errores, llave)) return errores[llave];
  return '';
}

// ===== FIN VALIDACION COMPARTIDA =====


/* ============================== PÁGINA ============================== */

/** La invitación pregunta al cargar si las confirmaciones siguen abiertas. */
function doGet() {
  try {
    var config = leerConfig();
    return respuestaJSON({
      ok: true,
      abierto: estaAbierto(config.abierto) && !fechaLimiteVencida(config.fechaLimite, new Date()),
      fechaLimite: config.fechaLimite,
      maximoPersonas: maximoPersonasValido(config.maximoPersonas),
      evento: config.evento
    });
  } catch (error) {
    console.error(error);
    return respuestaJSON({ ok: false, error: 'No se pudo leer la configuración de la hoja.' });
  }
}

/** Recibe una confirmación (JSON enviado como text/plain) y la guarda. */
function doPost(e) {
  var datos;
  try {
    datos = JSON.parse((e && e.postData && e.postData.contents) || '');
  } catch (error) {
    datos = null;
  }
  if (!datos || typeof datos !== 'object' || Array.isArray(datos)) {
    return respuestaJSON({ ok: false, error: 'No llegaron los datos. Recarga la página e intenta de nuevo.' });
  }

  // Campo trampa: las personas no lo ven; si viene lleno, es un robot. Se le responde "ok" sin guardar.
  if (datos.sitioWeb) return respuestaJSON({ ok: true });

  var candado = LockService.getScriptLock();
  if (!candado.tryLock(15000)) {
    return respuestaJSON({ ok: false, error: 'Hay muchas confirmaciones al mismo tiempo. Espera unos segundos e intenta de nuevo.' });
  }

  try {
    var ahora = new Date();
    var revision = validarConfirmacion(datos, leerConfig(), ahora);
    if (!revision.ok) {
      return respuestaJSON({ ok: false, error: primerError(revision.errores), errores: revision.errores });
    }

    var limpio = revision.limpio;
    var hoja = obtenerHoja(HOJAS.confirmaciones);
    var anterior = buscarConfirmacionAnterior(hoja, limpio.telefono);
    var duplicado = anterior
      ? 'Revisar: ya confirmó el ' + Utilities.formatDate(anterior, ZONA, "d/MM/yyyy 'a las' HH:mm")
      : '';

    var fila = hoja.getLastRow() + 1;
    var rango = hoja.getRange(fila, 1, 1, COLUMNAS.length);
    rango.setNumberFormats([['dd/mm/yyyy hh:mm', '@', '@', '@', '0', '@', '@', '@']]);
    rango.setValues([[
      ahora,
      protegerCelda(limpio.nombre),
      limpio.telefono,
      limpio.asistira,
      limpio.personas,
      protegerCelda(limpio.asistentes.join(', ')),
      protegerCelda(limpio.mensaje),
      duplicado
    ]]);
    rango.setVerticalAlignment('top');
    if (duplicado) rango.setBackground(COLORES.duplicado);
    SpreadsheetApp.flush();

    return respuestaJSON({ ok: true });
  } catch (error) {
    console.error(error);
    return respuestaJSON({ ok: false, error: 'No pudimos guardar tu confirmación. Intenta de nuevo en un momento.' });
  } finally {
    candado.releaseLock();
  }
}


/* ============================== CONFIGURAR LA HOJA ============================== */

/**
 * Ejecútala UNA vez después de pegar el código. Si la vuelves a ejecutar no
 * borra confirmaciones ni ajustes: solo completa lo que falte y rehace el Resumen.
 */
function configurarHoja() {
  var libro = SpreadsheetApp.getActiveSpreadsheet();
  libro.setSpreadsheetTimeZone(ZONA);

  prepararConfirmaciones(libro);
  prepararConfig(libro);
  var resumen = prepararResumen(libro);

  // Orden de pestañas: Resumen, Confirmaciones, Config
  [HOJAS.resumen, HOJAS.confirmaciones, HOJAS.config].forEach(function (nombre, i) {
    libro.setActiveSheet(libro.getSheetByName(nombre));
    libro.moveActiveSheet(i + 1);
  });
  libro.setActiveSheet(resumen);

  console.log('Listo. Ahora llena la pestaña Config (sobre todo Evento y Fecha límite).');
}

function prepararConfirmaciones(libro) {
  var hoja = libro.getSheetByName(HOJAS.confirmaciones);
  if (!hoja) {
    // Si la hoja es nueva, aprovecha la pestaña vacía que Google crea ("Hoja 1").
    var hojas = libro.getSheets();
    var vacia = hojas.length === 1 && hojas[0].getLastRow() === 0 && hojas[0].getLastColumn() === 0;
    hoja = vacia ? hojas[0].setName(HOJAS.confirmaciones) : libro.insertSheet(HOJAS.confirmaciones);
  }

  if (!hoja.getRange(1, 1).getValue()) {
    hoja.getRange(1, 1, 1, COLUMNAS.length).setValues([COLUMNAS]);
  }
  var encabezados = hoja.getRange(1, 1, 1, COLUMNAS.length);
  encabezados
    .setBackground(COLORES.vino)
    .setFontColor(COLORES.blanco)
    .setFontWeight('bold')
    .setWrap(true)
    .setVerticalAlignment('middle');
  hoja.setRowHeight(1, 40);
  hoja.setFrozenRows(1);
  ANCHOS.forEach(function (ancho, i) { hoja.setColumnWidth(i + 1, ancho); });

  var filas = Math.max(hoja.getMaxRows() - 1, 1);
  hoja.getRange(2, 1, filas, 1).setNumberFormat('dd/mm/yyyy hh:mm');
  hoja.getRange(2, 3, filas, 1).setNumberFormat('@');
  hoja.getRange(2, 6, filas, 2).setWrap(true);
  hoja.getRange(2, 1, filas, COLUMNAS.length).setVerticalAlignment('top').setFontColor(COLORES.tinta);

  if (!hoja.getFilter()) hoja.getRange(1, 1, hoja.getMaxRows(), COLUMNAS.length).createFilter();
  return hoja;
}

function prepararConfig(libro) {
  var hoja = libro.getSheetByName(HOJAS.config) || libro.insertSheet(HOJAS.config);
  if (!hoja.getRange(1, 1).getValue()) hoja.getRange(1, 1, 1, 2).setValues([['Ajuste', 'Valor']]);

  var predeterminados = [
    [AJUSTES.evento, '', 'Nombre del evento, por ejemplo "XV años de Valeria". Sale en el correo diario.'],
    [AJUSTES.fechaLimite, '', 'Último día para confirmar, escrito así: 2026-11-20. Ese día completo todavía se puede.'],
    [AJUSTES.maximoPersonas, 5, 'Cuántas personas puede anotar cada invitado (1 a 20).'],
    [AJUSTES.abierto, 'SÍ', 'Cambia a NO para cerrar las confirmaciones de inmediato.'],
    [AJUSTES.correo, '', 'Si escribes un correo, cada noche a las 9 pm llega un resumen (hay que activarlo con instalarResumenDiario).'],
    [AJUSTES.maximoPaquete, 200, 'Invitados que incluye el paquete. Solo se usa en el Resumen.']
  ];
  var existentes = hoja.getRange(1, 1, Math.max(hoja.getLastRow(), 1), 1).getValues()
    .map(function (f) { return String(f[0]).trim(); });

  predeterminados.forEach(function (ajuste) {
    var fila = existentes.indexOf(ajuste[0]) + 1;
    if (!fila) {
      fila = hoja.getLastRow() + 1;
      hoja.getRange(fila, 1, 1, 2).setValues([[ajuste[0], ajuste[1]]]);
      existentes.push(ajuste[0]);
    }
    hoja.getRange(fila, 1).setNote(ajuste[2]);
    if (ajuste[0] === AJUSTES.fechaLimite) hoja.getRange(fila, 2).setNumberFormat('@');
    if (ajuste[0] === AJUSTES.abierto) {
      hoja.getRange(fila, 2).setDataValidation(
        SpreadsheetApp.newDataValidation().requireValueInList(['SÍ', 'NO'], true).setAllowInvalid(false).build()
      );
    }
  });

  hoja.getRange(1, 1, 1, 2).setBackground(COLORES.vino).setFontColor(COLORES.blanco).setFontWeight('bold');
  hoja.getRange(2, 1, hoja.getLastRow() - 1, 1).setBackground(COLORES.papel).setFontColor(COLORES.tinta);
  hoja.getRange(2, 2, hoja.getLastRow() - 1, 1).setHorizontalAlignment('left');
  hoja.setFrozenRows(1);
  hoja.setColumnWidth(1, 320);
  hoja.setColumnWidth(2, 280);
  return hoja;
}

function prepararResumen(libro) {
  var hoja = libro.getSheetByName(HOJAS.resumen) || libro.insertSheet(HOJAS.resumen);
  hoja.clear();

  var c = "'" + HOJAS.confirmaciones + "'!";
  var maximoPaquete = 'IFERROR(VLOOKUP("' + AJUSTES.maximoPaquete + '",\'' + HOJAS.config + '\'!A:B,2,FALSE),200)';
  var filas = [
    ['Dato', 'Valor'],
    ['Confirmaciones recibidas', '=COUNTA(' + c + 'B2:B)'],
    ['Personas que asistirán', '=SUMIF(' + c + 'D2:D,"Sí",' + c + 'E2:E)'],
    ['Confirmaciones de "No asistiré"', '=COUNTIF(' + c + 'D2:D,"No")'],
    ['Posibles duplicados por revisar', '=COUNTIF(' + c + 'H2:H,"Revisar*")'],
    ['Lugares usados del paquete', '=B3&" de "&' + maximoPaquete],
    ['Porcentaje del paquete usado', '=IFERROR(B3/' + maximoPaquete + ',0)'],
    ['Última confirmación recibida', '=IF(COUNTA(' + c + 'A2:A)=0,"Todavía no hay",MAX(' + c + 'A2:A))']
  ];
  hoja.getRange(1, 1, filas.length, 2).setValues(filas);
  hoja.getRange(7, 2).setNumberFormat('0%');
  hoja.getRange(8, 2).setNumberFormat('dd/mm/yyyy hh:mm');

  hoja.getRange(1, 1, 1, 2).setBackground(COLORES.vino).setFontColor(COLORES.blanco).setFontWeight('bold');
  hoja.getRange(2, 1, filas.length - 1, 1).setBackground(COLORES.papel).setFontColor(COLORES.tinta);
  hoja.getRange(2, 2, filas.length - 1, 1).setFontWeight('bold').setFontSize(12).setHorizontalAlignment('left');
  hoja.getRange(10, 1, 1, 2).merge()
    .setValue('Si hay posibles duplicados (filas amarillas en Confirmaciones), la misma familia puede estar contada dos veces en "Personas que asistirán". Revísalas.')
    .setWrap(true).setFontStyle('italic').setFontColor('#6B5458');
  hoja.setRowHeight(10, 48);
  hoja.setFrozenRows(1);
  hoja.setColumnWidth(1, 280);
  hoja.setColumnWidth(2, 200);
  return hoja;
}


/* ============================== RESUMEN DIARIO ============================== */

/** Activa el correo de cada noche (entre 9 y 10 pm, hora del centro de México). */
function instalarResumenDiario() {
  quitarResumenDiario();
  ScriptApp.newTrigger('enviarResumenDiario')
    .timeBased()
    .everyDays(1)
    .atHour(21)
    .inTimezone(ZONA)
    .create();
  var correo = String(leerConfig().correo || '').trim();
  console.log(correo
    ? 'Resumen diario activado. Llegará a ' + correo + ' las noches que haya confirmaciones nuevas.'
    : 'Resumen diario activado, pero falta escribir el correo en Config. Sin correo no se envía nada.');
}

function quitarResumenDiario() {
  ScriptApp.getProjectTriggers().forEach(function (activador) {
    if (activador.getHandlerFunction() === 'enviarResumenDiario') ScriptApp.deleteTrigger(activador);
  });
  console.log('Resumen diario desactivado.');
}

/** La ejecuta el activador. Solo envía si hubo confirmaciones nuevas hoy. */
function enviarResumenDiario() {
  var config = leerConfig();
  var correo = String(config.correo || '').trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) return;

  var hoja = obtenerHoja(HOJAS.confirmaciones);
  if (hoja.getLastRow() < 2) return;
  var filas = hoja.getRange(2, 1, hoja.getLastRow() - 1, COLUMNAS.length).getValues()
    .filter(function (f) { return f[1] !== ''; });

  var hoy = Utilities.formatDate(new Date(), ZONA, 'yyyy-MM-dd');
  var nuevas = filas.filter(function (f) {
    return f[0] instanceof Date && Utilities.formatDate(f[0], ZONA, 'yyyy-MM-dd') === hoy;
  });
  if (!nuevas.length) return;

  var personas = 0, noAsistiran = 0, duplicados = 0;
  filas.forEach(function (f) {
    if (f[3] === 'Sí') personas += Number(f[4]) || 0;
    if (f[3] === 'No') noAsistiran++;
    if (String(f[7]).indexOf('Revisar') === 0) duplicados++;
  });

  var lineas = [
    'Confirmaciones nuevas de hoy: ' + nuevas.length,
    '',
    'Totales hasta ahora:',
    '· Confirmaciones recibidas: ' + filas.length,
    '· Personas que asistirán: ' + personas + ' de ' + (Number(config.maximoPaquete) || 200),
    '· No asistirán: ' + noAsistiran
  ];
  if (duplicados) lineas.push('· Posibles duplicados por revisar: ' + duplicados);
  lineas.push('', 'Las nuevas:');
  nuevas.forEach(function (f) {
    var detalle = f[3] === 'Sí' ? 'Sí, ' + f[4] + (Number(f[4]) === 1 ? ' persona' : ' personas') : 'No asistirá';
    lineas.push('· ' + Utilities.formatDate(f[0], ZONA, 'HH:mm') + ' — ' + f[1] + ': ' + detalle + (f[7] ? ' (revisar: posible duplicado)' : ''));
  });
  lineas.push('', 'Ver la hoja completa: ' + SpreadsheetApp.getActiveSpreadsheet().getUrl());

  var evento = String(config.evento || '').trim() || 'tu evento';
  MailApp.sendEmail({
    to: correo,
    subject: 'Confirmaciones de hoy · ' + evento + ' (' + nuevas.length + (nuevas.length === 1 ? ' nueva)' : ' nuevas)'),
    body: lineas.join('\n'),
    name: 'Invitara'
  });
}


/* ============================== AUXILIARES ============================== */

function obtenerHoja(nombre) {
  var hoja = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(nombre);
  if (!hoja) throw new Error('Falta la pestaña "' + nombre + '". Ejecuta configurarHoja.');
  return hoja;
}

/** Lee la pestaña Config buscando cada ajuste por su etiqueta. */
function leerConfig() {
  var valores = obtenerHoja(HOJAS.config).getDataRange().getValues();
  var porEtiqueta = {};
  valores.forEach(function (fila) { porEtiqueta[String(fila[0]).trim()] = fila[1]; });

  var config = {};
  Object.keys(AJUSTES).forEach(function (clave) {
    var valor = porEtiqueta[AJUSTES[clave]];
    config[clave] = valor === undefined || valor === null ? '' : valor;
  });
  // Si Sheets convirtió la fecha límite en fecha, se regresa al formato AAAA-MM-DD.
  if (config.fechaLimite instanceof Date) {
    config.fechaLimite = Utilities.formatDate(config.fechaLimite, ZONA, 'yyyy-MM-dd');
  } else {
    config.fechaLimite = String(config.fechaLimite).trim();
  }
  config.evento = String(config.evento).trim();
  return config;
}

/** Fecha de la confirmación más reciente con ese teléfono, o null. */
function buscarConfirmacionAnterior(hoja, telefono) {
  if (hoja.getLastRow() < 2) return null;
  var filas = hoja.getRange(2, 1, hoja.getLastRow() - 1, 3).getValues();
  for (var i = filas.length - 1; i >= 0; i--) {
    if (normalizarTelefono(filas[i][2]) === telefono && filas[i][0] instanceof Date) return filas[i][0];
  }
  return null;
}

/** Evita que un texto que empieza con = + - @ se tome como fórmula. */
function protegerCelda(texto) {
  return /^[=+\-@]/.test(texto) ? "'" + texto : texto;
}

function respuestaJSON(objeto) {
  return ContentService.createTextOutput(JSON.stringify(objeto)).setMimeType(ContentService.MimeType.JSON);
}
