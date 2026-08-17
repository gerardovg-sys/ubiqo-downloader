/**
 * ============================================================
 *  SMARTCORP — Módulo de Ingesta de Archivos GPS
 *  Archivo: Audit_GPS_Ingestion.js
 *
 *  Propósito:
 *    Parsear el Excel de Ubiqo (una sola vez) y escribir tramos
 *    digeridos en Historial_GPS con Estado = "Pendiente".
 *    Solo extrae datos crudos. La detección de geocercas se
 *    realiza al momento del procesamiento (usa contexto Bitácora).
 *
 *  Versión : 1.2.0
 *  Fecha   : 04/08/2026
 *  Cambios : Eliminadas columnas Geocerca_Inicio/Fin (solo lat/lon).
 *            Schema reducido a 13 columnas.
 * ============================================================
 */

// ─────────────────────────────────────────────────────────────
//  PUNTO DE ENTRADA DESDE EL MENÚ
//  📥 "Ingerir Archivos GPS (GPS_Pendientes)"
//
//  USO: Para archivos que llegaron automáticamente a GPS_Pendientes
//  vía la descarga de GitHub (2:00 AM). Apps Script no puede
//  dispararse solo por eventos de Drive, por eso este botón existe.
//
//  FLUJO AUTOMÁTICO RECOMENDADO:
//    2:00 AM — GitHub descarga Ubiqo → GPS_Pendientes
//    2:30 AM — Trigger de Apps Script ejecuta esta función
//    Mañana  — Historial_GPS ya tiene todo listo
// ─────────────────────────────────────────────────────────────

function ejecutarIngerirArchivosPendientes() {
  ejecutarCadenaIngestaDiagnosticoPrueba(false);
}

/**
 * Cadena unificada de Ingesta -> Diagnóstico -> Prellenado Prueba
 * Diseñada para correr silenciosamente en el Trigger de las 3:00 AM o manualmente desde el Menú.
 */
function ejecutarCadenaIngestaDiagnosticoPrueba(isSilent) {
  var ui = null;
  try { ui = SpreadsheetApp.getUi(); } catch (e) {}
  
  var ssActive = SpreadsheetApp.getActiveSpreadsheet();
  if (ssActive && !isSilent) ssActive.toast('📥 Iniciando cadena (Ingesta ➔ Diagnóstico ➔ Prueba)...', 'Auditorías SMARTCORP', 10);

  try {
    var ssConfig         = auditObtenerSpreadsheetConfiguracion();
    var shHistorial      = auditEnsureHistorialHeaders(ssConfig);
    var folderPendientes = DriveApp.getFolderById(AUDIT_GPS_PENDIENTES_FOLDER_ID);
    var folderProcesados = DriveApp.getFolderById(AUDIT_GPS_PROCESADOS_FOLDER_ID);

    var files       = folderPendientes.getFiles();
    var filesOk     = 0;
    var totalTramos = 0;

    while (files.hasNext()) {
      var file     = files.next();
      var fileName = file.getName();
      if (fileName.indexOf('TEMP_GPS') !== -1) continue;

      var mimeType = file.getMimeType();
      var esXlsx   = fileName.toLowerCase().indexOf('.xlsx') !== -1;
      var esSheets = (mimeType === MimeType.GOOGLE_SHEETS ||
                      mimeType === 'application/vnd.google-apps.spreadsheet');
      if (!esXlsx && !esSheets) continue;

      filesOk++;
      if (ssActive && !isSilent) ssActive.toast('📄 Ingiriendo (' + filesOk + '): ' + fileName, 'Auditorías SMARTCORP', 25);
      Logger.log('[INGESTA] Procesando: ' + fileName);

      try {
        var n = auditIngerirArchivoGPS(file, shHistorial, fileName);
        totalTramos += n;
        auditMoverArchivoAProcessados(file, folderProcesados, fileName);
        Logger.log('[INGESTA] ✅ Movido a GPS_Procesados: ' + fileName + ' (' + n + ' tramos)');
      } catch (fileErr) {
        Logger.log('[INGESTA] ❌ Error en ' + fileName + ': ' + fileErr.message);
      }
    }

    // ── PASO 2: EJECUTAR DIAGNÓSTICO EN DIAGNOSTICO_GPS ──
    Logger.log('[CADENA] Paso 2: Ejecutando Diagnóstico GPS...');
    ejecutarDiagnosticoDetalladoGPS(true);

    // ── PASO 3: EJECUTAR PRELLENADO EN BITACORA_PRUEBA ──
    Logger.log('[CADENA] Paso 3: Ejecutando Prellenado en Bitacora_Prueba...');
    ejecutarProcesamientoGPSCore(true, true);

    if (ui && !isSilent) {
      ui.alert(
        '✅ Cadena de Automatización Completada',
        ' Archivos GPS Ingeridos: ' + filesOk + '\n Tramos procesados: ' + totalTramos + '\n\n' +
        ' Se ha generado la radiografía en "Diagnostico_GPS" y prellenado la pestaña "Bitacora_Prueba".',
        ui.ButtonSet.OK
      );
    }

  } catch (err) {
    Logger.log('[CADENA] ❌ Error general: ' + err.message + '\n' + err.stack);
    if (ui && !isSilent) ui.alert('❌ Error en Cadena GPS', err.message, ui.ButtonSet.OK);
  }
}

// ─────────────────────────────────────────────────────────────
//  ACTIVADOR AUTOMÁTICO NOCTURNO (2:50 AM Verificación / 3:00 AM Cadena)
// ─────────────────────────────────────────────────────────────

/**
 * Revisa a las 2:50 AM si hay archivo en GPS_Pendientes.
 * Si NO hay archivo, solicita a GitHub Actions la descarga inmediata.
 */
function auditVerificarOForzarDescargaNocturna() {
  try {
    var folderPendientes = DriveApp.getFolderById(AUDIT_GPS_PENDIENTES_FOLDER_ID);
    if (folderPendientes) {
      var files = folderPendientes.getFiles();
      if (files.hasNext()) {
        Logger.log('[RESCATE 2:50 AM] ✅ Ya existe archivo en GPS_Pendientes. No se requiere rescate.');
        return;
      }
    }
    Logger.log('[RESCATE 2:50 AM] ⚠️ No se detectó archivo en GPS_Pendientes. Forzando descarga vía GitHub...');
    ejecutarForzarDescargaUbiqoGitHub(true);
  } catch (e) {
    Logger.log('[RESCATE 2:50 AM] ❌ Error en verificación nocturna: ' + e.message);
  }
}

/**
 * Ejecuta o solicita a GitHub Actions la descarga del reporte Ubiqo.
 */
function ejecutarForzarDescargaUbiqoGitHub(isSilent) {
  var ui = null;
  if (!isSilent) {
    try { ui = SpreadsheetApp.getUi(); } catch(e) {}
  }
  
  try {
    var githubToken = PropertiesService.getScriptProperties().getProperty('GITHUB_TOKEN');
    if (!githubToken) {
      githubToken = '';
      try { PropertiesService.getScriptProperties().setProperty('GITHUB_TOKEN', githubToken); } catch(e) {}
    }
    
    var url = 'https://api.github.com/repos/gerardovg-sys/ubiqo-downloader/actions/workflows/run_ubiqo.yml/dispatches';
    var options = {
      method: 'post',
      headers: {
        'Authorization': 'Bearer ' + githubToken,
        'Accept': 'application/vnd.github+json',
        'User-Agent': 'Google-Apps-Script'
      },
      payload: JSON.stringify({ ref: 'main' }),
      contentType: 'application/json'
    };
    
    UrlFetchApp.fetch(url, options);
    Logger.log('[GITHUB] 🚀 Solicitud dispatch enviada a GitHub Actions exitosamente.');
    if (ui) {
      ui.alert(
        '🚀 Solicitud Enviada a GitHub Actions',
        'El robot ha iniciado la descarga del reporte Ubiqo en la nube.\n\n' +
        'En aproximadamente 45 a 60 segundos el archivo llegará a tu Google Drive y Apps Script ejecutará automáticamente:\n' +
        '  1. Ingesta a Historial_GPS\n' +
        '  2. Generación de Diagnostico_GPS\n' +
        '  3. Prellenado de Bitacora_Prueba',
        ui.ButtonSet.OK
      );
    }
  } catch (err) {
    Logger.log('[GITHUB] ⚠️ Error enviando dispatch: ' + err.message);
    if (ui) ui.alert('⚠️ Aviso GitHub', 'Puedes ejecutar "Run workflow" manualmente desde GitHub Actions.', ui.ButtonSet.OK);
  }
}

/**
 * Candado Nocturno 10:00 PM:
 * Si el usuario no presionó el botón durante el día (ej. vacaciones o descuido),
 * esta función toma automáticamente los datos prellenados de Bitacora_Prueba
 * y los traspasa a la Bitácora Real de forma silenciosa.
 */
function auditVerificarYForzarProcesamientoRealNocturno10PM() {
  try {
    var ssConfig = auditObtenerSpreadsheetConfiguracion();
    var histRes  = auditLeerHistorialPendiente(ssConfig);
    
    if (!histRes.datesToProcess || histRes.datesToProcess.length === 0) {
      Logger.log('[CANDADO 10:00 PM] ✅ No hay filas pendientes en Historial_GPS. La Bitácora fue procesada en el día.');
      return;
    }
    
    Logger.log('[CANDADO 10:00 PM] ⚠️ Se detectaron fechas pendientes (' + histRes.datesToProcess.join(', ') + '). Ejecutando traspaso automático a Bitácora Real...');
    
    // Traspasar a Bitácora Real de forma silenciosa
    ejecutarProcesamientoGPSCore(false, true);
    Logger.log('[CANDADO 10:00 PM] ✅ Traspaso nocturno automático a Bitácora Real completado exitosamente.');
  } catch (e) {
    Logger.log('[CANDADO 10:00 PM] ❌ Error en candado nocturno 10 PM: ' + e.message);
  }
}

/**
 * Crea o actualiza los activadores basados en tiempo:
 * 1. 02:50 AM -> Verificación y rescate de archivo Ubiqo.
 * 2. 03:00 AM -> Cadena completa (Ingesta ➔ Diagnóstico ➔ Prueba).
 * 3. 10:00 PM -> Candado de procesamiento automático a Bitácora Real.
 */
function crearTriggerIngestaNocturna() {
  var ui = null;
  try { ui = SpreadsheetApp.getUi(); } catch (e) {}
  
  try {
    var triggers = ScriptApp.getProjectTriggers();
    for (var i = 0; i < triggers.length; i++) {
      var fnName = triggers[i].getHandlerFunction();
      if (fnName === 'ejecutarIngerirArchivosPendientes' || 
          fnName === 'ejecutarCadenaIngestaDiagnosticoPrueba' ||
          fnName === 'auditVerificarOForzarDescargaNocturna' ||
          fnName === 'auditVerificarYForzarProcesamientoRealNocturno10PM') {
        ScriptApp.deleteTrigger(triggers[i]);
      }
    }
    
    // 1. Trigger de rescate a las 2:50 AM
    ScriptApp.newTrigger('auditVerificarOForzarDescargaNocturna')
      .timeBased()
      .everyDays(1)
      .atHour(2)
      .nearMinute(50)
      .create();

    // 2. Trigger de la cadena a las 3:00 AM
    ScriptApp.newTrigger('ejecutarCadenaIngestaDiagnosticoPrueba')
      .timeBased()
      .everyDays(1)
      .atHour(3)
      .create();

    // 3. Trigger del candado nocturno a las 10:00 PM
    ScriptApp.newTrigger('auditVerificarYForzarProcesamientoRealNocturno10PM')
      .timeBased()
      .everyDays(1)
      .atHour(22)
      .create();

    Logger.log('[INGESTA] Activadores nocturnos (2:50 AM Rescate + 3:00 AM Cadena + 10:00 PM Candado Real) configurados.');
    if (ui) {
      ui.alert(
        '⏰ Activadores Nocturnos Configurados',
        '• 02:50 AM: Rescate automático si falta archivo en Drive.\n' +
        '• 03:00 AM: Cadena completa (Ingesta ➔ Diagnóstico ➔ Prellenado Bitacora_Prueba).\n' +
        '• 10:00 PM: Candado automático a Bitácora Real (si el encargado no dio clic en el día).',
        ui.ButtonSet.OK
      );
    }
  } catch (e) {
    Logger.log('[INGESTA] ❌ Error creando activadores: ' + e.message);
    if (ui) ui.alert('❌ Error configurando activadores', e.message, ui.ButtonSet.OK);
  }
}

// ─────────────────────────────────────────────────────────────
//  INGESTA DE UN ARCHIVO INDIVIDUAL
// ─────────────────────────────────────────────────────────────

/**
 * Parsea un archivo Ubiqo (.xlsx o Google Sheets) y escribe
 * los tramos digeridos en Historial_GPS.
 * NO aplica reglas de negocio. Las geocercas se detectan al procesar.
 *
 * @param {File}   file          - DriveApp File original.
 * @param {Sheet}  shHistorial   - Hoja Historial_GPS validada.
 * @param {string} archivoOrigen - Nombre del archivo (trazabilidad).
 * @returns {number} Tramos escritos.
 */
function auditIngerirArchivoGPS(file, shHistorial, archivoOrigen) {
  var tempFile = null;
  var tempSs   = null;
  var tramosEscritos = 0;

  try {
    var mimeType = file.getMimeType();

    if (mimeType === MimeType.GOOGLE_SHEETS ||
        mimeType === 'application/vnd.google-apps.spreadsheet') {
      tempSs = SpreadsheetApp.openById(file.getId());
    } else {
      // .xlsx → convertir a Google Sheets UNA SOLA VEZ
      var resource = {
        title: 'TEMP_GPS_INGESTA_' + file.getName().replace(/\.[^.]+$/, ''),
        mimeType: MimeType.GOOGLE_SHEETS
      };
      tempFile = Drive.Files.insert(resource, file.getBlob());
      if (!tempFile || !tempFile.id) {
        throw new Error('No se pudo convertir el archivo a Google Sheets.');
      }
      Utilities.sleep(3000);
      tempSs = SpreadsheetApp.openById(tempFile.id);
    }

    var sheet   = tempSs.getSheets()[0];
    var allData = sheet.getDataRange().getValues();
    var tramos  = auditExtraerTramosDeExcel(allData);
    Logger.log('[INGESTA] Tramos de "' + archivoOrigen + '": ' + tramos.length);

    if (tramos.length > 0) {
      var startRow = shHistorial.getLastRow() + 1;
      var rows = tramos.map(function(t) {
        return [
          t.unidad,         // A: Unidad
          t.fecha,          // B: Fecha
          t.hora_inicio,    // C: Hora_Inicio
          t.lat_inicio,     // D: Lat_Inicio
          t.lon_inicio,     // E: Lon_Inicio
          t.hora_fin,       // F: Hora_Fin
          t.lat_fin,        // G: Lat_Fin
          t.lon_fin,        // H: Lon_Fin
          t.distancia_km,   // I: Distancia_Segmento
          t.duracion_hms,   // J: Duracion_Segmento
          t.paradas_hms,    // K: Paradas_Duracion_HH_MM_SS (vacío si N/A)
          archivoOrigen,    // L: Archivo_Origen
          'Pendiente'       // M: Estado
        ];
      });
      shHistorial.getRange(startRow, 1, rows.length, 13).setValues(rows);
      tramosEscritos = rows.length;
    }

  } finally {
    if (tempFile && tempFile.id) {
      try { Drive.Files.remove(tempFile.id); } catch (e) {
        Logger.log('[INGESTA] Aviso: no se eliminó temporal ' + tempFile.id + ': ' + e.message);
      }
    }
  }

  return tramosEscritos;
}

// ─────────────────────────────────────────────────────────────
//  MOVER ARCHIVO A GPS_PROCESADOS (método robusto con respaldo)
// ─────────────────────────────────────────────────────────────

/**
 * Mueve un archivo a GPS_Procesados. Intenta moveTo primero; si falla,
 * usa addFile/removeFile como respaldo.
 */
function auditMoverArchivoAProcessados(file, folderProcesados, fileName) {
  try {
    file.moveTo(folderProcesados);
    Logger.log('[INGESTA] moveTo OK: ' + fileName);
  } catch (e1) {
    Logger.log('[INGESTA] moveTo falló (' + e1.message + '), usando addFile...');
    try {
      folderProcesados.addFile(file);
      DriveApp.getFolderById(AUDIT_GPS_PENDIENTES_FOLDER_ID).removeFile(file);
      Logger.log('[INGESTA] addFile/removeFile OK: ' + fileName);
    } catch (e2) {
      Logger.log('[INGESTA] ⚠️ No se pudo mover archivo: ' + e2.message);
    }
  }
}

// ─────────────────────────────────────────────────────────────
//  PARSER PURO DEL EXCEL DE UBIQO
// ─────────────────────────────────────────────────────────────

/**
 * Recorre el contenido del Excel de Ubiqo y extrae todos los tramos
 * con sus paradas acumuladas.
 *
 * Estructura Ubiqo (índices base-0):
 *   Fila 3: encabezado general (A="Dispositivo")
 *   Fila 4: primera unidad (A=nombre unidad)  ← garantizada
 *   Fila 5: sub-encabezado (B="Ruta", C="Fecha Inicia" …)
 *   Fila 6+: datos de tramos y paradas
 *
 *   Columnas de tramo:
 *     B(1)=ID Ruta  C(2)=Fecha Inicia  E(4)=Lat ini  F(5)=Lon ini
 *     G(6)=Fecha Final  I(8)=Lat fin  J(9)=Lon fin
 *     U(20)=Distancia  V(21)=Duración tramo
 *
 *   Columnas de parada (sub-tabla dentro de cada tramo):
 *     P(15)=#Parada (número > 0, col B vacía)
 *     S(18)=Duración parada ("7 min. 23 s." ó "N/A")
 *
 * @param {Array[][]} allData - getDataRange().getValues().
 * @returns {Array} Objetos tramo con 13 campos para Historial_GPS.
 */
function auditExtraerTramosDeExcel(allData) {
  var tramos       = [];
  var currentUnit  = null;
  var currentTramo = null;

  for (var r = 4; r < allData.length; r++) {
    var row  = allData[r];
    var colA = String(row[0] || '').trim();
    var colB = String(row[1] || '').trim();

    // ── Detectar nueva unidad ────────────────────────────────
    if (colA !== '' && auditEsNombreUnidadValido(colA)) {
      var nextColB = (r + 1 < allData.length)
        ? String(allData[r + 1][1] || '').toLowerCase().trim()
        : '';
      var esNuevaUnidad = (
        nextColB.indexOf('ruta') !== -1 ||
        nextColB.indexOf('tramo') !== -1 ||
        r === 4
      );
      if (esNuevaUnidad) {
        currentUnit  = colA;
        currentTramo = null;
        r++;          // saltar fila de sub-encabezado
        continue;
      }
    }

    if (!currentUnit) continue;

    // ── Detectar fila de TRAMO ───────────────────────────────
    var colBNum = parseFloat(colB.replace(',', '.'));
    if (!isNaN(colBNum) && colBNum > 0 && colB !== '') {
      var startRaw = row[2];   // C: Fecha Inicia
      var startDt  = (startRaw instanceof Date) ? startRaw : parseDateTimeJS(startRaw);
      if (!startDt || isNaN(startDt.getTime())) continue;

      var endRaw = row[6];     // G: Fecha Final
      var endDt  = (endRaw instanceof Date) ? endRaw : parseDateTimeJS(endRaw);

      var latIni  = parseCoordJS(row[4]);          // E: Lat inicial
      var lonIni  = parseCoordJS(row[5]);          // F: Lon inicial
      var latFin  = parseCoordJS(row[8]);          // I: Lat final
      var lonFin  = parseCoordJS(row[9]);          // J: Lon final
      var distKm  = auditParseDistanciaKm(row[20]); // U: Distancia
      var durSec  = parseDurSecJS(row[21]);         // V: Duración tramo

      currentTramo = {
        unidad:        currentUnit,
        fecha:         auditFormatDate(startDt),
        hora_inicio:   formatTimeOnly(startDt),
        lat_inicio:    latIni,
        lon_inicio:    lonIni,
        hora_fin:      endDt ? formatTimeOnly(endDt) : '',
        lat_fin:       latFin,
        lon_fin:       lonFin,
        distancia_km:  distKm > 0 ? distKm : '',
        duracion_hms:  durSec > 0 ? formatSecToHMS(durSec) : '',
        paradas_hms:   '',    // se acumula con las filas de parada
        _paradas_sec:  0      // acumulador temporal (no se escribe)
      };
      tramos.push(currentTramo);
      continue;
    }

    // ── Detectar fila de PARADA ──────────────────────────────
    if (currentTramo) {
      if (isNaN(colBNum) || colBNum <= 0 || colB === '' || colB.toLowerCase().indexOf('parada') !== -1) {
        // Escanear celdas de la fila buscando cualquier string de duración (ej: "7 min. 23 s.", "15 min.")
        for (var c = 0; c < row.length; c++) {
          var cellVal = String(row[c] || '').trim();
          if (cellVal !== '' && (cellVal.toLowerCase().indexOf('min') !== -1 || cellVal.toLowerCase().indexOf('s.') !== -1 || /\d+\s*h/i.test(cellVal))) {
            var durSeg = auditParseDuracionParadaUbiqo(cellVal);
            if (durSeg > 0) {
              currentTramo._paradas_sec += durSeg;
              currentTramo.paradas_hms   = formatSecToHMS(currentTramo._paradas_sec);
              break;
            }
          }
        }
      }
    }
  }

  return tramos;
}

// ─────────────────────────────────────────────────────────────
//  PARSER DE DISTANCIA (km ó m desde Ubiqo)
// ─────────────────────────────────────────────────────────────

/**
 * Convierte el campo Distancia de Ubiqo a kilómetros.
 * Detecta automáticamente la unidad:
 *   "15.3 km" → 15.3 km  |  "15300 m" → 15.3 km  |  15.3 (número) → 15.3 km
 *   Si el número puro > 1000 → asume metros y convierte.
 */
function auditParseDistanciaKm(val) {
  if (val === null || val === undefined || val === '') return 0;
  if (typeof val === 'number') {
    if (isNaN(val)) return 0;
    return val > 1000 ? val / 1000 : val;
  }
  var str     = String(val).toLowerCase().trim();
  var cleaned = str.replace(/,/g, '.');
  var match   = cleaned.match(/([\d.]+)/);
  if (!match) return 0;
  var num = parseFloat(match[1]);
  if (isNaN(num)) return 0;

  if (str.indexOf('km') !== -1)                            return num;
  if (str.indexOf(' m') !== -1 || /^\d+\.?\d*\s*m$/.test(str)) return num / 1000;
  return num > 1000 ? num / 1000 : num;   // sin unidad: si > 1000 asume metros
}

// ─────────────────────────────────────────────────────────────
//  CONVERSIÓN DE DURACIÓN DE PARADA (formato Ubiqo)
// ─────────────────────────────────────────────────────────────

/**
 * Convierte "7 min. 23 s." a segundos. Devuelve -1 si es N/A o vacío.
 */
function auditParseDuracionParadaUbiqo(val) {
  var str = String(val || '').trim();
  if (!str || str.toUpperCase() === 'N/A') return -1;

  var totalSec = 0;
  var matchH   = str.match(/(\d+)\s*h/i);
  var matchM   = str.match(/(\d+)\s*min/i);
  var matchS   = str.match(/(\d+)\s*s\b/i);

  if (matchH) totalSec += parseInt(matchH[1], 10) * 3600;
  if (matchM) totalSec += parseInt(matchM[1], 10) * 60;
  if (matchS) totalSec += parseInt(matchS[1], 10);

  return totalSec > 0 ? totalSec : -1;
}

// ─────────────────────────────────────────────────────────────
//  GESTIÓN DE Historial_GPS — 13 COLUMNAS
// ─────────────────────────────────────────────────────────────

/**
 * Garantiza que la hoja Historial_GPS existe con los 13 encabezados correctos.
 * Si viene de la versión anterior (14-16 columnas), actualiza automáticamente.
 */
function auditEnsureHistorialHeaders(ssConfig) {
  var HEADERS = [
    'Unidad', 'Fecha', 'Hora_Inicio', 'Lat_Inicio', 'Lon_Inicio',
    'Hora_Fin', 'Lat_Fin', 'Lon_Fin',
    'Distancia_Segmento', 'Duracion_Segmento',
    'Paradas_Duracion_HH_MM_SS',
    'Archivo_Origen', 'Estado'
  ];

  var sh = ssConfig.getSheetByName('Historial_GPS');

  if (!sh) {
    sh = ssConfig.insertSheet('Historial_GPS');
    sh.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS])
      .setFontWeight('bold')
      .setBackground('#c9daf8');
    sh.setFrozenRows(1);
    Logger.log('[INGESTA] Hoja Historial_GPS creada (13 columnas).');
    return sh;
  }

  // Verificar encabezados
  var lastCol  = Math.max(sh.getLastColumn(), HEADERS.length);
  var firstRow = sh.getRange(1, 1, 1, lastCol).getValues()[0];
  var ok = HEADERS.every(function(h, i) {
    return String(firstRow[i] || '').trim() === h;
  });

  if (!ok) {
    Logger.log('[INGESTA] Actualizando encabezados de Historial_GPS a 13 columnas...');
    sh.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    // Limpiar columnas sobrantes de versiones anteriores
    if (lastCol > HEADERS.length) {
      sh.getRange(1, HEADERS.length + 1, 1, lastCol - HEADERS.length).clearContent();
    }
  }

  return sh;
}
