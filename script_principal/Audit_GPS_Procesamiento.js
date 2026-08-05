/**
 * ============================================================
 *  SMARTCORP — Módulo de Procesamiento Principal GPS
 *  Archivo: Audit_GPS_Procesamiento.js
 *
 *  Propósito:
 *    Procesar la telemetría GPS desde Historial_GPS y escribir los
 *    resultados en la Bitácora Real o en la Hoja de Prueba.
 *
 *  Versión : 1.0.0
 *  Fecha   : 04/08/2026
 * ============================================================
 */

function ejecutarProcesamientoGPS() {
  ejecutarProcesamientoGPSCore(false);
}

function ejecutarProcesamientoGPSPrueba() {
  ejecutarProcesamientoGPSCore(true);
}

function ejecutarProcesamientoGPSCore(isPrueba, isSilent) {
  var ui = null;
  try { ui = SpreadsheetApp.getUi(); } catch (e) {}
  
  var ssActive = SpreadsheetApp.getActiveSpreadsheet();
  if (ssActive && !isSilent) ssActive.toast('🚀 Iniciando procesamiento de Auditoría GPS (Prueba=' + isPrueba + ')...', 'Auditorías SMARTCORP', 10);
  
  try {
    Logger.log('=== [PROCESAMIENTO LOG 1] INICIO: ejecutarProcesamientoGPSCore (Prueba=' + isPrueba + ') ===');
    var ssConfig  = auditObtenerSpreadsheetConfiguracion();
    var geocercas = auditObtenerGeocercas(ssConfig);
    var officeLat = 20.618933, officeLon = -100.407993;
    if (geocercas['SMARTCORP']) {
      officeLat = geocercas['SMARTCORP'].lat;
      officeLon = geocercas['SMARTCORP'].lon;
    }
    
    var mapaEquivalencias = auditObtenerMapaEquivalencias(ssConfig);
    var especiales        = auditObtenerProyectosEspeciales(ssConfig);

    // ── LEER TRAMOS PENDIENTES DESDE HISTORIAL_GPS ──
    var histRes             = auditLeerHistorialPendiente(ssConfig);
    var routesByUnitAndDate = histRes.byUnitAndDate;
    var datesToProcess      = histRes.datesToProcess;

    if (!datesToProcess || datesToProcess.length === 0) {
      if (ui && !isSilent) {
        ui.alert(
          'ℹ️ Sin Datos Pendientes',
          'No hay tramos pendientes en Historial_GPS.\nPor favor ingiere un archivo GPS primero.',
          ui.ButtonSet.OK
        );
      }
      return;
    }

    // Asegurar mapeo de equivalencias para que la Bitácora encuentre por Nombre_Bitacora o Nombre_GPS
    for (var d = 0; d < datesToProcess.length; d++) {
      var dKey = datesToProcess[d];
      var uMap = routesByUnitAndDate[dKey] || {};
      for (var uNorm in uMap) {
        var tramosArr = uMap[uNorm];
        if (tramosArr && tramosArr.length > 0) {
          var origUnit   = tramosArr[0].unit_id;
          var mappedUnit = auditBuscarEquivalenciaUnidad(origUnit, mapaEquivalencias);
          var mappedNorm = auditNormalizar(mappedUnit);
          if (mappedNorm && mappedNorm !== uNorm) {
            routesByUnitAndDate[dKey][mappedNorm] = tramosArr;
          }
        }
      }
    }
    
    Logger.log('[PROCESAMIENTO LOG 2] Fechas para procesar desde Historial_GPS: ' + JSON.stringify(datesToProcess));
    
    var ssBitacora      = SpreadsheetApp.openById(AUDIT_BITACORA_SHEET_ID);
    var targetSheetName = isPrueba ? 'Bitacora_Prueba' : AUDIT_BITACORA_TAB_NAME;
    var shBitacora      = ssBitacora.getSheetByName(targetSheetName);
    
    if (!shBitacora) {
      shBitacora = ssBitacora.insertSheet('Bitacora_Prueba');
    }
    
    if (isPrueba) {
      shBitacora.clear();
      var masterSh = ssBitacora.getSheetByName(AUDIT_BITACORA_TAB_NAME);
      if (masterSh) {
        var lastCol = masterSh.getLastColumn();
        masterSh.getRange(1, 1, 1, lastCol).copyTo(shBitacora.getRange(1, 1));
      }
      for (var dIdx = 0; dIdx < datesToProcess.length; dIdx++) {
        var dStr = auditNormalizarFechaKey(datesToProcess[dIdx]);
        auditCopiarFilasFechaPrueba(ssBitacora, shBitacora, dStr);
      }
      
      // Calcular métricas y llenar Bitacora_Prueba
      for (var dIdx = 0; dIdx < datesToProcess.length; dIdx++) {
        var dateStr       = auditNormalizarFechaKey(datesToProcess[dIdx]);
        var dateUnitsData = routesByUnitAndDate[dateStr] || {};
        auditProcesarFechaGlobal(shBitacora, dateUnitsData, geocercas, officeLat, officeLon, dateStr, mapaEquivalencias, especiales, isPrueba);
      }
    } else {
      // Si NO es prueba (Bitácora Real):
      // 1. Asegurar que Bitacora_Prueba tenga datos (si no tiene, calcularla primero)
      var shPrueba = ssBitacora.getSheetByName('Bitacora_Prueba');
      if (!shPrueba || shPrueba.getLastRow() < 2) {
        ejecutarProcesamientoGPSPrueba(true);
      }
      
      // 2. Traspasar datos de Bitacora_Prueba a Bitácora Real (Velocidad ultra-rápida 0.3 seg)
      auditTraspasarPruebaABitacoraReal(ssBitacora, datesToProcess);
      
      // 3. EJECUTAR AUDITORÍA DE REPORTES ENVIADOS AUTOMÁTICAMENTE (Columna K: REPORTE ENV.)
      for (var dIdx = 0; dIdx < datesToProcess.length; dIdx++) {
        var dStr = auditNormalizarFechaKey(datesToProcess[dIdx]);
        try {
          Logger.log('[PROCESAMIENTO] Ejecutando Auditoría de Reporte Enviado para fecha: ' + dStr);
          auditProcesarPeriodo(dStr, dStr);
        } catch (repErr) {
          Logger.log('[PROCESAMIENTO] ⚠️ Error en Auditoría de Reportes: ' + repErr.message);
        }
      }
      
      // 4. Cambiar Estado a "Procesado" en Historial_GPS
      if (histRes.pendingRowIndices.length > 0) {
        auditMarcarHistorialProcesado(histRes.shHistorial, histRes.pendingRowIndices);
      }
    }
    
    if (ui && !isSilent) {
      ui.alert(
        '✅ Procesamiento GPS y Auditoría Completados',
        'Se procesaron exitosamente ' + datesToProcess.length + ' fecha(s) en la hoja "' + targetSheetName + '".\n\n' +
        '• Datos GPS escritos en Bitácora Real.\n' +
        '• Columna "REPORTE ENV." auditada automáticamente.\n' +
        '• Estado actualizado a "Procesado" en Historial_GPS.',
        ui.ButtonSet.OK
      );
    }
  } catch (err) {
    Logger.log('❌ Error en ejecutarProcesamientoGPSCore: ' + err.message + '\n' + err.stack);
    if (ui && !isSilent) ui.alert('❌ Error en Procesamiento GPS', err.message, ui.ButtonSet.OK);
  }
}

/**
 * Copia en bloque masivo (0.3 seg) las filas prellenadas y validadas desde Bitacora_Prueba
 * directamente a la pestaña maestra Bitácora Real, copiando ÚNICAMENTE las 22 columnas de valores fijos
 * y preservando intactas las celdas con fórmula (ID, SAP, CÁLCULO HORAS, etc.).
 */
function auditTraspasarPruebaABitacoraReal(ssBitacora, datesToProcess) {
  var masterSh = ssBitacora.getSheetByName(AUDIT_BITACORA_TAB_NAME);
  var pruebaSh = ssBitacora.getSheetByName('Bitacora_Prueba');
  if (!masterSh || !pruebaSh) return;
  
  var pruebaData = pruebaSh.getDataRange().getValues();
  if (pruebaData.length < 2) return;
  
  var masterHeaders = masterSh.getRange(1, 1, 1, masterSh.getLastColumn()).getValues()[0];
  var pruebaHeaders = pruebaSh.getRange(1, 1, 1, pruebaSh.getLastColumn()).getValues()[0];
  
  // Lista exacta de 22 columnas proporcionadas por el usuario a copiar valores fijos
  var targetNames = [
    'FECHA', 'PROYECTO', 'NOMBRE', 'ROL', 'DE', 'A', 'UNIDAD', 'ASUNTO',
    'JUSTIFICACION', 'JUSTIFICACIÓN', 'NOTA', 'REV', 'HORA DE SALIDA', 'HORA DE ENTRADA',
    'TIEMPO RECORRIDO', 'TIEMPO DE PARADAS', 'PARADAS', 'REGRESOS', 'OBSERVACIONES',
    'KM', 'HORAS EXTRA', 'HORA SAL PROY', 'HORA LLEG PROY'
  ];
  
  var targetColMap = [];
  for (var t = 0; t < targetNames.length; t++) {
    var tNorm = auditNormalizar(targetNames[t]);
    var pCol = -1;
    var mCol = -1;
    for (var p = 0; p < pruebaHeaders.length; p++) {
      if (auditNormalizar(pruebaHeaders[p]) === tNorm) { pCol = p; break; }
    }
    for (var m = 0; m < masterHeaders.length; m++) {
      if (auditNormalizar(masterHeaders[m]) === tNorm) { mCol = m; break; }
    }
    if (pCol !== -1 && mCol !== -1) {
      targetColMap.push({ pruebaCol: pCol, masterCol: mCol });
    }
  }
  
  for (var dIdx = 0; dIdx < datesToProcess.length; dIdx++) {
    var dateStr = auditNormalizarFechaKey(datesToProcess[dIdx]);
    
    var pruebaRowsForDate = [];
    for (var p = 1; p < pruebaData.length; p++) {
      var pDate = auditFastNormalizarFechaKey(pruebaData[p][2]);
      if (pDate === dateStr) {
        pruebaRowsForDate.push(pruebaData[p]);
      }
    }
    
    if (pruebaRowsForDate.length === 0) continue;
    
    var masterData = masterSh.getDataRange().getValues();
    var masterIndices = [];
    for (var m = 1; m < masterData.length; m++) {
      var mDate = auditFastNormalizarFechaKey(masterData[m][2]);
      if (mDate === dateStr) {
        masterIndices.push(m);
      }
    }
    
    if (masterIndices.length > 0) {
      var startRowIdx = masterIndices[0] + 1;
      var lastMasterRow = masterIndices[masterIndices.length - 1] + 1;
      
      var diffRows = pruebaRowsForDate.length - masterIndices.length;
      if (diffRows > 0) {
        // Insertar filas faltantes en el bloque de la fecha
        masterSh.insertRowsAfter(lastMasterRow, diffRows);
        
        // Identificar específicamente las 3 columnas únicas con fórmula: ID (q), SAP, CÁLCULO HORAS
        var formulaNames = ['ID', 'Q', 'SAP', 'CALCULO HORAS', 'CÁLCULO HORAS'];
        
        for (var c = 1; c <= masterHeaders.length; c++) {
          var hNorm = auditNormalizar(masterHeaders[c - 1]);
          var isFormulaCol = false;
          for (var f = 0; f < formulaNames.length; f++) {
            if (auditNormalizar(formulaNames[f]) === hNorm) { isFormulaCol = true; break; }
          }
          if (isFormulaCol) {
            // Arrastrar fórmula de la fila previa para las filas nuevas insertadas
            masterSh.getRange(lastMasterRow, c).copyTo(masterSh.getRange(lastMasterRow + 1, c, diffRows, 1));
          }
        }
      }
      
      // Escribir en bloque los valores de las 22 columnas seleccionadas
      for (var k = 0; k < targetColMap.length; k++) {
        var pColIdx = targetColMap[k].pruebaCol;
        var mColIdx = targetColMap[k].masterCol;
        
        var colValues = [];
        for (var r = 0; r < pruebaRowsForDate.length; r++) {
          colValues.push([pruebaRowsForDate[r][pColIdx]]);
        }
        
        masterSh.getRange(startRowIdx, mColIdx + 1, colValues.length, 1).setValues(colValues);
      }
      
      Logger.log('[TRASPASO REAL] ✅ Copiadas ' + pruebaRowsForDate.length + ' filas de la fecha ' + dateStr + ' preservando fórmulas en Bitácora Real.');
    }
  }
}
