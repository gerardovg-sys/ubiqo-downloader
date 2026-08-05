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
  
    // --- PASS 1: INSERCIONES DE FILAS ADMINISTRATIVAS ---
  var processedTechs = {};
  var continueLoop = true;
  var safetyCounter = 0;
  while (continueLoop && safetyCounter < 150) {
    safetyCounter++;
    var currentData = sheet.getDataRange().getValues();
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
      continueLoop = false;
      break;
    }
    
    var techRows = auditObtenerFilasTecnico(currentData, activeTechName, dateStr);
    Logger.log('[LOG] PASS 1: Procesando inserciones para ' + activeTechName + ' con ' + techRows.length + ' filas.');
    auditProcesarDiaTecnicoInsertarFilas(sheet, techRows, dateUnitsData, geocercas, officeLat, officeLon, dateStr, mapaEquivalencias, especiales, isPrueba, adminTracker, currentData);
    processedTechs[activeTechName] = true;
  }

  // --- PASS 2: ESCRITURA DE MÉTRICAS GPS ---
  processedTechs = {};
  continueLoop = true;
  safetyCounter = 0;
  while (continueLoop && safetyCounter < 150) {
    safetyCounter++;
    var currentData = sheet.getDataRange().getValues();
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
      continueLoop = false;
      break;
    }
    
    var techRows = auditObtenerFilasTecnico(currentData, activeTechName, dateStr);
    Logger.log('[LOG] PASS 2: Escribiendo métricas para ' + activeTechName + ' con ' + techRows.length + ' filas.');
    auditProcesarDiaTecnicoEscribirMetricas(sheet, techRows, dateUnitsData, geocercas, officeLat, officeLon, dateStr, mapaEquivalencias, especiales, isPrueba, currentData);
    processedTechs[activeTechName] = true;
  }

/**
 * Procesa la jornada de un técnico individual para una fecha determinada.
 */
}

function auditProcesarDiaTecnicoInsertarFilas(sheet, techRows, dateUnitsData, geocercas, officeLat, officeLon, dateStr, mapaEquivalencias, especiales, isPrueba, adminTracker, currentData) {
  if (!adminTracker) adminTracker = { startNextRow: null, endNextRow: null };
  var reverseMap = {};
  for (var gpsKey in mapaEquivalencias) {
    var bitacoraVal = mapaEquivalencias[gpsKey];
    reverseMap[auditNormalizar(bitacoraVal)] = gpsKey;
  }
  
  var gpsRows = [];
  for (var i = 0; i < techRows.length; i++) {
    var row = techRows[i];
    var projNorm = auditNormalizar(row.proyecto);
    var isEspecial = !!(especiales && (especiales[projNorm] ||
      (projNorm.indexOf('2605') !== -1 && (projNorm.indexOf('mtto') !== -1 || projNorm.indexOf('personal') !== -1)) ||
      projNorm === 'smarthaus gastos' || projNorm === 'oficina' || projNorm === 'smartcorp'));
    
    var unidadNorm = auditNormalizar(row.unidad);
    if (isEspecial) {
      gpsRows.push(row);
    } else if (unidadNorm !== 'na' && unidadNorm !== '') {
      var translatedUnit = reverseMap[unidadNorm] || row.unidad;
      var normTranslatedUnit = auditNormalizar(translatedUnit);
      if (dateUnitsData && dateUnitsData[normTranslatedUnit]) {
        gpsRows.push(row);
      }
    }
  }
  
  if (gpsRows.length === 0) return;
  var isOnlySpecialProject = (gpsRows.length === 1 && (especiales[auditNormalizar(gpsRows[0].proyecto)] || auditNormalizar(gpsRows[0].proyecto) === 'smarthaus gastos' || auditNormalizar(gpsRows[0].proyecto) === 'oficina' || auditNormalizar(gpsRows[0].proyecto) === 'smartcorp'));
  
  var installGpsRows = gpsRows.filter(function(r) {
    var pNorm = auditNormalizar(r.proyecto);
    return !(pNorm === 'smarthaus gastos' || pNorm === 'oficina' || pNorm === 'smartcorp');
  });
  var firstInstallRow = installGpsRows.length > 0 ? installGpsRows[0] : gpsRows[0];
  var lastInstallRow = installGpsRows.length > 0 ? installGpsRows[installGpsRows.length - 1] : gpsRows[gpsRows.length - 1];

  for (var i = 0; i < gpsRows.length; i++) {
    var row = gpsRows[i];
    var translatedUnit = reverseMap[auditNormalizar(row.unidad)] || row.unidad;
    var normTranslatedUnit = auditNormalizar(translatedUnit);
    var routes = dateUnitsData ? (dateUnitsData[normTranslatedUnit] || []) : [];
    row.routes = auditFiltrarRutasPorTurno(routes, row.deOriginal, row.aOriginal);
    row.normTranslatedUnit = normTranslatedUnit;
  }
  
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
  
  gpsRows.sort(function(a, b) {
    if (!a._firstTouchDt) return 1;
    if (!b._firstTouchDt) return -1;
    return a._firstTouchDt.getTime() - b._firstTouchDt.getTime();
  });
  
  for (var i = 0; i < gpsRows.length; i++) {
    gpsRows[i]._boundaryStart = 0.0;
    gpsRows[i]._boundaryEnd = 24.0;
  }
  
  for (var i = 0; i < gpsRows.length - 1; i++) {
    var rowPrev = gpsRows[i];
    var rowCurr = gpsRows[i+1];
    if (rowPrev.normTranslatedUnit !== rowCurr.normTranslatedUnit) {
      var tReturn = auditBuscarHoraRegresoOficina(rowPrev.routes, geocercas, auditNormalizar(rowPrev.proyecto), officeLat, officeLon);
      var tDepart = auditBuscarHoraSalidaOficina(rowCurr.routes, geocercas, auditNormalizar(rowCurr.proyecto), officeLat, officeLon);
      if (tReturn && tDepart) {
        var decReturn = tReturn.getHours() + tReturn.getMinutes() / 60.0;
        var decDepart = tDepart.getHours() + tDepart.getMinutes() / 60.0;
        var decMid = (decReturn + decDepart) / 2.0;
        var decBoundary = Math.ceil(decMid * 4) / 4.0;
        rowPrev._boundaryEnd = decBoundary;
        rowCurr._boundaryStart = decBoundary;
      } else {
        var decBoundary = 12.0;
        rowPrev._boundaryEnd = decBoundary;
        rowCurr._boundaryStart = decBoundary;
      }
    } else {
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
      } else {
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
        } else {
          var routeClusterIds = [];
          var currentClusterIdx = 0;
          for (var r = 0; r < routes.length; r++) {
            var rt = routes[r];
            if (r === 0) {
              routeClusterIds.push(0);
            } else {
              var rtPrev = routes[r - 1];
              var distToOfficeCurr = auditCalcularDistanciaMetros(rt.end_lat, rt.end_lon, officeLat, officeLon);
              if (distToOfficeCurr < 150) {
                routeClusterIds.push(currentClusterIdx);
              } else {
                var distBetween = auditCalcularDistanciaMetros(rtPrev.end_lat, rtPrev.end_lon, rt.end_lat, rt.end_lon);
                var prevGeoId = auditObtenerGeocercaDetectada(rtPrev.end_lat, rtPrev.end_lon, geocercas, []);
                var currGeoId = auditObtenerGeocercaDetectada(rt.end_lat, rt.end_lon, geocercas, []);
                var sameGeo = (prevGeoId && currGeoId && prevGeoId === currGeoId);
                if (distBetween >= 2000 && !sameGeo) {
                  currentClusterIdx++;
                }
                routeClusterIds.push(currentClusterIdx);
              }
            }
          }
          
          var totalClusters = currentClusterIdx + 1;
          var totalRoutesCount = routes.length;
          var totalProjectsCount = gpsRows.length;
          var splitRouteIdx = -1;
          if (totalClusters === totalProjectsCount) {
            for (var r = 0; r < routeClusterIds.length; r++) {
              if (routeClusterIds[r] === i + 1) {
                splitRouteIdx = r;
                break;
              }
            }
          }
          if (splitRouteIdx <= 0 || splitRouteIdx >= totalRoutesCount) {
            splitRouteIdx = Math.floor((i + 1) * totalRoutesCount / totalProjectsCount);
          }
          
          if (splitRouteIdx > 0 && splitRouteIdx < totalRoutesCount) {
            var rtPrevLast = routes[splitRouteIdx - 1];
            var rtCurrFirst = routes[splitRouteIdx];
            if (rtPrevLast.end_time && rtCurrFirst.start_time) {
              var decLeave = rtPrevLast.end_time.getHours() + rtPrevLast.end_time.getMinutes() / 60.0;
              var decArrive = rtCurrFirst.start_time.getHours() + rtCurrFirst.start_time.getMinutes() / 60.0;
              var decMid = (decLeave + decArrive) / 2.0;
              var decBoundary = Math.ceil(decMid * 4) / 4.0;
              rowPrev._boundaryEnd = decBoundary;
              rowCurr._boundaryStart = decBoundary;
            } else {
              var decBoundary = 12.5;
              rowPrev._boundaryEnd = decBoundary;
              rowCurr._boundaryStart = decBoundary;
            }
          } else {
            var decBoundary = 12.5;
            rowPrev._boundaryEnd = decBoundary;
            rowCurr._boundaryStart = decBoundary;
          }
        }
      }
    }
  }
  
  for (var i = 0; i < gpsRows.length; i++) {
    var row = gpsRows[i];
    var boundStart = row._boundaryStart;
    var boundEnd = row._boundaryEnd;
    row.routes = row.routes.filter(function(rt) {
      var rtStartDec = rt.start_time.getHours() + rt.start_time.getMinutes() / 60.0;
      return (rtStartDec >= boundStart && rtStartDec < boundEnd);
    });
  }
  
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
        if (firstStartDec - 8.0 >= 1.0 && !isOnlySpecialProject) {
          deDec = Math.ceil(firstStartDec * 4) / 4.0;
        } else {
          deDec = 8.0;
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
        if (lastEndDec > 16.5) {
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
  
  var usedRowIndices = {};
  var techRol = "";
  for (var j = 0; j < techRows.length; j++) {
    if (techRows[j].rol) {
      techRol = techRows[j].rol;
      break;
    }
  }
  
  var firstRow = gpsRows[0];
  var lastRow = gpsRows[gpsRows.length - 1];
  
  var firstRoutes = (firstInstallRow && firstInstallRow.routes) ? firstInstallRow.routes : [];
  var firstStart = null;
  for (var r = 0; r < firstRoutes.length; r++) {
    var rt = firstRoutes[r];
    if (rt && rt.start_time && (firstStart === null || rt.start_time < firstStart)) {
      firstStart = rt.start_time;
    }
  }
  var firstStartDec = firstStart ? (firstStart.getHours() + firstStart.getMinutes() / 60.0) : 8.0;
  
  var lastRoutes = (lastInstallRow && lastInstallRow.routes) ? lastInstallRow.routes : [];
  var lastEnd = null;
  for (var r = 0; r < lastRoutes.length; r++) {
    var rt = lastRoutes[r];
    if (rt && rt.end_time && (lastEnd === null || rt.end_time > lastEnd)) {
      lastEnd = rt.end_time;
    }
  }
  var lastEndDec = lastEnd ? (lastEnd.getHours() + lastEnd.getMinutes() / 60.0) : 17.0;
  
  if (firstStartDec - 8.0 >= 1.0 && !isOnlySpecialProject) {
    var existingStartRow = null;
    for (var j = 0; j < techRows.length; j++) {
      var tr = techRows[j];
      var trProjNorm = auditNormalizar(tr.proyecto);
      if (trProjNorm === 'smarthaus gastos' || trProjNorm === 'oficina' || trProjNorm === 'smartcorp') {
        existingStartRow = tr;
        usedRowIndices[tr.index] = true;
        break;
      }
    }
    
    var strA = formatDecimalToTime15Min(firstRow.T_de);
    if (existingStartRow) {
      var targetSheetRow = existingStartRow.index + 1;
      var rangeGtoZ = sheet.getRange(targetSheetRow, 7, 1, 20);
      var valuesGtoZ = rangeGtoZ.getValues()[0];
      var formulasGtoZ = rangeGtoZ.getFormulas()[0];
      
      valuesGtoZ[0] = "8:00";
      valuesGtoZ[1] = strA;
      valuesGtoZ[8] = "REVISAR";
      var warning = "[GPS] Fila administrativa autogenerada por inicio tardio (08:00 a " + strA + ":00)";
      var prevObs = String(valuesGtoZ[15] || '').trim();
      if (prevObs.indexOf(warning) === -1) {
        valuesGtoZ[15] = prevObs ? prevObs + " | " + warning : warning;
      }
      for (var k = 0; k < valuesGtoZ.length; k++) {
        if (formulasGtoZ[k]) valuesGtoZ[k] = formulasGtoZ[k];
      }
      rangeGtoZ.setValues([valuesGtoZ]);
    } else {
      var insertSheetRow = firstRow.index + 1;
      if (adminTracker.startNextRow === null || insertSheetRow < adminTracker.startNextRow) {
        adminTracker.startNextRow = insertSheetRow;
      } else {
        insertSheetRow = adminTracker.startNextRow;
      }
      auditInsertarFilaYActualizarModelos(
        sheet,
        insertSheetRow,
        dateStr,
        firstRow.nombre,
        "SMARTHAUS GASTOS",
        "8:00",
        strA,
        "Oficina",
        "NA",
        "[GPS] Fila administrativa autogenerada por inicio tardio (08:00 a " + strA + ":00)",
        techRol,
        currentData,
        techRows,
        gpsRows,
        adminTracker
      );
      adminTracker.startNextRow = insertSheetRow + 1;
    }
  }
  
  if (lastEndDec < 17.0 && (18.0 - lastEndDec >= 1.5) && !isOnlySpecialProject) {
    var existingEndRow = null;
    for (var j = 0; j < techRows.length; j++) {
      var tr = techRows[j];
      var trProjNorm = auditNormalizar(tr.proyecto);
      if ((trProjNorm === 'smarthaus gastos' || trProjNorm === 'oficina' || trProjNorm === 'smartcorp') && !usedRowIndices[tr.index]) {
        existingEndRow = tr;
        usedRowIndices[tr.index] = true;
        break;
      }
    }
    
    var strDe = formatDecimalToTime15Min(lastRow.T_a);
    if (existingEndRow) {
      var targetSheetRow = existingEndRow.index + 1;
      var rangeGtoZ = sheet.getRange(targetSheetRow, 7, 1, 20);
      var valuesGtoZ = rangeGtoZ.getValues()[0];
      var formulasGtoZ = rangeGtoZ.getFormulas()[0];
      
      valuesGtoZ[0] = strDe;
      valuesGtoZ[1] = "17:00";
      valuesGtoZ[8] = "REVISAR";
      var warning = "[GPS] Fila administrativa autogenerada por retorno temprano (" + strDe + " a 17:00)";
      var prevObs = String(valuesGtoZ[15] || '').trim();
      if (prevObs.indexOf(warning) === -1) {
        valuesGtoZ[15] = prevObs ? prevObs + " | " + warning : warning;
      }
      for (var k = 0; k < valuesGtoZ.length; k++) {
        if (formulasGtoZ[k]) valuesGtoZ[k] = formulasGtoZ[k];
      }
      rangeGtoZ.setValues([valuesGtoZ]);
    } else {
      var insertSheetRowEnd;
      var maxVehicleRowIdx = -1;
      var normTranslatedUnit = lastRow.normTranslatedUnit;
      for (var b = 1; b < currentData.length; b++) {
        var uVal = String(currentData[b][AUDIT_COL_BIT_UNIDAD] || '').trim();
        var uNorm = auditNormalizar(uVal);
        var tUnit = reverseMap[uNorm] || uVal;
        var ntUnit = auditNormalizar(tUnit);
        if (ntUnit === normTranslatedUnit) {
          if (b > maxVehicleRowIdx) {
            maxVehicleRowIdx = b;
          }
        }
      }
      var lastProjSheetRow = (maxVehicleRowIdx !== -1) ? (maxVehicleRowIdx + 1) : (lastRow.index + 1);
      
      if (adminTracker.endNextRow === null || lastProjSheetRow >= adminTracker.endNextRow) {
        insertSheetRowEnd = lastProjSheetRow + 1;
      } else {
        insertSheetRowEnd = adminTracker.endNextRow;
      }
      auditInsertarFilaYActualizarModelos(
        sheet,
        insertSheetRowEnd,
        dateStr,
        lastRow.nombre,
        "SMARTHAUS GASTOS",
        strDe,
        "17:00",
        "Oficina",
        "NA",
        "[GPS] Fila administrativa autogenerada por retorno temprano (" + strDe + " a 17:00)",
        techRol,
        currentData,
        techRows,
        gpsRows,
        adminTracker
      );
      adminTracker.endNextRow = insertSheetRowEnd + 1;
    }
  }
  
  var allTechRoutes = [];
  for (var i = 0; i < gpsRows.length; i++) {
    allTechRoutes = allTechRoutes.concat(gpsRows[i].routes);
  }
  if (allTechRoutes.length > 0) {
    var targetProjectsNorm = gpsRows.map(function(row) {
      return auditNormalizar(row.proyecto);
    });
    var unitString = gpsRows.map(function(r) { return r.unidad; }).join(', ');
    // Buscar techSap en currentData para pasarlo a auditDetectarEInsertarParadasProlongadas
    var techSap = "";
    for (var b = 1; b < currentData.length; b++) {
      var fFechaRaw = currentData[b][AUDIT_COL_BIT_FECHA];
      if (!fFechaRaw) continue;
      var fFecha = auditFormatDate(fFechaRaw);
      var fNombre = String(currentData[b][AUDIT_COL_BIT_NOMBRE] || '').trim();
      if (fFecha === dateStr && fNombre === firstRow.nombre) {
        techSap = String(currentData[b][1] || ''); // Col B (SAP)
        break;
      }
    }
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

function auditProcesarDiaTecnicoEscribirMetricas(sheet, techRows, dateUnitsData, geocercas, officeLat, officeLon, dateStr, mapaEquivalencias, especiales, isPrueba, currentData) {
  var reverseMap = {};
  for (var gpsKey in mapaEquivalencias) {
    var bitacoraVal = mapaEquivalencias[gpsKey];
    reverseMap[auditNormalizar(bitacoraVal)] = gpsKey;
  }
  
  var gpsRows = [];
  for (var i = 0; i < techRows.length; i++) {
    var row = techRows[i];
    var projNorm = auditNormalizar(row.proyecto);
    var isEspecial = !!(especiales && (especiales[projNorm] ||
      (projNorm.indexOf('2605') !== -1 && (projNorm.indexOf('mtto') !== -1 || projNorm.indexOf('personal') !== -1)) ||
      projNorm === 'smarthaus gastos' || projNorm === 'oficina' || projNorm === 'smartcorp'));
    
    var unidadNorm = auditNormalizar(row.unidad);
    if (isEspecial) {
      gpsRows.push(row);
    } else if (unidadNorm !== 'na' && unidadNorm !== '') {
      var translatedUnit = reverseMap[unidadNorm] || row.unidad;
      var normTranslatedUnit = auditNormalizar(translatedUnit);
      if (dateUnitsData && dateUnitsData[normTranslatedUnit]) {
        gpsRows.push(row);
      }
    }
  }
  
  if (gpsRows.length === 0) return;
  var isOnlySpecialProject = (gpsRows.length === 1 && (especiales[auditNormalizar(gpsRows[0].proyecto)] || auditNormalizar(gpsRows[0].proyecto) === 'smarthaus gastos' || auditNormalizar(gpsRows[0].proyecto) === 'oficina' || auditNormalizar(gpsRows[0].proyecto) === 'smartcorp'));
  
  var installGpsRows = gpsRows.filter(function(r) {
    var pNorm = auditNormalizar(r.proyecto);
    return !(pNorm === 'smarthaus gastos' || pNorm === 'oficina' || pNorm === 'smartcorp');
  });
  var firstInstallRow = installGpsRows.length > 0 ? installGpsRows[0] : gpsRows[0];
  var lastInstallRow = installGpsRows.length > 0 ? installGpsRows[installGpsRows.length - 1] : gpsRows[gpsRows.length - 1];
  
  for (var i = 0; i < gpsRows.length; i++) {
    var row = gpsRows[i];
    var translatedUnit = reverseMap[auditNormalizar(row.unidad)] || row.unidad;
    var normTranslatedUnit = auditNormalizar(translatedUnit);
    var routes = dateUnitsData ? (dateUnitsData[normTranslatedUnit] || []) : [];
    row.routes = auditFiltrarRutasPorTurno(routes, row.deOriginal, row.aOriginal);
    row.normTranslatedUnit = normTranslatedUnit;
  }
  
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
  
    // Separar proyectos de instalación de filas administrativas
    var installRows = gpsRows.filter(function(r) {
      var pNorm = auditNormalizar(r.proyecto);
      return !(pNorm === 'smarthaus gastos' || pNorm === 'oficina' || pNorm === 'smartcorp');
    });

    var adminRows = gpsRows.filter(function(r) {
      var pNorm = auditNormalizar(r.proyecto);
      return (pNorm === 'smarthaus gastos' || pNorm === 'oficina' || pNorm === 'smartcorp');
    });

    installRows.sort(function(a, b) {
      if (!a._firstTouchDt) return 1;
      if (!b._firstTouchDt) return -1;
      return a._firstTouchDt.getTime() - b._firstTouchDt.getTime();
    });

    for (var k = 0; k < installRows.length; k++) {
      installRows[k]._boundaryStart = 0.0;
      installRows[k]._boundaryEnd = 24.0;
    }

    for (var k = 0; k < installRows.length - 1; k++) {
      var rowPrev = installRows[k];
      var rowCurr = installRows[k+1];
      if (rowPrev.normTranslatedUnit !== rowCurr.normTranslatedUnit) {
        var tReturn = auditBuscarHoraRegresoOficina(rowPrev.routes, geocercas, auditNormalizar(rowPrev.proyecto), officeLat, officeLon);
        var tDepart = auditBuscarHoraSalidaOficina(rowCurr.routes, geocercas, auditNormalizar(rowCurr.proyecto), officeLat, officeLon);
        
        var decReturn = tReturn ? (tReturn.getHours() + tReturn.getMinutes() / 60.0) : (rowPrev.routes.length > 0 ? (rowPrev.routes[rowPrev.routes.length - 1].end_time.getHours() + rowPrev.routes[rowPrev.routes.length - 1].end_time.getMinutes() / 60.0) : 10.0);
        var decDepart = tDepart ? (tDepart.getHours() + tDepart.getMinutes() / 60.0) : (rowCurr.routes.length > 0 ? (rowCurr.routes[0].start_time.getHours() + rowCurr.routes[0].start_time.getMinutes() / 60.0) : 11.0);
        
        var decMid = (decReturn + decDepart) / 2.0;
        var decBoundary = Math.ceil(decMid * 4) / 4.0;
        rowPrev._boundaryEnd = decBoundary;
        rowCurr._boundaryStart = decBoundary;
      } else {
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
        } else {
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
          } else {
            var routeClusterIds = [];
            var currentClusterIdx = 0;
            for (var r = 0; r < routes.length; r++) {
              var rt = routes[r];
              if (r === 0) {
                routeClusterIds.push(0);
              } else {
                var rtPrev = routes[r - 1];
                var distToOfficeCurr = auditCalcularDistanciaMetros(rt.end_lat, rt.end_lon, officeLat, officeLon);
                if (distToOfficeCurr < 150) {
                  routeClusterIds.push(currentClusterIdx);
                } else {
                  var distBetween = auditCalcularDistanciaMetros(rtPrev.end_lat, rtPrev.end_lon, rt.end_lat, rt.end_lon);
                  var prevGeoId = auditObtenerGeocercaDetectada(rtPrev.end_lat, rtPrev.end_lon, geocercas, []);
                  var currGeoId = auditObtenerGeocercaDetectada(rt.end_lat, rt.end_lon, geocercas, []);
                  var sameGeo = (prevGeoId && currGeoId && prevGeoId === currGeoId);
                  if (distBetween >= 2000 && !sameGeo) {
                    currentClusterIdx++;
                  }
                  routeClusterIds.push(currentClusterIdx);
                }
              }
            }
            
            var totalClusters = currentClusterIdx + 1;
            var totalRoutesCount = routes.length;
            var totalProjectsCount = installRows.length;
            var splitRouteIdx = -1;
            if (totalClusters === totalProjectsCount) {
              for (var r = 0; r < routeClusterIds.length; r++) {
                if (routeClusterIds[r] === k + 1) {
                  splitRouteIdx = r;
                  break;
                }
              }
            }
            if (splitRouteIdx <= 0 || splitRouteIdx >= totalRoutesCount) {
              splitRouteIdx = Math.floor((k + 1) * totalRoutesCount / totalProjectsCount);
            }
            
            if (splitRouteIdx > 0 && splitRouteIdx < totalRoutesCount) {
              var rtPrevLast = routes[splitRouteIdx - 1];
              var rtCurrFirst = routes[splitRouteIdx];
              if (rtPrevLast.end_time && rtCurrFirst.start_time) {
                var decLeave = rtPrevLast.end_time.getHours() + rtPrevLast.end_time.getMinutes() / 60.0;
                var decArrive = rtCurrFirst.start_time.getHours() + rtCurrFirst.start_time.getMinutes() / 60.0;
                var decMid = (decLeave + decArrive) / 2.0;
                var decBoundary = Math.ceil(decMid * 4) / 4.0;
                rowPrev._boundaryEnd = decBoundary;
                rowCurr._boundaryStart = decBoundary;
              }
            }
          }
        }
      }
    }

    for (var k = 0; k < installRows.length; k++) {
      var rowInst = installRows[k];
      var pNormInst = auditNormalizar(rowInst.proyecto);
      var isEspecialInst = !!(especiales && (especiales[pNormInst] || pNormInst === 'smarthaus gastos' || pNormInst === 'oficina' || pNormInst === 'smartcorp'));

      if (isEspecialInst) {
        rowInst.T_de = 8.0;
        rowInst.T_a = 17.0;
      } else {
        var isFirstInstall = (k === 0);
        var isLastInstall = (k === installRows.length - 1);

        if (isFirstInstall) {
          rowInst.T_de = (firstStartDec - 8.0 >= 1.0 && !isOnlySpecialProject) ? (Math.ceil(firstStartDec * 4) / 4.0) : 8.0;
        } else {
          rowInst.T_de = rowInst._boundaryStart || 12.0;
        }

        if (isLastInstall) {
          rowInst.T_a = 17.0;
        } else {
          rowInst.T_a = rowInst._boundaryEnd || 17.0;
        }
      }
    }

    for (var k = 0; k < adminRows.length; k++) {
      var rowAdmin = adminRows[k];
      if (firstStartDec - 8.0 >= 1.0 && !isOnlySpecialProject) {
        rowAdmin.T_de = 8.0;
        rowAdmin.T_a = installRows.length > 0 ? installRows[0].T_de : 9.5;
      } else if (lastEndDec < 17.0 && (18.0 - lastEndDec >= 1.5) && !isOnlySpecialProject) {
        rowAdmin.T_de = installRows.length > 0 ? installRows[installRows.length - 1].T_a : 16.5;
        rowAdmin.T_a = 17.0;
      } else {
        rowAdmin.T_de = 8.0;
        rowAdmin.T_a = 17.0;
      }
    }
  
  var usedRowIndices = {};
  var firstRow = gpsRows[0];
  var lastRow = gpsRows[gpsRows.length - 1];
  
  var firstRoutes = (firstInstallRow && firstInstallRow.routes) ? firstInstallRow.routes : [];
  var firstStart = null;
  for (var r = 0; r < firstRoutes.length; r++) {
    var rt = firstRoutes[r];
    if (rt && rt.start_time && (firstStart === null || rt.start_time < firstStart)) {
      firstStart = rt.start_time;
    }
  }
  var firstStartDec = firstStart ? (firstStart.getHours() + firstStart.getMinutes() / 60.0) : 8.0;
  
  var lastRoutes = (lastInstallRow && lastInstallRow.routes) ? lastInstallRow.routes : [];
  var lastEnd = null;
  for (var r = 0; r < lastRoutes.length; r++) {
    var rt = lastRoutes[r];
    if (rt && rt.end_time && (lastEnd === null || rt.end_time > lastEnd)) {
      lastEnd = rt.end_time;
    }
  }
  var lastEndDec = lastEnd ? (lastEnd.getHours() + lastEnd.getMinutes() / 60.0) : 17.0;
  
  if (firstStartDec - 8.0 >= 1.0 && !isOnlySpecialProject) {
    for (var j = 0; j < techRows.length; j++) {
      var tr = techRows[j];
      var trProjNorm = auditNormalizar(tr.proyecto);
      if (trProjNorm === 'smarthaus gastos' || trProjNorm === 'oficina' || trProjNorm === 'smartcorp') {
        usedRowIndices[tr.index] = true;
        break;
      }
    }
  }
  if (lastEndDec < 17.0 && (18.0 - lastEndDec >= 1.5) && !isOnlySpecialProject) {
    for (var j = 0; j < techRows.length; j++) {
      var tr = techRows[j];
      var trProjNorm = auditNormalizar(tr.proyecto);
      if ((trProjNorm === 'smarthaus gastos' || trProjNorm === 'oficina' || trProjNorm === 'smartcorp') && !usedRowIndices[tr.index]) {
        usedRowIndices[tr.index] = true;
        break;
      }
    }
  }
  
  // --- CALCULAR Y ESCRIBIR MÉTRICAS EN BITÁCORA ---
  for (var i = 0; i < gpsRows.length; i++) {
    var row = gpsRows[i];
    var rowNum = row.index + 1;
    
    var validTechRows = techRows.filter(function(tr) {
      var trProjNorm = auditNormalizar(tr.proyecto);
      var isAdmin = (trProjNorm === 'smarthaus gastos' || trProjNorm === 'oficina' || trProjNorm === 'smartcorp');
      if (isAdmin) {
        return !!usedRowIndices[tr.index];
      }
      return true;
    });
    
    var myIndexInValidTechRows = -1;
    for (var j = 0; j < validTechRows.length; j++) {
      if (validTechRows[j].index === row.index) {
        myIndexInValidTechRows = j;
        break;
      }
    }
    var isFirst = (myIndexInValidTechRows === 0);
    var isLast = (myIndexInValidTechRows === validTechRows.length - 1);
    
    var res = auditCalcularMetricasParaFilaGPS(row, geocercas, officeLat, officeLon, isFirst, isLast, dateStr, especiales);
    
    if (isFirst && firstStartDec - 8.0 >= 1.0 && !isOnlySpecialProject) {
      res.deVal = formatDecimalToTime15Min(row.T_de);
    }
    if (isLast && lastEndDec < 17.0 && (18.0 - lastEndDec >= 1.5) && !isOnlySpecialProject) {
      res.aVal = formatDecimalToTime15Min(row.T_a);
    }
    
    var rangeGtoZ = sheet.getRange(rowNum, 7, 1, 20);
    var valuesGtoZ = rangeGtoZ.getValues()[0];
    var formulasGtoZ = rangeGtoZ.getFormulas()[0];
    
    var alertTriggered = false;
    var currentObs = String(valuesGtoZ[15] || '').trim();
    
    if (res.alertaHorario && isFirst) {
      alertTriggered = true;
      var warning = "[GPS] REVISAR: Inicio de jornada detectado tarde (" + res.horaReal + ")";
      if (currentObs.indexOf(warning) === -1) {
        currentObs = currentObs ? currentObs + " | " + warning : warning;
      }
    }
    if (res.alertaLlegadaTemprana && isLast) {
      alertTriggered = true;
      var warning = "[GPS] REVISAR: Termino de jornada detectado temprano (" + res.horaLlegadaReal + ")";
      if (currentObs.indexOf(warning) === -1) {
        currentObs = currentObs ? currentObs + " | " + warning : warning;
      }
    }
    if (res.alertaVelocidadBaja) {
      alertTriggered = true;
      var warning = "[GPS] REVISAR: Velocidad promedio baja (" + res.velocidadBajaReal + " km/h)";
      if (currentObs.indexOf(warning) === -1) {
        currentObs = currentObs ? currentObs + " | " + warning : warning;
      }
    }
    if (res.sinGeocerca) {
      alertTriggered = true;
      var warning = "[GPS] REVISAR: El vehiculo no visito la geocerca de este proyecto.";
      if (currentObs.indexOf(warning) === -1) {
        currentObs = currentObs ? currentObs + " | " + warning : warning;
      }
    }
    
    if (alertTriggered) {
      valuesGtoZ[8] = "REVISAR";
    }
    
    valuesGtoZ[0] = res.deVal;
    valuesGtoZ[1] = res.aVal;
    valuesGtoZ[9] = res.horaSalida;
    valuesGtoZ[10] = res.horaEntrada;
    valuesGtoZ[11] = res.tiempoRecorrido;
    valuesGtoZ[12] = res.tiempoParadas;
    valuesGtoZ[13] = res.paradas;
    valuesGtoZ[14] = res.regresos;
    valuesGtoZ[15] = currentObs;
    valuesGtoZ[16] = res.km;
    valuesGtoZ[17] = res.horasExtra;
    valuesGtoZ[18] = res.horaSalProy;
    valuesGtoZ[19] = res.horaLlegProy;
    
    var colsToPreserveFormulas = [2, 3, 4, 5, 6, 7];
    for (var fIdx = 0; fIdx < colsToPreserveFormulas.length; fIdx++) {
      var k = colsToPreserveFormulas[fIdx];
      if (formulasGtoZ[k]) {
        valuesGtoZ[k] = formulasGtoZ[k];
      }
    }
    
    rangeGtoZ.setValues([valuesGtoZ]);
  }
  
  if (gpsRows.length > 0) {
    for (var j = 0; j < techRows.length; j++) {
      var tr = techRows[j];
      var trProjNorm = auditNormalizar(tr.proyecto);
      if (trProjNorm === 'smarthaus gastos' || trProjNorm === 'oficina' || trProjNorm === 'smartcorp') {
        if (!usedRowIndices[tr.index]) {
          var targetSheetRow = tr.index + 1;
          var rangeGtoZ = sheet.getRange(targetSheetRow, 7, 1, 20);
          var valuesGtoZ = rangeGtoZ.getValues()[0];
          var formulasGtoZ = rangeGtoZ.getFormulas()[0];
          valuesGtoZ[8] = "REVISAR";
          var warning = "[GPS] REVISAR: Fila administrativa redundante con proyecto activo.";
          var prevObs = String(valuesGtoZ[15] || '').trim();
          if (prevObs.indexOf(warning) === -1) {
            valuesGtoZ[15] = prevObs ? prevObs + " | " + warning : warning;
          }
          var colsToPreserveFormulas = [2, 3, 4, 5, 6, 7];
          for (var fIdx = 0; fIdx < colsToPreserveFormulas.length; fIdx++) {
            var k = colsToPreserveFormulas[fIdx];
            if (formulasGtoZ[k]) {
              valuesGtoZ[k] = formulasGtoZ[k];
            }
          }
          rangeGtoZ.setValues([valuesGtoZ]);
        }
      }
    }
  }
}
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
    if (firstStartDecimal < 6.0) {
      // Excepcion A: salida muy temprana (<06:00) - suprimir HORA SALIDA y HORA LLEG PROY
      deInfo.deVal = 8.0;
      deInfo.alerta = true;
      deInfo.horaReal = formatTimeOnly(firstStart);
      deInfo.salidaMuyTemprana = true;
      horaSalidaReal = ''; // NO escribir hora de salida real
    } else if (firstStartDecimal < 7.5) {
      deInfo.deVal = 8.0;
      deInfo.alerta = true;
      deInfo.horaReal = formatTimeOnly(firstStart);
      deInfo.salidaMuyTemprana = false;
      horaSalidaReal = formatTimeOnly(firstStart);
    } else {
      deInfo.deVal = 8.0;
      deInfo.alerta = false;
      deInfo.salidaMuyTemprana = false;
      horaSalidaReal = formatTimeOnly(firstStart);
    }
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
      if (lastEndDecimal < 16.5) {
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
  
  res.deVal = formatDecimalToTime(row.T_de);
  res.aVal = isLastOfPerson ? (horasExtraVal ? "" : "17:00") : formatDecimalToTime(row.T_a);
  
  res.horaSalida = isFirstOfPerson ? horaSalidaReal : formatDecimalToTime(deHour);
  res.horaEntrada = isLastOfPerson ? (horasExtraVal ? "" : horaLlegadaReal) : formatDecimalToTime(aHour);
  
  res.alertaHorario = isFirstOfPerson ? deInfo.alerta : false;
  res.horaReal = isFirstOfPerson ? deInfo.horaReal : '';
  res.alertaLlegadaTemprana = isLastOfPerson ? aInfo.alerta : false;
  res.horaLlegadaReal = isLastOfPerson ? aInfo.horaReal : '';
  res.horasExtra = isLastOfPerson ? horasExtraVal : "";
  
  // Regla base: horaSalida y horaLlegProy solo en primero+normal
  // horaSalProy y horaEntrada solo en ultimo+normal
  if (!isFirstOfPerson || isEspecial) {
    res.horaSalida = "";
  }
  // horaLlegProy: primero del dia + normal (sin excepcion A)
  if (!isFirstOfPerson || isEspecial) {
    res.horaLlegProy = "";
  }
  if (!isLastOfPerson || isEspecial) {
    res.horaEntrada = "";
  }
  // horaSalProy: ultimo del dia + normal (sin excepcion B)
  if (!isLastOfPerson || isEspecial) {
    res.horaSalProy = "";
  }
  
  // Excepcion A: salida muy temprana (<06:00) - suprimir HORA SALIDA y HORA LLEG PROY
  if (isFirstOfPerson && deInfo.salidaMuyTemprana) {
    res.horaSalida = "";
    res.horaLlegProy = "";
    if (!res.sinGeocerca) {
      res.alertaHorario = true;
      res.horaReal = deInfo.horaReal;
    }
  }
  // Excepcion B: horas extra (>19:00) - suprimir HORA ENTRADA y HORA SAL PROY
  if (isLastOfPerson && horasExtraVal) {
    res.horaSalida = (isFirstOfPerson && !deInfo.salidaMuyTemprana) ? horaSalidaReal : "";
    res.horaEntrada = "";
    res.horaLlegProy = (isFirstOfPerson && !deInfo.salidaMuyTemprana) ? res.horaLlegProy : "";
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
    res.deVal = formatDecimalToTime(row.T_de);
    res.aVal = formatDecimalToTime(row.T_a);
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
    
    res.km = routes.length > 0 ? Number(totalDistance.toFixed(2)) : "";
    res.tiempoRecorrido = routes.length > 0 ? formatSecToHMS(totalDurationSec) : "";
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
    esNocturno = (deHour >= 18.0 || deHour < 6.0 || aHour >= 18.0 || aHour < 6.0);
    if (!esNocturno) {
      for (var r = 0; r < routes.length; r++) {
        var rt = routes[r];
        var rtStart = rt.start_time.getHours() + rt.start_time.getMinutes() / 60.0;
        var rtEnd = rt.end_time.getHours() + rt.end_time.getMinutes() / 60.0;
        if (rtStart >= 18.0 || rtStart < 6.0 || rtEnd >= 18.0 || rtEnd < 6.0) {
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
function auditInsertarFilaAdministrativa(sheet, targetRowIdx, dateStr, nombre, proyecto, de, a, asunto, unidad, obs, rol) {
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
  rowValues[5] = rol || "";                   // Rol (col F, index 5)
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
  if (!routes || !routes.length) return null;
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
  if (!routes || !routes.length) return null;
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

/**
 * Inserta una fila de administración física, y actualiza todos los arrays de datos locales en memoria
 * para garantizar la sincronización de índices y prevenir desalineaciones visuales en Bitácora.
 */
function auditInsertarFilaYActualizarModelos(sheet, targetRowIdx, dateStr, nombre, proyecto, de, a, asunto, unidad, obs, rol, currentData, techRows, gpsRows, adminTracker) {
  // 1. Insertar físicamente en la hoja
  auditInsertarFilaAdministrativa(sheet, targetRowIdx, dateStr, nombre, proyecto, de, a, asunto, unidad, obs, rol);
  
  // 2. Insertar fila dummy en currentData para sincronizar los índices del bucle loop
  if (currentData) {
    var newRow = new Array(26);
    newRow[2] = dateStr;                     // FECHA (col C, index 2)
    newRow[3] = proyecto;                    // PROYECTO (col D, index 3)
    newRow[4] = nombre;                      // NOMBRE (col E, index 4)
    newRow[5] = rol || "";                   // Rol (col F, index 5)
    newRow[6] = de;                          // DE (col G, index 6)
    newRow[7] = a;                           // A (col H, index 7)
    newRow[9] = unidad;                      // UNIDAD (col J, index 9)
    newRow[10] = "";                         // REPORTE ENV (col K, index 10)
    newRow[11] = asunto;                     // ASUNTO (col L, index 11)
    newRow[14] = "REVISAR";                  // REV (col O, index 14)
    newRow[21] = obs;                        // OBSERVACIONES (col V, index 21)
    
    currentData.splice(targetRowIdx - 1, 0, newRow);
  }
  
  // 3. Desplazar los índices del modelo techRows local
  if (techRows) {
    for (var j = 0; j < techRows.length; j++) {
      if (techRows[j].index >= targetRowIdx - 1) {
        techRows[j].index++;
      }
    }
  }
  
  // 4. Desplazar los índices del modelo gpsRows local
  if (gpsRows) {
    for (var j = 0; j < gpsRows.length; j++) {
      if (gpsRows[j].index >= targetRowIdx - 1) {
        gpsRows[j].index++;
      }
    }
  }
  
  // 5. Ajustar punteros de adminTracker
  if (adminTracker) {
    if (adminTracker.startNextRow !== null && targetRowIdx <= adminTracker.startNextRow) {
      adminTracker.startNextRow++;
    }
    if (adminTracker.endNextRow !== null && targetRowIdx <= adminTracker.endNextRow) {
      adminTracker.endNextRow++;
    }
  }
}

function auditObtenerFilasTecnico(currentData, activeTechName, dateStr) {
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
        rol: String(currentData[b][5] || '').trim(), // Rol (col F, index 5)
        asunto: String(currentData[b][AUDIT_COL_BIT_ASUNTO] || '').trim(),
        unidad: String(currentData[b][AUDIT_COL_BIT_UNIDAD] || '').trim(),
        deOriginal: currentData[b][AUDIT_COL_BIT_DE],
        aOriginal: currentData[b][AUDIT_COL_BIT_A]
      });
    }
  }
  return techRows;
}

function auditFiltrarRutasPorTurno(routes, deOriginal, aOriginal) {
  if (!routes || !routes.length) return [];
  var isDeEmpty = (deOriginal === undefined || deOriginal === null || String(deOriginal).trim() === "");
  var deDec = isDeEmpty ? 8.0 : parseTimeToDecimal(deOriginal);
  
  var esTurnoNocturno = (deDec >= 19.0 || deDec < 5.0);
  
  return routes.filter(function(rt) {
    if (!rt.start_time) return false;
    var rtStart = rt.start_time.getHours() + rt.start_time.getMinutes() / 60.0;
    var isRtNocturno = (rtStart >= 19.0 || rtStart < 5.0);
    return esTurnoNocturno ? isRtNocturno : !isRtNocturno;
  });
}
