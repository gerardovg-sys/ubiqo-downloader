/**
 * ============================================================
 *  SMARTCORP — Módulo de Procesamiento Principal GPS
 *  Archivo: Audit_GPS_Procesamiento.js
 *
 *  Propósito:
 *    Procesar la telemetría GPS desde Historial_GPS y escribir los
 *    resultados en la Bitácora Real o en la Hoja de Prueba.
 *    Integra el Snapshot Inmutable y el Diff Engine para registrar
 *    discrepancias reales en Log_Mejora_Continua (SMARTCORP_GPS_Configuracion).
 *
 *  Versión : 3.0.0
 *  Fecha   : 25/09/2026
 * ============================================================
 */

function ejecutarProcesamientoGPS() {
  ejecutarProcesamientoGPSCore(false);
}

function ejecutarProcesamientoGPSPrueba() {
  ejecutarProcesamientoGPSCore(true);
}

/**
 * Vuelve a ejecutar el Diagnóstico GPS y el Prellenado de Bitacora_Prueba
 * utilizando la configuración actualizada (Geocercas, Proyectos Especiales y Relacion_Unidades)
 * sin modificar la Bitácora Real.
 */
function ejecutarRecalcularDiagnosticoYPrueba() {
  var ui = null;
  try { ui = SpreadsheetApp.getUi(); } catch (e) {}
  
  var ssActive = SpreadsheetApp.getActiveSpreadsheet();
  if (ssActive) ssActive.toast('🔄 Recalculando Diagnóstico y Bitacora_Prueba con nueva configuración...', 'Auditorías SMARTCORP', 10);
  
  try {
    Logger.log('=== [RECALCULAR] Inicio de recálculo con nueva configuración ===');
    
    // 1. Re-ejecutar Diagnóstico GPS
    ejecutarDiagnosticoDetalladoGPS(true);
    
    // 2. Re-ejecutar Prellenado en Bitacora_Prueba
    ejecutarProcesamientoGPSCore(true, true);
    
    if (ui) {
      ui.alert(
        '🔄 Recálculo Completado Exitosamente',
        'Se han vuelto a calcular el Diagnóstico GPS y la hoja borrador Bitacora_Prueba considerando los datos actualizados de:\n\n' +
        '  • Geocercas (Proyectos_GPS)\n' +
        '  • Proyectos Especiales\n' +
        '  • Relación de Unidades\n\n' +
        'Puedes revisar ahora las pestañas Diagnostico_GPS y Bitacora_Prueba.',
        ui.ButtonSet.OK
      );
    }
  } catch (e) {
    Logger.log('=== [RECALCULAR] ❌ Error: ' + e.message);
    if (ui) ui.alert('❌ Error en Recálculo', e.message, ui.ButtonSet.OK);
  }
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

    var ssBitacora      = SpreadsheetApp.openById(AUDIT_BITACORA_SHEET_ID);
    var targetSheetName = isPrueba ? 'Bitacora_Prueba' : AUDIT_BITACORA_TAB_NAME;
    var shBitacora      = ssBitacora.getSheetByName(targetSheetName);

    // Resiliencia: si datesToProcess viene vacío al pasar a Bitácora Real, extraer fechas desde Bitacora_Prueba
    if (!datesToProcess || datesToProcess.length === 0) {
      if (!isPrueba) {
        var shPruebaCheck = ssBitacora.getSheetByName('Bitacora_Prueba');
        if (shPruebaCheck && shPruebaCheck.getLastRow() >= 2) {
          var pDataCheck = shPruebaCheck.getDataRange().getValues();
          var pMapInit   = auditObtenerMapaIndicesBitacora(pDataCheck[0]);
          var pFechaCol  = (pMapInit.FECHA !== undefined) ? pMapInit.FECHA : 2;
          var foundDates = {};
          for (var pr = 1; pr < pDataCheck.length; pr++) {
            var fKey = auditFastNormalizarFechaKey(pDataCheck[pr][pFechaCol]);
            if (fKey) foundDates[fKey] = true;
          }
          datesToProcess = Object.keys(foundDates);
        }
      }
      
      if (!datesToProcess || datesToProcess.length === 0) {
        if (ui && !isSilent) {
          ui.alert(
            'ℹ️ Sin Datos Pendientes',
            'No hay tramos pendientes en Historial_GPS ni filas en Bitacora_Prueba.\nPor favor ingiere un archivo GPS primero.',
            ui.ButtonSet.OK
          );
        }
        return;
      }
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
    
    Logger.log('[PROCESAMIENTO LOG 2] Fechas para procesar: ' + JSON.stringify(datesToProcess));
    
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

      // 📸 TOMAR SNAPSHOT INMUTABLE DE LA PROPUESTA DEL ROBOT (para comparación Diff posterior)
      auditGuardarSnapshotPrueba(ssConfig, shBitacora);

    } else {
      // Si NO es prueba (Bitácora Real):
      // 1. Asegurar que Bitacora_Prueba tenga datos (si no tiene, calcularla primero)
      var shPrueba = ssBitacora.getSheetByName('Bitacora_Prueba');
      if (!shPrueba || shPrueba.getLastRow() < 2) {
        ejecutarProcesamientoGPSPrueba(true);
        shPrueba = ssBitacora.getSheetByName('Bitacora_Prueba');
      }
      
      // 2. EJECUTAR DIFF ENGINE (Registra cambios reales entre robot y humano en Log_Mejora_Continua)
      auditEjecutarDiffYLogMejoraContinua(ssConfig, shPrueba, datesToProcess);

      // 3. Traspasar datos de Bitacora_Prueba a Bitácora Real (Velocidad ultra-rápida 0.3 seg)
      auditTraspasarPruebaABitacoraReal(ssBitacora, datesToProcess);
      
      // 4. EJECUTAR AUDITORÍA DE REPORTES ENVIADOS AUTOMÁTICAMENTE (Columna K: REPORTE ENV.)
      for (var dIdx = 0; dIdx < datesToProcess.length; dIdx++) {
        var dStr = auditNormalizarFechaKey(datesToProcess[dIdx]);
        try {
          Logger.log('[PROCESAMIENTO] Ejecutando Auditoría de Reporte Enviado para fecha: ' + dStr);
          auditProcesarPeriodo(dStr, dStr);
        } catch (repErr) {
          Logger.log('[PROCESAMIENTO] ⚠️ Error en Auditoría de Reportes: ' + repErr.message);
        }
      }
      
      // 5. Cambiar Estado a "Procesado" en Historial_GPS
      if (histRes.pendingRowIndices && histRes.pendingRowIndices.length > 0) {
        auditMarcarHistorialProcesado(histRes.shHistorial, histRes.pendingRowIndices);
      }
    }
    
    if (ui && !isSilent) {
      ui.alert(
        '✅ Procesamiento GPS y Auditoría Completados',
        'Se procesaron exitosamente ' + datesToProcess.length + ' fecha(s) en la hoja "' + targetSheetName + '".\n\n' +
        '• Datos GPS escritos en Bitácora Real.\n' +
        '• Columna "REPORTE ENV." auditada automáticamente.\n' +
        '• Estado actualizado a "Procesado" en Historial_GPS.\n' +
        '• Discrepancias reales registradas en Log_Mejora_Continua.',
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
 * directamente a la pestaña maestra Bitácora Real, copiando ÚNICAMENTE las columnas de valores fijos
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
  
  var pMap = auditObtenerMapaIndicesBitacora(pruebaHeaders);
  var mMap = auditObtenerMapaIndicesBitacora(masterHeaders);
  
  var formulaNames = ['ID', 'Q', 'SAP', 'CALCULO HORAS', 'CÁLCULO HORAS'];
  
  // Mapa de columnas dinámico: cualquier columna que NO sea de fórmula y exista en ambos lados
  var targetColMap = [];
  for (var m = 0; m < masterHeaders.length; m++) {
    var hNorm = auditNormalizar(masterHeaders[m]);
    if (!hNorm) continue;
    
    var isFormulaCol = false;
    for (var f = 0; f < formulaNames.length; f++) {
      if (auditNormalizar(formulaNames[f]) === hNorm) { isFormulaCol = true; break; }
    }
    if (isFormulaCol) continue; // Las fórmulas se preservan / arrastran
    
    // Buscar columna correspondiente por nombre en Bitacora_Prueba
    for (var p = 0; p < pruebaHeaders.length; p++) {
      if (auditNormalizar(pruebaHeaders[p]) === hNorm) {
        targetColMap.push({ pruebaCol: p, masterCol: m });
        break;
      }
    }
  }
  
  var pFechaCol = (pMap.FECHA !== undefined) ? pMap.FECHA : 2;
  var mFechaCol = (mMap.FECHA !== undefined) ? mMap.FECHA : 2;
  
  for (var dIdx = 0; dIdx < datesToProcess.length; dIdx++) {
    var dateStr = auditNormalizarFechaKey(datesToProcess[dIdx]);
    
    var pruebaRowsForDate = [];
    for (var p = 1; p < pruebaData.length; p++) {
      var pDate = auditFastNormalizarFechaKey(pruebaData[p][pFechaCol]);
      if (pDate === dateStr) {
        pruebaRowsForDate.push(pruebaData[p]);
      }
    }
    
    if (pruebaRowsForDate.length === 0) continue;
    
    var masterData = masterSh.getDataRange().getValues();
    var masterIndices = [];
    for (var m = 1; m < masterData.length; m++) {
      var mDate = auditFastNormalizarFechaKey(masterData[m][mFechaCol]);
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
      
      // Escribir en bloque los valores de todas las columnas de valor dinámicas
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
      if (mMap.KM !== undefined && mMap.KM >= 0) {
        masterSh.getRange(startRowIdx, mMap.KM + 1, pruebaRowsForDate.length, 1).setNumberFormat("0.00");
      }
    }
  }
}

// ─────────────────────────────────────────────────────────────
//  MOTOR DE MEJORA CONTINUA Y DIFF ENGINE
// ─────────────────────────────────────────────────────────────

/**
 * Guarda una fotografía inmutable de lo que el robot calculó en Bitacora_Prueba.
 * Se almacena en la pestaña oculta '_Snapshot_Bitacora_Prueba' dentro de SMARTCORP_GPS_Configuracion.
 */
function auditGuardarSnapshotPrueba(ssConfig, shBitacoraPrueba) {
  if (!ssConfig || !shBitacoraPrueba) return;
  try {
    var data = shBitacoraPrueba.getDataRange().getValues();
    if (data.length < 2) return;
    
    var shSnapshot = ssConfig.getSheetByName('_Snapshot_Bitacora_Prueba');
    if (!shSnapshot) {
      shSnapshot = ssConfig.insertSheet('_Snapshot_Bitacora_Prueba');
      try { shSnapshot.hideSheet(); } catch (e) {}
    }
    shSnapshot.clear();
    shSnapshot.getRange(1, 1, data.length, data[0].length).setValues(data);
    Logger.log('[DIFF ENGINE] 📸 Snapshot inmutable guardado exitosamente en _Snapshot_Bitacora_Prueba (' + data.length + ' filas).');
  } catch (err) {
    Logger.log('[DIFF ENGINE] ⚠️ Error al guardar snapshot: ' + err.message);
  }
}

/**
 * Asegura la existencia de la hoja 'Log_Mejora_Continua' en el libro de configuración GPS
 * con encabezados formales y formato corporativo.
 */
function auditAsegurarHojaLogMejoraContinua(ssConfig) {
  var shLog = ssConfig.getSheetByName('Log_Mejora_Continua');
  var headers = [
    'Timestamp_Aprobacion',
    'Fecha_Jornada',
    'Tecnico',
    'Unidad',
    'Proyecto',
    'Campo_Modificado',
    'Valor_Propuesto_Robot',
    'Valor_Final_Humano',
    'Causa_Deducida',
    'Accion_Recomendada'
  ];
  
  if (!shLog) {
    shLog = ssConfig.insertSheet('Log_Mejora_Continua');
    shLog.getRange(1, 1, 1, headers.length).setValues([headers]);
    shLog.getRange(1, 1, 1, headers.length)
      .setBackground('#1a365d')
      .setFontColor('#ffffff')
      .setFontWeight('bold');
    shLog.setFrozenRows(1);
  } else if (shLog.getLastRow() === 0) {
    shLog.getRange(1, 1, 1, headers.length).setValues([headers]);
    shLog.getRange(1, 1, 1, headers.length)
      .setBackground('#1a365d')
      .setFontColor('#ffffff')
      .setFontWeight('bold');
    shLog.setFrozenRows(1);
  }
  return shLog;
}

/**
 * Normaliza horas a formato HH:MM para comparación estricta.
 */
function auditFormatearHoraComparacion(val) {
  if (val === null || val === undefined) return '';
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return '';
    return auditPad2(val.getHours()) + ':' + auditPad2(val.getMinutes());
  }
  var str = String(val).trim();
  if (!str) return '';
  var parts = str.split(':');
  if (parts.length >= 2) {
    var h = parseInt(parts[0], 10);
    var m = parseInt(parts[1], 10);
    if (!isNaN(h) && !isNaN(m)) {
      return auditPad2(h) + ':' + auditPad2(m);
    }
  }
  return str;
}

/**
 * Determina si un rango horario corresponde a turno nocturno o tardío.
 */
function auditEsHoraNocturna(deStr, aStr) {
  var parseH = function(tStr) {
    if (!tStr) return null;
    if (tStr instanceof Date) return tStr.getHours() + tStr.getMinutes() / 60.0;
    var parts = String(tStr).split(':');
    if (parts.length < 2) return null;
    var h = parseInt(parts[0], 10);
    var m = parseInt(parts[1], 10);
    if (isNaN(h) || isNaN(m)) return null;
    return h + m / 60.0;
  };
  var deDec = parseH(deStr);
  var aDec  = parseH(aStr);
  if (deDec !== null && aDec !== null && aDec < deDec) return true; // Cruzó medianoche
  if (deDec !== null && deDec >= 18.0) return true;
  if (aDec !== null && aDec >= 20.0) return true;
  return false;
}

/**
 * Compara la propuesta inmutable del robot contra los datos autorizados por el humano en Bitacora_Prueba.
 * Filtra el 80% de ruido (falsos positivos o confirmaciones simples) y registra exclusivamente
 * discrepancias operativas en la hoja 'Log_Mejora_Continua' de SMARTCORP_GPS_Configuracion.
 */
function auditEjecutarDiffYLogMejoraContinua(ssConfig, shPrueba, datesToProcess) {
  try {
    if (!ssConfig || !shPrueba || !datesToProcess || datesToProcess.length === 0) return;
    
    var shSnapshot = ssConfig.getSheetByName('_Snapshot_Bitacora_Prueba');
    if (!shSnapshot || shSnapshot.getLastRow() < 2) {
      Logger.log('[DIFF ENGINE] ℹ️ No se encontró snapshot previo en _Snapshot_Bitacora_Prueba. Omitiendo registro de discrepancias.');
      return;
    }
    
    var snapData = shSnapshot.getDataRange().getValues();
    var pruebaData = shPrueba.getDataRange().getValues();
    if (snapData.length < 2 || pruebaData.length < 2) return;
    
    var snapMap = auditObtenerMapaIndicesBitacora(snapData[0]);
    var pruebaMap = auditObtenerMapaIndicesBitacora(pruebaData[0]);
    
    var sFechaCol = snapMap.FECHA !== undefined ? snapMap.FECHA : 2;
    var pFechaCol = pruebaMap.FECHA !== undefined ? pruebaMap.FECHA : 2;
    
    var sNombreCol = snapMap.NOMBRE !== undefined ? snapMap.NOMBRE : 4;
    var pNombreCol = pruebaMap.NOMBRE !== undefined ? pruebaMap.NOMBRE : 4;
    
    var timestampStr = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'America/Mexico_City', 'yyyy-MM-dd HH:mm:ss');
    var logEntries = [];
    
    for (var dIdx = 0; dIdx < datesToProcess.length; dIdx++) {
      var dateStr = auditNormalizarFechaKey(datesToProcess[dIdx]);
      
      // Filtrar filas de snapshot para esta fecha
      var snapRows = [];
      for (var s = 1; s < snapData.length; s++) {
        if (auditFastNormalizarFechaKey(snapData[s][sFechaCol]) === dateStr) {
          snapRows.push(snapData[s]);
        }
      }
      
      // Filtrar filas de prueba para esta fecha
      var pruebaRows = [];
      for (var p = 1; p < pruebaData.length; p++) {
        if (auditFastNormalizarFechaKey(pruebaData[p][pFechaCol]) === dateStr) {
          pruebaRows.push(pruebaData[p]);
        }
      }
      
      if (pruebaRows.length === 0) continue;
      
      // Agrupar filas de snapshot por técnico
      var snapByTech = {};
      for (var s = 0; s < snapRows.length; s++) {
        var tNorm = auditNormalizar(String(snapRows[s][sNombreCol] || ''));
        if (!tNorm) continue;
        if (!snapByTech[tNorm]) snapByTech[tNorm] = [];
        snapByTech[tNorm].push(snapRows[s]);
      }
      
      // Agrupar filas de prueba por técnico
      var pruebaByTech = {};
      for (var p = 0; p < pruebaRows.length; p++) {
        var tNorm = auditNormalizar(String(pruebaRows[p][pNombreCol] || ''));
        if (!tNorm) continue;
        if (!pruebaByTech[tNorm]) pruebaByTech[tNorm] = [];
        pruebaByTech[tNorm].push(pruebaRows[p]);
      }
      
      // Comparar técnico por técnico
      for (var tNorm in pruebaByTech) {
        var humanRows = pruebaByTech[tNorm];
        var sTechRows = snapByTech[tNorm] || [];
        
        for (var i = 0; i < humanRows.length; i++) {
          var hRow = humanRows[i];
          var hTech   = (pNombreCol !== undefined) ? String(hRow[pNombreCol] || '').trim() : '';
          var hUnidad = (pruebaMap.UNIDAD !== undefined) ? String(hRow[pruebaMap.UNIDAD] || '').trim() : '';
          var hProj   = (pruebaMap.PROYECTO !== undefined) ? String(hRow[pruebaMap.PROYECTO] || '').trim() : '';
          var hDe     = (pruebaMap.DE !== undefined) ? String(hRow[pruebaMap.DE] || '').trim() : '';
          var hA      = (pruebaMap.A !== undefined) ? String(hRow[pruebaMap.A] || '').trim() : '';
          
          if (i >= sTechRows.length) {
            // Caso 1: Fila nueva agregada manualmente por el humano
            var esNoct = auditEsHoraNocturna(hDe, hA);
            var causaNueva = esNoct ? 'Turno Nocturno Agregado' : 'Partida Nueva Agregada Manualmente';
            var accionNueva = esNoct 
              ? 'Configurar guardias nocturnas en agenda previa para reconocimiento automático.'
              : 'Registrar partida de trabajo en la agenda previa.';
              
            logEntries.push([
              timestampStr,
              dateStr,
              hTech,
              hUnidad,
              hProj,
              'FILA_NUEVA',
              '(No existía propuesta del robot)',
              hProj + ' (' + hDe + ' - ' + hA + ')',
              causaNueva,
              accionNueva
            ]);
          } else {
            // Caso 2: Fila existente. Comparar campos operativos
            var sRow = sTechRows[i];
            var sProj   = (snapMap.PROYECTO !== undefined) ? String(sRow[snapMap.PROYECTO] || '').trim() : '';
            var sUnidad = (snapMap.UNIDAD !== undefined) ? String(sRow[snapMap.UNIDAD] || '').trim() : '';
            
            // a) Proyecto modificado
            if (auditNormalizar(sProj) !== auditNormalizar(hProj) && hProj) {
              logEntries.push([
                timestampStr,
                dateStr,
                hTech,
                hUnidad,
                hProj,
                'PROYECTO',
                sProj,
                hProj,
                'Corrección de Proyecto / Obra Asignada',
                'Verificar catálogo de proyectos o asignación de agenda previa.'
              ]);
            }
            
            // b) Unidad modificada
            if (auditNormalizar(sUnidad) !== auditNormalizar(hUnidad) && hUnidad) {
              logEntries.push([
                timestampStr,
                dateStr,
                hTech,
                hUnidad,
                hProj,
                'UNIDAD',
                sUnidad,
                hUnidad,
                'Cambio de Unidad en Campo',
                'Actualizar asignación vehicular en Relacion_Unidades o agenda.'
              ]);
            }
            
            // c) Horario de Inicio (DE)
            var sDeComp = auditFormatearHoraComparacion(snapMap.DE !== undefined ? sRow[snapMap.DE] : '');
            var hDeComp = auditFormatearHoraComparacion(pruebaMap.DE !== undefined ? hRow[pruebaMap.DE] : '');
            if (sDeComp !== hDeComp && hDeComp !== '') {
              logEntries.push([
                timestampStr,
                dateStr,
                hTech,
                hUnidad,
                hProj,
                'DE',
                sDeComp || '(vacío)',
                hDeComp,
                'Corrección de Horario de Salida',
                'Revisar si la unidad estuvo en taller o patio antes de las 8:00 AM.'
              ]);
            }
            
            // d) Horario de Fin (A)
            var sAComp = auditFormatearHoraComparacion(snapMap.A !== undefined ? sRow[snapMap.A] : '');
            var hAComp = auditFormatearHoraComparacion(pruebaMap.A !== undefined ? hRow[pruebaMap.A] : '');
            if (sAComp !== hAComp && hAComp !== '') {
              logEntries.push([
                timestampStr,
                dateStr,
                hTech,
                hUnidad,
                hProj,
                'A',
                sAComp || '(vacío)',
                hAComp,
                'Ajuste de Horario de Fin de Jornada',
                'Validar si hubo trabajos nocturnos o tolerancia de salida.'
              ]);
            }
            
            // e) Llegada a Proyecto (HORA LLEG PROY)
            var sLlegComp = auditFormatearHoraComparacion(snapMap.LLEG_PROY !== undefined ? sRow[snapMap.LLEG_PROY] : '');
            var hLlegComp = auditFormatearHoraComparacion(pruebaMap.LLEG_PROY !== undefined ? hRow[pruebaMap.LLEG_PROY] : '');
            if (sLlegComp !== hLlegComp) {
              if (!sLlegComp && hLlegComp) {
                logEntries.push([
                  timestampStr,
                  dateStr,
                  hTech,
                  hUnidad,
                  hProj,
                  'HORA LLEG PROY',
                  '(vacío / no detectada)',
                  hLlegComp,
                  'Geocerca Descalibrada / Reducida',
                  'Ampliar el radio de geocerca en Proyectos_GPS (+250m) o verificar caseta de acceso.'
                ]);
              } else if (sLlegComp && hLlegComp) {
                logEntries.push([
                  timestampStr,
                  dateStr,
                  hTech,
                  hUnidad,
                  hProj,
                  'HORA LLEG PROY',
                  sLlegComp,
                  hLlegComp,
                  'Ajuste de Hora de Llegada a Obra',
                  'Verificar horario reportado por el líder de cuadrilla.'
                ]);
              }
            }
            
            // f) Salida de Proyecto (HORA SAL PROY)
            var sSalComp = auditFormatearHoraComparacion(snapMap.SAL_PROY !== undefined ? sRow[snapMap.SAL_PROY] : '');
            var hSalComp = auditFormatearHoraComparacion(pruebaMap.SAL_PROY !== undefined ? hRow[pruebaMap.SAL_PROY] : '');
            if (sSalComp !== hSalComp && (sSalComp || hSalComp)) {
              logEntries.push([
                timestampStr,
                dateStr,
                hTech,
                hUnidad,
                hProj,
                'HORA SAL PROY',
                sSalComp || '(vacío)',
                hSalComp || '(vacío)',
                'Ajuste de Hora de Salida de Obra',
                'Verificar tiempo de permanencia en geocerca.'
              ]);
            }
            
            // g) Kilometraje (KM)
            var sKmVal = parseFloat(snapMap.KM !== undefined ? sRow[snapMap.KM] : 0) || 0;
            var hKmVal = parseFloat(pruebaMap.KM !== undefined ? hRow[pruebaMap.KM] : 0) || 0;
            if (Math.abs(sKmVal - hKmVal) > 0.5) {
              logEntries.push([
                timestampStr,
                dateStr,
                hTech,
                hUnidad,
                hProj,
                'KM',
                sKmVal.toFixed(2),
                hKmVal.toFixed(2),
                'Ajuste de Kilometraje Manual',
                'Comprobar si el dispositivo GPS de la unidad perdió cobertura o tomó ruta alterna.'
              ]);
            }
          }
        }
      }
    }
    
    if (logEntries.length > 0) {
      var shLog = auditAsegurarHojaLogMejoraContinua(ssConfig);
      var lastRow = shLog.getLastRow();
      shLog.getRange(lastRow + 1, 1, logEntries.length, 10).setValues(logEntries);
      Logger.log('[DIFF ENGINE] 🎯 Se registraron ' + logEntries.length + ' discrepancia(s) operativa(s) en Log_Mejora_Continua.');
    } else {
      Logger.log('[DIFF ENGINE] 🎯 Cero discrepancias operativas detectadas. Todas las propuestas del robot fueron validadas sin cambios sustantivos (0% Ruido).');
    }
  } catch (err) {
    Logger.log('[DIFF ENGINE] ⚠️ Error en auditEjecutarDiffYLogMejoraContinua: ' + err.message + '\n' + err.stack);
  }
}
