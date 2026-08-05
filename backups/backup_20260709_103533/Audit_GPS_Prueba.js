/**
 * ============================================================
 *  SMARTCORP – Módulo de Pruebas GPS (Paralelo)
 *  Archivo: Audit_GPS_Prueba.js
 *
 *  Propósito:
 *    • Ejecutar la lógica de importación GPS de forma segura en 'Bitacora_Prueba'
 *    • Resolver colisiones de cabeceras en "Reporte Dinámico" por índices fijos
 *    • Calcular DE/A con redondeo y restar 1 hora de comida
 *    • Detectar retornos a oficina al mediodía para corte de turnos a las 12:30
 *    • Distribuir kilómetros inteligentemente por bloques de viajes
 *    • Validar turnos por técnico para respetar salidas tardías o regresos tempranos
 *
 *  Versión : 1.1.0
 *  Fecha   : 22/06/2026
 * ============================================================
 */

// Constantes de columnas para Bitácora
var AUDIT_COL_BIT_DE = 6;     // "DE" (col G)
var AUDIT_COL_BIT_A = 7;      // "A" (col H)
var AUDIT_COL_BIT_ASUNTO = 11; // "ASUNTO" (col L)

/**
 * Función principal para procesar GPS en la hoja de pruebas.
 * Invocada desde el menú: 🔍 Auditorías SMARTCORP -> 🧪 Procesar GPS en Hoja de Prueba.
 */
function ejecutarProcesamientoGPSPrueba() {
  var ui = SpreadsheetApp.getUi();
  
  try {
    Logger.log('=== [LOG] INICIO SIMULACIÓN: ejecutarProcesamientoGPSPrueba ===');
    
    // 1. Obtener configuración
    var ssConfig = auditObtenerSsConfiguracion();
    var geocercas = auditObtenerGeocercas(ssConfig);
    var mapaEquivalencias = auditObtenerEquivalenciasUnidades(ssConfig);
    
    Logger.log('[LOG] Mapeo de Equivalencias en prueba: ' + JSON.stringify(mapaEquivalencias));
    
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
    var files = folderPendientes.getFiles();
    
    // 3. Obtener hojas de trabajo
    var ssBitacora = SpreadsheetApp.openById(AUDIT_BITACORA_SHEET_ID);
    var shBitacoraOriginal = ssBitacora.getSheetByName(AUDIT_BITACORA_TAB_NAME);
    if (!shBitacoraOriginal) {
      throw new Error('No se encontró la pestaña "' + AUDIT_BITACORA_TAB_NAME + '" en la Bitácora.');
    }
    
    // Asegurar existencia de pestaña Bitacora_Prueba
    var shBitacoraPrueba = ssBitacora.getSheetByName('Bitacora_Prueba');
    if (!shBitacoraPrueba) {
      shBitacoraPrueba = ssBitacora.insertSheet('Bitacora_Prueba');
      var headersRange = shBitacoraOriginal.getRange(1, 1, 1, shBitacoraOriginal.getLastColumn());
      headersRange.copyTo(shBitacoraPrueba.getRange(1, 1));
      shBitacoraPrueba.getRange(1, 1, 1, shBitacoraOriginal.getLastColumn()).setFontWeight('bold');
    }
    
    var logMensajes = [];
    var archivosProcesados = 0;
    
    // 4. Recorrer archivos en GPS_Pendientes y cargarlos en memoria
    var routesByUnitAndDate = {}; // dateStr -> { unitName -> [routes] }
    var fileRecords = [];
    
    while (files.hasNext()) {
      var file = files.next();
      var nombreArchivo = file.getName();
      Logger.log('[LOG PRUEBA] Cargando en memoria de prueba: ' + nombreArchivo);
      
      var parseRes = null;
      try {
        parseRes = auditParsearExcelGPSPrueba(file);
      } catch (ex) {
        Logger.log('[LOG PRUEBA] Error parseando archivo ' + nombreArchivo + ': ' + ex.message);
        logMensajes.push('❌ Error parseando ' + nombreArchivo + ': ' + ex.message);
        continue;
      }
      
      if (!parseRes || parseRes.status !== 'success') {
        logMensajes.push('❌ Estructura inválida en ' + nombreArchivo);
        continue;
      }
      
      var units = parseRes.units || [];
      if (units.length === 0) {
        logMensajes.push('⚠️ ' + nombreArchivo + ': No contiene unidades de GPS.');
        continue;
      }
      
      var fileDates = {};
      var hasValidRoutes = false;
      
      for (var u = 0; u < units.length; u++) {
        var unitBlock = units[u];
        var unidad = unitBlock.unidad;
        var routes = unitBlock.routes || [];
        if (routes.length === 0) continue;
        hasValidRoutes = true;
        
        var normalizedUnit = auditNormalizar(unidad);
        Logger.log('[LOG PRUEBA] Unidad cargada: "' + normalizedUnit + '" con ' + routes.length + ' rutas.');
        
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
      
      if (!hasValidRoutes) {
        logMensajes.push('⚠️ ' + nombreArchivo + ': Sin viajes válidos.');
        continue;
      }
      
      fileRecords.push({ file: file, name: nombreArchivo, dates: fileDates });
    }
    
    // 5. Procesar cada fecha globalmente en Bitacora_Prueba
    var datesToProcess = Object.keys(routesByUnitAndDate);
    Logger.log('[LOG PRUEBA] Fechas identificadas para procesar: ' + JSON.stringify(datesToProcess));
    
    var especiales = auditObtenerProyectosEspeciales(ssConfig);
    
    for (var dIdx = 0; dIdx < datesToProcess.length; dIdx++) {
      var dateStr = datesToProcess[dIdx];
      var dateUnitsData = routesByUnitAndDate[dateStr];
      
      // 1. Limpiar todos los registros previos en Bitacora_Prueba para esta fecha
      var dataPrueba = shBitacoraPrueba.getDataRange().getValues();
      for (var r = dataPrueba.length - 1; r >= 1; r--) {
        var pFechaRaw = dataPrueba[r][AUDIT_COL_BIT_FECHA];
        if (pFechaRaw) {
          var pFecha = auditFormatDate(pFechaRaw);
          if (pFecha === dateStr) {
            shBitacoraPrueba.deleteRow(r + 1);
          }
        }
      }
      
      // 2. Copiar todas las filas originales de esta fecha desde Bitacora (producción) a Bitacora_Prueba
      var dataOriginal = shBitacoraOriginal.getDataRange().getValues();
      var filasACopiar = [];
      for (var b = 1; b < dataOriginal.length; b++) {
        var fFechaRaw = dataOriginal[b][AUDIT_COL_BIT_FECHA];
        if (fFechaRaw) {
          var fFecha = auditFormatDate(fFechaRaw);
          if (fFecha === dateStr) {
            filasACopiar.push(b);
          }
        }
      }
      
      if (filasACopiar.length > 0) {
        var startRow = shBitacoraPrueba.getLastRow() + 1;
        for (var f = 0; f < filasACopiar.length; f++) {
          var origIdx = filasACopiar[f];
          var sourceRange = shBitacoraOriginal.getRange(origIdx + 1, 1, 1, shBitacoraOriginal.getLastColumn());
          var targetRange = shBitacoraPrueba.getRange(startRow + f, 1, 1, shBitacoraOriginal.getLastColumn());
          sourceRange.copyTo(targetRange);
        }
      }
      
      // 3. Ejecutar el procesamiento global en la hoja de prueba
      auditProcesarFechaGlobal(shBitacoraPrueba, dateUnitsData, geocercas, officeLat, officeLon, dateStr, mapaEquivalencias, especiales, true);
      
      logMensajes.push('🧪 ' + dateStr + ': Simulación de GPS completada en Bitacora_Prueba.');
    }
    
    archivosProcesados = fileRecords.length;
    
    var resumenTexto = 
      '🧪 PRUEBA DE IMPORTACIÓN GPS COMPLETADA\n' +
      '─────────────────────────────────\n' +
      '• Archivos simulados : ' + archivosProcesados + '\n' +
      '• Pestaña de destino : Bitacora_Prueba\n' +
      '─────────────────────────────────\n\n' +
      'DETALLE:\n' + logMensajes.join('\n');
      
    ui.alert('🧪 Probador GPS SMARTCORP', resumenTexto, ui.ButtonSet.OK);
    
  } catch (e) {
    Logger.log('Error en ejecutarProcesamientoGPSPrueba: ' + e.message + '\n' + e.stack);
    ui.alert('❌ Error de Pruebas', e.message, ui.ButtonSet.OK);
  }
}

/**
 * Parsea el Excel de GPS dinámicamente por índices de columna absolutos.
 */
function auditParsearExcelGPSPrueba(file) {
  var tempFile = null;
  try {
    var resource = {
      title: 'TEMP_GPS_PRUEBA_' + file.getName().replace(/\.xlsx$/i, ''),
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
 * Módulo de Diagnóstico Detallado de GPS
 * Analiza archivos de GPS_Pendientes y vuelca el trace detallado en SMARTCORP_GPS_Configuracion (tab Diagnostico_GPS)
 */
function ejecutarDiagnosticoDetalladoGPS() {
  var ui = SpreadsheetApp.getUi();
  
  try {
    Logger.log('=== INICIO: ejecutarDiagnosticoDetalladoGPS ===');
    
    // 1. Obtener configuración
    var ssConfig = auditObtenerSsConfiguracion();
    var geocercas = auditObtenerGeocercas(ssConfig);
    var mapaEquivalencias = auditObtenerEquivalenciasUnidades(ssConfig);
    
    // Obtener o crear pestaña Diagnostico_GPS
    var shDiag = ssConfig.getSheetByName('Diagnostico_GPS');
    if (shDiag) {
      shDiag.clear(); // Limpiar contenido anterior
    } else {
      shDiag = ssConfig.insertSheet('Diagnostico_GPS');
    }
    
    // Escribir cabeceras (18 columnas)
    shDiag.appendRow([
      'Unidad', 'Fecha', 'Tramo_ID', 'Hora_Inicio', 'Lat_Lon_Inicio', 'Geocerca_Inicio_Detectada',
      'Distancia_Inicio_SMARTCORP_m', 'Geocerca_Inicio_Mas_Cercana', 'Hora_Fin', 'Lat_Lon_Fin',
      'Geocerca_Fin_Detectada', 'Distancia_Fin_SMARTCORP_m', 'Geocerca_Fin_Mas_Cercana',
      'Distancia_KM', 'Duracion', 'Filtro_Aplicado', 'Bitacora_Match_Status', 'Resultado_Propuesto'
    ]);
    shDiag.getRange('A1:R1').setFontWeight('bold');
    
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
    var files = folderPendientes.getFiles();
    var totalSegmentosLogs = [];
    var filesProcessed = 0;
    
    // Obtener datos de la Bitácora original para buscar coincidencias
    var ssBitacora = SpreadsheetApp.openById(AUDIT_BITACORA_SHEET_ID);
    var shBitacoraOriginal = ssBitacora.getSheetByName(AUDIT_BITACORA_TAB_NAME);
    if (!shBitacoraOriginal) {
      throw new Error('No se encontró la pestaña "' + AUDIT_BITACORA_TAB_NAME + '" en la Bitácora.');
    }
    var datosBitacoraOriginal = shBitacoraOriginal.getDataRange().getValues();
    
    // 3. Recorrer archivos en GPS_Pendientes
    while (files.hasNext()) {
      var file = files.next();
      var nombreArchivo = file.getName();
      Logger.log('Analizando para diagnóstico: ' + nombreArchivo);
      
      var parseRes = null;
      try {
        parseRes = auditParsearExcelGPSPrueba(file);
      } catch (ex) {
        Logger.log('Error parseando archivo ' + nombreArchivo + ': ' + ex.message);
        continue;
      }
      
      if (!parseRes || parseRes.status !== 'success') continue;
      
      var units = parseRes.units || [];
      for (var u = 0; u < units.length; u++) {
        var unitBlock = units[u];
        var unidad = unitBlock.unidad;
        var routes = unitBlock.routes;
        
        // Traducir unidad usando el mapa de equivalencias
        var unidadBitacora = mapaEquivalencias[auditNormalizar(unidad)] || unidad;
        
        // Identificar las fechas únicas presentes en los viajes
        var fechasMapa = {};
        for (var r = 0; r < routes.length; r++) {
          var rDateStr = auditFormatDate(routes[r].start_time);
          if (rDateStr) fechasMapa[rDateStr] = true;
        }
        
        var fechasUnicas = Object.keys(fechasMapa);
        
        // Procesar cada fecha
        for (var d = 0; d < fechasUnicas.length; d++) {
          var dateStr = fechasUnicas[d];
          
          // Buscar filas correspondientes en la Bitácora original
          var filasCoincidentes = [];
          for (var b = 1; b < datosBitacoraOriginal.length; b++) {
            var fFechaRaw = datosBitacoraOriginal[b][AUDIT_COL_BIT_FECHA];
            if (!fFechaRaw) continue;
            
            var fFecha = auditFormatDate(fFechaRaw);
            if (fFecha !== dateStr) continue;
            
            var fUnidad = String(datosBitacoraOriginal[b][AUDIT_COL_BIT_UNIDAD] || '').trim();
            if (auditNormalizar(fUnidad) === auditNormalizar(unidadBitacora)) {
              filasCoincidentes.push({
                index: b,
                proyecto: String(datosBitacoraOriginal[b][AUDIT_COL_BIT_PROYECTO] || ''),
                nombre: String(datosBitacoraOriginal[b][AUDIT_COL_BIT_NOMBRE] || ''),
                asunto: String(datosBitacoraOriginal[b][AUDIT_COL_BIT_ASUNTO] || ''),
                deOriginal: datosBitacoraOriginal[b][AUDIT_COL_BIT_DE],
                aOriginal: datosBitacoraOriginal[b][AUDIT_COL_BIT_A]
              });
            }
          }
          
          var matchStatus = "";
          if (filasCoincidentes.length === 0) {
            matchStatus = "⚠️ Sin fila coincidente en Bitácora";
          } else {
            var projList = filasCoincidentes.map(function(f) { return f.proyecto + " (" + f.nombre + ")"; }).join(", ");
            matchStatus = "✅ Coincide con " + filasCoincidentes.length + " fila(s): " + projList;
          }
          
          // Filtrar viajes del día
          var dayRoutes = routes.filter(function(rt) {
            return auditFormatDate(rt.start_time) === dateStr;
          });
          
          var resultadoPropuesto = "N/A";
          if (filasCoincidentes.length > 0 && dayRoutes.length > 0) {
            // Filtrar viajes aplicando Patio y Ruido
            var dayRoutesFiltradas = dayRoutes.filter(function(rt) {
              if (rt.dist_km < 0.15) return false;
              if (rt.dist_km < 0.5 && rt.start_lat && rt.start_lon && rt.end_lat && rt.end_lon) {
                var distStartToOffice = auditCalcularDistanciaMetros(rt.start_lat, rt.start_lon, officeLat, officeLon);
                var distEndToOffice = auditCalcularDistanciaMetros(rt.end_lat, rt.end_lon, officeLat, officeLon);
                if (distStartToOffice < 150 && distEndToOffice < 150) {
                  return false; // Descartar movimiento en patio
                }
              }
              return true;
            });
            
            if (dayRoutesFiltradas.length > 0) {
              try {
                var calcDataSim = auditCalcularMetricasGPS(dayRoutesFiltradas, geocercas, officeLat, officeLon, filasCoincidentes, datosBitacoraOriginal, dateStr).results;
                var resSim = calcDataSim[0]; // Muestra la propuesta para la primera fila
                resultadoPropuesto = "Propone DE: " + resSim.deVal + 
                                     " | A: " + resSim.aVal + 
                                     " | Salida: " + resSim.horaSalida + 
                                     " | Entrada: " + resSim.horaEntrada + 
                                     " | KM: " + resSim.km + 
                                     " | Paradas: " + resSim.paradas +
                                     (resSim.horasExtra ? " | Horas Extra: " + resSim.horasExtra : "") +
                                     (resSim.alertaNocturna ? " [NOCTURNO]" : "");
              } catch(e) {
                resultadoPropuesto = "❌ Error en cálculo: " + e.message;
              }
            } else {
              resultadoPropuesto = "⚠️ Todos los viajes descartados por filtros de ruido/patio.";
            }
          }
          
          // Escribir cada tramo
          for (var r = 0; r < dayRoutes.length; r++) {
            var rt = dayRoutes[r];
            var latLonIni = rt.start_lat && rt.start_lon ? rt.start_lat.toFixed(6) + ", " + rt.start_lon.toFixed(6) : "N/A";
            var latLonFin = rt.end_lat && rt.end_lon ? rt.end_lat.toFixed(6) + ", " + rt.end_lon.toFixed(6) : "N/A";
            
            var distIniOffice = rt.start_lat && rt.start_lon ? Math.round(auditCalcularDistanciaMetros(rt.start_lat, rt.start_lon, officeLat, officeLon)) : "N/A";
            var distFinOffice = rt.end_lat && rt.end_lon ? Math.round(auditCalcularDistanciaMetros(rt.end_lat, rt.end_lon, officeLat, officeLon)) : "N/A";
            
            var matchesInicio = auditDetectarGeocercasCoincidentes(rt.start_lat, rt.start_lon, geocercas);
            var targetProjNorm = filasCoincidentes.map(function(row) { return auditNormalizar(row.proyecto); });
            var locInicio = auditResolverGeocerca(matchesInicio, targetProjNorm) || "Desconocido";
            
            var matchesFin = auditDetectarGeocercasCoincidentes(rt.end_lat, rt.end_lon, geocercas);
            var locFin = auditResolverGeocerca(matchesFin, targetProjNorm) || "Desconocido";
            
            var geoIniCercanaInfo = "Desconocido";
            if (locInicio !== "Desconocido") {
              var geoObj = auditBuscarGeocercaPorId(geocercas, locInicio);
              geoIniCercanaInfo = geoObj ? (geoObj.nombre || geoObj.id) : locInicio;
            } else {
              geoIniCercanaInfo = auditObtenerGeocercaMasCercanaExcluyendoOficina(rt.start_lat, rt.start_lon, geocercas);
            }
            
            var geoFinCercanaInfo = "Desconocido";
            if (locFin !== "Desconocido") {
              var geoObj = auditBuscarGeocercaPorId(geocercas, locFin);
              geoFinCercanaInfo = geoObj ? (geoObj.nombre || geoObj.id) : locFin;
            } else {
              geoFinCercanaInfo = auditObtenerGeocercaMasCercanaExcluyendoOficina(rt.end_lat, rt.end_lon, geocercas);
            }
            
            var filtroText = "Aceptado";
            if (rt.dist_km < 0.15) {
              filtroText = "Descartado: Ruido (< 150m)";
            } else if (rt.dist_km < 0.5 && distIniOffice !== "N/A" && distFinOffice !== "N/A") {
              if (distIniOffice < 150 && distFinOffice < 150) {
                filtroText = "Descartado: Patio de Oficina (< 500m start/end en SMARTCORP)";
              }
            }
            
            totalSegmentosLogs.push([
              unidad,
              dateStr,
              rt.id,
              formatTimeOnly(rt.start_time),
              latLonIni,
              locInicio,
              distIniOffice,
              geoIniCercanaInfo,
              formatTimeOnly(rt.end_time),
              latLonFin,
              locFin,
              distFinOffice,
              geoFinCercanaInfo,
              rt.dist_km,
              rt.dur_mov_raw || "00:00:00",
              filtroText,
              matchStatus,
              resultadoPropuesto
            ]);
          }
        }
      }
      filesProcessed++;
    }
    
    // Escribir en lote
    if (totalSegmentosLogs.length > 0) {
      shDiag.getRange(2, 1, totalSegmentosLogs.length, 18).setValues(totalSegmentosLogs);
      shDiag.getRange(2, 1, totalSegmentosLogs.length, 18).setHorizontalAlignment('left');
    }
    
    ui.alert("🔬 Diagnóstico de GPS Completado", 
             "Se procesaron " + filesProcessed + " archivos.\nSe han escrito " + totalSegmentosLogs.length + " filas de desglose de rutas en la pestaña 'Diagnostico_GPS' de la configuración independiente (SMARTCORP_GPS_Configuracion).", 
             ui.ButtonSet.OK);
             
  } catch (e) {
    Logger.log('Error en ejecutarDiagnosticoDetalladoGPS: ' + e.message + '\n' + e.stack);
    ui.alert('❌ Error de Diagnóstico', e.message, ui.ButtonSet.OK);
  }
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
        insertSheetRow = firstRow.index + 1; // 1-based
        adminTracker.startNextRow = insertSheetRow + 1;
      } else {
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
        insertSheetRowEnd = lastProjSheetRow + 1;
        adminTracker.endNextRow = insertSheetRowEnd + 1;
      } else {
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
