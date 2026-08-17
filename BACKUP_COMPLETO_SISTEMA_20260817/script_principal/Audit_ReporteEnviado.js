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

function auditObtenerMapaIndicesReportes(headers) {
  var map = {
    FECHA_REPORTE: 1,
    NOMBRE_PROYECTO: 3,
    FECHA_REFERENCIA: 4,
    EQUIPO_MANUAL: 36
  };
  if (!headers || !headers.length) return map;
  
  for (var c = 0; c < headers.length; c++) {
    var hNorm = auditReporteNormalizar(headers[c]);
    if (hNorm.indexOf('fecha_reporte') !== -1 || hNorm.indexOf('fecha reporte') !== -1) map.FECHA_REPORTE = c;
    else if (hNorm.indexOf('nombreproyecto') !== -1 || hNorm.indexOf('nombre_proyecto') !== -1 || hNorm.indexOf('nombre proyecto') !== -1) map.NOMBRE_PROYECTO = c;
    else if (hNorm.indexOf('fecha_referencia') !== -1 || hNorm.indexOf('fecha referencia') !== -1) map.FECHA_REFERENCIA = c;
    else if (hNorm.indexOf('equipo_trabajo_manual') !== -1 || hNorm.indexOf('equipo trabajo manual') !== -1 || hNorm.indexOf('equipo_manual') !== -1) map.EQUIPO_MANUAL = c;
  }
  return map;
}

// Valor de ASUNTO que activa la auditoría de reporte
var AUDIT_ASUNTO_INSTALACION = 'proyecto instalación';

// Versión del módulo de auditorías
var AUDIT_VERSION = '6.1.0 (Build 17/08/2026)';


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

  var shEspeciales = ssBitacora.getSheetByName('Proyectos_Especiales');
  if (!shEspeciales) {
    try {
      var ssConfig = auditObtenerSpreadsheetConfiguracion();
      shEspeciales = ssConfig.getSheetByName('Proyectos_Especiales');
    } catch(eEsp) {}
  }
  var especiales = {};
  if (shEspeciales) {
    var vals = shEspeciales.getDataRange().getValues();
    for (var i = 0; i < vals.length; i++) {
      var projName = vals[i][0];
      if (projName) {
        especiales[auditReporteNormalizar(projName)] = true;
      }
    }
  }

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

  var mRep = auditObtenerMapaIndicesReportes(datosReportes[0]);
  var repFechaRefCol = (mRep.FECHA_REFERENCIA !== undefined) ? mRep.FECHA_REFERENCIA : 4;
  var repNomProjCol  = (mRep.NOMBRE_PROYECTO !== undefined) ? mRep.NOMBRE_PROYECTO : 3;
  var repFechaRepCol = (mRep.FECHA_REPORTE !== undefined) ? mRep.FECHA_REPORTE : 1;
  var repEquipoCol   = (mRep.EQUIPO_MANUAL !== undefined) ? mRep.EQUIPO_MANUAL : 36;

  for (var r = 1; r < datosReportes.length; r++) {
    var filaRep       = datosReportes[r];
    var fechaRefStr   = auditReporteFormatDate(filaRep[repFechaRefCol]);

    if (!setFechas[fechaRefStr]) continue;
    filasCoincidentes++;

    var nombreProyecto  = String(filaRep[repNomProjCol] || '');
    var fechaRepStr     = auditReporteFormatDate(filaRep[repFechaRepCol]);
    var equipoRaw       = String(filaRep[repEquipoCol] || '');
    var proyectoNorm    = auditReporteNormalizar(nombreProyecto);

    var personas = equipoRaw.split(/[,;\/\n]|\by\b/i);
    for (var p = 0; p < personas.length; p++) {
      var personaNorm = auditReporteNormalizar(personas[p]);
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

  var mBit = auditObtenerMapaIndicesBitacora(datosBitacora[0]);
  var fechaCol = (mBit.FECHA !== undefined) ? mBit.FECHA : 2;
  var asuntoCol = (mBit.ASUNTO !== undefined) ? mBit.ASUNTO : 13;
  var proyectoCol = (mBit.PROYECTO !== undefined) ? mBit.PROYECTO : 3;
  var nombreCol = (mBit.NOMBRE !== undefined) ? mBit.NOMBRE : 4;
  var repEnvCol = (mBit.REPORTE_ENV !== undefined) ? mBit.REPORTE_ENV : 12;

  for (var b = 1; b < datosBitacora.length; b++) {
    var filaBit     = datosBitacora[b];
    var fFechaRaw   = filaBit[fechaCol];
    if (!fFechaRaw) continue; // Saltar filas vacías de forma rápida

    var fechaBitStr = auditReporteFormatDate(fFechaRaw);
    if (!setFechas[fechaBitStr]) continue;
    contTotal++;

    var asunto   = String(filaBit[asuntoCol]   || '').trim();
    var proyecto = String(filaBit[proyectoCol] || '');
    var nombre   = String(filaBit[nombreCol]   || '');

    var resultado;

    // Lista negra: Proyectos especiales no reportan, siempre es NA
    var projNorm         = auditReporteNormalizar(proyecto);
    var asuntoNorm       = auditReporteNormalizar(asunto);
    var targetAsuntoNorm = auditReporteNormalizar(AUDIT_ASUNTO_INSTALACION);
    var isEspecial       = !!(especiales[projNorm] || projNorm === 'smarthaus gastos' || projNorm === 'oficina' || projNorm === 'smartcorp');
    if (asuntoNorm !== targetAsuntoNorm || isEspecial) {
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
    if (datosBitacora[b][repEnvCol] !== resultado) {
      datosBitacora[b][repEnvCol] = resultado;
      huboCambios = true;
    }
  }

  // 4. Escribir todos los cambios en lote
  if (contTotal > 0 && huboCambios) {
    var valuesToWrite = [];
    for (var b = 1; b < datosBitacora.length; b++) {
      valuesToWrite.push([datosBitacora[b][repEnvCol]]);
    }
    shBitacora.getRange(2, repEnvCol + 1, valuesToWrite.length, 1).setValues(valuesToWrite);
    Logger.log('Auditoría guardada en lote en columna ' + (repEnvCol + 1));
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
    if (!contenidoBase64) {
      throw new Error('Contenido del archivo vacío.');
    }

    var folderPendientes = DriveApp.getFolderById(AUDIT_GPS_PENDIENTES_FOLDER_ID);
    if (!folderPendientes) {
      throw new Error('No se pudo acceder a la carpeta GPS_Pendientes en Google Drive.');
    }

    // Generar nombre único: Reporte Dinamico (DD-MM-YYYY HH_mm_ss).xlsx
    var timeZone      = Session.getScriptTimeZone() || 'GMT-6';
    var formattedDate = Utilities.formatDate(new Date(), timeZone, 'dd-MM-yyyy HH_mm_ss');
    var nuevoNombre   = 'Reporte Dinamico (' + formattedDate + ').xlsx';

    var bytes = Utilities.base64Decode(contenidoBase64);
    var blob  = Utilities.newBlob(
      bytes,
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      nuevoNombre
    );
    var file = folderPendientes.createFile(blob);
    Logger.log('[CARGA GPS] Archivo guardado: ' + nuevoNombre + ' (ID: ' + file.getId() + ')');

    // ── Ingerir e Iniciar Cadena Completa ──────────────
    var tramosIngested = 0;
    try {
      var ssConfig         = auditObtenerSpreadsheetConfiguracion();
      var shHistorial      = auditEnsureHistorialHeaders(ssConfig);
      tramosIngested       = auditIngerirArchivoGPS(file, shHistorial, nuevoNombre);
      Logger.log('[CARGA GPS] Ingesta: ' + tramosIngested + ' tramos en Historial_GPS.');

      // Mover a GPS_Procesados usando helper robusto
      var folderProcesados = DriveApp.getFolderById(AUDIT_GPS_PROCESADOS_FOLDER_ID);
      auditMoverArchivoAProcessados(file, folderProcesados, nuevoNombre);

      // ── PASO 2: EJECUTAR DIAGNÓSTICO EN DIAGNOSTICO_GPS ──
      Logger.log('[CARGA GPS] Ejecutando Diagnóstico GPS...');
      ejecutarDiagnosticoDetalladoGPS(true);

      // ── PASO 3: EJECUTAR PRELLENADO EN BITACORA_PRUEBA ──
      Logger.log('[CARGA GPS] Ejecutando Prellenado en Bitacora_Prueba...');
      ejecutarProcesamientoGPSCore(true, true);

    } catch (ingestErr) {
      Logger.log('[CARGA GPS] ⚠️ Error en cadena de ingesta: ' + ingestErr.message);
    }

    return {
      status:         'success',
      fileId:         file.getId(),
      fileName:       nuevoNombre,
      tramosIngested: tramosIngested
    };
  } catch (e) {
    Logger.log('[CARGA GPS] ❌ Error: ' + e.message);
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
function auditReporteFormatDate(valor) {
  if (!valor && valor !== 0) return '';

  if (valor instanceof Date) {
    if (isNaN(valor.getTime())) return '';
    return auditReportePad2(valor.getDate()) + '/' +
           auditReportePad2(valor.getMonth() + 1) + '/' +
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
      return auditReportePad2(day) + '/' + auditReportePad2(month) + '/' + year;
    }
  }

  // Fallback al parser estándar de JS Date
  var fecha = new Date(str);
  if (!isNaN(fecha.getTime())) {
    return auditReportePad2(fecha.getDate()) + '/' +
           auditReportePad2(fecha.getMonth() + 1) + '/' +
           fecha.getFullYear();
  }

  return str;
}

/** Agrega cero a la izquierda si el número tiene un dígito. */
function auditReportePad2(n) {
  return n < 10 ? '0' + n : String(n);
}

/**
 * Normaliza texto: minúsculas, sin tildes (opcional, dejamos estándar para coincidencia),
 * sin espacios extra al inicio/final, y espacios internos colapsados.
 */
function auditReporteNormalizar(texto) {
  if (!texto && texto !== 0) return '';
  return String(texto)
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\u200b\u200c\u200d\ufeff]/g, "")
    .replace(/\s+/g, ' ');
}

/**
 * Genera la clave exacta para la búsqueda de reportes.
 * Modificado v2.8.0: Coincidencia exacta sin variantes para evitar colisiones de primer nombre.
 */
function auditGenerarClaves(proyecto, nombre) {
  var pNorm  = auditReporteNormalizar(proyecto);
  var nNorm  = auditReporteNormalizar(nombre);
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
  return auditReportePad2(d.getDate()) + '/' + auditReportePad2(d.getMonth() + 1) + '/' + d.getFullYear();
}

// ─────────────────────────────────────────────────────────────
//  ACTIVADORES PROGRAMADOS DE AUDITORÍA (SEMANAL Y MENSUAL)
// ─────────────────────────────────────────────────────────────

/**
 * Re-audita automáticamente toda la semana anterior (Lunes a Domingo)
 * Se ejecuta todos los Lunes a las 8:00 AM.
 */
function auditEjecutarAuditoriaSemanalLunes8AM() {
  try {
    var now = new Date();
    // Lunes de la semana pasada (hace 7 días)
    var mondayPrev = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
    // Domingo de la semana pasada (hace 1 día)
    var sundayPrev = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    
    var startStr = auditFormatFechaDDMMYYYY(mondayPrev);
    var endStr   = auditFormatFechaDDMMYYYY(sundayPrev);
    
    Logger.log('[AUDITORÍA SEMANAL] ⏰ Re-auditando semana pasada: ' + startStr + ' al ' + endStr);
    auditProcesarPeriodo(startStr, endStr);
  } catch (e) {
    Logger.log('[AUDITORÍA SEMANAL] ❌ Error: ' + e.message);
  }
}

/**
 * Re-audita automáticamente todo el mes anterior completo (día 1 al último día)
 * Se ejecuta los días 7 de cada mes a las 8:00 AM.
 */
function auditEjecutarAuditoriaMensualDia7_8AM() {
  try {
    var now = new Date();
    // Primer día del mes anterior
    var firstDayPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    // Último día del mes anterior (día 0 del mes actual)
    var lastDayPrevMonth = new Date(now.getFullYear(), now.getMonth(), 0);
    
    var startStr = auditFormatFechaDDMMYYYY(firstDayPrevMonth);
    var endStr   = auditFormatFechaDDMMYYYY(lastDayPrevMonth);
    
    Logger.log('[AUDITORÍA MENSUAL] ⏰ Re-auditando mes pasado completo: ' + startStr + ' al ' + endStr);
    auditProcesarPeriodo(startStr, endStr);
  } catch (e) {
    Logger.log('[AUDITORÍA MENSUAL] ❌ Error: ' + e.message);
  }
}

/**
 * Crea o actualiza los activadores de auditoría periódica (Semanal y Mensual)
 */
function crearTriggersProgramadosReportes() {
  var ui = null;
  try { ui = SpreadsheetApp.getUi(); } catch (e) {}
  
  try {
    var triggers = ScriptApp.getProjectTriggers();
    for (var i = 0; i < triggers.length; i++) {
      var fnName = triggers[i].getHandlerFunction();
      if (fnName === 'auditEjecutarAuditoriaSemanalLunes8AM' || 
          fnName === 'auditEjecutarAuditoriaMensualDia7_8AM') {
        ScriptApp.deleteTrigger(triggers[i]);
      }
    }
    
    // 1. Trigger Semanal: Todos los Lunes a las 8:00 AM
    ScriptApp.newTrigger('auditEjecutarAuditoriaSemanalLunes8AM')
      .timeBased()
      .onWeekDay(ScriptApp.WeekDay.MONDAY)
      .atHour(8)
      .create();

    // 2. Trigger Mensual: Día 7 de cada mes a las 8:00 AM
    ScriptApp.newTrigger('auditEjecutarAuditoriaMensualDia7_8AM')
      .timeBased()
      .onMonthDay(7)
      .atHour(8)
      .create();

    Logger.log('[TRIGGERS AUDITORÍA] Configurados activadores Lunes 8AM (Semanal) y Día 7 (Mensual).');
    if (ui) {
      ui.alert(
        '⏰ Activadores de Auditoría Configurados',
        '• Semanal: Todos los Lunes a las 8:00 AM (Audita semana anterior completa).\n' +
        '• Mensual: Los días 7 de cada mes a las 8:00 AM (Audita mes anterior completo).',
        ui.ButtonSet.OK
      );
    }
  } catch (e) {
    Logger.log('[TRIGGERS AUDITORÍA] ❌ Error configurando activadores: ' + e.message);
    if (ui) ui.alert('❌ Error configurando activadores', e.message, ui.ButtonSet.OK);
  }
}
