/**
 * ============================================================
 *  SMARTCORP – Sistema de Procesamiento e Importación GPS (Producción)
 *  Archivo: Audit_GPS.js
 *
 *  Propósito:
 *    • Módulo 3: Procesar los reportes de GPS Excel en "GPS_Pendientes"
 *    • Mapear distancias, paradas y tiempos recorridos a la Bitácora
 *    • Calcular horarios usando geocercas virtuales (Haversine)
 *    • Registrar histórico detallado con 12 columnas en "SMARTCORP_GPS_Configuracion"
 *    • Dividir tramos cronológicamente si hay múltiples proyectos en un día
 *    • Alertar sobre anomalías (salida/llegada temprana, velocidad baja, geocerca faltante)
 *
 *  Versión : 2.2.0
 *  Fecha   : 22/06/2026
 * ============================================================
 */

// ─────────────────────────────────────────────────────────────
//  IDs DE LAS HOJAS Y DRIVE (modificar aquí si cambian)
// ─────────────────────────────────────────────────────────────
var AUDIT_BITACORA_SHEET_ID        = '18GFvQZdpmALvmmTFc70dXENJxImMR3bkHU04IG_UyyY';
var AUDIT_BITACORA_TAB_NAME        = 'Bitácora';

// Módulo GPS - Carpetas de Google Drive
var AUDIT_GPS_MAIN_FOLDER_ID       = '1eoOdJG44aRsmrOQtbSQjMrE8ZWMxxO56';
var AUDIT_GPS_PENDIENTES_FOLDER_ID = '1TALOZQf1D07iICjXmi9pupEgGg5fl5xm';
var AUDIT_GPS_PROCESADOS_FOLDER_ID = '1RiGoDqORutSwb5svJmBZaR0KGCACdWRr';
var AUDIT_GPS_ERRORES_FOLDER_ID    = '1pKCzDF7ISiXWtSJm1VTQlv_kiAC_aPUK';

var AUDIT_GPS_CONFIG_FILE_NAME     = 'SMARTCORP_GPS_Configuracion';

// ─────────────────────────────────────────────────────────────
//  ÍNDICES DE COLUMNAS — BITÁCORA (base 0)
// ─────────────────────────────────────────────────────────────
var AUDIT_COL_BIT_FECHA            = 2;   // "FECHA"
var AUDIT_COL_BIT_PROYECTO         = 3;   // "PROYECTO"
var AUDIT_COL_BIT_NOMBRE           = 4;   // "NOMBRE"
var AUDIT_COL_BIT_DE               = 6;   // "DE" (col G)
var AUDIT_COL_BIT_A                = 7;   // "A" (col H)
var AUDIT_COL_BIT_UNIDAD           = 9;   // "UNIDAD" (col J)
var AUDIT_COL_BIT_ASUNTO           = 11;  // "ASUNTO" (col L)
var AUDIT_COL_BIT_HORA_SALIDA      = 15;  // "HORA DE SALIDA" (col P)
var AUDIT_COL_BIT_HORA_ENTRADA     = 16;  // "HORA DE ENTRADA" (col Q)
var AUDIT_COL_BIT_TIEMPO_RECORRIDO = 17;  // "TIEMPO RECORRIDO" (col R)
var AUDIT_COL_BIT_PARADAS          = 19;  // "PARADAS" (col T)
var AUDIT_COL_BIT_KM               = 22;  // "KM" (col W)
var AUDIT_COL_BIT_HORA_SAL_PROY    = 24;  // "HORA SAL PROY" (col Y)
var AUDIT_COL_BIT_HORA_LLEG_PROY   = 25;  // "HORA LLEG PROY" (col Z)

// Asunto que activa la validación en la Bitácora
var AUDIT_GPS_ASUNTO_INSTALACION   = 'proyecto instalación';

/**
 * Función principal para procesar GPS en producción.
 */
function ejecutarProcesamientoGPS() {
  var ui = SpreadsheetApp.getUi();
  
  try {
    Logger.log('=== [LOG] INICIO: ejecutarProcesamientoGPS ===');
    
    // 1. Obtener configuración
    var ssConfig = auditObtenerSsConfiguracion();
    var geocercas = auditObtenerGeocercas(ssConfig);
    var mapaEquivalencias = auditObtenerEquivalenciasUnidades(ssConfig);
    
    Logger.log('[LOG] Mapeo de Equivalencias cargado: ' + JSON.stringify(mapaEquivalencias));
    
    var shHistorial = ssConfig.getSheetByName('Historial_GPS');
    
    // Buscar coordenadas de la oficina SMARTCORP
    var officeLat = 20.618933;
    var officeLon = -100.407993;
    for (var i = 0; i < geocercas.length; i++) {
      if (geocercas[i].id === 'SMARTCORP') {
        officeLat = geocercas[i].lat;
        officeLon = geocercas[i].lon;
        break;
      }
    }
    
    // 2. Obtener carpetas de Drive
    var folderPendientes = DriveApp.getFolderById(AUDIT_GPS_PENDIENTES_FOLDER_ID);
    var folderProcesados = DriveApp.getFolderById(AUDIT_GPS_PROCESADOS_FOLDER_ID);
    var folderErrores = DriveApp.getFolderById(AUDIT_GPS_ERRORES_FOLDER_ID);
    
    var files = folderPendientes.getFiles();
    
    // 3. Obtener hojas de trabajo
    var ssBitacora = SpreadsheetApp.openById(AUDIT_BITACORA_SHEET_ID);
    var shBitacora = ssBitacora.getSheetByName(AUDIT_BITACORA_TAB_NAME);
    if (!shBitacora) {
      throw new Error('No se encontró la pestaña "' + AUDIT_BITACORA_TAB_NAME + '" en la Bitácora.');
    }
    
    var logMensajes = [];
    var archivosProcesados = 0;
    var erroresCount = 0;
    var noBitacoraCount = 0;
    var bitacoraModificada = false;
    
    // 4. Recorrer archivos en GPS_Pendientes y cargarlos en memoria
    var routesByUnitAndDate = {}; // dateStr -> { unitName -> [routes] }
    var fileRecords = []; // Array of { file, name, dates }
    
    while (files.hasNext()) {
      var file = files.next();
      var nombreArchivo = file.getName();
      Logger.log('[LOG] Leyendo archivo de Drive: ' + nombreArchivo);
      
      var parseRes = null;
      try {
        parseRes = auditParsearExcelGPS(file);
      } catch (ex) {
        Logger.log('[LOG] Error parseando ' + nombreArchivo + ': ' + ex.message);
        logMensajes.push('❌ Error parseando ' + nombreArchivo + ': ' + ex.message);
        erroresCount++;
        try { file.moveTo(folderErrores); } catch(e) {}
        continue;
      }
      
      if (!parseRes || parseRes.status !== 'success') {
        logMensajes.push('❌ Estructura inválida en ' + nombreArchivo);
        erroresCount++;
        try { file.moveTo(folderErrores); } catch(e) {}
        continue;
      }
      
      var units = parseRes.units || [];
      if (units.length === 0) {
        logMensajes.push('⚠️ ' + nombreArchivo + ': No contiene unidades de GPS.');
        noBitacoraCount++;
        try { file.moveTo(folderProcesados); } catch(e) {}
        continue;
      }
      
      var fileDates = {};
      var fileHasValidRoutes = false;
      
      for (var u = 0; u < units.length; u++) {
        var unitBlock = units[u];
        var unidad = unitBlock.unidad;
        var routes = unitBlock.routes || [];
        if (routes.length === 0) continue;
        fileHasValidRoutes = true;
        
        var normalizedUnit = auditNormalizar(unidad);
        Logger.log('[LOG] Cargada unidad: "' + normalizedUnit + '" con ' + routes.length + ' rutas del archivo.');
        
        for (var r = 0; r < routes.length; r++) {
          var rt = routes[r];
          var rDateStr = auditFormatDate(rt.start_time);
          if (!rDateStr) continue;
          fileDates[rDateStr] = true;
          
          if (!routesByUnitAndDate[rDateStr]) {
            routesByUnitAndDate[rDateStr] = {};
          }
          if (!routesByUnitAndDate[rDateStr][normalizedUnit]) {
            routesByUnitAndDate[rDateStr][normalizedUnit] = [];
          }
          
          // Filtros de ruido y patio
          var keep = true;
          if (rt.dist_km < 0.15) keep = false;
          if (rt.dist_km < 0.5 && rt.start_lat && rt.start_lon && rt.end_lat && rt.end_lon) {
            var distStartToOffice = auditCalcularDistanciaMetros(rt.start_lat, rt.start_lon, officeLat, officeLon);
            var distEndToOffice = auditCalcularDistanciaMetros(rt.end_lat, rt.end_lon, officeLat, officeLon);
            if (distStartToOffice < 150 && distEndToOffice < 150) {
              keep = false;
            }
          }
          if (keep) {
            routesByUnitAndDate[rDateStr][normalizedUnit].push(rt);
          }
        }
      }
      
      if (!fileHasValidRoutes) {
        logMensajes.push('⚠️ ' + nombreArchivo + ': Sin viajes válidos.');
        noBitacoraCount++;
        try { file.moveTo(folderProcesados); } catch(e) {}
        continue;
      }
      
      fileRecords.push({ file: file, name: nombreArchivo, dates: fileDates });
    }
    
    // 5. Procesar cada fecha globalmente
    var datesToProcess = Object.keys(routesByUnitAndDate);
    Logger.log('[LOG] Fechas identificadas para procesar: ' + JSON.stringify(datesToProcess));
    
    var especiales = auditObtenerProyectosEspeciales(ssConfig);
    
    for (var dIdx = 0; dIdx < datesToProcess.length; dIdx++) {
      var dateStr = datesToProcess[dIdx];
      var dateUnitsData = routesByUnitAndDate[dateStr];
      
      // Llamar al procesador global para esta fecha
      auditProcesarFechaGlobal(shBitacora, dateUnitsData, geocercas, officeLat, officeLon, dateStr, mapaEquivalencias, especiales, false);
      
      bitacoraModificada = true;
      logMensajes.push('✅ ' + dateStr + ': Procesamiento global de GPS completado con éxito.');
      
      // Escribir ruta detallada en Historial_GPS (12 columnas) para todas las unidades y segmentos de esta fecha
      var rowsToAppend = [];
      var unitsInDate = Object.keys(dateUnitsData);
      for (var uIdx = 0; uIdx < unitsInDate.length; uIdx++) {
        var normUnit = unitsInDate[uIdx];
        var routes = dateUnitsData[normUnit] || [];
        for (var s = 0; s < routes.length; s++) {
          var rt = routes[s];
          
          var targetProjectsNorm = [];
          var matchesInicio = auditDetectarGeocercasCoincidentes(rt.start_lat, rt.start_lon, geocercas);
          var locInicio = auditResolverGeocerca(matchesInicio, targetProjectsNorm);
          
          var matchesFin = auditDetectarGeocercasCoincidentes(rt.end_lat, rt.end_lon, geocercas);
          var locFin = auditResolverGeocerca(matchesFin, targetProjectsNorm);
          
          rowsToAppend.push([
            normUnit.toUpperCase(),
            dateStr,
            formatTimeOnly(rt.start_time),
            rt.start_lat,
            rt.start_lon,
            locInicio || 'Desconocido',
            formatTimeOnly(rt.end_time),
            rt.end_lat,
            rt.end_lon,
            locFin || 'Desconocido',
            rt.dist_km,
            rt.dur_mov_raw
          ]);
        }
      }
      if (rowsToAppend.length > 0) {
        shHistorial.getRange(shHistorial.getLastRow() + 1, 1, rowsToAppend.length, 12).setValues(rowsToAppend);
      }
    }
    
    // 6. Archivar archivos procesados
    for (var f = 0; f < fileRecords.length; f++) {
      archivosProcesados++;
      try {
        fileRecords[f].file.moveTo(folderProcesados);
      } catch (moveEx) {
        Logger.log('[LOG] Error moviendo archivo a procesados: ' + moveEx.message);
      }
    }
    
    var resumenTexto = 
      '📡 IMPORTACIÓN GPS COMPLETADA (PROCESAMIENTO GLOBAL)\n' +
      '─────────────────────────────────\n' +
      '• Archivos importados con éxito : ' + archivosProcesados + '\n' +
      '• Archivos sin coincidencia en Bitácora : ' + noBitacoraCount + '\n' +
      '• Archivos con errores o fallidos : ' + erroresCount + '\n' +
      '─────────────────────────────────\n\n' +
      'DETALLE:\n' + logMensajes.join('\n');
      
    ui.alert('📡 Procesador GPS SMARTCORP', resumenTexto, ui.ButtonSet.OK);
    
  } catch (e) {
    Logger.log('Error en ejecutarProcesamientoGPS: ' + e.message + '\n' + e.stack);
    ui.alert('❌ Error', e.message, ui.ButtonSet.OK);
  }
}

/**
 * Parsea el Excel de GPS dinámicamente por índices de columna absolutos.
 */
function auditParsearExcelGPS(file) {
  var tempFile = null;
  try {
    var resource = {
      title: 'TEMP_GPS_' + file.getName().replace(/\.xlsx$/i, ''),
      mimeType: MimeType.GOOGLE_SHEETS
    };
    
    tempFile = Drive.Files.insert(resource, file.getBlob());
    var tempSs = SpreadsheetApp.openById(tempFile.id);
    var sheet = tempSs.getSheets()[0];
    var lastRow = sheet.getLastRow();
    
    if (lastRow < 7) {
      throw new Error('El archivo no contiene suficientes filas de datos.');
    }
    
    var allData = sheet.getDataRange().getValues();
    
    var colRutaId = 1;     // Col B
    var colFechaIni = 2;   // Col C
    var colStartAddr = 3;  // Col D
    var colLatIni = 4;     // Col E
    var colLonIni = 5;     // Col F
    var colFechaFin = 6;   // Col G
    var colEndAddr = 7;    // Col H
    var colLatFin = 8;     // Col I
    var colLonFin = 9;     // Col J
    var colParadasCount = 14; // Col O
    var colStopIdx = 15;   // Col P
    var colStopStart = 16; // Col Q
    var colStopEnd = 17;   // Col R
    var colStopDur = 18;   // Col S
    var colStopAddr = 19;  // Col T
    var colDist = 20;      // Col U
    var colDur = 21;       // Col V
    
    var unitBlocks = [];
    var currentUnitBlock = null;
    var currentRoute = null;
    
    for (var r = 4; r < allData.length; r++) {
      var row = allData[r];
      var colAVal = String(row[0] || '').trim();
      
      // Validar si esta fila es un resumen de nuevo dispositivo
      var isNewDevice = false;
      if (colAVal !== "") {
        if (r + 1 < allData.length) {
          var nextRowBVal = String(allData[r+1][1] || '').toLowerCase().trim();
          if (nextRowBVal.indexOf('ruta') !== -1) {
            isNewDevice = true;
          }
        }
      }
      
      if (isNewDevice) {
        var paradasTotal = parseInt(row[5], 10) || 0;
        var distanciaTotal = auditParseDistancia(row[7]);
        var enMovimiento = auditParseDuracion(row[8]);
        
        currentUnitBlock = {
          unidad: colAVal,
          resumen: {
            paradas: paradasTotal,
            distancia: distanciaTotal,
            duracion: enMovimiento
          },
          routes: []
        };
        unitBlocks.push(currentUnitBlock);
        currentRoute = null;
        
        // Saltar la fila del encabezado de rutas
        r++;
        continue;
      }
      
      if (currentUnitBlock) {
        var rId = row[colRutaId];
        var rStartVal = row[colFechaIni];
        
        if (rId !== null && String(rId).trim() !== "" && !isNaN(rId)) {
          var startDt = rStartVal instanceof Date ? rStartVal : parseTimeJS(rStartVal);
          if (!startDt) continue;
          
          var endDt = row[colFechaFin] instanceof Date ? row[colFechaFin] : parseTimeJS(row[colFechaFin]);
          var latI = auditParseCoordenada(row[colLatIni]);
          var lonI = auditParseCoordenada(row[colLonIni]);
          var latF = auditParseCoordenada(row[colLatFin]);
          var lonF = auditParseCoordenada(row[colLonFin]);
          
          var distSeg = auditParseDistancia(row[colDist]);
          var durSegRaw = row[colDur];
          var durSegMin = parseDurationToMinJS(durSegRaw);
          
          // Filtro GPS Loco: descartar si distancia < 100m y duracion > 15min
          if (distSeg < 0.1 && durSegMin > 15.0) {
            Logger.log('GPS LOCO detectado y descartado: dist=' + distSeg + 'km, dur=' + durSegMin + 'min');
            currentRoute = null;
            continue;
          }
          
          currentRoute = {
            id: rId,
            start_time: startDt,
            end_time: endDt,
            start_lat: latI,
            start_lon: lonI,
            end_lat: latF,
            end_lon: lonF,
            start_addr: String(row[colStartAddr] || '').trim(),
            end_addr: String(row[colEndAddr] || '').trim(),
            dist_km: distSeg,
            dur_mov_raw: durSegRaw,
            dur_mov_min: durSegMin,
            paradas: []
          };
          currentUnitBlock.routes.push(currentRoute);
        }
        
        if (currentRoute) {
          var stopIdx = row[colStopIdx];
          if (stopIdx !== null && String(stopIdx).trim() !== "N/A" && String(stopIdx).trim() !== "") {
            var sStart = row[colStopStart] instanceof Date ? row[colStopStart] : parseTimeJS(row[colStopStart]);
            var sEnd = row[colStopEnd] instanceof Date ? row[colStopEnd] : parseTimeJS(row[colStopEnd]);
            var sDur = row[colStopDur];
            var sAddr = row[colStopAddr];
            
            var durMin = parseDurationToMinJS(sDur);
            if (durMin > 10.0) {
              currentRoute.paradas.push({
                idx: stopIdx,
                start_time: sStart,
                end_time: sEnd,
                dur_min: durMin,
                dur_raw: sDur,
                address: String(sAddr || '').trim()
              });
            }
          }
        }
      }
    }
    
    if (unitBlocks.length === 0) {
      throw new Error('No se pudo encontrar ninguna unidad de GPS en el archivo.');
    }
    
    return {
      status: 'success',
      units: unitBlocks
    };
  } finally {
    if (tempFile) {
      try {
        Drive.Files.remove(tempFile.id);
      } catch (ex) {
        Logger.log('Error borrando temp: ' + ex.message);
      }
    }
  }
}

/**
 * Motor de Cálculo Avanzado de GPS (splitting de turnos y kilómetros)
 */
function auditCalcularMetricasGPS(routes, geocercas, officeLat, officeLon, filasCoincidentes, datosBitacoraComplete, dateStr) {
  var results = [];
  
  // 1. Obtener lista de proyectos especiales desde la hoja
  var ssConfig = auditObtenerSsConfiguracion();
  var especiales = auditObtenerProyectosEspeciales(ssConfig);
  
  // 2. Aplicar brechas de señal (> 500m) entre tramos consecutivos
  for (var r = 0; r < routes.length - 1; r++) {
    var rtCurr = routes[r];
    var rtNext = routes[r + 1];
    if (rtCurr.end_lat && rtCurr.end_lon && rtNext.start_lat && rtNext.start_lon) {
      var distBrechaM = auditCalcularDistanciaMetros(rtCurr.end_lat, rtCurr.end_lon, rtNext.start_lat, rtNext.start_lon);
      if (distBrechaM > 500) {
        var distBrechaKm = distBrechaM / 1000.0;
        Logger.log('BRECHA DE SEÑAL: ' + distBrechaM + ' metros entre tramos. Sumando a KM.');
        rtNext.dist_km += distBrechaKm;
      }
    }
  }
  
  // 3. Encontrar primer inicio y último fin del día
  var firstStart = null;
  var lastEnd = null;
  var totalDistance = 0.0;
  
  for (var r = 0; r < routes.length; r++) {
    var rt = routes[r];
    if (rt.start_time && (firstStart === null || rt.start_time < firstStart)) {
      firstStart = rt.start_time;
    }
    if (rt.end_time && (lastEnd === null || rt.end_time > lastEnd)) {
      lastEnd = rt.end_time;
    }
    totalDistance += rt.dist_km;
  }
  
  // 4. Detectar regresos intermedios a la oficina
  var splitTime = null;
  var officeReturnRouteIdx = -1;
  
  for (var r = 0; r < routes.length - 1; r++) {
    var rt = routes[r];
    if (rt.end_lat && rt.end_lon && rt.end_time) {
      var distToOffice = auditCalcularDistanciaMetros(rt.end_lat, rt.end_lon, officeLat, officeLon);
      if (distToOffice < 500) {
        var hour = rt.end_time.getHours() + rt.end_time.getMinutes()/60.0;
        if (hour >= 11.5 && hour <= 13.5) {
          splitTime = new Date(rt.end_time.getTime());
          officeReturnRouteIdx = r;
          break;
        }
      }
    }
  }
  
  // Crear bloques de viajes
  var morningRoutes = [];
  var afternoonRoutes = [];
  if (splitTime !== null) {
    for (var r = 0; r < routes.length; r++) {
      if (r <= officeReturnRouteIdx) {
        morningRoutes.push(routes[r]);
      } else {
        afternoonRoutes.push(routes[r]);
      }
    }
  } else {
    morningRoutes = routes.slice();
  }
  
  // Agrupar filas coincidentes por nombre de técnico para evaluar secuencias individuales
  var rowsByTech = {};
  for (var f = 0; f < filasCoincidentes.length; f++) {
    var row = filasCoincidentes[f];
    var techName = row.nombre;
    if (!rowsByTech[techName]) rowsByTech[techName] = [];
    rowsByTech[techName].push(row);
  }
  
  var resultsMap = {};
  
  for (var techName in rowsByTech) {
    var techRows = rowsByTech[techName];
    
    // 1. Si los horarios planeados DE/A están vacíos, los inferimos dinámicamente usando las geocercas tocadas en las rutas del satélite
    for (var k = 0; k < techRows.length; k++) {
      var rDec = techRows[k];
      var projNorm = auditNormalizar(rDec.proyecto);
      var isDeEmpty = (rDec.deOriginal === undefined || rDec.deOriginal === null || String(rDec.deOriginal).trim() === "");
      var isAEmpty = (rDec.aOriginal === undefined || rDec.aOriginal === null || String(rDec.aOriginal).trim() === "");
      
      var deDec = isDeEmpty ? null : parseTimeToDecimal(rDec.deOriginal);
      var aDec = isAEmpty ? null : parseTimeToDecimal(rDec.aOriginal);
      
      var firstTouch = null;
      var lastTouch = null;
      for (var r = 0; r < routes.length; r++) {
        var rt = routes[r];
        var startGeoId = auditObtenerGeocercaDetectada(rt.start_lat, rt.start_lon, geocercas, [projNorm]);
        var destGeoId = auditObtenerGeocercaDetectada(rt.end_lat, rt.end_lon, geocercas, [projNorm]);
        
        var touches = false;
        if (startGeoId && auditCoincideGeocercaConProyecto(auditBuscarGeocercaPorId(geocercas, startGeoId), projNorm)) touches = true;
        if (destGeoId && auditCoincideGeocercaConProyecto(auditBuscarGeocercaPorId(geocercas, destGeoId), projNorm)) touches = true;
        
        if (touches) {
          if (firstTouch === null) firstTouch = rt.start_time;
          lastTouch = rt.end_time;
        }
      }
      
      if (isDeEmpty || isAEmpty) {
        if (firstTouch !== null && lastTouch !== null) {
          if (isDeEmpty) deDec = firstTouch.getHours() + firstTouch.getMinutes() / 60.0;
          if (isAEmpty) aDec = lastTouch.getHours() + lastTouch.getMinutes() / 60.0;
        } else {
          // Si no toca geocerca (ej. especial o gap), usar división secuencial sobre la jornada estándar (8:00 a 17:00)
          var totalShiftHours = 9.0;
          var segmentDuration = totalShiftHours / techRows.length;
          deDec = 8.0 + k * segmentDuration;
          aDec = 8.0 + (k + 1) * segmentDuration;
        }
      }
      
      rDec._firstTouch = firstTouch ? (firstTouch.getHours() + firstTouch.getMinutes() / 60.0) : deDec;
      rDec.T_de = deDec;
      rDec.T_a = aDec;
    }
    
    // Ordenar cronológicamente por horario DE planeado/inferido
    techRows.sort(function(a, b) {
      var diff = a._firstTouch - b._firstTouch;
      if (diff !== 0) return diff;
      return a.index - b.index;
    });
    
    // 2. Aplicar Snapping entre proyectos contiguos
    var directTransitions = {}; // Maps route.id -> { prevIdx, currIdx }
    for (var k = 1; k < techRows.length; k++) {
      var projPrevNorm = auditNormalizar(techRows[k-1].proyecto);
      var projCurrNorm = auditNormalizar(techRows[k].proyecto);
      
      var isAdminPrev = (projPrevNorm === 'oficina' || projPrevNorm === 'smartcorp' || projPrevNorm === 'smarthaus gastos');
      var isAdminCurr = (projCurrNorm === 'oficina' || projCurrNorm === 'smartcorp' || projCurrNorm === 'smarthaus gastos');
      
      if (isAdminPrev || isAdminCurr) {
        techRows[k].T_de = techRows[k-1].T_a;
      } else {
        // Encontrar último toque de prev y primer toque de curr
        var rt_prev_last = null;
        for (var r = routes.length - 1; r >= 0; r--) {
          var rt = routes[r];
          var startGeoId = auditObtenerGeocercaDetectada(rt.start_lat, rt.start_lon, geocercas, [projPrevNorm]);
          var destGeoId = auditObtenerGeocercaDetectada(rt.end_lat, rt.end_lon, geocercas, [projPrevNorm]);
          var touches = false;
          if (startGeoId && auditCoincideGeocercaConProyecto(auditBuscarGeocercaPorId(geocercas, startGeoId), projPrevNorm)) touches = true;
          if (destGeoId && auditCoincideGeocercaConProyecto(auditBuscarGeocercaPorId(geocercas, destGeoId), projPrevNorm)) touches = true;
          if (touches) {
            rt_prev_last = rt;
            break;
          }
        }
        
        var rt_curr_first = null;
        for (var r = 0; r < routes.length; r++) {
          var rt = routes[r];
          var startGeoId = auditObtenerGeocercaDetectada(rt.start_lat, rt.start_lon, geocercas, [projCurrNorm]);
          var destGeoId = auditObtenerGeocercaDetectada(rt.end_lat, rt.end_lon, geocercas, [projCurrNorm]);
          var touches = false;
          if (startGeoId && auditCoincideGeocercaConProyecto(auditBuscarGeocercaPorId(geocercas, startGeoId), projCurrNorm)) touches = true;
          if (destGeoId && auditCoincideGeocercaConProyecto(auditBuscarGeocercaPorId(geocercas, destGeoId), projCurrNorm)) touches = true;
          if (touches) {
            rt_curr_first = rt;
            break;
          }
        }
        
        if (rt_prev_last && rt_curr_first && (rt_prev_last.end_time <= rt_curr_first.start_time || rt_prev_last.id === rt_curr_first.id)) {
          var returnedToOffice = false;
          var officeArrivalDec = null;
          if (rt_prev_last.id !== rt_curr_first.id) {
            for (var r = 0; r < routes.length; r++) {
              var rt = routes[r];
              if (rt.start_time >= rt_prev_last.end_time && rt.end_time <= rt_curr_first.start_time) {
                var endToOffice = auditCalcularDistanciaMetros(rt.end_lat, rt.end_lon, officeLat, officeLon);
                if (endToOffice < 150) {
                  returnedToOffice = true;
                  officeArrivalDec = rt.end_time.getHours() + rt.end_time.getMinutes() / 60.0;
                }
              }
            }
          }
          
          if (returnedToOffice) {
            var T_boundary = officeArrivalDec ? Math.ceil(officeArrivalDec * 4) / 4 : techRows[k-1].T_a;
            techRows[k-1].T_a = T_boundary;
            techRows[k].T_de = T_boundary;
          } else {
            var t_dep = (rt_prev_last.id === rt_curr_first.id) 
              ? rt_prev_last.start_time.getHours() + rt_prev_last.start_time.getMinutes() / 60.0 
              : rt_prev_last.end_time.getHours() + rt_prev_last.end_time.getMinutes() / 60.0;
            var t_arr = (rt_prev_last.id === rt_curr_first.id)
              ? rt_curr_first.end_time.getHours() + rt_curr_first.end_time.getMinutes() / 60.0
              : rt_curr_first.start_time.getHours() + rt_curr_first.start_time.getMinutes() / 60.0;
            
            var t_mid = (t_dep + t_arr) / 2.0;
            var T_boundary = Math.ceil(t_mid * 4) / 4;
            techRows[k-1].T_a = T_boundary;
            techRows[k].T_de = T_boundary;
            
            if (rt_prev_last.id === rt_curr_first.id) {
              directTransitions[rt_prev_last.id] = { prevIdx: k-1, currIdx: k };
            } else {
              for (var r = 0; r < routes.length; r++) {
                var rt = routes[r];
                if (rt.start_time >= rt_prev_last.end_time && rt.end_time <= rt_curr_first.start_time) {
                  directTransitions[rt.id] = { prevIdx: k-1, currIdx: k };
                }
              }
            }
          }
        } else if (!rt_prev_last && rt_curr_first) {
          var startOfficeDist = auditCalcularDistanciaMetros(rt_curr_first.start_lat, rt_curr_first.start_lon, officeLat, officeLon);
          if (startOfficeDist < 150) {
            var officeDepartureDec = rt_curr_first.start_time.getHours() + rt_curr_first.start_time.getMinutes() / 60.0;
            var T_boundary = Math.ceil(officeDepartureDec * 4) / 4;
            techRows[k-1].T_a = T_boundary;
            techRows[k].T_de = T_boundary;
          } else {
            var t_dep = rt_curr_first.start_time.getHours() + rt_curr_first.start_time.getMinutes() / 60.0;
            var t_arr = rt_curr_first.end_time.getHours() + rt_curr_first.end_time.getMinutes() / 60.0;
            var t_mid = (t_dep + t_arr) / 2.0;
            var T_boundary = Math.ceil(t_mid * 4) / 4;
            techRows[k-1].T_a = T_boundary;
            techRows[k].T_de = T_boundary;
            directTransitions[rt_curr_first.id] = { prevIdx: k-1, currIdx: k };
          }
        } else if (rt_prev_last && !rt_curr_first) {
          var endOfficeDist = auditCalcularDistanciaMetros(rt_prev_last.end_lat, rt_prev_last.end_lon, officeLat, officeLon);
          if (endOfficeDist < 150) {
            var officeArrivalDec = rt_prev_last.end_time.getHours() + rt_prev_last.end_time.getMinutes() / 60.0;
            var T_boundary = Math.ceil(officeArrivalDec * 4) / 4;
            techRows[k-1].T_a = T_boundary;
            techRows[k].T_de = T_boundary;
          } else {
            var t_dep = rt_prev_last.start_time.getHours() + rt_prev_last.start_time.getMinutes() / 60.0;
            var t_arr = rt_prev_last.end_time.getHours() + rt_prev_last.end_time.getMinutes() / 60.0;
            var t_mid = (t_dep + t_arr) / 2.0;
            var T_boundary = Math.ceil(t_mid * 4) / 4;
            techRows[k-1].T_a = T_boundary;
            techRows[k].T_de = T_boundary;
            directTransitions[rt_prev_last.id] = { prevIdx: k-1, currIdx: k };
          }
        } else {
          techRows[k].T_de = techRows[k-1].T_a;
        }
      }
    }
    
    // Identificar si hay proyectos administrativos al inicio/fin del día
    var adminAtStart = false;
    var adminAtEnd = false;
    if (techRows.length > 1) {
      var firstProjNorm = auditNormalizar(techRows[0].proyecto);
      if (firstProjNorm === 'oficina' || firstProjNorm === 'smartcorp' || firstProjNorm === 'smarthaus gastos') {
        adminAtStart = true;
      }
      var lastProjNorm = auditNormalizar(techRows[techRows.length - 1].proyecto);
      if (lastProjNorm === 'oficina' || lastProjNorm === 'smartcorp' || lastProjNorm === 'smarthaus gastos') {
        adminAtEnd = true;
      }
    }
    
    var firstInstallIdx = -1;
    for (var k = 0; k < techRows.length; k++) {
      var pNorm = auditNormalizar(techRows[k].proyecto);
      var isAdmin = (pNorm === 'oficina' || pNorm === 'smartcorp' || pNorm === 'smarthaus gastos');
      if (!isAdmin && firstInstallIdx === -1) {
        firstInstallIdx = k;
      }
    }
    
    var lastInstallIdx = -1;
    for (var k = techRows.length - 1; k >= 0; k--) {
      var pNorm = auditNormalizar(techRows[k].proyecto);
      var isAdmin = (pNorm === 'oficina' || pNorm === 'smartcorp' || pNorm === 'smarthaus gastos');
      if (!isAdmin && lastInstallIdx === -1) {
        lastInstallIdx = k;
      }
    }
    
    // 3. Procesar métricas por bloque
    for (var i = 0; i < techRows.length; i++) {
      var row = techRows[i];
      var rowIdx = row.index;
      
      var projNorm = auditNormalizar(row.proyecto);
      var isEspecial = (especiales[projNorm] || projNorm === 'smarthaus gastos' || projNorm === 'oficina' || projNorm === 'smartcorp');
      
      var targetProjectsNorm = [projNorm];
      var projectGeoId = auditObtenerGeocercaDetectada(routes[0].start_lat, routes[0].start_lon, geocercas, targetProjectsNorm);
      var sinGeocerca = false;
      if (!isEspecial && !projectGeoId) {
        sinGeocerca = true;
      }
      
      var isFirstOfPerson = (i === 0);
      var isLastOfPerson = (i === techRows.length - 1);
      
      var rowRoutes = [];
      if (techRows.length > 1) {
        rowRoutes = routes.filter(function(rt) {
          if (directTransitions[rt.id]) {
            var conn = directTransitions[rt.id];
            return (i === conn.prevIdx || i === conn.currIdx);
          }
          var rtStart = rt.start_time.getHours() + rt.start_time.getMinutes() / 60.0;
          if (i === techRows.length - 1) {
            return rtStart >= techRows[i].T_de;
          } else {
            return rtStart >= techRows[i].T_de && rtStart < techRows[i].T_a;
          }
        });
      } else {
        rowRoutes = routes;
      }
      
      if (techRows[i].T_de >= 6.0 && techRows[i].T_de <= 15.0) {
        rowRoutes = rowRoutes.filter(function(rt) {
          var rtEndHour = rt.end_time.getHours() + rt.end_time.getMinutes() / 60.0;
          var limitHour = Math.min(5.5, techRows[i].T_de - 2.0);
          return rtEndHour >= limitHour;
        });
      }
      
      var rowMetrics = auditCalcularMetricasDeBloque(rowRoutes, geocercas, targetProjectsNorm, directTransitions);
      
      var res = {};
      res.tiempoRecorrido = rowMetrics.tiempoRecorrido;
      res.tiempoParadas = rowMetrics.tiempoParadas;
      res.paradas = rowMetrics.paradas;
      res.horaSalProy = rowMetrics.horaSalProy;
      res.horaLlegProy = rowMetrics.horaLlegProy;
      res.km = rowMetrics.km;
      res.horasExtra = "";
      
      var regresosCount = auditCalcularRegresosDeProyecto(rowRoutes, geocercas, projNorm, officeLat, officeLon);
      res.regresos = regresosCount > 0 ? regresosCount : "";
      
      var deHour = techRows[i].T_de;
      var aHour = techRows[i].T_a;
      
      var deInfo = { deVal: deHour, alerta: false, horaReal: '' };
      var aInfo = { aVal: aHour, alerta: false, horaReal: '' };
      var horasExtraVal = "";
      var horaLlegadaReal = "";
      var horaSalidaReal = "";
      
      if (firstStart) {
        var firstStartDecimal = firstStart.getHours() + firstStart.getMinutes() / 60.0;
        if (firstStartDecimal < 7.5) {
          deInfo.deVal = 8.0;
          deInfo.alerta = true;
          deInfo.horaReal = formatTimeOnly(firstStart);
        } else {
          deInfo.deVal = 8.0;
          deInfo.alerta = false;
        }
        horaSalidaReal = formatTimeOnly(firstStart);
      }
      
      if (lastEnd) {
        var lastEndDecimal = lastEnd.getHours() + lastEnd.getMinutes() / 60.0;
        if (lastEndDecimal > 19.0) {
          aInfo.aVal = 17.0;
          var diffExtra = lastEndDecimal - 18.0;
          if (diffExtra > 0) {
            horasExtraVal = Number(diffExtra.toFixed(1));
          }
        } else {
          if (lastEndDecimal < 15.5) {
            aInfo.aVal = 17.0;
            aInfo.alerta = true;
            aInfo.horaReal = formatTimeOnly(lastEnd);
          } else {
            aInfo.aVal = 17.0;
            aInfo.alerta = false;
          }
          horaLlegadaReal = formatTimeOnly(lastEnd);
        }
      }
      
      res.deVal = isFirstOfPerson ? deInfo.deVal : deHour;
      res.aVal = isLastOfPerson ? aInfo.aVal : aHour;
      
      res.horaSalida = isFirstOfPerson ? horaSalidaReal : formatDecimalToTime(deHour);
      res.horaEntrada = isLastOfPerson ? (horasExtraVal ? "" : horaLlegadaReal) : formatDecimalToTime(aHour);
      
      res.alertaHorario = isFirstOfPerson ? deInfo.alerta : false;
      res.horaReal = isFirstOfPerson ? deInfo.horaReal : '';
      res.alertaLlegadaTemprana = isLastOfPerson ? aInfo.alerta : false;
      res.horaLlegadaReal = isLastOfPerson ? aInfo.horaReal : '';
      res.horasExtra = isLastOfPerson ? horasExtraVal : "";
      
      if (!isFirstOfPerson) {
        res.horaSalida = "";
        res.horaLlegProy = "";
      }
      if (!isLastOfPerson) {
        res.horaEntrada = "";
        res.horaSalProy = "";
      }
      
      if (adminAtStart && i === firstInstallIdx) {
        res.horaSalida = "";
        res.horaLlegProy = "";
      }
      if (adminAtEnd && i === lastInstallIdx) {
        res.horaEntrada = "";
        res.horaSalProy = "";
      }
      
      if (isLastOfPerson && horasExtraVal) {
        res.horaSalida = isFirstOfPerson ? horaSalidaReal : "";
        res.horaEntrada = "";
        res.horaLlegProy = "";
        res.horaSalProy = "";
      }
      
      var alertaVelocidadBaja = false;
      var velocidadBajaReal = "";
      var speedParts = res.tiempoRecorrido.split(':');
      var speedSeconds = 0;
      if (speedParts.length === 3) {
        speedSeconds = parseInt(speedParts[0], 10) * 3600 + parseInt(speedParts[1], 10) * 60 + parseInt(speedParts[2], 10);
      }
      if (speedSeconds > 600) {
        var speedHours = speedSeconds / 3600.0;
        var avgSpeed = res.km / speedHours;
        if (avgSpeed < 6.0) {
          alertaVelocidadBaja = true;
          velocidadBajaReal = avgSpeed.toFixed(1);
        }
      }
      
      res.alertaVelocidadBaja = alertaVelocidadBaja;
      res.velocidadBajaReal = velocidadBajaReal;
      res.sinGeocerca = sinGeocerca;
      res.proyectoName = row.proyecto;
      
      if (isEspecial) {
        res.deVal = (row.deOriginal !== undefined && row.deOriginal !== null && String(row.deOriginal).trim() !== "") ? row.deOriginal : (isFirstOfPerson ? deInfo.deVal : deHour);
        res.aVal = (row.aOriginal !== undefined && row.aOriginal !== null && String(row.aOriginal).trim() !== "") ? row.aOriginal : (isLastOfPerson ? aInfo.aVal : aHour);
        res.horaSalida = "";
        res.horaEntrada = "";
        res.tiempoParadas = "";
        res.paradas = "";
        res.horaSalProy = "";
        res.horaLlegProy = "";
        res.alertaHorario = false;
        res.alertaLlegadaTemprana = false;
        res.alertaVelocidadBaja = false;
        res.sinGeocerca = false;
        res.horasExtra = "";
        res.regresos = "";
        
        var totalDurationSec = 0;
        for (var rVal = 0; rVal < routes.length; rVal++) {
          totalDurationSec += (routes[rVal].dur_mov_min * 60);
        }
        res.km = Number(totalDistance.toFixed(2));
        res.tiempoRecorrido = formatSecToHMS(totalDurationSec);
      }
      
      if (res.horaEntrada && res.horaSalProy) {
        var decimalEntrada = parseTimeToDecimal(res.horaEntrada);
        var decimalSalProy = parseTimeToDecimal(res.horaSalProy);
        if (decimalEntrada < decimalSalProy && lastEnd) {
          res.horaEntrada = formatTimeOnly(lastEnd);
        }
      }
      
      var esNocturno = false;
      if (!isEspecial) {
        esNocturno = (deHour >= 20.0 || deHour < 6.0 || aHour >= 20.0 || aHour < 6.0);
        if (!esNocturno) {
          for (var r = 0; r < rowRoutes.length; r++) {
            var rt = rowRoutes[r];
            var rtStart = rt.start_time.getHours() + rt.start_time.getMinutes() / 60.0;
            var rtEnd = rt.end_time.getHours() + rt.end_time.getMinutes() / 60.0;
            if (rtStart >= 20.0 || rtStart < 6.0 || rtEnd >= 20.0 || rtEnd < 6.0) {
              esNocturno = true;
              break;
            }
          }
        }
      }
      if (esNocturno) {
        res.deVal = row.deOriginal;
        res.aVal = row.aOriginal;
        res.horaSalida = "";
        res.horaEntrada = "";
        res.tiempoParadas = "";
        res.paradas = "";
        res.horaSalProy = "";
        res.horaLlegProy = "";
        res.tiempoRecorrido = "";
        res.km = "";
        res.alertaHorario = false;
        res.alertaLlegadaTemprana = false;
        res.alertaVelocidadBaja = false;
        res.sinGeocerca = false;
        res.alertaNocturna = true;
        res.horasExtra = "";
        res.regresos = "";
      }
      
      if (typeof res.deVal === 'number') {
        res.deVal = isFirstOfPerson ? formatDecimalToTime(res.deVal) : formatDecimalToTime15Min(res.deVal);
      }
      if (typeof res.aVal === 'number') {
        res.aVal = isLastOfPerson ? formatDecimalToTime(res.aVal) : formatDecimalToTime15Min(res.aVal);
      }
      
      resultsMap[rowIdx] = res;
    }
  }
  
  for (var f = 0; f < filasCoincidentes.length; f++) {
    results.push(resultsMap[filasCoincidentes[f].index]);
  }
  
  var targetProjectsNorm = filasCoincidentes.map(function(row) {
    return auditNormalizar(row.proyecto);
  });
  
  var segmentosClasificados = [];
  for (var i = 0; i < routes.length; i++) {
    var rt = routes[i];
    var matchesInicio = auditDetectarGeocercasCoincidentes(rt.start_lat, rt.start_lon, geocercas);
    var locInicio = auditResolverGeocerca(matchesInicio, targetProjectsNorm);
    
    var matchesFin = auditDetectarGeocercasCoincidentes(rt.end_lat, rt.end_lon, geocercas);
    var locFin = auditResolverGeocerca(matchesFin, targetProjectsNorm);
    
    segmentosClasificados.push({
      original: rt,
      locInicio: locInicio,
      locFin: locFin
    });
  }
  return {
    results: results,
    segmentosClasificados: segmentosClasificados
  };
}

/**
 * Verifica si hay una fila anterior para la misma persona en el mismo día.
 */
function auditEsPrimerTramoDiaPersona(datosBitacora, rowIdx, nombre, dateStr) {
  var currentDE = parseTimeToDecimal(datosBitacora[rowIdx][AUDIT_COL_BIT_DE]); // original DE (Col G)
  var nNorm = auditNormalizar(nombre);
  
  for (var r = 1; r < datosBitacora.length; r++) {
    if (r === rowIdx) continue;
    
    var fFechaRaw = datosBitacora[r][AUDIT_COL_BIT_FECHA];
    if (!fFechaRaw) continue;
    var fFecha = auditFormatDate(fFechaRaw);
    if (fFecha !== dateStr) continue;
    
    var fNombre = String(datosBitacora[r][AUDIT_COL_BIT_NOMBRE] || '').trim();
    if (auditNormalizar(fNombre) === nNorm) {
      var otherDE = parseTimeToDecimal(datosBitacora[r][AUDIT_COL_BIT_DE]); // DE
      if (otherDE < currentDE - 0.05) { // 3 minutos de tolerancia
        return false;
      }
    }
  }
  return true;
}

/**
 * Verifica si hay una fila posterior para la misma persona en el mismo día.
 */
function auditEsUltimoTramoDiaPersona(datosBitacora, rowIdx, nombre, dateStr) {
  var currentA = parseTimeToDecimal(datosBitacora[rowIdx][AUDIT_COL_BIT_A]); // original A (Col H)
  var nNorm = auditNormalizar(nombre);
  
  for (var r = 1; r < datosBitacora.length; r++) {
    if (r === rowIdx) continue;
    
    var fFechaRaw = datosBitacora[r][AUDIT_COL_BIT_FECHA];
    if (!fFechaRaw) continue;
    var fFecha = auditFormatDate(fFechaRaw);
    if (fFecha !== dateStr) continue;
    
    var fNombre = String(datosBitacora[r][AUDIT_COL_BIT_NOMBRE] || '').trim();
    if (auditNormalizar(fNombre) === nNorm) {
      var otherA = parseTimeToDecimal(datosBitacora[r][AUDIT_COL_BIT_A]); // A
      if (otherA > currentA + 0.05) {
        return false;
      }
    }
  }
  return true;
}

/**
 * Suma los kilómetros de los tramos que inician o terminan cerca de la geocerca de un proyecto específico.
 */
function auditCalcularKmInteligentesParaProyecto(routes, geocercas, proyectoName) {
  if (!proyectoName) return 0.0;
  var projNorm = auditNormalizar(proyectoName);
  var sum = 0.0;
  
  var projectGeo = null;
  for (var i = 0; i < geocercas.length; i++) {
    var geo = geocercas[i];
    if (auditNormalizar(geo.id) === projNorm || auditNormalizar(geo.nombre) === projNorm) {
      projectGeo = geo;
      break;
    }
  }
  
  if (!projectGeo) {
    var firstDestLat = null;
    var firstDestLon = null;
    for (var r = 0; r < routes.length; r++) {
      var rt = routes[r];
      if (rt.start_lat && rt.start_lon && rt.end_lat && rt.end_lon) {
        var distToOffice = auditCalcularDistanciaMetros(rt.end_lat, rt.end_lon, 20.618933, -100.407993);
        if (distToOffice > 500) {
          firstDestLat = rt.end_lat;
          firstDestLon = rt.end_lon;
          break;
        }
      }
    }
    
    if (firstDestLat && firstDestLon) {
      for (var r = 0; r < routes.length; r++) {
        var rt = routes[r];
        var distToDestEnd = auditCalcularDistanciaMetros(rt.end_lat, rt.end_lon, firstDestLat, firstDestLon);
        if (distToDestEnd < 500) {
          sum += rt.dist_km;
        }
        var distToDestStart = auditCalcularDistanciaMetros(rt.start_lat, rt.start_lon, firstDestLat, firstDestLon);
        var distToEndOffice = auditCalcularDistanciaMetros(rt.end_lat, rt.end_lon, 20.618933, -100.407993);
        if (distToDestStart < 500 && distToEndOffice < 500) {
          sum += rt.dist_km;
        }
      }
      if (sum > 0) return Number(sum.toFixed(2));
    }
    
    var total = 0;
    for (var r = 0; r < routes.length; r++) {
      total += routes[r].dist_km;
    }
    return Number(total.toFixed(2));
  }
  
  for (var r = 0; r < routes.length; r++) {
    var rt = routes[r];
    var startsAtProject = rt.start_lat && rt.start_lon && (auditCalcularDistanciaMetros(rt.start_lat, rt.start_lon, projectGeo.lat, projectGeo.lon) <= projectGeo.radio);
    var endsAtProject = rt.end_lat && rt.end_lon && (auditCalcularDistanciaMetros(rt.end_lat, rt.end_lon, projectGeo.lat, projectGeo.lon) <= projectGeo.radio);
    
    if (startsAtProject || endsAtProject) {
      sum += rt.dist_km;
    }
  }
  return Number(sum.toFixed(2));
}

/**
 * Calcula las métricas acumuladas de un bloque de segmentos.
 */
function auditCalcularMetricasDeBloque(blockRoutes, geocercas, targetProjectsNorm, directTransitions) {
  var totalKm = 0.0;
  var totalDurationSec = 0;
  var totalStops = 0;
  var totalStopsSec = 0;
  
  var firstArrival = '';
  var lastDeparture = '';
  
  for (var r = 0; r < blockRoutes.length; r++) {
    var rt = blockRoutes[r];
    var isSplit = false;
    if (directTransitions && directTransitions[rt.id]) {
      isSplit = true;
    }
    totalKm += isSplit ? (rt.dist_km / 2.0) : rt.dist_km;
    totalDurationSec += isSplit ? (rt.dur_mov_min * 30.0) : (rt.dur_mov_min * 60.0);
    
    totalStops += rt.paradas.length;
    for (var s = 0; s < rt.paradas.length; s++) {
      totalStopsSec += (rt.paradas[s].dur_min * 60);
    }
    
    // HORA LLEG PROY: Hora de llegada al primer proyecto real del bloque (exacta sin redondeo)
    if (rt.end_lat && rt.end_lon && !firstArrival) {
      var destGeo = auditObtenerGeocercaDetectada(rt.end_lat, rt.end_lon, geocercas, targetProjectsNorm);
      if (destGeo && destGeo !== 'SMARTCORP') {
        var geoDest = auditBuscarGeocercaPorId(geocercas, destGeo);
        if (geoDest && auditExisteCoincidenciaEnProyectos(geoDest, targetProjectsNorm)) {
          firstArrival = formatTimeOnly(rt.end_time);
        }
      }
    }
    
    // HORA SAL PROY: Hora de salida del último proyecto real del bloque (exacta sin redondeo)
    if (rt.start_lat && rt.start_lon) {
      var startGeo = auditObtenerGeocercaDetectada(rt.start_lat, rt.start_lon, geocercas, targetProjectsNorm);
      if (startGeo && startGeo !== 'SMARTCORP') {
        var geoStart = auditBuscarGeocercaPorId(geocercas, startGeo);
        if (geoStart && auditExisteCoincidenciaEnProyectos(geoStart, targetProjectsNorm)) {
          lastDeparture = formatTimeOnly(rt.start_time);
        }
      }
    }
  }
  
  // Fallbacks para HORA LLEG PROY / HORA SAL PROY si las coordenadas quedaron ligeramente fuera de la geocerca
  if (blockRoutes.length > 0) {
    var officeLat = 20.618933;
    var officeLon = -100.407993;
    for (var idxGeo = 0; idxGeo < geocercas.length; idxGeo++) {
      if (geocercas[idxGeo].id === 'SMARTCORP') {
        officeLat = geocercas[idxGeo].lat;
        officeLon = geocercas[idxGeo].lon;
        break;
      }
    }
    
    // Fallback HORA SAL PROY: Si el último tramo de este bloque de rutas termina en la oficina (o cerca)
    if (!lastDeparture) {
      var lastRt = blockRoutes[blockRoutes.length - 1];
      var destGeo = auditObtenerGeocercaDetectada(lastRt.end_lat, lastRt.end_lon, geocercas, ['smartcorp']);
      if (destGeo === 'SMARTCORP' || auditCalcularDistanciaMetros(lastRt.end_lat, lastRt.end_lon, officeLat, officeLon) < 150) {
        lastDeparture = formatTimeOnly(lastRt.start_time);
      }
    }
    
    // Fallback HORA LLEG PROY: Si el primer tramo de este bloque comenzó en la oficina (o cerca)
    if (!firstArrival) {
      var firstRt = blockRoutes[0];
      var startGeo = auditObtenerGeocercaDetectada(firstRt.start_lat, firstRt.start_lon, geocercas, ['smartcorp']);
      if (startGeo === 'SMARTCORP' || auditCalcularDistanciaMetros(firstRt.start_lat, firstRt.start_lon, officeLat, officeLon) < 150) {
        firstArrival = formatTimeOnly(firstRt.end_time);
      }
    }
  }
  
  return {
    km: Number(totalKm.toFixed(2)),
    tiempoRecorrido: formatSecToHMS(totalDurationSec),
    tiempoParadas: totalStops > 0 ? formatSecToHMS(totalStopsSec) : '',
    paradas: totalStops > 0 ? totalStops : '',
    horaLlegProy: firstArrival,
    horaSalProy: lastDeparture
  };
}

/**
 * Calcula la hora "A" redondeada al entero más cercano menos 1 hora de comida.
 */
function calculateA(lastEndDt) {
  if (!lastEndDt) return 17; // Default 5 PM
  var hr = lastEndDt.getHours();
  var min = lastEndDt.getMinutes();
  
  var roundedHour = hr + (min >= 30 ? 1 : 0);
  var aVal = roundedHour - 1;
  
  if (aVal < 8) aVal = 8;
  if (aVal > 18) aVal = 17;
  return aVal;
}

/**
 * Parsea un string con fecha y hora a un objeto Date.
 */
function parseTimeJS(val) {
  if (!val) return null;
  if (val instanceof Date) return val;
  var s = String(val).trim();
  
  var parts = s.split(' ');
  if (parts.length >= 2) {
    var dateParts = parts[0].split('/');
    var timeParts = parts[1].split(':');
    if (dateParts.length === 3 && timeParts.length >= 2) {
      var d = parseInt(dateParts[0], 10);
      var m = parseInt(dateParts[1], 10) - 1;
      var y = parseInt(dateParts[2], 10);
      if (y < 100) y += 2000;
      var hr = parseInt(timeParts[0], 10);
      var min = parseInt(timeParts[1], 10);
      var sec = timeParts.length === 3 ? parseInt(timeParts[2], 10) : 0;
      return new Date(y, m, d, hr, min, sec);
    }
  }
  return null;
}

/**
 * Convierte un string de duración a minutos float.
 */
function parseDurationToMinJS(dur_str) {
  if (!dur_str || String(dur_str).trim() === "" || String(dur_str).trim() === "N/A") {
    return 0.0;
  }
  var s = String(dur_str).trim().toLowerCase();
  
  var h = 0, m = 0, sc = 0;
  var matchH = s.match(/(\d+)\s*h/);
  if (matchH) h = parseInt(matchH[1], 10);
  
  var matchM = s.match(/(\d+)\s*min/);
  if (matchM) m = parseInt(matchM[1], 10);
  
  var matchS = s.match(/(\d+)\s*s/);
  if (matchS) sc = parseInt(matchS[1], 10);
  
  if (matchH || matchM || matchS) {
    return h * 60 + m + sc / 60.0;
  }
  
  var parts = s.split(":");
  if (parts.length === 3) {
    try {
      return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10) + parseInt(parts[2], 10) / 60.0;
    } catch(e) {}
  }
  return 0.0;
}

function formatTimeOnly(dt) {
  if (!dt || !(dt instanceof Date)) return '';
  return auditPad2(dt.getHours()) + ':' + auditPad2(dt.getMinutes()) + ':' + auditPad2(dt.getSeconds());
}

function formatSecToHMS(totalSec) {
  var sec = Math.round(totalSec);
  var h = Math.floor(sec / 3600);
  var m = Math.floor((sec % 3600) / 60);
  var s = sec % 60;
  return auditPad2(h) + ':' + auditPad2(m) + ':' + auditPad2(s);
}

function parseTimeToDecimal(val) {
  if (!val) return 0.0;
  if (val instanceof Date) {
    return val.getHours() + val.getMinutes() / 60.0;
  }
  var s = String(val).trim();
  var parts = s.split(':');
  if (parts.length >= 2) {
    var h = parseInt(parts[0], 10);
    var m = parseInt(parts[1], 10);
    if (!isNaN(h) && !isNaN(m)) {
      return h + m / 60.0;
    }
  }
  var num = parseFloat(s);
  return isNaN(num) ? 0.0 : num;
}

function formatDecimalToTime(decimalVal) {
  var h = Math.floor(decimalVal);
  var m = Math.round((decimalVal - h) * 60);
  return auditPad2(h) + ':' + auditPad2(m) + ':00';
}

/**
 * Determina el valor DE redondeado y si califica como salida muy temprana.
 */
function auditCalcularDeRedondeado(firstStartDt) {
  if (!firstStartDt) return { deVal: 8, alerta: false, horaReal: '' };
  
  var decimalHour = firstStartDt.getHours() + firstStartDt.getMinutes() / 60.0;
  
  if (decimalHour < 7.5) {
    // Salida antes de las 07:30 AM -> Capping a 8:00 AM con alerta
    return { deVal: 8, alerta: true, horaReal: formatTimeOnly(firstStartDt) };
  } else if (decimalHour >= 7.5 && decimalHour < 8.0) {
    // Entre 07:30 AM y 08:00 AM -> Redondeo estándar a 8:00 AM limpia
    return { deVal: 8, alerta: false, horaReal: '' };
  } else {
    // A partir de las 08:00 AM -> Redondeo hacia abajo estándar
    return { deVal: firstStartDt.getHours(), alerta: false, horaReal: '' };
  }
}

/**
 * Determina el valor A redondeado y si califica como llegada muy temprana.
 */
function auditCalcularARedondeado(lastEndDt, aHour) {
  if (!lastEndDt) return { aVal: aHour, alerta: false, horaReal: '' };
  
  var decimalHour = lastEndDt.getHours() + lastEndDt.getMinutes() / 60.0;
  
  if (decimalHour < 15.5) {
    // Llegada antes de las 03:30 PM -> Mantener aHour (original) y alertar
    return { aVal: aHour, alerta: true, horaReal: formatTimeOnly(lastEndDt) };
  } else {
    // Llegada normal -> Redondeo estándar de A menos 1h de comida
    return { aVal: calculateA(lastEndDt), alerta: false, horaReal: '' };
  }
}

// ═════════════════════════════════════════════════════════════
//  ALGORITMO GEOCERCAS Y TRAYECTORIAS
// ═════════════════════════════════════════════════════════════

/**
 * Calcula la distancia en metros entre dos coordenadas usando la fórmula Haversine.
 */
function auditCalcularDistanciaMetros(lat1, lon1, lat2, lon2) {
  var R = 6371000; // Radio de la Tierra en metros
  var dLat = (lat2 - lat1) * Math.PI / 180;
  var dLon = (lon2 - lon1) * Math.PI / 180;
  var a = Math.sin(dLat/2) * Math.sin(dLat/2) +
          Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
          Math.sin(dLon/2) * Math.sin(dLon/2);
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

/**
 * Encuentra todas las geocercas que cubren un punto.
 */
function auditDetectarGeocercasCoincidentes(lat, lon, geocercas) {
  var coincidentes = [];
  for (var i = 0; i < geocercas.length; i++) {
    var geo = geocercas[i];
    var dist = auditCalcularDistanciaMetros(lat, lon, geo.lat, geo.lon);
    if (dist <= geo.radio) {
      coincidentes.push({ geo: geo, distancia: dist });
    }
  }
  coincidentes.sort(function(a, b) { return a.distancia - b.distancia; });
  return coincidentes;
}

/**
 * Resuelve y prioriza la geocerca correcta considerando el empalme y la Bitácora.
 */
function auditResolverGeocerca(coincidentes, targetProjectsNorm) {
  if (coincidentes.length === 0) return null;
  if (coincidentes.length === 1) return coincidentes[0].geo.id;
  
  if (targetProjectsNorm && targetProjectsNorm.length > 0) {
    for (var i = 0; i < coincidentes.length; i++) {
      if (auditExisteCoincidenciaEnProyectos(coincidentes[i].geo, targetProjectsNorm)) {
        return coincidentes[i].geo.id;
      }
    }
  }
  return coincidentes[0].geo.id;
}

// ═════════════════════════════════════════════════════════════
//  SOPORTE SPREADSHEET DE CONFIGURACIÓN INDEPENDIENTE
// ═════════════════════════════════════════════════════════════

/**
 * Asegura la existencia del Spreadsheet independiente de configuración en la carpeta raíz.
 */
function auditObtenerSsConfiguracion() {
  var folder = DriveApp.getFolderById(AUDIT_GPS_MAIN_FOLDER_ID);
  var files = folder.getFilesByName(AUDIT_GPS_CONFIG_FILE_NAME);
  var ss;
  
  if (files.hasNext()) {
    ss = SpreadsheetApp.open(files.next());
  } else {
    Logger.log('Creando hoja de configuración independiente...');
    ss = SpreadsheetApp.create(AUDIT_GPS_CONFIG_FILE_NAME);
    var file = DriveApp.getFileById(ss.getId());
    file.moveTo(folder);
  }
  
  var shProyectos = ss.getSheetByName('Proyectos_GPS');
  if (!shProyectos) {
    var sheets = ss.getSheets();
    if (sheets.length === 1 && (sheets[0].getName().indexOf('Hoja') === 0 || sheets[0].getName().indexOf('Sheet') === 0)) {
      shProyectos = sheets[0];
      shProyectos.setName('Proyectos_GPS');
    } else {
      shProyectos = ss.insertSheet('Proyectos_GPS');
    }
    shProyectos.getRange('A1:E1').setValues([[
      'ID_Proyecto', 'Nombre_Proyecto', 'Latitud', 'Longitud', 'Radio_Geocerca_Metros'
    ]]).setFontWeight('bold');
    
    shProyectos.appendRow([
      'SMARTCORP', 'Oficina Principal SMARTCORP', 20.618933132732675, -100.40799342597374, 50
    ]);
  }
  
  var shHistorial = ss.getSheetByName('Historial_GPS');
  if (!shHistorial) {
    shHistorial = ss.insertSheet('Historial_GPS');
    shHistorial.getRange('A1:L1').setValues([[
      'Unidad', 'Fecha', 'Hora_Inicio', 'Lat_Inicio', 'Lon_Inicio', 'Geocerca_Inicio',
      'Hora_Fin', 'Lat_Fin', 'Lon_Fin', 'Geocerca_Fin', 'Distancia_Segmento', 'Duracion_Segmento'
    ]]).setFontWeight('bold');
  }
  
  var shRelacion = ss.getSheetByName('Relacion_Unidades');
  if (!shRelacion) {
    shRelacion = ss.insertSheet('Relacion_Unidades');
    shRelacion.getRange('A1:B1').setValues([[
      'Nombre_GPS', 'Nombre_Bitacora'
    ]]).setFontWeight('bold');
    
    shRelacion.appendRow([
      'SH-U30-Frontier 2', '30 (Frontier 2)'
    ]);
  } else {
    var data = shRelacion.getDataRange().getValues();
    var existe = false;
    for (var i = 1; i < data.length; i++) {
      if (auditNormalizar(data[i][0]) === auditNormalizar('SH-U30-Frontier 2')) {
        existe = true;
        break;
      }
    }
    if (!existe) {
      shRelacion.appendRow([
        'SH-U30-Frontier 2', '30 (Frontier 2)'
      ]);
      Logger.log('Se agrego la equivalencia por defecto para SH-U30-Frontier 2');
    }
  }
  
  var shEspeciales = ss.getSheetByName('Proyectos_Especiales');
  if (!shEspeciales) {
    shEspeciales = ss.insertSheet('Proyectos_Especiales');
    shEspeciales.getRange('A1').setValue('Nombre_Proyecto').setFontWeight('bold');
    shEspeciales.appendRow(['INT QRO MTTO PERSONAL 2605']);
    shEspeciales.appendRow(['SOPORTE CLIENTES']);
  }
  
  return ss;
}

/**
 * Carga la lista de proyectos especiales desde la pestaña "Proyectos_Especiales".
 */
function auditObtenerProyectosEspeciales(ssConfig) {
  var sheet = ssConfig.getSheetByName('Proyectos_Especiales');
  if (!sheet) return {};
  
  var data = sheet.getDataRange().getValues();
  var especiales = {};
  for (var i = 1; i < data.length; i++) {
    var projName = String(data[i][0] || '').trim();
    if (projName) {
      especiales[auditNormalizar(projName)] = true;
    }
  }
  return especiales;
}

/**
 * Carga las equivalencias de unidades desde la pestaña "Relacion_Unidades".
 */
function auditObtenerEquivalenciasUnidades(ssConfig) {
  var sheet = ssConfig.getSheetByName('Relacion_Unidades');
  if (!sheet) return {};
  
  var data = sheet.getDataRange().getValues();
  var equivalencias = {};
  for (var i = 1; i < data.length; i++) {
    var gpsName = String(data[i][0] || '').trim();
    var bitacoraName = String(data[i][1] || '').trim();
    if (gpsName && bitacoraName) {
      equivalencias[auditNormalizar(gpsName)] = bitacoraName;
    }
  }
  return equivalencias;
}

/**
 * Carga geocercas desde el Spreadsheet.
 */
function auditObtenerGeocercas(ssConfig) {
  var sheet = ssConfig.getSheetByName('Proyectos_GPS');
  var data = sheet.getDataRange().getValues();
  var geocercas = [];
  
  for (var i = 1; i < data.length; i++) {
    var id = String(data[i][0] || '').trim();
    var nombre = String(data[i][1] || '').trim();
    var lat = auditParseCoordenada(data[i][2]);
    var lon = auditParseCoordenada(data[i][3]);
    var radio = parseFloat(data[i][4]) || 100;
    
    if (!id || isNaN(lat) || isNaN(lon)) continue;
    
    geocercas.push({
      id: id,
      nombre: nombre,
      lat: lat,
      lon: lon,
      radio: radio
    });
  }
  return geocercas;
}

// ═════════════════════════════════════════════════════════════
//  PARSERS Y NORMALIZADORES AUXILIARES
// ═════════════════════════════════════════════════════════════

/**
 * Parsea coordenadas geográficas limpiando comas decimales e identificando signos.
 */
function auditParseCoordenada(val) {
  if (!val && val !== 0) return NaN;
  if (typeof val === 'number') return val;
  
  var str = String(val).toLowerCase().trim();
  var esNegativo = (str.indexOf('w') !== -1 || str.indexOf('o') !== -1 || str.indexOf('s') !== -1 || str.indexOf('-') !== -1);
  str = str.replace(/,/g, '.');
  str = str.replace(/[^0-9.]/g, '');
  var num = parseFloat(str);
  if (isNaN(num)) return NaN;
  return esNegativo ? -num : num;
}

/**
 * Limpia y parsea la distancia convirtiendo metros (m) a kilómetros (km) si es necesario.
 */
function auditParseDistancia(val) {
  if (!val && val !== 0) return 0;
  var str = String(val).toLowerCase().replace(/,/g, '').trim();
  
  if (str.indexOf('km') !== -1) {
    str = str.replace(/km\.?/g, '').trim();
    var num = parseFloat(str);
    return isNaN(num) ? 0 : num;
  } else if (str.indexOf('m') !== -1) {
    str = str.replace(/m\.?/g, '').trim();
    var num = parseFloat(str);
    return isNaN(num) ? 0 : num / 1000.0;
  } else {
    var num = parseFloat(str);
    return isNaN(num) ? 0 : num;
  }
}

/**
 * Parsea duraciones (tipo "1 h. 31 min. 2 s." o formato tradicional "HH:MM:SS").
 */
function auditParseDuracion(val) {
  if (!val) return '00:00:00';
  var str = String(val).toLowerCase().trim();
  if (/^\d{2}:\d{2}(:\d{2})?$/.test(str)) {
    return str;
  }
  
  var hours = 0;
  var minutes = 0;
  var seconds = 0;
  
  var matchH = str.match(/(\d+)\s*h/);
  if (matchH) hours = parseInt(matchH[1], 10);
  
  var matchM = str.match(/(\d+)\s*min/);
  if (matchM) minutes = parseInt(matchM[1], 10);
  
  var matchS = str.match(/(\d+)\s*s/);
  if (matchS) seconds = parseInt(matchS[1], 10);
  
  return auditPad2(hours) + ':' + auditPad2(minutes) + ':' + auditPad2(seconds);
}

/**
 * Extrae la porción de hora (HH:MM:SS) de un Date o string.
 */
function auditExtractTime(val) {
  if (!val) return '';
  if (val instanceof Date) {
    return auditPad2(val.getHours()) + ':' + auditPad2(val.getMinutes()) + ':' + auditPad2(val.getSeconds());
  }
  var str = String(val).trim();
  var partesEspacio = str.split(' ');
  if (partesEspacio.length >= 2) {
    var horaPart = partesEspacio[1];
    if (/^\d{2}:\d{2}(:\d{2})?$/.test(horaPart)) return horaPart;
  }
  if (/^\d{2}:\d{2}(:\d{2})?$/.test(str)) return str;
  return '';
}

function auditPad2(n) {
  return n < 10 ? '0' + n : String(n);
}

function auditNormalizar(text) {
  if (!text && text !== 0) return '';
  return String(text).toLowerCase().trim().replace(/[\u200b\u200c\u200d\ufeff]/g, '').replace(/\s+/g, ' ');
}

/**
 * Compara una geocerca con un nombre de proyecto de la Bitácora de forma flexible (fuzzy matching).
 */
function auditCoincideGeocercaConProyecto(geo, projNorm) {
  if (!geo || !projNorm) return false;
  
  var geoIdNorm = auditNormalizar(geo.id);
  var geoNombreNorm = auditNormalizar(geo.nombre);
  var projNormClean = auditNormalizar(projNorm);
  
  // 1. Coincidencia exacta
  if (geoIdNorm === projNormClean || geoNombreNorm === projNormClean) return true;
  
  // Excluir la oficina SMARTCORP de coincidencias parciales con otros proyectos
  if (geoIdNorm === 'smartcorp' || geoNombreNorm === 'smartcorp') {
    return (projNormClean === 'smartcorp' || projNormClean === 'oficina');
  }
  
  // 2. Coincidencia parcial (subcadena)
  if (geoIdNorm.length >= 3 && projNormClean.indexOf(geoIdNorm) !== -1) return true;
  if (geoNombreNorm.length >= 3 && projNormClean.indexOf(geoNombreNorm) !== -1) return true;
  
  if (projNormClean.length >= 3 && geoIdNorm.indexOf(projNormClean) !== -1) return true;
  if (projNormClean.length >= 3 && geoNombreNorm.indexOf(projNormClean) !== -1) return true;
  
  return false;
}

/**
 * Verifica si una geocerca coincide con alguno de los proyectos de una lista.
 */
function auditExisteCoincidenciaEnProyectos(geo, targetProjectsNorm) {
  if (!targetProjectsNorm || targetProjectsNorm.length === 0) return false;
  for (var i = 0; i < targetProjectsNorm.length; i++) {
    if (auditCoincideGeocercaConProyecto(geo, targetProjectsNorm[i])) {
      return true;
    }
  }
  return false;
}

/**
 * Busca una geocerca en la lista por su ID.
 */
function auditBuscarGeocercaPorId(geocercas, id) {
  if (!geocercas || !id) return null;
  for (var i = 0; i < geocercas.length; i++) {
    if (geocercas[i].id === id) return geocercas[i];
  }
  return null;
}

function auditFormatDate(d) {
  if (!d) return '';
  if (d instanceof Date) {
    return auditPad2(d.getDate()) + '/' + auditPad2(d.getMonth() + 1) + '/' + d.getFullYear();
  }
  var s = String(d).trim();
  var parts = s.split(' ');
  if (parts.length > 0) {
    var dateParts = parts[0].split('/');
    if (dateParts.length === 3) {
      var day = parseInt(dateParts[0], 10);
      var month = parseInt(dateParts[1], 10);
      var year = parseInt(dateParts[2], 10);
      if (year < 100) year += 2000;
      return auditPad2(day) + '/' + auditPad2(month) + '/' + year;
    }
  }
  return '';
}

/**
 * Busca y prioriza la geocerca correcta considerando coincidencia exacta y proximidad de 1000m.
 */
function auditObtenerGeocercaDetectada(lat, lon, geocercas, targetProjectsNorm) {
  if (!lat || !lon) return null;
  
  // 1. Coincidencia directa con radio estándar de geocerca
  var coincidentes = auditDetectarGeocercasCoincidentes(lat, lon, geocercas);
  if (coincidentes.length > 0) {
    return auditResolverGeocerca(coincidentes, targetProjectsNorm);
  }
  
  // 2. Proximidad Inteligente (1000m) para el proyecto en la Bitácora
  if (targetProjectsNorm && targetProjectsNorm.length > 0) {
    for (var i = 0; i < geocercas.length; i++) {
      var geo = geocercas[i];
      if (geo.id === 'SMARTCORP') continue;
      
      if (auditExisteCoincidenciaEnProyectos(geo, targetProjectsNorm)) {
        var dist = auditCalcularDistanciaMetros(lat, lon, geo.lat, geo.lon);
        if (dist <= 1000) {
          Logger.log('PROXIMIDAD INTELIGENTE (1000m): Asociando tramo a ' + geo.id + ' (Distancia: ' + Math.round(dist) + 'm)');
          return geo.id;
        }
      }
    }
  }
  
  return null;
}

/**
 * Redondea un decimal de hora hacia arriba al intervalo de 15 minutos más cercano.
 */
function auditRedondear15MinArriba(decimalHour) {
  return Math.ceil(decimalHour * 4) / 4;
}

/**
 * Convierte un decimal de hora a string "HH:MM:SS" redondeado a 15 minutos hacia arriba.
 */
function formatDecimalToTime15Min(decimalVal) {
  var rounded = auditRedondear15MinArriba(decimalVal);
  var h = Math.floor(rounded);
  var m = Math.round((rounded - h) * 60);
  if (h >= 24) h = h % 24;
  return auditPad2(h) + ':' + auditPad2(m) + ':00';
}

/**
 * Busca la geocerca de proyecto registrada más cercana excluyendo la Oficina SMARTCORP.
 */
function auditObtenerGeocercaMasCercanaExcluyendoOficina(lat, lon, geocercas) {
  if (!lat || !lon) return "N/A";
  var minDistance = Infinity;
  var closestGeo = null;
  
  for (var i = 0; i < geocercas.length; i++) {
    var geo = geocercas[i];
    if (geo.id === 'SMARTCORP') continue; // Excluir oficina
    var dist = auditCalcularDistanciaMetros(lat, lon, geo.lat, geo.lon);
    if (dist < minDistance) {
      minDistance = dist;
      closestGeo = geo;
    }
  }
  
  if (!closestGeo) return "Ninguna geocerca registrada";
  return closestGeo.nombre + " (" + Math.round(minDistance) + " m)";
}

/**
 * Detecta paradas > 90 min en ubicaciones desconocidas o proyectos no registrados y las inserta al final de la Bitácora.
 */
function auditDetectarEInsertarParadasProlongadas(dayRoutes, geocercas, unidadBitacora, dateStr, targetProjectsNorm, shBitacora, techName, techSap, techRol) {
  var rowsInserted = 0;
  
  for (var r = 0; r < dayRoutes.length; r++) {
    var rt = dayRoutes[r];
    if (!rt.paradas || rt.paradas.length === 0) continue;
    
    for (var pIdx = 0; pIdx < rt.paradas.length; pIdx++) {
      var p = rt.paradas[pIdx];
      if (p.dur_min > 90.0) {
        // 1. Resolver geocerca del destino del tramo
        var stopGeoId = auditObtenerGeocercaDetectada(rt.end_lat, rt.end_lon, geocercas, targetProjectsNorm);
        
        // Si no se detecta ninguna geocerca, o es diferente a los proyectos planeados
        // y no es la oficina SMARTCORP
        var isOffice = false;
        var directGeo = auditDetectarGeocercasCoincidentes(rt.end_lat, rt.end_lon, geocercas);
        if (directGeo.length > 0 && directGeo[0].geo.id === 'SMARTCORP') {
          isOffice = true;
        }
        
        if (isOffice) continue; // No reportar paradas en la oficina
        
        var isRegistered = false;
        if (stopGeoId) {
          var geoStop = auditBuscarGeocercaPorId(geocercas, stopGeoId);
          if (geoStop && auditExisteCoincidenciaEnProyectos(geoStop, targetProjectsNorm)) {
            isRegistered = true;
          }
        }
        
        if (!isRegistered) {
          Logger.log('PARADA PROLONGADA DETECTADA: Unidad ' + unidadBitacora + ' en ' + dateStr + ' estuvo ' + p.dur_min.toFixed(1) + ' min en geocerca ' + (stopGeoId || 'Desconocida'));
          
          var lastRow = shBitacora.getLastRow();
          var newRowNum = lastRow + 1;
          
          shBitacora.insertRowAfter(lastRow);
          
          var templateRange = shBitacora.getRange(lastRow, 1, 1, shBitacora.getLastColumn());
          var newRowRange = shBitacora.getRange(newRowNum, 1, 1, shBitacora.getLastColumn());
          templateRange.copyTo(newRowRange);
          
          var newRowValues = newRowRange.getValues()[0];
          var templateRowFormulas = newRowRange.getFormulas()[0];
          
          // Limpiar valores no esenciales para evitar duplicar datos fijos de la fila plantilla
          for (var c = 0; c < newRowValues.length; c++) {
            if (templateRowFormulas[c] === "") {
              newRowValues[c] = "";
            }
          }
          
          newRowValues[1] = techSap; // SAP
          newRowValues[AUDIT_COL_BIT_FECHA] = dateStr;
          
          var projName = "PROYECTO NO REGISTRADO";
          if (stopGeoId) {
            for (var g = 0; g < geocercas.length; g++) {
              if (geocercas[g].id === stopGeoId) {
                projName = geocercas[g].nombre || geocercas[g].id;
                break;
              }
            }
          }
          newRowValues[AUDIT_COL_BIT_PROYECTO] = projName;
          newRowValues[AUDIT_COL_BIT_NOMBRE] = techName;
          newRowValues[5] = techRol; // Rol
          newRowValues[6] = ""; // DE
          newRowValues[7] = ""; // A
          newRowValues[AUDIT_COL_BIT_UNIDAD] = unidadBitacora;
          newRowValues[AUDIT_COL_BIT_ASUNTO] = "Proyecto instalación";
          newRowValues[14] = "REVISAR"; // REV
          newRowValues[21] = "[GPS] Fila agregada automáticamente: Permanencia de " + Math.round(p.dur_min) + " minutos en ubicación no registrada."; // OBSERVACIONES
          
          newRowValues[AUDIT_COL_BIT_HORA_SALIDA] = formatTimeOnly(rt.start_time);
          newRowValues[AUDIT_COL_BIT_HORA_ENTRADA] = formatTimeOnly(rt.end_time);
          newRowValues[AUDIT_COL_BIT_TIEMPO_RECORRIDO] = rt.dur_mov_raw || "00:00:00";
          newRowValues[18] = p.dur_raw || ""; // TIEMPO DE PARADAS (col S)
          newRowValues[AUDIT_COL_BIT_PARADAS] = 1; // PARADAS
          newRowValues[20] = ""; // REGRESOS (col U)
          newRowValues[AUDIT_COL_BIT_KM] = rt.dist_km; // KM
          
          // Horarios exactos de GPS satelital sin redondeos
          newRowValues[AUDIT_COL_BIT_HORA_LLEG_PROY] = formatTimeOnly(rt.end_time);
          newRowValues[AUDIT_COL_BIT_HORA_SAL_PROY] = formatTimeOnly(p.end_time);
          
          // Re-escribir fórmulas de la fila
          for (var c = 0; c < newRowValues.length; c++) {
            if (templateRowFormulas[c] !== "") {
              newRowValues[c] = templateRowFormulas[c];
            }
          }
          
          newRowRange.setValues([newRowValues]);
          rowsInserted++;
        }
      }
    }
  }
  
  return rowsInserted;
}

/**
 * Calcula regresos reales al mismo proyecto con retorno intermedio a la oficina.
 */
function auditCalcularRegresosDeProyecto(routes, geocercas, projNorm, officeLat, officeLon) {
  var seq = ['smartcorp'];
  for (var r = 0; r < routes.length; r++) {
    var rt = routes[r];
    
    var startGeoId = auditObtenerGeocercaDetectada(rt.start_lat, rt.start_lon, geocercas, [projNorm]);
    if (startGeoId) {
      var geo = auditBuscarGeocercaPorId(geocercas, startGeoId);
      if (geo) {
        var name = auditNormalizar(geo.id);
        var last = seq[seq.length - 1];
        if (name === 'smartcorp') {
          if (last !== 'smartcorp') seq.push('smartcorp');
        } else if (auditCoincideGeocercaConProyecto(geo, projNorm)) {
          if (last !== 'proyecto') seq.push('proyecto');
        }
      }
    }
    
    var endGeoId = auditObtenerGeocercaDetectada(rt.end_lat, rt.end_lon, geocercas, [projNorm]);
    if (endGeoId) {
      var geo = auditBuscarGeocercaPorId(geocercas, endGeoId);
      if (geo) {
        var name = auditNormalizar(geo.id);
        var last = seq[seq.length - 1];
        if (name === 'smartcorp') {
          if (last !== 'smartcorp') seq.push('smartcorp');
        } else if (auditCoincideGeocercaConProyecto(geo, projNorm)) {
          if (last !== 'proyecto') seq.push('proyecto');
        }
      }
    }
  }
  
  var visits = 0;
  for (var i = 0; i < seq.length; i++) {
    if (seq[i] === 'proyecto') {
      visits++;
    }
  }
  return visits > 1 ? (visits - 1) : 0;
}

// =========================================================================
//  NUEVAS FUNCIONES PARA PROCESAMIENTO GLOBAL E INSERCIÓN DINÁMICA (v3.5.0)
// =========================================================================

/**
 * Procesa globalmente una fecha en la hoja destino especificada.
 * Agrupa las filas por técnico, asocia las rutas correspondientes a cada fila según su columna UNIDAD,
 * calcula transiciones (incluyendo cambios de unidad), e inserta filas administrativas si se cumplen
 * los umbrales de 1.5 horas para inicio tardío o regreso temprano.
 */
function auditProcesarFechaGlobal(sheet, dateUnitsData, geocercas, officeLat, officeLon, dateStr, mapaEquivalencias, especiales, isPrueba) {
  Logger.log('=== [LOG] Iniciando auditProcesarFechaGlobal para fecha: ' + dateStr + ' ===');
  
  // Tracker para agrupar filas SMARTHAUS en bloques (no intercaladas)
  var adminTracker = { startNextRow: null, endNextRow: null };
  
  // Flaggear filas con UNIDAD = "NA" y ASUNTO = "Proyecto instalación" para esta fecha
  var dataTemp = sheet.getDataRange().getValues();
  for (var b = 1; b < dataTemp.length; b++) {
    var fFechaRaw = dataTemp[b][AUDIT_COL_BIT_FECHA];
    if (!fFechaRaw) continue;
    var fFecha = auditFormatDate(fFechaRaw);
    if (fFecha === dateStr) {
      var fUnidad = String(dataTemp[b][AUDIT_COL_BIT_UNIDAD] || '').trim();
      var fAsunto = String(dataTemp[b][AUDIT_COL_BIT_ASUNTO] || '').trim();
      if (fUnidad.toUpperCase() === 'NA' && fAsunto.toLowerCase() === 'proyecto instalación') {
        var rowNum = b + 1;
        var currentRev = String(dataTemp[b][14] || '').trim();
        if (currentRev !== 'REVISAR') {
          var prevObs = String(dataTemp[b][21] || '').trim();
          var warning = "[GPS] REVISAR: Esta partida no tiene unidad asignada.";
          var newObs = prevObs ? prevObs + " | " + warning : warning;
          sheet.getRange(rowNum, 15).setValue('REVISAR');
          sheet.getRange(rowNum, 22).setValue(newObs);
          Logger.log('[LOG] Fila ' + rowNum + ' marcada como REVISAR por UNIDAD = NA en proyecto de instalación.');
        }
      }
    }
  }
  
  // Recargar los datos de la hoja destino en un bucle dinámico para procesar técnico por técnico
  var processedTechs = {};
  var continueLoop = true;
  var safetyCounter = 0;
  
  while (continueLoop && safetyCounter < 150) {
    safetyCounter++;
    var currentData = sheet.getDataRange().getValues();
    
    // Buscar el siguiente técnico no procesado para esta fecha
    var activeTechName = null;
    for (var b = 1; b < currentData.length; b++) {
      var fFechaRaw = currentData[b][AUDIT_COL_BIT_FECHA];
      if (!fFechaRaw) continue;
      var fFecha = auditFormatDate(fFechaRaw);
      if (fFecha !== dateStr) continue;
      
      var fNombre = String(currentData[b][AUDIT_COL_BIT_NOMBRE] || '').trim();
      if (fNombre && !processedTechs[fNombre]) {
        activeTechName = fNombre;
        break;
      }
    }
    
    if (activeTechName === null) {
      Logger.log('[LOG] Todos los técnicos para la fecha ' + dateStr + ' han sido procesados.');
      continueLoop = false;
      break;
    }
    
    // Agrupar filas del técnico activo en la fecha actual
    var techRows = [];
    for (var b = 1; b < currentData.length; b++) {
      var fFechaRaw = currentData[b][AUDIT_COL_BIT_FECHA];
      if (!fFechaRaw) continue;
      var fFecha = auditFormatDate(fFechaRaw);
      if (fFecha !== dateStr) continue;
      
      var fNombre = String(currentData[b][AUDIT_COL_BIT_NOMBRE] || '').trim();
      if (fNombre === activeTechName) {
        techRows.push({
          index: b, // 0-based
          proyecto: String(currentData[b][AUDIT_COL_BIT_PROYECTO] || ''),
          nombre: fNombre,
          asunto: String(currentData[b][AUDIT_COL_BIT_ASUNTO] || '').trim(),
          unidad: String(currentData[b][AUDIT_COL_BIT_UNIDAD] || '').trim(),
          deOriginal: currentData[b][AUDIT_COL_BIT_DE],
          aOriginal: currentData[b][AUDIT_COL_BIT_A]
        });
      }
    }
    
    Logger.log('[LOG] Procesando técnico activo: ' + activeTechName + ' con ' + techRows.length + ' filas en Bitácora.');
    
    // Llamar al procesador individual del día del técnico
    auditProcesarDiaTecnico(sheet, techRows, dateUnitsData, geocercas, officeLat, officeLon, dateStr, mapaEquivalencias, especiales, isPrueba, adminTracker);
    
    processedTechs[activeTechName] = true;
  }
}

/**
 * Procesa la jornada de un técnico individual para una fecha determinada.
 */
function auditProcesarDiaTecnico(sheet, techRows, dateUnitsData, geocercas, officeLat, officeLon, dateStr, mapaEquivalencias, especiales, isPrueba, adminTracker) {
  if (!adminTracker) adminTracker = { startNextRow: null, endNextRow: null };
  // Crear un mapa inverso: Nombre de Bitácora (ej. "02 (March 1)") -> Nombre de dispositivo GPS (ej. "sh-u02-march 1")
  var reverseMap = {};
  for (var gpsKey in mapaEquivalencias) {
    var bitacoraVal = mapaEquivalencias[gpsKey];
    reverseMap[auditNormalizar(bitacoraVal)] = gpsKey;
  }
  
  // [DIAG] Log de diagnóstico: claves disponibles en GPS cargado y en mapa inverso
  var dateUnitsKeys = dateUnitsData ? Object.keys(dateUnitsData) : [];
  var reverseMapKeys = Object.keys(reverseMap);
  Logger.log('[DIAG] Claves GPS cargadas para ' + dateStr + ': ' + JSON.stringify(dateUnitsKeys));
  Logger.log('[DIAG] Claves del reverseMap (Bitacora->GPS): ' + JSON.stringify(reverseMapKeys));
  
  // 1. Filtrar filas de instalación con unidad asignada QUE TENGAN TELEMETRÍA CARGADA
  var gpsRows = [];
  for (var i = 0; i < techRows.length; i++) {
    var row = techRows[i];
    var asuntoNorm = row.asunto.toLowerCase();
    var unidadNorm = auditNormalizar(row.unidad);
    
    if (asuntoNorm === 'proyecto instalación' && unidadNorm !== 'na' && unidadNorm !== '') {
      var translatedUnit = reverseMap[unidadNorm] || row.unidad;
      var normTranslatedUnit = auditNormalizar(translatedUnit);
      
      Logger.log('[DIAG] Fila ' + (row.index + 1) + ' | unidad bitacora norm: "' + unidadNorm + '" | GPS key buscada: "' + normTranslatedUnit + '" | En dateUnitsData: ' + (dateUnitsData && dateUnitsData[normTranslatedUnit] ? 'SI (' + dateUnitsData[normTranslatedUnit].length + ' rutas)' : 'NO'));
      
      // Validamos si tenemos telemetría de GPS cargada para este vehículo
      if (dateUnitsData && dateUnitsData[normTranslatedUnit]) {
        Logger.log('[LOG] COINCIDENCIA ENCONTRADA: ' + dateUnitsData[normTranslatedUnit].length + ' rutas para "' + normTranslatedUnit + '".');
        gpsRows.push(row);
      } else {
        Logger.log('[LOG] Sin telemetria para unidad "' + normTranslatedUnit + '" (bitacora: "' + row.unidad + '") en fecha ' + dateStr + '. Se omite la fila.');
      }
    }
  }
  
  if (gpsRows.length === 0) {
    Logger.log('[LOG] El técnico ' + techRows[0].nombre + ' no tiene proyectos de instalación con telemetría de GPS cargada para esta fecha.');
    return;
  }
  
  // 2. Cargar telemetría para cada fila de instalación seleccionada
  for (var i = 0; i < gpsRows.length; i++) {
    var row = gpsRows[i];
    var translatedUnit = reverseMap[auditNormalizar(row.unidad)] || row.unidad;
    var normTranslatedUnit = auditNormalizar(translatedUnit);
    var routes = dateUnitsData ? (dateUnitsData[normTranslatedUnit] || []) : [];
    row.routes = routes;
    row.normTranslatedUnit = normTranslatedUnit;
  }
  
  // 3. Estimar primer toque de geocerca (o inicio de viaje)
  for (var i = 0; i < gpsRows.length; i++) {
    var row = gpsRows[i];
    var projNorm = auditNormalizar(row.proyecto);
    var firstTouch = null;
    for (var r = 0; r < row.routes.length; r++) {
      var rt = row.routes[r];
      var startGeoId = auditObtenerGeocercaDetectada(rt.start_lat, rt.start_lon, geocercas, [projNorm]);
      var destGeoId = auditObtenerGeocercaDetectada(rt.end_lat, rt.end_lon, geocercas, [projNorm]);
      var touches = false;
      if (startGeoId && auditCoincideGeocercaConProyecto(auditBuscarGeocercaPorId(geocercas, startGeoId), projNorm)) touches = true;
      if (destGeoId && auditCoincideGeocercaConProyecto(auditBuscarGeocercaPorId(geocercas, destGeoId), projNorm)) touches = true;
      if (touches) {
        firstTouch = rt.start_time;
        break;
      }
    }
    if (!firstTouch && row.routes.length > 0) {
      firstTouch = row.routes[0].start_time;
    }
    row._firstTouchDt = firstTouch;
  }
  
  // Ordenar cronológicamente por primer toque
  gpsRows.sort(function(a, b) {
    if (!a._firstTouchDt) return 1;
    if (!b._firstTouchDt) return -1;
    return a._firstTouchDt.getTime() - b._firstTouchDt.getTime();
  });
  
  // Inicializar límites de boundaries para cada fila
  for (var i = 0; i < gpsRows.length; i++) {
    gpsRows[i]._boundaryStart = 0.0;
    gpsRows[i]._boundaryEnd = 24.0;
  }
  
  // 4. Calcular transiciones entre filas adyacentes
  for (var i = 0; i < gpsRows.length - 1; i++) {
    var rowPrev = gpsRows[i];
    var rowCurr = gpsRows[i+1];
    
    if (rowPrev.normTranslatedUnit !== rowCurr.normTranslatedUnit) {
      // Cambio de unidad (Caso 1)
      var tReturn = auditBuscarHoraRegresoOficina(rowPrev.routes, geocercas, auditNormalizar(rowPrev.proyecto), officeLat, officeLon);
      var tDepart = auditBuscarHoraSalidaOficina(rowCurr.routes, geocercas, auditNormalizar(rowCurr.proyecto), officeLat, officeLon);
      
      if (tReturn && tDepart) {
        var decReturn = tReturn.getHours() + tReturn.getMinutes() / 60.0;
        var decDepart = tDepart.getHours() + tDepart.getMinutes() / 60.0;
        var decMid = (decReturn + decDepart) / 2.0;
        var decBoundary = Math.ceil(decMid * 4) / 4.0; // redondeado al siguiente múltiplo de 15 min (0.25)
        
        rowPrev._boundaryEnd = decBoundary;
        rowCurr._boundaryStart = decBoundary;
        Logger.log('[LOG] Cambio de unidad detectado para ' + rowPrev.nombre + ': ' + rowPrev.unidad + ' -> ' + rowCurr.unidad + '. Límite calculado: ' + decBoundary);
      } else {
        var decBoundary = 12.0; // 12:00 PM fallback
        rowPrev._boundaryEnd = decBoundary;
        rowCurr._boundaryStart = decBoundary;
        Logger.log('[LOG] Cambio de unidad detectado pero sin retornos de oficina. Usando fallback límite: 12:00 PM');
      }
    } else {
      // Misma unidad: buscar si hubo retorno intermedio a la oficina
      var routes = rowPrev.routes;
      var projNormPrev = auditNormalizar(rowPrev.proyecto);
      var projNormCurr = auditNormalizar(rowCurr.proyecto);
      
      var splitTime = null;
      for (var r = 0; r < routes.length - 1; r++) {
        var rt = routes[r];
        if (rt.end_lat && rt.end_lon && rt.end_time) {
          var distToOffice = auditCalcularDistanciaMetros(rt.end_lat, rt.end_lon, officeLat, officeLon);
          if (distToOffice < 500) {
            var hour = rt.end_time.getHours() + rt.end_time.getMinutes()/60.0;
            if (hour >= 11.5 && hour <= 13.5) {
              splitTime = new Date(rt.end_time.getTime());
              break;
            }
          }
        }
      }
      
      if (splitTime !== null) {
        var decSplit = splitTime.getHours() + splitTime.getMinutes() / 60.0;
        var decBoundary = Math.ceil(decSplit * 4) / 4.0;
        rowPrev._boundaryEnd = decBoundary;
        rowCurr._boundaryStart = decBoundary;
        Logger.log('[LOG] Retorno de mediodía detectado para ' + rowPrev.nombre + '. Límite de corte: ' + decBoundary);
      } else {
        // Transición directa
        var tLeave = null;
        var tArrive = null;
        
        for (var r = routes.length - 1; r >= 0; r--) {
          var rt = routes[r];
          var destGeoId = auditObtenerGeocercaDetectada(rt.end_lat, rt.end_lon, geocercas, [projNormPrev]);
          if (destGeoId && auditCoincideGeocercaConProyecto(auditBuscarGeocercaPorId(geocercas, destGeoId), projNormPrev)) {
            tLeave = rt.end_time;
            break;
          }
        }
        for (var r = 0; r < routes.length; r++) {
          var rt = routes[r];
          var startGeoId = auditObtenerGeocercaDetectada(rt.start_lat, rt.start_lon, geocercas, [projNormCurr]);
          if (startGeoId && auditCoincideGeocercaConProyecto(auditBuscarGeocercaPorId(geocercas, startGeoId), projNormCurr)) {
            tArrive = rt.start_time;
            break;
          }
        }
        
        if (tLeave && tArrive) {
          var decLeave = tLeave.getHours() + tLeave.getMinutes() / 60.0;
          var decArrive = tArrive.getHours() + tArrive.getMinutes() / 60.0;
          var decMid = (decLeave + decArrive) / 2.0;
          var decBoundary = Math.ceil(decMid * 4) / 4.0;
          rowPrev._boundaryEnd = decBoundary;
          rowCurr._boundaryStart = decBoundary;
          Logger.log('[LOG] Transición directa entre proyectos para ' + rowPrev.nombre + '. Límite: ' + decBoundary);
        } else {
          var decBoundary = 12.5; // 12:30 PM fallback
          rowPrev._boundaryEnd = decBoundary;
          rowCurr._boundaryStart = decBoundary;
        }
      }
    }
  }
  
  // 5. Filtrar las rutas de cada fila según sus límites
  for (var i = 0; i < gpsRows.length; i++) {
    var row = gpsRows[i];
    var boundStart = row._boundaryStart;
    var boundEnd = row._boundaryEnd;
    
    var beforeLen = row.routes.length;
    row.routes = row.routes.filter(function(rt) {
      var rtStartDec = rt.start_time.getHours() + rt.start_time.getMinutes() / 60.0;
      return (rtStartDec >= boundStart && rtStartDec < boundEnd);
    });
    Logger.log('[LOG] Filtrado de rutas para ' + row.nombre + ' (' + row.proyecto + '): ' + beforeLen + ' -> ' + row.routes.length + ' rutas en límite [' + boundStart + ', ' + boundEnd + '].');
  }
  
  // 6. Asignar T_de y T_a iniciales para cada fila basándonos en sus rutas filtradas
  for (var i = 0; i < gpsRows.length; i++) {
    var row = gpsRows[i];
    var isFirst = (i === 0);
    var isLast = (i === gpsRows.length - 1);
    
    var firstStart = null;
    var lastEnd = null;
    for (var r = 0; r < row.routes.length; r++) {
      var rt = row.routes[r];
      if (rt.start_time && (firstStart === null || rt.start_time < firstStart)) {
        firstStart = rt.start_time;
      }
      if (rt.end_time && (lastEnd === null || rt.end_time > lastEnd)) {
        lastEnd = rt.end_time;
      }
    }
    
    var deDec = 8.0;
    var aDec = 17.0;
    
    if (firstStart) {
      var firstStartDec = firstStart.getHours() + firstStart.getMinutes() / 60.0;
      if (isFirst) {
        if (firstStartDec < 8.5) {
          deDec = 8.0;
        } else {
          deDec = Math.ceil(firstStartDec * 4) / 4.0;
        }
      } else {
        deDec = row._boundaryStart;
      }
    } else {
      deDec = isFirst ? 8.0 : row._boundaryStart;
    }
    
    if (lastEnd) {
      var lastEndDec = lastEnd.getHours() + lastEnd.getMinutes() / 60.0;
      if (isLast) {
        if (lastEndDec > 15.5) {
          aDec = 17.0;
        } else {
          aDec = Math.ceil(lastEndDec * 4) / 4.0;
        }
      } else {
        aDec = row._boundaryEnd;
      }
    } else {
      aDec = isLast ? 17.0 : row._boundaryEnd;
    }
    
    row.T_de = deDec;
    row.T_a = aDec;
  }
  
  // --- INSERCIÓN DINÁMICA DE FILAS ADMINISTRATIVAS ---
  
  // Caso 2: Oficina al inicio (Brecha >= 1.5 horas)
  var firstRow = gpsRows[0];
  if (firstRow.T_de - 8.0 >= 1.5) {
    var hasOfficeStart = false;
    for (var j = 0; j < techRows.length; j++) {
      var tr = techRows[j];
      var trProjNorm = auditNormalizar(tr.proyecto);
      if ((trProjNorm === 'smarthaus gastos' || trProjNorm === 'oficina') && tr.deOriginal !== undefined && tr.deOriginal !== null && String(tr.deOriginal).trim() !== "") {
        var decDe = parseTimeToDecimal(tr.deOriginal);
        if (decDe <= 8.5) {
          hasOfficeStart = true;
          break;
        }
      }
    }
    
    if (!hasOfficeStart) {
      var strA = formatDecimalToTime15Min(firstRow.T_de);
      // Agrupamiento en bloque: insertar junto a las SMARTHAUS previas del mismo periodo
      var insertSheetRow;
      if (adminTracker.startNextRow === null) {
        // Primera insercion de inicio tardio: ancla el bloque antes del primer proyecto
        insertSheetRow = firstRow.index + 1; // 1-based
        adminTracker.startNextRow = insertSheetRow + 1;
      } else {
        // Inserciones siguientes: apilar justo despues de la ultima SMARTHAUS de inicio
        insertSheetRow = adminTracker.startNextRow;
        adminTracker.startNextRow++;
      }
      Logger.log('[LOG] Brecha detectada al inicio para ' + firstRow.nombre + ' (' + (firstRow.T_de - 8.0) + ' hrs). Insertando oficina en renglon ' + insertSheetRow + '.');
      auditInsertarFilaAdministrativa(
        sheet,
        insertSheetRow,
        dateStr,
        firstRow.nombre,
        "SMARTHAUS GASTOS",
        "08:00",
        strA,
        "Oficina",
        "NA",
        "[GPS] Fila administrativa autogenerada por inicio tardio (08:00 a " + strA + ")"
      );
      for (var g = 0; g < gpsRows.length; g++) {
        if (gpsRows[g].index + 1 >= insertSheetRow) {
          gpsRows[g].index++;
        }
      }
    }
  }
  
  // Caso 3: Oficina al final (Brecha >= 1.5 horas)
  var lastRow = gpsRows[gpsRows.length - 1];
  if (17.0 - lastRow.T_a >= 1.5) {
    var hasOfficeEnd = false;
    for (var j = 0; j < techRows.length; j++) {
      var tr = techRows[j];
      var trProjNorm = auditNormalizar(tr.proyecto);
      if ((trProjNorm === 'smarthaus gastos' || trProjNorm === 'oficina') && tr.aOriginal !== undefined && tr.aOriginal !== null && String(tr.aOriginal).trim() !== "") {
        var decA = parseTimeToDecimal(tr.aOriginal);
        if (decA >= 16.5) {
          hasOfficeEnd = true;
          break;
        }
      }
    }
    
    if (!hasOfficeEnd) {
      var strDe = formatDecimalToTime15Min(lastRow.T_a);
      // Agrupamiento en bloque: insertar junto a las SMARTHAUS previas del mismo periodo
      var insertSheetRowEnd;
      var lastProjSheetRow = lastRow.index + 1; // 1-based sheet row of last project
      if (adminTracker.endNextRow === null || lastProjSheetRow > adminTracker.endNextRow) {
        // Primera insercion de fin o proyecto posterior al bloque actual: ancla nueva posicion
        insertSheetRowEnd = lastProjSheetRow + 1; // insertar justo despues del ultimo proyecto
        adminTracker.endNextRow = insertSheetRowEnd + 1;
      } else {
        // Inserciones siguientes: apilar justo despues de la ultima SMARTHAUS de fin
        insertSheetRowEnd = adminTracker.endNextRow;
        adminTracker.endNextRow++;
      }
      Logger.log('[LOG] Brecha detectada al final para ' + lastRow.nombre + ' (' + (17.0 - lastRow.T_a) + ' hrs). Insertando oficina en renglon ' + insertSheetRowEnd + '.');
      auditInsertarFilaAdministrativa(
        sheet,
        insertSheetRowEnd,
        dateStr,
        lastRow.nombre,
        "SMARTHAUS GASTOS",
        strDe,
        "17:00",
        "Oficina",
        "NA",
        "[GPS] Fila administrativa autogenerada por retorno temprano (" + strDe + " a 17:00)"
      );
      for (var g = 0; g < gpsRows.length; g++) {
        if (gpsRows[g].index + 1 >= insertSheetRowEnd) {
          gpsRows[g].index++;
        }
      }
    }
  }
  
  // --- CALCULAR Y ESCRIBIR MÉTRICAS EN BITÁCORA ---
  for (var i = 0; i < gpsRows.length; i++) {
    var row = gpsRows[i];
    var rowNum = row.index + 1;
    var isFirst = (i === 0);
    var isLast = (i === gpsRows.length - 1);
    
    var res = auditCalcularMetricasParaFilaGPS(row, geocercas, officeLat, officeLon, isFirst, isLast, dateStr, especiales);
    
    // Si se insertó fila de oficina al inicio, el primer proyecto no debe iniciar a las 8:00
    if (isFirst && row.T_de > 8.0 && (row.T_de - 8.0 >= 1.5)) {
      res.deVal = formatDecimalToTime15Min(row.T_de);
    }
    
    // Si se insertó fila de oficina al final, el último proyecto no debe terminar a las 17:00
    if (isLast && row.T_a < 17.0 && (17.0 - row.T_a >= 1.5)) {
      res.aVal = formatDecimalToTime15Min(row.T_a);
    }
    
    // Leer el rango completo de G (col 7) a Z (col 26) para optimizar la escritura en una sola llamada a la API
    var rangeGtoZ = sheet.getRange(rowNum, 7, 1, 20);
    var valuesGtoZ = rangeGtoZ.getValues()[0];
    var formulasGtoZ = rangeGtoZ.getFormulas()[0];
    
    var prevObs = String(valuesGtoZ[15] || '').trim(); // col 22 is index 15 in G-Z array
    var currentObs = prevObs;
    var alertTriggered = false;
    
    if (res.alertaHorario) {
      var warning = "[GPS] Salida muy temprano: " + res.horaReal;
      if (currentObs.indexOf(warning) === -1) {
        currentObs = currentObs ? currentObs + " | " + warning : warning;
      }
      alertTriggered = true;
    }
    if (res.sinGeocerca) {
      var warning = "[GPS] Ubicación no registrada: " + res.proyectoName;
      if (currentObs.indexOf(warning) === -1) {
        currentObs = currentObs ? currentObs + " | " + warning : warning;
      }
      alertTriggered = true;
    }
    if (res.alertaLlegadaTemprana) {
      var warning = "[GPS] Llegada muy temprana: " + res.horaLlegadaReal;
      if (currentObs.indexOf(warning) === -1) {
        currentObs = currentObs ? currentObs + " | " + warning : warning;
      }
      alertTriggered = true;
    }
    if (res.alertaVelocidadBaja) {
      var warning = "[GPS] Velocidad promedio muy baja: " + res.velocidadBajaReal + " km/h";
      if (currentObs.indexOf(warning) === -1) {
        currentObs = currentObs ? currentObs + " | " + warning : warning;
      }
      alertTriggered = true;
    }
    if (res.alertaNocturna) {
      var warning = "[GPS] Horario nocturno: revisión manual";
      if (currentObs.indexOf(warning) === -1) {
        currentObs = currentObs ? currentObs + " | " + warning : warning;
      }
      alertTriggered = true;
    }
    
    Logger.log('[LOG] Escribiendo fila ' + rowNum + ' para ' + row.nombre + ' (' + row.proyecto + '). DE=' + res.deVal + ', A=' + res.aVal + ', KM=' + res.km + '.');
    
    // Modificar los valores en memoria del rango G-Z (índices 0 a 19)
    valuesGtoZ[0] = res.deVal;                                          // DE (col G, index 0)
    valuesGtoZ[1] = res.aVal;                                           // A (col H, index 1)
    
    if (alertTriggered) {
      valuesGtoZ[8] = "REVISAR";                                        // REV (col O, index 8)
    }
    
    valuesGtoZ[9] = res.horaSalida;                                     // HORA DE SALIDA (col P, index 9)
    valuesGtoZ[10] = res.horaEntrada;                                   // HORA DE ENTRADA (col Q, index 10)
    valuesGtoZ[11] = res.tiempoRecorrido;                               // TIEMPO RECORRIDO (col R, index 11)
    valuesGtoZ[12] = res.tiempoParadas;                                 // TIEMPO DE PARADAS (col S, index 12)
    valuesGtoZ[13] = res.paradas;                                       // PARADAS (col T, index 13)
    valuesGtoZ[14] = res.regresos;                                      // REGRESOS (col U, index 14)
    valuesGtoZ[15] = currentObs;                                        // OBSERVACIONES (col V, index 15)
    valuesGtoZ[16] = res.km;                                            // KM (col W, index 16)
    valuesGtoZ[17] = res.horasExtra;                                    // HORAS EXTRA (col X, index 17)
    valuesGtoZ[18] = res.horaSalProy;                                   // HORA SAL PROY (col Y, index 18)
    valuesGtoZ[19] = res.horaLlegProy;                                  // HORA LLEG PROY (col Z, index 19)
    
    // Restaurar fórmulas para no sobrescribirlas con valores estáticos (ej. Columna I - CALCULO HORAS)
    for (var k = 0; k < valuesGtoZ.length; k++) {
      if (formulasGtoZ[k]) {
        valuesGtoZ[k] = formulasGtoZ[k];
      }
    }
    
    // Guardar todo en una sola llamada de escritura
    rangeGtoZ.setValues([valuesGtoZ]);
  }
  
  // 7. Detectar e insertar paradas prolongadas (> 90 min)
  var allTechRoutes = [];
  for (var i = 0; i < gpsRows.length; i++) {
    allTechRoutes = allTechRoutes.concat(gpsRows[i].routes);
  }
  
  if (allTechRoutes.length > 0) {
    var targetProjectsNorm = gpsRows.map(function(row) {
      return auditNormalizar(row.proyecto);
    });
    var firstRow = gpsRows[0];
    
    var currentData = sheet.getDataRange().getValues();
    var techSap = "";
    var techRol = "";
    for (var b = 1; b < currentData.length; b++) {
      var fFechaRaw = currentData[b][AUDIT_COL_BIT_FECHA];
      if (!fFechaRaw) continue;
      var fFecha = auditFormatDate(fFechaRaw);
      var fNombre = String(currentData[b][AUDIT_COL_BIT_NOMBRE] || '').trim();
      if (fFecha === dateStr && fNombre === firstRow.nombre) {
        techSap = String(currentData[b][1] || ''); // Col B (SAP)
        techRol = String(currentData[b][5] || ''); // Col F (Rol)
        break;
      }
    }
    
    var unitString = gpsRows.map(function(r) { return r.unidad; }).join(', ');
    
    auditDetectarEInsertarParadasProlongadas(
      allTechRoutes,
      geocercas,
      unitString,
      dateStr,
      targetProjectsNorm,
      sheet,
      firstRow.nombre,
      techSap,
      techRol
    );
  }
}

/**
 * Calcula las métricas avanzadas para una única fila de proyecto de instalación.
 */
function auditCalcularMetricasParaFilaGPS(row, geocercas, officeLat, officeLon, isFirstOfPerson, isLastOfPerson, dateStr, especiales) {
  var routes = row.routes || [];
  
  // Encontrar primer inicio, último fin y distancia total
  var firstStart = null;
  var lastEnd = null;
  var totalDistance = 0.0;
  
  for (var r = 0; r < routes.length; r++) {
    var rt = routes[r];
    if (rt.start_time && (firstStart === null || rt.start_time < firstStart)) {
      firstStart = rt.start_time;
    }
    if (rt.end_time && (lastEnd === null || rt.end_time > lastEnd)) {
      lastEnd = rt.end_time;
    }
    totalDistance += rt.dist_km;
  }
  
  var projNorm = auditNormalizar(row.proyecto);
  // especiales es un diccionario { projNorm: true }, no un array
  var isEspecial = !!(especiales && (especiales[projNorm] ||
    projNorm === 'smarthaus gastos' || projNorm === 'oficina' || projNorm === 'smartcorp'));
  
  var sinGeocerca = true;
  for (var r = 0; r < routes.length; r++) {
    var rt = routes[r];
    var startGeoId = auditObtenerGeocercaDetectada(rt.start_lat, rt.start_lon, geocercas, [projNorm]);
    var destGeoId = auditObtenerGeocercaDetectada(rt.end_lat, rt.end_lon, geocercas, [projNorm]);
    if (startGeoId && auditCoincideGeocercaConProyecto(auditBuscarGeocercaPorId(geocercas, startGeoId), projNorm)) sinGeocerca = false;
    if (destGeoId && auditCoincideGeocercaConProyecto(auditBuscarGeocercaPorId(geocercas, destGeoId), projNorm)) sinGeocerca = false;
  }
  
  var rowMetrics = auditCalcularMetricasDeBloque(routes, geocercas, [projNorm], false);
  
  var res = {};
  res.tiempoRecorrido = rowMetrics.tiempoRecorrido;
  res.tiempoParadas = rowMetrics.tiempoParadas;
  res.paradas = rowMetrics.paradas;
  res.horaSalProy = rowMetrics.horaSalProy;
  res.horaLlegProy = rowMetrics.horaLlegProy;
  res.km = rowMetrics.km;
  res.horasExtra = "";
  
  var regresosCount = auditCalcularRegresosDeProyecto(routes, geocercas, projNorm, officeLat, officeLon);
  res.regresos = regresosCount > 0 ? regresosCount : "";
  
  var deHour = row.T_de;
  var aHour = row.T_a;
  
  var deInfo = { deVal: deHour, alerta: false, horaReal: '' };
  var aInfo = { aVal: aHour, alerta: false, horaReal: '' };
  var horasExtraVal = "";
  var horaLlegadaReal = "";
  var horaSalidaReal = "";
  
  if (firstStart) {
    var firstStartDecimal = firstStart.getHours() + firstStart.getMinutes() / 60.0;
    if (firstStartDecimal < 7.5) {
      deInfo.deVal = 8.0;
      deInfo.alerta = true;
      deInfo.horaReal = formatTimeOnly(firstStart);
    } else {
      deInfo.deVal = 8.0;
      deInfo.alerta = false;
    }
    horaSalidaReal = formatTimeOnly(firstStart);
  }
  
  if (lastEnd) {
    var lastEndDecimal = lastEnd.getHours() + lastEnd.getMinutes() / 60.0;
    if (lastEndDecimal > 19.0) {
      aInfo.aVal = 17.0;
      var diffExtra = lastEndDecimal - 18.0;
      if (diffExtra > 0) {
        horasExtraVal = Number(diffExtra.toFixed(1));
      }
    } else {
      if (lastEndDecimal < 15.5) {
        aInfo.aVal = 17.0;
        aInfo.alerta = true;
        aInfo.horaReal = formatTimeOnly(lastEnd);
      } else {
        aInfo.aVal = 17.0;
        aInfo.alerta = false;
      }
      horaLlegadaReal = formatTimeOnly(lastEnd);
    }
  }
  
  res.deVal = isFirstOfPerson ? deInfo.deVal : deHour;
  res.aVal = isLastOfPerson ? aInfo.aVal : aHour;
  
  res.horaSalida = isFirstOfPerson ? horaSalidaReal : formatDecimalToTime(deHour);
  res.horaEntrada = isLastOfPerson ? (horasExtraVal ? "" : horaLlegadaReal) : formatDecimalToTime(aHour);
  
  res.alertaHorario = isFirstOfPerson ? deInfo.alerta : false;
  res.horaReal = isFirstOfPerson ? deInfo.horaReal : '';
  res.alertaLlegadaTemprana = isLastOfPerson ? aInfo.alerta : false;
  res.horaLlegadaReal = isLastOfPerson ? aInfo.horaReal : '';
  res.horasExtra = isLastOfPerson ? horasExtraVal : "";
  
  if (!isFirstOfPerson) {
    res.horaSalida = "";
    res.horaLlegProy = "";
  }
  if (!isLastOfPerson) {
    res.horaEntrada = "";
    res.horaSalProy = "";
  }
  
  // Regla: si el primer viaje al proyecto inicia a las 15:30 o despues
  // (1.5h antes de 17:00), no se registra HORA SAL PROY ni HORA LLEG PROY
  if (firstStart) {
    var firstStartDec = firstStart.getHours() + firstStart.getMinutes() / 60.0;
    if (firstStartDec >= 15.5) {
      res.horaSalProy = "";
      res.horaLlegProy = "";
    }
  }
  
  if (isLastOfPerson && horasExtraVal) {
    res.horaSalida = isFirstOfPerson ? horaSalidaReal : "";
    res.horaEntrada = "";
    res.horaLlegProy = "";
    res.horaSalProy = "";
  }
  
  var alertaVelocidadBaja = false;
  var velocidadBajaReal = "";
  var speedParts = res.tiempoRecorrido.split(':');
  var speedSeconds = 0;
  if (speedParts.length === 3) {
    speedSeconds = parseInt(speedParts[0], 10) * 3600 + parseInt(speedParts[1], 10) * 60 + parseInt(speedParts[2], 10);
  }
  if (speedSeconds > 600) {
    var speedHours = speedSeconds / 3600.0;
    var avgSpeed = res.km / speedHours;
    if (avgSpeed < 6.0) {
      alertaVelocidadBaja = true;
      velocidadBajaReal = avgSpeed.toFixed(1);
    }
  }
  
  res.alertaVelocidadBaja = alertaVelocidadBaja;
  res.velocidadBajaReal = velocidadBajaReal;
  res.sinGeocerca = sinGeocerca;
  res.proyectoName = row.proyecto;
  
  if (isEspecial) {
    res.deVal = (row.deOriginal !== undefined && row.deOriginal !== null && String(row.deOriginal).trim() !== "") ? row.deOriginal : (isFirstOfPerson ? deInfo.deVal : deHour);
    res.aVal = (row.aOriginal !== undefined && row.aOriginal !== null && String(row.aOriginal).trim() !== "") ? row.aOriginal : (isLastOfPerson ? aInfo.aVal : aHour);
    res.horaSalida = "";
    res.horaEntrada = "";
    res.tiempoParadas = "";
    res.paradas = "";
    res.horaSalProy = "";
    res.horaLlegProy = "";
    res.alertaHorario = false;
    res.alertaLlegadaTemprana = false;
    res.alertaVelocidadBaja = false;
    res.sinGeocerca = false;
    res.horasExtra = "";
    res.regresos = "";
    
    var totalDurationSec = 0;
    for (var rVal = 0; rVal < routes.length; rVal++) {
      totalDurationSec += (routes[rVal].dur_mov_min * 60);
    }
    res.km = Number(totalDistance.toFixed(2));
    res.tiempoRecorrido = formatSecToHMS(totalDurationSec);
  }
  
  if (res.horaEntrada && res.horaSalProy) {
    var decimalEntrada = parseTimeToDecimal(res.horaEntrada);
    var decimalSalProy = parseTimeToDecimal(res.horaSalProy);
    if (decimalEntrada < decimalSalProy && lastEnd) {
      res.horaEntrada = formatTimeOnly(lastEnd);
    }
  }
  
  var esNocturno = false;
  if (!isEspecial) {
    esNocturno = (deHour >= 20.0 || deHour < 6.0 || aHour >= 20.0 || aHour < 6.0);
    if (!esNocturno) {
      for (var r = 0; r < routes.length; r++) {
        var rt = routes[r];
        var rtStart = rt.start_time.getHours() + rt.start_time.getMinutes() / 60.0;
        var rtEnd = rt.end_time.getHours() + rt.end_time.getMinutes() / 60.0;
        if (rtStart >= 20.0 || rtStart < 6.0 || rtEnd >= 20.0 || rtEnd < 6.0) {
          esNocturno = true;
          break;
        }
      }
    }
  }
  if (esNocturno) {
    res.deVal = row.deOriginal;
    res.aVal = row.aOriginal;
    res.horaSalida = "";
    res.horaEntrada = "";
    res.tiempoParadas = "";
    res.paradas = "";
    res.horaSalProy = "";
    res.horaLlegProy = "";
    res.tiempoRecorrido = "";
    res.km = "";
    res.alertaHorario = false;
    res.alertaLlegadaTemprana = false;
    res.alertaVelocidadBaja = false;
    res.sinGeocerca = false;
    res.alertaNocturna = true;
    res.horasExtra = "";
    res.regresos = "";
  }
  
  if (typeof res.deVal === 'number') {
    res.deVal = isFirstOfPerson ? formatDecimalToTime(res.deVal) : formatDecimalToTime15Min(res.deVal);
  }
  if (typeof res.aVal === 'number') {
    res.aVal = isLastOfPerson ? formatDecimalToTime(res.aVal) : formatDecimalToTime15Min(res.aVal);
  }
  
  return res;
}

/**
 * Inserta de forma segura una fila administrativa en la hoja, heredando formatos y fórmulas de la celda adyacente.
 */
function auditInsertarFilaAdministrativa(sheet, targetRowIdx, dateStr, nombre, proyecto, de, a, asunto, unidad, obs) {
  Logger.log('[LOG] Insertando fila administrativa en renglón ' + targetRowIdx + ' para ' + nombre + ' (' + proyecto + '). Horario: ' + de + ' a ' + a + '.');
  sheet.insertRowBefore(targetRowIdx);
  
  var sourceRowIdx = targetRowIdx + 1;
  if (sourceRowIdx > sheet.getLastRow()) {
    sourceRowIdx = targetRowIdx - 1;
  }
  
  var cols = sheet.getLastColumn();
  var sourceRange = sheet.getRange(sourceRowIdx, 1, 1, cols);
  var targetRange = sheet.getRange(targetRowIdx, 1, 1, cols);
  sourceRange.copyTo(targetRange);
  
  // Leer los valores y fórmulas copiados
  var rowValues = targetRange.getValues()[0];
  var rowFormulas = targetRange.getFormulas()[0];
  
  // Modificar los campos en el array (índices base 0, por lo que col 3 es índice 2)
  rowValues[2] = dateStr;                     // FECHA (col C, index 2)
  rowValues[3] = proyecto;                    // PROYECTO (col D, index 3)
  rowValues[4] = nombre;                      // NOMBRE (col E, index 4)
  rowValues[6] = de;                          // DE (col G, index 6)
  rowValues[7] = a;                           // A (col H, index 7)
  rowValues[9] = unidad;                      // UNIDAD (col J, index 9)
  rowValues[10] = "";                         // REPORTE ENV (col K, index 10)
  rowValues[11] = asunto;                     // ASUNTO (col L, index 11)
  rowValues[12] = "";                         // JUSTIFICACION (col M, index 12)
  rowValues[13] = "";                         // NOTA (col N, index 13)
  rowValues[14] = "REVISAR";                  // REV (col O, index 14)
  
  // Cols P a U (índices 15 a 20)
  rowValues[15] = ""; // HORA DE SALIDA
  rowValues[16] = ""; // HORA DE ENTRADA
  rowValues[17] = ""; // TIEMPO RECORRIDO
  rowValues[18] = ""; // TIEMPO DE PARADAS
  rowValues[19] = ""; // PARADAS
  rowValues[20] = ""; // REGRESOS
  
  rowValues[21] = obs;                        // OBSERVACIONES (col V, index 21)
  
  // Cols W a Z (índices 22 a 25)
  rowValues[22] = ""; // KM
  rowValues[23] = ""; // HORAS EXTRA
  rowValues[24] = ""; // HORA SAL PROY
  rowValues[25] = ""; // HORA LLEG PROY
  
  // Re-aplicar fórmulas originales (como CALCULO HORAS) para que no se sobrescriban
  for (var cIdx = 0; cIdx < rowValues.length; cIdx++) {
    if (rowFormulas[cIdx]) {
      rowValues[cIdx] = rowFormulas[cIdx];
    }
  }
  
  // Escribir la fila completa en una sola llamada de API
  targetRange.setValues([rowValues]);
}

/**
 * Busca el último arribo a la oficina después del proyecto Prev para cambio de unidad.
 */
function auditBuscarHoraRegresoOficina(routes, geocercas, projNorm, officeLat, officeLon) {
  var lastProjRouteIdx = -1;
  for (var r = routes.length - 1; r >= 0; r--) {
    var rt = routes[r];
    var startGeoId = auditObtenerGeocercaDetectada(rt.start_lat, rt.start_lon, geocercas, [projNorm]);
    var destGeoId = auditObtenerGeocercaDetectada(rt.end_lat, rt.end_lon, geocercas, [projNorm]);
    var touches = false;
    if (startGeoId && auditCoincideGeocercaConProyecto(auditBuscarGeocercaPorId(geocercas, startGeoId), projNorm)) touches = true;
    if (destGeoId && auditCoincideGeocercaConProyecto(auditBuscarGeocercaPorId(geocercas, destGeoId), projNorm)) touches = true;
    if (touches) {
      lastProjRouteIdx = r;
      break;
    }
  }
  if (lastProjRouteIdx !== -1) {
    for (var k = lastProjRouteIdx; k < routes.length; k++) {
      var rtK = routes[k];
      var distToOffice = auditCalcularDistanciaMetros(rtK.end_lat, rtK.end_lon, officeLat, officeLon);
      if (distToOffice < 500 && rtK.end_time) {
        return rtK.end_time;
      }
    }
    return routes[lastProjRouteIdx].end_time;
  }
  return null;
}

/**
 * Busca la salida de la oficina previa a la primera visita de Project Curr.
 */
function auditBuscarHoraSalidaOficina(routes, geocercas, projNorm, officeLat, officeLon) {
  var firstProjRouteIdx = -1;
  for (var r = 0; r < routes.length; r++) {
    var rt = routes[r];
    var startGeoId = auditObtenerGeocercaDetectada(rt.start_lat, rt.start_lon, geocercas, [projNorm]);
    var destGeoId = auditObtenerGeocercaDetectada(rt.end_lat, rt.end_lon, geocercas, [projNorm]);
    var touches = false;
    if (startGeoId && auditCoincideGeocercaConProyecto(auditBuscarGeocercaPorId(geocercas, startGeoId), projNorm)) touches = true;
    if (destGeoId && auditCoincideGeocercaConProyecto(auditBuscarGeocercaPorId(geocercas, destGeoId), projNorm)) touches = true;
    if (touches) {
      firstProjRouteIdx = r;
      break;
    }
  }
  if (firstProjRouteIdx !== -1) {
    for (var k = firstProjRouteIdx; k >= 0; k--) {
      var rtK = routes[k];
      var distToOffice = auditCalcularDistanciaMetros(rtK.start_lat, rtK.start_lon, officeLat, officeLon);
      if (distToOffice < 500 && rtK.start_time) {
        return rtK.start_time;
      }
    }
    return routes[firstProjRouteIdx].start_time;
  }
  return null;
}
