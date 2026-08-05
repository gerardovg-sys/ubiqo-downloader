/**
 * ============================================================
 *  SMARTCORP – Sistema de Auditorías de Bitácora
 *  Archivo: Audit_ReporteEnviado.js
 *
 *  Propósito:
 *    • Módulo 1: Auditar columna "REPORTE ENV." para una fecha (Calendario)
 *    • Módulo 2: Auditar por periodos (Rango de fechas con Calendario)
 *    • Módulo 3: Carga de reportes GPS desde el diálogo modal
 *
 *  Versión : 1.1.0
 *  Fecha   : 19/06/2026
 * ============================================================
 */

// ─────────────────────────────────────────────────────────────
//  IDs DE LAS HOJAS Y DRIVE (modificar aquí si cambian)
// ─────────────────────────────────────────────────────────────
var AUDIT_BITACORA_SHEET_ID  = '18GFvQZdpmALvmmTFc70dXENJxImMR3bkHU04IG_UyyY';
var AUDIT_BITACORA_TAB_NAME  = 'Bitácora';
var AUDIT_REPORTES_SHEET_ID  = '14vPIvvrc2Cag61_BCdXJd4Cd-yksfV1RqmzMhKesqao';
var AUDIT_REPORTES_TAB_NAME  = 'REPORTES_GENERAL';

// Módulo GPS - Carpetas de Google Drive
var AUDIT_GPS_MAIN_FOLDER_ID       = '1eoOdJG44aRsmrOQtbSQjMrE8ZWMxxO56';
var AUDIT_GPS_PENDIENTES_FOLDER_ID = '1TALOZQf1D07iICjXmi9pupEgGg5fl5xm';
var AUDIT_GPS_PROCESADOS_FOLDER_ID = '1RiGoDqORutSwb5svJmBZaR0KGCACdWRr';

// ─────────────────────────────────────────────────────────────
//  ÍNDICES DE COLUMNAS — BITÁCORA (base 0)
// ─────────────────────────────────────────────────────────────
var AUDIT_COL_BIT_FECHA        = 2;   // "FECHA"
var AUDIT_COL_BIT_PROYECTO     = 3;   // "PROYECTO"
var AUDIT_COL_BIT_NOMBRE       = 4;   // "NOMBRE"
var AUDIT_COL_BIT_REPORTE_ENV  = 10;  // "REPORTE ENV."
var AUDIT_COL_BIT_ASUNTO       = 11;  // "ASUNTO"

// ─────────────────────────────────────────────────────────────
//  ÍNDICES DE COLUMNAS — REPORTES_GENERAL (base 0)
// ─────────────────────────────────────────────────────────────
var AUDIT_COL_REP_FECHA_REPORTE    = 1;   // "Fecha_Reporte"
var AUDIT_COL_REP_NOMBRE_PROYECTO  = 3;   // "NombreProyecto"
var AUDIT_COL_REP_FECHA_REFERENCIA = 4;   // "Fecha_Referencia"
var AUDIT_COL_REP_EQUIPO_MANUAL    = 36;  // "Equipo_Trabajo_Manual"

// Valor de ASUNTO que activa la auditoría de reporte
var AUDIT_ASUNTO_INSTALACION = 'proyecto instalación';

// Versión del módulo de auditorías
var AUDIT_VERSION = '1.1.0 (19/06/2026)';


// ═════════════════════════════════════════════════════════════
//  FUNCIONES DE INTERFAZ: ABRE DIÁLOGOS MODALES
// ═════════════════════════════════════════════════════════════

/** Abre diálogo para auditar una sola fecha con selector de calendario. */
function abrirDialogoFechaIndividual() {
  var template = HtmlService.createTemplateFromFile('DatePicker');
  template.mode = 'single';
  var html = template.evaluate()
      .setWidth(360)
      .setHeight(250)
      .setSandboxMode(HtmlService.SandboxMode.IFRAME);
  SpreadsheetApp.getUi().showModalDialog(html, ' ');
}

/** Abre diálogo para auditar un rango de fechas con selector de calendario. */
function abrirDialogoPeriodo() {
  var template = HtmlService.createTemplateFromFile('DatePicker');
  template.mode = 'period';
  var html = template.evaluate()
      .setWidth(380)
      .setHeight(300)
      .setSandboxMode(HtmlService.SandboxMode.IFRAME);
  SpreadsheetApp.getUi().showModalDialog(html, ' ');
}

/** Abre diálogo para cargar múltiples archivos de GPS. */
function abrirDialogoSubirGps() {
  var html = HtmlService.createHtmlOutputFromFile('GpsUploader')
      .setWidth(400)
      .setHeight(350)
      .setSandboxMode(HtmlService.SandboxMode.IFRAME);
  SpreadsheetApp.getUi().showModalDialog(html, ' ');
}


// ═════════════════════════════════════════════════════════════
//  FUNCIÓN CONTROLADORA: ejecutarAuditoriaDesdeDialogo
// ═════════════════════════════════════════════════════════════

/**
 * Recibe los datos del diálogo de calendario y ejecuta la auditoría.
 * @param {Object} datos - Parámetros con el modo y las fechas.
 * @return {Object} Resultado de la ejecución con resumen de conteos.
 */
function ejecutarAuditoriaDesdeDialogo(datos) {
  try {
    if (!datos || !datos.mode) {
      throw new Error('Datos de entrada no válidos.');
    }

    if (datos.mode === 'single') {
      // Formato YYYY-MM-DD -> DD/MM/YYYY
      var partes = datos.date.split('-');
      var fechaFormatted = partes[2] + '/' + partes[1] + '/' + partes[0];
      return auditProcesarPeriodo(fechaFormatted, fechaFormatted);
      
    } else if (datos.mode === 'period') {
      // Formato YYYY-MM-DD -> DD/MM/YYYY
      var partesInicio = datos.startDate.split('-');
      var fechaInicioFormatted = partesInicio[2] + '/' + partesInicio[1] + '/' + partesInicio[0];
      
      var partesFin = datos.endDate.split('-');
      var fechaFinFormatted = partesFin[2] + '/' + partesFin[1] + '/' + partesFin[0];

      return auditProcesarPeriodo(fechaInicioFormatted, fechaFinFormatted);
    }
    
    throw new Error('Modo de auditoría no reconocido: ' + datos.mode);
  } catch (e) {
    Logger.log('Error en ejecutarAuditoriaDesdeDialogo: ' + e.message);
    return { status: 'error', message: e.message };
  }
}


// ═════════════════════════════════════════════════════════════
//  LÓGICA DEL MOTOR DE AUDITORÍA: auditProcesarPeriodo
// ═════════════════════════════════════════════════════════════

/**
 * Audita la Bitácora por un rango de fechas. Procesa en memoria (lote) para optimizar.
 * @param {string} fechaInicioStr - Fecha de inicio en formato DD/MM/YYYY.
 * @param {string} fechaFinStr - Fecha de fin en formato DD/MM/YYYY.
 * @return {Object} Objeto con estado y el conteo de registros actualizados.
 */
function auditProcesarPeriodo(fechaInicioStr, fechaFinStr) {
  Logger.log('=== INICIO: auditProcesarPeriodo === Desde: ' + fechaInicioStr + ' Hasta: ' + fechaFinStr);
  
  var ssBitacora = SpreadsheetApp.openById(AUDIT_BITACORA_SHEET_ID);
  var shBitacora = ssBitacora.getSheetByName(AUDIT_BITACORA_TAB_NAME);
  if (!shBitacora) {
    throw new Error('No se encontró la pestaña "' + AUDIT_BITACORA_TAB_NAME + '" en la Bitácora.');
  }

  var ssReportes = SpreadsheetApp.openById(AUDIT_REPORTES_SHEET_ID);
  var shReportes = ssReportes.getSheetByName(AUDIT_REPORTES_TAB_NAME);
  if (!shReportes) {
    throw new Error('No se encontró la pestaña "' + AUDIT_REPORTES_TAB_NAME + '" en REPORTES_GENERAL.');
  }

  var datosBitacora = shBitacora.getDataRange().getValues();
  var datosReportes = shReportes.getDataRange().getValues();

  Logger.log('Filas cargadas — Bitácora: ' + datosBitacora.length + ' | Reportes: ' + datosReportes.length);

  // 1. Obtener lista de fechas en el rango
  var dInicio = auditParseFechaDDMMYYYY(fechaInicioStr);
  var dFin = auditParseFechaDDMMYYYY(fechaFinStr);
  
  if (dInicio > dFin) {
    throw new Error('La fecha de inicio no puede ser posterior a la fecha de fin.');
  }

  var setFechas = {};
  var tempDate = new Date(dInicio.getTime());
  
  while (tempDate <= dFin) {
    var fStr = auditFormatFechaDDMMYYYY(tempDate);
    setFechas[fStr] = true;
    tempDate.setDate(tempDate.getDate() + 1);
  }

  // 2. Construir mapa de búsqueda desde REPORTES_GENERAL
  var mapaReportes = {};
  var filasCoincidentes = 0;

  for (var r = 1; r < datosReportes.length; r++) {
    var filaRep       = datosReportes[r];
    var fechaRefStr   = auditFormatDate(filaRep[AUDIT_COL_REP_FECHA_REFERENCIA]);

    if (!setFechas[fechaRefStr]) continue;
    filasCoincidentes++;

    var nombreProyecto  = String(filaRep[AUDIT_COL_REP_NOMBRE_PROYECTO] || '');
    var fechaRepStr     = auditFormatDate(filaRep[AUDIT_COL_REP_FECHA_REPORTE]);
    var equipoRaw       = String(filaRep[AUDIT_COL_REP_EQUIPO_MANUAL] || '');
    var proyectoNorm    = auditNormalizar(nombreProyecto);

    var personas = equipoRaw.split(',');
    for (var p = 0; p < personas.length; p++) {
      var personaNorm = auditNormalizar(personas[p]);
      if (!personaNorm) continue;

      var clave = proyectoNorm + '|' + personaNorm + '|' + fechaRefStr;
      if (!mapaReportes[clave]) mapaReportes[clave] = [];
      mapaReportes[clave].push({ fechaReporte: fechaRepStr, fechaReferencia: fechaRefStr });
    }
  }

  Logger.log('Reportes coincidentes en rango: ' + filasCoincidentes);
  Logger.log('Entradas en mapa: ' + Object.keys(mapaReportes).length);

  // 3. Procesar filas de Bitácora
  var contTotal = 0, contSI = 0, contFT = 0, contNO = 0, contNA = 0;
  var huboCambios = false;

  for (var b = 1; b < datosBitacora.length; b++) {
    var filaBit     = datosBitacora[b];
    var fFechaRaw   = filaBit[AUDIT_COL_BIT_FECHA];
    if (!fFechaRaw) continue; // Saltar filas vacías de forma rápida

    var fechaBitStr = auditFormatDate(fFechaRaw);
    if (!setFechas[fechaBitStr]) continue;
    contTotal++;

    var asunto   = String(filaBit[AUDIT_COL_BIT_ASUNTO]  || '').trim();
    var proyecto = String(filaBit[AUDIT_COL_BIT_PROYECTO] || '');
    var nombre   = String(filaBit[AUDIT_COL_BIT_NOMBRE]   || '');

    var resultado;

    // Lista negra: "INT QRO MTTO PERSONAL 2605" no reporta, siempre es NA
    if (asunto.toLowerCase() !== AUDIT_ASUNTO_INSTALACION || auditNormalizar(proyecto) === 'int qro mtto personal 2605') {
      resultado = 'NA';
      contNA++;
    } else {
      var clavesSinFecha = auditGenerarClaves(proyecto, nombre);
      var matches = null;

      for (var k = 0; k < clavesSinFecha.length; k++) {
        var claveConFecha = clavesSinFecha[k] + '|' + fechaBitStr;
        if (mapaReportes[claveConFecha]) {
          matches = mapaReportes[claveConFecha];
          break;
        }
      }

      if (!matches) {
        resultado = 'NO';
        contNO++;
      } else {
        var tieneSI = false;
        for (var c = 0; c < matches.length; c++) {
          if (matches[c].fechaReporte === matches[c].fechaReferencia) {
            tieneSI = true;
            break;
          }
        }
        resultado = tieneSI ? 'SI' : 'FT';
        tieneSI ? contSI++ : contFT++;
      }
    }

    // Actualizar valor en memoria
    if (datosBitacora[b][AUDIT_COL_BIT_REPORTE_ENV] !== resultado) {
      datosBitacora[b][AUDIT_COL_BIT_REPORTE_ENV] = resultado;
      huboCambios = true;
    }
  }

  // 4. Escribir todos los cambios en lote
  if (contTotal > 0 && huboCambios) {
    var valuesToWrite = [];
    for (var b = 1; b < datosBitacora.length; b++) {
      valuesToWrite.push([datosBitacora[b][AUDIT_COL_BIT_REPORTE_ENV]]);
    }
    shBitacora.getRange(2, AUDIT_COL_BIT_REPORTE_ENV + 1, valuesToWrite.length, 1).setValues(valuesToWrite);
    Logger.log('Auditoría guardada en lote.');
  } else {
    Logger.log('Sin cambios que escribir en la hoja.');
  }

  var periodText = fechaInicioStr === fechaFinStr ? fechaInicioStr : (fechaInicioStr + ' al ' + fechaFinStr);

  return {
    status: 'success',
    summary: {
      total: contTotal,
      si: contSI,
      ft: contFT,
      no: contNO,
      na: contNA,
      period: periodText
    }
  };
}


// ═════════════════════════════════════════════════════════════
//  CARGA GPS: auditGuardarArchivoGPS
// ═════════════════════════════════════════════════════════════

/**
 * Guarda un archivo Excel del GPS recibido como string base64 en la carpeta "GPS_Pendientes" de Drive.
 * @param {string} nombre - Nombre del archivo Excel.
 * @param {string} contenidoBase64 - Contenido del archivo codificado en Base64.
 * @return {Object} Estado del guardado y ID del archivo creado.
 */
function auditGuardarArchivoGPS(nombre, contenidoBase64) {
  try {
    if (!nombre || !contenidoBase64) {
      throw new Error('Nombre de archivo o contenido vacío.');
    }

    var folder = DriveApp.getFolderById(AUDIT_GPS_PENDIENTES_FOLDER_ID);
    if (!folder) {
      throw new Error('No se pudo acceder a la carpeta GPS_Pendientes en Google Drive.');
    }

    var bytes = Utilities.base64Decode(contenidoBase64);
    var blob = Utilities.newBlob(bytes, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', nombre);
    var file = folder.createFile(blob);
    
    Logger.log('Archivo guardado en Drive: ' + nombre + ' (ID: ' + file.getId() + ')');
    return { status: 'success', fileId: file.getId() };
  } catch (e) {
    Logger.log('Error en auditGuardarArchivoGPS: ' + e.message);
    return { status: 'error', message: e.message };
  }
}


// ═════════════════════════════════════════════════════════════
//  FALLBACK/COMPATIBILIDAD: auditarReporteEnviadoPorFecha
// ═════════════════════════════════════════════════════════════

/**
 * Abre el diálogo de fecha individual (mantiene compatibilidad con ejecuciones directas antiguas).
 */
function auditarReporteEnviadoPorFecha() {
  abrirDialogoFechaIndividual();
}


// ═════════════════════════════════════════════════════════════
//  DIÁLOGO: Acerca del sistema de auditorías
// ═════════════════════════════════════════════════════════════

/**
 * Muestra información sobre la versión del módulo de auditorías.
 */
function mostrarAcercaDeAuditorias() {
  var ui = SpreadsheetApp.getUi();
  ui.alert(
    'ℹ️ Auditorías SMARTCORP',
    '📌 MÓDULO DE AUDITORÍAS\n' +
    '─────────────────────────\n' +
    'Versión : ' + AUDIT_VERSION + '\n\n' +
    'Bitácora ID:\n  ' + AUDIT_BITACORA_SHEET_ID + '\n\n' +
    'Reportes ID:\n  ' + AUDIT_REPORTES_SHEET_ID + '\n\n' +
    'Carpetas GPS:\n' +
    '  • Pendientes:\n    ' + AUDIT_GPS_PENDIENTES_FOLDER_ID + '\n' +
    '  • Procesados:\n    ' + AUDIT_GPS_PROCESADOS_FOLDER_ID + '\n\n' +
    'Desarrollado para automatización e importación en SMARTCORP.',
    ui.ButtonSet.OK
  );
}


// ═════════════════════════════════════════════════════════════
//  FUNCIONES AUXILIARES
// ═════════════════════════════════════════════════════════════

/**
 * Convierte un valor de celda Sheets a string "DD/MM/YYYY".
 * Maneja Date objects y strings con formato variable.
 */
function auditFormatDate(valor) {
  if (!valor && valor !== 0) return '';

  if (valor instanceof Date) {
    if (isNaN(valor.getTime())) return '';
    return auditPad2(valor.getDate()) + '/' +
           auditPad2(valor.getMonth() + 1) + '/' +
           valor.getFullYear();
  }

  var str = String(valor).trim();

  // Extraer la parte de la fecha antes del espacio o la 'T' (por si viene con hora)
  var datePart = str.split(/[ T]/)[0];
  var partes = datePart.split(/[\/\-]/);

  if (partes.length === 3) {
    var day, month, year;
    // Si empieza con 4 dígitos, asumimos formato YYYY-MM-DD
    if (partes[0].length === 4) {
      year = parseInt(partes[0], 10);
      month = parseInt(partes[1], 10);
      day = parseInt(partes[2], 10);
    } else {
      // De lo contrario, asumimos DD/MM/YY o DD/MM/YYYY
      day = parseInt(partes[0], 10);
      month = parseInt(partes[1], 10);
      var yearStr = partes[2];
      if (yearStr.length === 2) {
        year = 2000 + parseInt(yearStr, 10);
      } else {
        year = parseInt(yearStr, 10);
      }
    }

    if (!isNaN(day) && !isNaN(month) && !isNaN(year) &&
        month >= 1 && month <= 12 &&
        day >= 1 && day <= 31) {
      return auditPad2(day) + '/' + auditPad2(month) + '/' + year;
    }
  }

  // Fallback al parser estándar de JS Date
  var fecha = new Date(str);
  if (!isNaN(fecha.getTime())) {
    return auditPad2(fecha.getDate()) + '/' +
           auditPad2(fecha.getMonth() + 1) + '/' +
           fecha.getFullYear();
  }

  return str;
}

/** Agrega cero a la izquierda si el número tiene un dígito. */
function auditPad2(n) {
  return n < 10 ? '0' + n : String(n);
}

/**
 * Normaliza texto: minúsculas, sin tildes (opcional, dejamos estándar para coincidencia),
 * sin espacios extra al inicio/final, y espacios internos colapsados.
 */
function auditNormalizar(texto) {
  if (!texto && texto !== 0) return '';
  return String(texto).toLowerCase().trim().replace(/[\u200b\u200c\u200d\ufeff]/g, '').replace(/\s+/g, ' ');
}

/**
 * Genera la clave exacta para la búsqueda de reportes.
 * Modificado v2.8.0: Coincidencia exacta sin variantes para evitar colisiones de primer nombre.
 */
function auditGenerarClaves(proyecto, nombre) {
  var pNorm  = auditNormalizar(proyecto);
  var nNorm  = auditNormalizar(nombre);
  return [pNorm + '|' + nNorm];
}

/** Parsea un string "DD/MM/YYYY" a un objeto Date de JS. */
function auditParseFechaDDMMYYYY(str) {
  var partes = str.split('/');
  var dia = parseInt(partes[0], 10);
  var mes = parseInt(partes[1], 10);
  var anio = parseInt(partes[2], 10);
  return new Date(anio, mes - 1, dia);
}

/** Formatea un objeto Date a string "DD/MM/YYYY". */
function auditFormatFechaDDMMYYYY(d) {
  return auditPad2(d.getDate()) + '/' + auditPad2(d.getMonth() + 1) + '/' + d.getFullYear();
}
