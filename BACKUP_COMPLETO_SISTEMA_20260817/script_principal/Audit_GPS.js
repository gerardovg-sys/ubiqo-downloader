/**
 * ============================================================
 *  SMARTCORP – Sistema de Auditorías de Bitácora y GPS
 *  Archivo: Audit_GPS.js (Versión v6.2.0 - Ultra-Estable, Ultra-Rápido y Restaurado)
 *
 *  Propósito:
 *    • Telemetría GPS y Auditoría de Bitácora.
 *    • Detección infalible de bloques de unidad Ubiqo (isNewDevice + A5).
 *    • Mapeo robusto con Relacion_Unidades para Diagnóstico y Hoja de Prueba.
 *    • Evaluación integral de los 17 Casos del SOP sin bloqueos de conversión.
 *
 *  Versión : 6.2.0
 *  Fecha   : 04/08/2026
 * ============================================================
 */

var AUDIT_GPS_CONFIG_SHEET_ID = '12nC3f_lU66sLqZp34Oa6K7sO6oZJ_6XmZ2q3Z_qX_X';

var AUDIT_COL_BIT_FECHA         = 2;   // Col C ("FECHA")
var AUDIT_COL_BIT_PROYECTO      = 3;   // Col D ("PROYECTO")
var AUDIT_COL_BIT_NOMBRE        = 4;   // Col E ("NOMBRE")
var AUDIT_COL_BIT_ROL           = 5;   // Col F ("Rol")
var AUDIT_COL_BIT_DE            = 6;   // Col G ("DE")
var AUDIT_COL_BIT_A             = 7;   // Col H ("A")
var AUDIT_COL_BIT_CALCULO_HORAS = 8;   // Col I ("CALCULO HORAS")
var AUDIT_COL_BIT_UNIDAD        = 9;   // Col J ("UNIDAD")
var AUDIT_COL_BIT_REPORTE_ENV   = 10;  // Col K ("REPORTE ENV.")
var AUDIT_COL_BIT_ASUNTO        = 11;  // Col L ("ASUNTO")
var AUDIT_COL_BIT_JUSTIFICACION = 12;  // Col M ("JUSTIFICACION")
var AUDIT_COL_BIT_NOTA          = 13;  // Col N ("NOTA")
var AUDIT_COL_BIT_REV           = 14;  // Col O ("REV")
var AUDIT_COL_BIT_SALIDA        = 15;  // Col P ("HORA DE SALIDA")
var AUDIT_COL_BIT_ENTRADA       = 16;  // Col Q ("HORA DE ENTRADA")
var AUDIT_COL_BIT_TIEMPO_REC    = 17;  // Col R ("TIEMPO RECORRIDO")
var AUDIT_COL_BIT_TIEMPO_PARADAS= 18;  // Col S ("TIEMPO DE PARADAS")
var AUDIT_COL_BIT_PARADAS       = 19;  // Col T ("PARADAS")
var AUDIT_COL_BIT_REGRESOS      = 20;  // Col U ("REGRESOS")
var AUDIT_COL_BIT_OBSERVACIONES = 21;  // Col V ("OBSERVACIONES")
var AUDIT_COL_BIT_KM            = 22;  // Col W ("KM")
var AUDIT_COL_BIT_HORAS_EXTRA   = 23;  // Col X ("HORAS EXTRA")
var AUDIT_COL_BIT_HORA_SAL_PROY = 24;  // Col Y ("HORA SAL PROY")
var AUDIT_COL_BIT_HORA_LLEG_PROY= 25;  // Col Z ("HORA LLEG PROY")

/**
 * Resuelve dinámicamente la posición de cada columna en la Bitácora escaneando la fila 1 de encabezados.
 * Si las columnas son agregadas, movidas o eliminadas, el sistema se adapta automáticamente por nombre.
 */
function auditObtenerMapaIndicesBitacora(headers) {
  var map = {
    ID: 0, SAP: 1, FECHA: 2, PROYECTO: 3, NOMBRE: 4, ROL: 5, UNIDAD: 6, DE: 7, A: 8,
    CALCULO_HORAS: 9, HORAS_EXTRA: 10, HRS_PAGADAS: 11, REPORTE_ENV: 12, ASUNTO: 13,
    JUSTIFICACION: 14, NOTA: 15, REV: 16, SALIDA: 17, ENTRADA: 18, TIEMPO_REC: 19,
    TIEMPO_PARADAS: 20, PARADAS: 21, REGRESOS: 22, OBSERVACIONES: 23, KM: 24,
    HORA_SAL_PROY: 25, HORA_LLEG_PROY: 26, ASISTENCIA: 27
  };
  if (!headers || !headers.length) return map;
  
  for (var c = 0; c < headers.length; c++) {
    var hNorm = auditNormalizar(headers[c]);
    if (hNorm === 'id') map.ID = c;
    else if (hNorm === 'sap') map.SAP = c;
    else if (hNorm === 'fecha') map.FECHA = c;
    else if (hNorm === 'proyecto') map.PROYECTO = c;
    else if (hNorm === 'nombre') map.NOMBRE = c;
    else if (hNorm === 'rol') map.ROL = c;
    else if (hNorm === 'unidad') map.UNIDAD = c;
    else if (hNorm === 'de') map.DE = c;
    else if (hNorm === 'a') map.A = c;
    else if (hNorm.indexOf('calculo horas') !== -1) map.CALCULO_HORAS = c;
    else if (hNorm.indexOf('hrs x pagadas') !== -1 || hNorm.indexOf('horas pagadas') !== -1) map.HRS_PAGADAS = c;
    else if (hNorm.indexOf('horas extra') !== -1) map.HORAS_EXTRA = c;
    else if (hNorm.indexOf('reporte env') !== -1) map.REPORTE_ENV = c;
    else if (hNorm === 'asunto') map.ASUNTO = c;
    else if (hNorm.indexOf('justificac') !== -1) map.JUSTIFICACION = c;
    else if (hNorm === 'nota') map.NOTA = c;
    else if (hNorm === 'rev') map.REV = c;
    else if (hNorm.indexOf('hora de salida') !== -1) map.SALIDA = c;
    else if (hNorm.indexOf('hora de entrada') !== -1) map.ENTRADA = c;
    else if (hNorm.indexOf('tiempo recorrido') !== -1) map.TIEMPO_REC = c;
    else if (hNorm.indexOf('tiempo de paradas') !== -1) map.TIEMPO_PARADAS = c;
    else if (hNorm === 'paradas') map.PARADAS = c;
    else if (hNorm === 'regresos') map.REGRESOS = c;
    else if (hNorm === 'observaciones') map.OBSERVACIONES = c;
    else if (hNorm === 'km') map.KM = c;
    else if (hNorm.indexOf('hora sal proy') !== -1) map.HORA_SAL_PROY = c;
    else if (hNorm.indexOf('hora lleg proy') !== -1) map.HORA_LLEG_PROY = c;
    else if (hNorm.indexOf('asistencia') !== -1) map.ASISTENCIA = c;
  }
  return map;
}

// Cache de parseo de archivos por ID para velocidad extrema
var _auditParseCache = {};

function auditFormatDate(d) {
  if (!d) return '';
  if (d instanceof Date) {
    try {
      return Utilities.formatDate(d, SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone(), 'dd/MM/yyyy');
    } catch(e) {
      var hours = d.getHours();
      var day = (hours === 0 || hours >= 18) ? d.getUTCDate() : d.getDate();
      var month = (hours === 0 || hours >= 18) ? (d.getUTCMonth() + 1) : (d.getMonth() + 1);
      var year = (hours === 0 || hours >= 18) ? d.getUTCFullYear() : d.getFullYear();
      return auditPad2(day) + '/' + auditPad2(month) + '/' + year;
    }
  }
  var s = String(d).trim();
  if (s.indexOf('T') !== -1) s = s.split('T')[0];
  if (s.indexOf('-') !== -1) {
    var partsDash = s.split('-');
    if (partsDash.length === 3) {
      if (partsDash[0].length === 4) return auditPad2(parseInt(partsDash[2], 10)) + '/' + auditPad2(parseInt(partsDash[1], 10)) + '/' + partsDash[0];
      if (partsDash[2].length === 4) return auditPad2(parseInt(partsDash[0], 10)) + '/' + auditPad2(parseInt(partsDash[1], 10)) + '/' + partsDash[2];
    }
  }
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

function auditNormalizarFechaKey(d) {
  if (!d) return '';
  var formatted = auditFormatDate(d);
  if (!formatted) return '';
  var parts = formatted.split('/');
  if (parts.length === 3) {
    var day = auditPad2(parseInt(parts[0], 10));
    var month = auditPad2(parseInt(parts[1], 10));
    var year = parts[2];
    return day + '/' + month + '/' + year;
  }
  return formatted;
}

function auditPad2(n) {
  return n < 10 ? '0' + n : String(n);
}

function auditNormalizar(text) {
  if (!text && text !== 0) return '';
  return String(text).toLowerCase().trim().replace(/[\u200b\u200c\u200d\ufeff]/g, '').replace(/\s+/g, ' ');
}

// ─────────────────────────────────────────────────────────────
//  2. PUNTOS DE ENTRADA DEL MENÚ
// ─────────────────────────────────────────────────────────────

// (Puntos de entrada de procesamiento movidos a Audit_GPS_Procesamiento.js)

// ─────────────────────────────────────────────────────────────
//  3. CORE PROCESADOR DE FECHA GLOBAL
// ─────────────────────────────────────────────────────────────

function auditProcesarFechaGlobal(sheet, dateUnitsData, geocercas, officeLat, officeLon, dateStr, mapaEquivalencias, especiales, isPrueba) {
  Logger.log('=== [LOG] Procesando fecha: ' + dateStr + ' ===');
  var adminTracker = { startNextRow: null, endNextRow: null };
  
  var dataTemp = sheet.getDataRange().getValues();
  if (dataTemp.length < 2) return;
  var mBitInit = auditObtenerMapaIndicesBitacora(dataTemp[0]);
  
  for (var b = 1; b < dataTemp.length; b++) {
    var fFecha = (mBitInit.FECHA !== undefined) ? auditNormalizarFechaKey(dataTemp[b][mBitInit.FECHA]) : '';
    if (fFecha === dateStr) {
      var fUnidad = (mBitInit.UNIDAD !== undefined) ? String(dataTemp[b][mBitInit.UNIDAD] || '').trim() : '';
      var fAsunto = (mBitInit.ASUNTO !== undefined) ? String(dataTemp[b][mBitInit.ASUNTO] || '').trim() : '';
      var fProj   = (mBitInit.PROYECTO !== undefined) ? auditNormalizar(dataTemp[b][mBitInit.PROYECTO]) : '';
      var fDe     = (mBitInit.DE !== undefined) ? String(dataTemp[b][mBitInit.DE] || '').trim() : '';
      var fA      = (mBitInit.A !== undefined) ? String(dataTemp[b][mBitInit.A] || '').trim() : '';
      var rowNum  = b + 1;
      
      if (fProj === 'smarthaus gastos' && (!fDe || !fA)) {
        if (!fDe && mBitInit.DE !== undefined) sheet.getRange(rowNum, mBitInit.DE + 1).setValue("8:00");
        if (!fA && mBitInit.A !== undefined) sheet.getRange(rowNum, mBitInit.A + 1).setValue("18:00");
      }
      
      if (fUnidad.toUpperCase() === 'NA' && auditNormalizar(fAsunto) === 'proyecto instalacion') {
        if (mBitInit.DE !== undefined) sheet.getRange(rowNum, mBitInit.DE + 1).setValue("8:00");
        if (mBitInit.A !== undefined) sheet.getRange(rowNum, mBitInit.A + 1).setValue("18:00");
        var prevObs = (mBitInit.OBSERVACIONES !== undefined) ? String(dataTemp[b][mBitInit.OBSERVACIONES] || '').trim() : '';
        var warning = "[GPS] REVISAR: Esta partida no tiene unidad asignada.";
        var newObs = prevObs ? (prevObs.indexOf(warning) !== -1 ? prevObs : prevObs + " | " + warning) : warning;
        if (mBitInit.REV !== undefined) sheet.getRange(rowNum, mBitInit.REV + 1).setValue('REVISAR');
        if (mBitInit.OBSERVACIONES !== undefined) sheet.getRange(rowNum, mBitInit.OBSERVACIONES + 1).setValue(newObs);
      }
    }
  }
  
  var currentData = sheet.getDataRange().getValues();
  var uniqueTechs = [];
  var seenTechs = {};
  for (var b = 1; b < currentData.length; b++) {
    var fFecha = (mBitInit.FECHA !== undefined) ? auditNormalizarFechaKey(currentData[b][mBitInit.FECHA]) : '';
    if (fFecha !== dateStr) continue;
    var fNombre = (mBitInit.NOMBRE !== undefined) ? String(currentData[b][mBitInit.NOMBRE] || '').trim() : '';
    var normN = auditNormalizar(fNombre);
    if (normN && !seenTechs[normN]) {
      seenTechs[normN] = true;
      uniqueTechs.push(fNombre);
    }
  }
  
  for (var t = 0; t < uniqueTechs.length; t++) {
    var activeTechName = uniqueTechs[t];
    var currentDataNow = sheet.getDataRange().getValues();
    var techRows = auditObtenerFilasTecnico(currentDataNow, activeTechName, dateStr);
    auditProcesarDiaTecnicoInsertarFilas(sheet, techRows, dateUnitsData, geocercas, officeLat, officeLon, dateStr, mapaEquivalencias, especiales, isPrueba, adminTracker);
  }
  
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow >= 2) {
    var fullHeaders = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    var fullRange = sheet.getRange(2, 1, lastRow - 1, lastCol);
    var allValues = fullRange.getValues();
    var allFormulas = fullRange.getFormulas();
    var currentDataFinal = sheet.getDataRange().getValues();
    
    for (var t = 0; t < uniqueTechs.length; t++) {
      var activeTechName = uniqueTechs[t];
      var techRows = auditObtenerFilasTecnico(currentDataFinal, activeTechName, dateStr);
      auditProcesarDiaTecnicoEscribirMetricas(sheet, techRows, dateUnitsData, geocercas, officeLat, officeLon, dateStr, mapaEquivalencias, especiales, isPrueba, allValues, allFormulas, fullHeaders);
    }
    
    fullRange.setValues(allValues);
  }
}

// ─────────────────────────────────────────────────────────────
//  4. PASS 1: INSERCIÓN DE FILAS ADMINISTRATIVAS
// ─────────────────────────────────────────────────────────────

function auditProcesarDiaTecnicoInsertarFilas(sheet, techRows, dateUnitsData, geocercas, officeLat, officeLon, dateStr, mapaEquivalencias, especiales, isPrueba, adminTracker) {
  if (!adminTracker) adminTracker = { startNextRow: null, endNextRow: null };
  var reverseMap = {};
  for (var gpsKey in mapaEquivalencias) {
    reverseMap[auditNormalizar(mapaEquivalencias[gpsKey])] = gpsKey;
  }
  
  var gpsRows = [];
  for (var i = 0; i < techRows.length; i++) gpsRows.push(techRows[i]);
  if (gpsRows.length === 0) return;
  
  var isOnlySpecialProject = (gpsRows.length === 1 && (especiales[auditNormalizar(gpsRows[0].proyecto)] || auditEsProyectoInterno(gpsRows[0].proyecto)));
  
  for (var i = 0; i < gpsRows.length; i++) {
    var row = gpsRows[i];
    var routes = auditObtenerRutasUnidadStrict(dateUnitsData, row.unidad, reverseMap, mapaEquivalencias);
    row.routes = auditFiltrarRutasPorTurno(routes, row.deOriginal, row.aOriginal);
  }
  
  var installRows = gpsRows.filter(function(r) {
    return !auditEsProyectoInterno(r.proyecto);
  });
  
  if (installRows.length === 0) return;
  
  var firstInstallRow = installRows[0];
  var lastInstallRow = installRows[installRows.length - 1];
  
  var firstStart = auditObtenerPrimerInicio(firstInstallRow.routes);
  var firstStartDec = firstStart ? (firstStart.getHours() + firstStart.getMinutes() / 60.0) : 8.0;
  
  var lastEnd = auditObtenerUltimoFin(lastInstallRow.routes);
  var lastEndDec = lastEnd ? (lastEnd.getHours() + lastEnd.getMinutes() / 60.0) : 18.0;
  
  var techName = techRows[0].nombre;
  var hasSmarthaus = gpsRows.some(function(r) { return auditNormalizar(r.proyecto) === 'smarthaus gastos'; });
  
  if (firstStartDec - 8.0 >= 1.0 && !isOnlySpecialProject && !hasSmarthaus) {
    var startTardioDec = Math.ceil(firstStartDec * 4) / 4.0;
    var startStr = formatDecimalToTime15Min(startTardioDec);
    var targetIdx = adminTracker.startNextRow ? adminTracker.startNextRow : (firstInstallRow.index + 1);
    var obs = "[GPS] Fila administrativa autogenerada por inicio tardio (08:00 a " + startStr + ")";
    auditInsertarFilaAdministrativa(sheet, targetIdx, dateStr, techName, "SMARTHAUS GASTOS", "8:00", startStr, "Oficina", "NA", obs, techRows[0].rol);
    adminTracker.startNextRow = targetIdx + 1;
    return;
  }
  
  if (lastEndDec < 17.0 && !isOnlySpecialProject && !hasSmarthaus) {
    var endTempranoDec = Math.floor(lastEndDec * 4) / 4.0;
    var endStr = formatDecimalToTime15Min(endTempranoDec);
    var targetIdx = lastInstallRow.index + 2;
    var obs = "[GPS] Fila administrativa autogenerada por retorno temprano (" + endStr + " a 18:00)";
    auditInsertarFilaAdministrativa(sheet, targetIdx, dateStr, techName, "SMARTHAUS GASTOS", endStr, "18:00", "Oficina", "NA", obs, techRows[0].rol);
    adminTracker.endNextRow = targetIdx + 1;
  }
}

// ─────────────────────────────────────────────────────────────
//  5. PASS 2: ESCRITURA DE MÉTRICAS GPS EN PARTIDAS (BATCH IN-MEMORY)
// ─────────────────────────────────────────────────────────────

function auditProcesarDiaTecnicoEscribirMetricas(sheet, techRows, dateUnitsData, geocercas, officeLat, officeLon, dateStr, mapaEquivalencias, especiales, isPrueba, allValues, allFormulas, fullHeaders) {
  var reverseMap = {};
  for (var gpsKey in mapaEquivalencias) {
    reverseMap[auditNormalizar(mapaEquivalencias[gpsKey])] = gpsKey;
  }
  
  var gpsRows = [];
  for (var i = 0; i < techRows.length; i++) gpsRows.push(techRows[i]);
  if (gpsRows.length === 0) return;

  Logger.log('=== [METRICAS LOG] Tecnico: ' + techRows[0].nombre + ' (' + gpsRows.length + ' filas en Bitacora) ===');
  
  var mBit = auditObtenerMapaIndicesBitacora(fullHeaders);
  var isOnlySpecialProject = (gpsRows.length === 1 && (especiales[auditNormalizar(gpsRows[0].proyecto)] || auditEsProyectoInterno(gpsRows[0].proyecto)));
  
  for (var i = 0; i < gpsRows.length; i++) {
    var row = gpsRows[i];
    var routes = auditObtenerRutasUnidadStrict(dateUnitsData, row.unidad, reverseMap, mapaEquivalencias);
    row.routes = auditFiltrarRutasPorTurno(routes, row.deOriginal, row.aOriginal);
    Logger.log('   -> Fila ' + (row.index + 1) + ': Proyecto="' + row.proyecto + '", Unidad="' + row.unidad + '" | Rutas vinculadas: ' + (routes ? routes.length : 0) + ' (Filtradas turno: ' + (row.routes ? row.routes.length : 0) + ')');
  }
  
  var installRows = gpsRows.filter(function(r) {
    return !auditEsProyectoInterno(r.proyecto);
  });
  
  for (var k = 0; k < installRows.length; k++) {
    installRows[k]._boundaryStart = 8.0;
    installRows[k]._boundaryEnd = 18.0;
  }
  
  for (var k = 0; k < installRows.length - 1; k++) {
    var rowPrev = installRows[k];
    var rowCurr = installRows[k+1];
    var prevEnd = auditObtenerUltimoFin(rowPrev.routes);
    var currStart = auditObtenerPrimerInicio(rowCurr.routes);
    
    var midDec = 13.0;
    if (prevEnd && currStart) {
      var pDec = prevEnd.getHours() + prevEnd.getMinutes() / 60.0;
      var cDec = currStart.getHours() + currStart.getMinutes() / 60.0;
      midDec = Math.ceil(((pDec + cDec) / 2.0) * 4) / 4.0;
    } else if (prevEnd) {
      var pDec = prevEnd.getHours() + prevEnd.getMinutes() / 60.0;
      midDec = Math.ceil(pDec * 4) / 4.0;
    } else if (currStart) {
      var cDec = currStart.getHours() + currStart.getMinutes() / 60.0;
      midDec = Math.floor(cDec * 4) / 4.0;
    }
    rowPrev._boundaryEnd = midDec;
    rowCurr._boundaryStart = midDec;
  }
  
  for (var k = 0; k < installRows.length; k++) {
    var rowInst = installRows[k];
    var pNormInst = auditNormalizar(rowInst.proyecto);
    var isEspecialInst = !!(especiales && especiales[pNormInst]);
    
    if (isEspecialInst) {
      rowInst.T_de = 8.0;
      rowInst.T_a = 18.0;
    } else {
      var isFirstInstall = (k === 0);
      var isLastInstall = (k === installRows.length - 1);
      
      var rowFirstStart = auditObtenerPrimerInicio(rowInst.routes);
      var rowLastEnd = auditObtenerUltimoFin(rowInst.routes);
      
      if (isFirstInstall) {
        if (rowFirstStart) {
          var rFsDec = rowFirstStart.getHours() + rowFirstStart.getMinutes() / 60.0;
          rowInst.T_de = (rFsDec - 8.0 >= 1.0 && !isOnlySpecialProject) ? (Math.ceil(rFsDec * 4) / 4.0) : 8.0;
        } else {
          rowInst.T_de = 8.0;
        }
      } else {
        rowInst.T_de = (rowInst._boundaryStart !== undefined && rowInst._boundaryStart !== null) ? rowInst._boundaryStart : 12.0;
      }
      
      if (isLastInstall) {
        if (rowLastEnd) {
          var rLeDec = rowLastEnd.getHours() + rowLastEnd.getMinutes() / 60.0;
          rowInst.T_a = (rLeDec < 17.0 && !isOnlySpecialProject) ? (Math.floor(rLeDec * 4) / 4.0) : 18.0;
        } else {
          rowInst.T_a = 18.0;
        }
      } else {
        rowInst.T_a = (rowInst._boundaryEnd !== undefined && rowInst._boundaryEnd !== null) ? rowInst._boundaryEnd : 18.0;
      }
    }
  }
  
  for (var i = 0; i < gpsRows.length; i++) {
    var row = gpsRows[i];
    var rowNum = row.index + 1;
    var matrixRowIdx = rowNum - 2;
    if (matrixRowIdx < 0 || matrixRowIdx >= allValues.length) continue;
    
    if (auditEsProyectoInterno(row.proyecto)) continue;
    
    var isFirst = (i === 0);
    var isLast = (i === gpsRows.length - 1);
    
    var res = auditCalcularMetricasParaFilaGPS(row, geocercas, officeLat, officeLon, isFirst, isLast, dateStr, especiales);
    Logger.log('   -> Resultado Fila ' + rowNum + ': HoraSalida="' + res.horaSalida + '", HoraEntrada="' + res.horaEntrada + '", KM=' + res.km + ', Recorrido=' + res.tiempoRecorrido);
    
    var fullRow = allValues[matrixRowIdx];
    var fullFormulas = allFormulas[matrixRowIdx];
    
    var revIdx        = mBit.REV;
    var obsIdx        = mBit.OBSERVACIONES;
    var deIdx         = mBit.DE;
    var aIdx          = mBit.A;
    var salidaIdx     = mBit.SALIDA;
    var entradaIdx    = mBit.ENTRADA;
    var recIdx        = mBit.TIEMPO_REC;
    var paradasDurIdx = mBit.TIEMPO_PARADAS;
    var paradasIdx    = mBit.PARADAS;
    var regresosIdx   = mBit.REGRESOS;
    var kmIdx         = mBit.KM;
    var extraIdx      = mBit.HORAS_EXTRA;
    var salProyIdx    = mBit.HORA_SAL_PROY;
    var llegProyIdx   = mBit.HORA_LLEG_PROY;
    
    var currentRev = (revIdx !== undefined) ? String(fullRow[revIdx] || '').trim() : '';
    var currentObs = (obsIdx !== undefined) ? String(fullRow[obsIdx] || '').trim() : '';
    
    if (res.alertaGeocerca) {
      currentRev = "REVISAR";
      var warning = "[GPS] REVISAR: El vehiculo no visito la geocerca de este proyecto.";
      currentObs = currentObs ? (currentObs.indexOf(warning) !== -1 ? currentObs : currentObs + " | " + warning) : warning;
    }
    
    var strDeVal = formatDecimalToTime15Min(row.T_de || 8.0);
    var strAVal  = formatDecimalToTime15Min(row.T_a || 18.0);
    
    var cleanKm         = (res.km && Number(res.km) > 0) ? res.km : "";
    var cleanTiempoRec  = (res.tiempoRecorrido && res.tiempoRecorrido !== "0:00:00" && res.tiempoRecorrido !== "00:00:00") ? res.tiempoRecorrido : "";
    var cleanHorasExtra = (res.horasExtra && Number(res.horasExtra) > 0) ? res.horasExtra : "";
    var cleanRegresos   = (res.regresos && Number(res.regresos) > 0) ? res.regresos : "";
    
    if (deIdx !== undefined) fullRow[deIdx] = strDeVal;
    if (aIdx !== undefined) fullRow[aIdx] = strAVal;
    if (revIdx !== undefined) fullRow[revIdx] = currentRev || fullRow[revIdx];
    if (salidaIdx !== undefined) fullRow[salidaIdx] = res.horaSalida || "";
    if (entradaIdx !== undefined) fullRow[entradaIdx] = res.horaEntrada || "";
    if (recIdx !== undefined) fullRow[recIdx] = cleanTiempoRec;
    if (paradasDurIdx !== undefined) fullRow[paradasDurIdx] = res.tiempoParadas || "";
    if (paradasIdx !== undefined) fullRow[paradasIdx] = res.paradas || "";
    if (regresosIdx !== undefined) fullRow[regresosIdx] = cleanRegresos;
    if (obsIdx !== undefined) fullRow[obsIdx] = currentObs;
    if (kmIdx !== undefined) fullRow[kmIdx] = cleanKm;
    if (extraIdx !== undefined) fullRow[extraIdx] = cleanHorasExtra;
    if (salProyIdx !== undefined) fullRow[salProyIdx] = res.horaSalProy || "";
    if (llegProyIdx !== undefined) fullRow[llegProyIdx] = res.horaLlegProy || "";
    
    // Preservar fórmulas si existen en alguna celda
    for (var cIdx = 0; cIdx < fullRow.length; cIdx++) {
      if (fullFormulas[cIdx]) {
        fullRow[cIdx] = fullFormulas[cIdx];
      }
    }
  }
}

// ─────────────────────────────────────────────────────────────
//  6. CÁLCULO DE MÉTRICAS Y EVALUACIÓN DE CASOS 1 AL 17
// ─────────────────────────────────────────────────────────────

function auditCalcularMetricasParaFilaGPS(row, geocercas, officeLat, officeLon, isFirstOfPerson, isLastOfPerson, dateStr, especiales) {
  var projNorm = auditNormalizar(row.proyecto);
  var isEspecial = !!(especiales && especiales[projNorm]);
  
  var deDec = parseTimeToDecimal(row.deOriginal || "8:00");
  var aDec = parseTimeToDecimal(row.aOriginal || "18:00");
  
  var esTurnoNocturno = (deDec >= 19.0 || deDec < 5.0 || aDec > 19.0 || (aDec < 5.0 && aDec > 0));
  if (esTurnoNocturno) {
    return {
      deVal: row.deOriginal || "8:00",
      aVal: row.aOriginal || "18:00",
      horaSalida: "", horaEntrada: "", tiempoRecorrido: "", tiempoParadas: "",
      paradas: "", regresos: "", km: "", horasExtra: "", horaSalProy: "", horaLlegProy: "",
      alertaGeocerca: false
    };
  }
  
  var routes = row.routes || [];
  
  if (!routes || routes.length === 0 || row.unidad.toUpperCase() === 'NA') {
    return {
      deVal: formatDecimalToTime15Min(row.T_de || 8.0),
      aVal: formatDecimalToTime15Min(row.T_a || 18.0),
      horaSalida: "", horaEntrada: "", tiempoRecorrido: "", tiempoParadas: "",
      paradas: "", regresos: "", km: "", horasExtra: "", horaSalProy: "", horaLlegProy: "",
      alertaGeocerca: false
    };
  }
  
  if (isEspecial) {
    var blockMetricsEsp = auditCalcularMetricasDeBloque(routes, officeLat, officeLon);
    return {
      deVal: formatDecimalToTime15Min(row.T_de || 8.0), aVal: formatDecimalToTime15Min(row.T_a || 18.0),
      horaSalida: "", horaEntrada: "",
      tiempoRecorrido: blockMetricsEsp.tiempoRecorrido,
      tiempoParadas: "", paradas: "", regresos: "",
      km: blockMetricsEsp.km, horasExtra: "", horaSalProy: "", horaLlegProy: "",
      alertaGeocerca: false
    };
  }
  
  var blockMetrics = auditCalcularMetricasDeBloque(routes, officeLat, officeLon);
  var firstStart = auditObtenerPrimerInicio(routes);
  var lastEnd = auditObtenerUltimoFin(routes);
  
  var horaSalida = "";
  var horaEntrada = "";
  var horaLlegProy = "";
  var horaSalProy = "";
  var horasExtraVal = "";
  
  if (isFirstOfPerson && firstStart) {
    horaSalida = formatTimeOnly(firstStart);
    var firstArrivalToProj = auditCalcularPrimeraLlegadaProyecto(routes, projNorm, geocercas);
    if (firstArrivalToProj) horaLlegProy = formatTimeOnly(firstArrivalToProj);
  }
  
  if (isLastOfPerson && lastEnd) {
    var lastEndDecimal = lastEnd.getHours() + lastEnd.getMinutes() / 60.0;
    if (lastEndDecimal > 19.0) {
      var diffExtra = lastEndDecimal - 18.0;
      if (diffExtra > 0) horasExtraVal = Number(diffExtra.toFixed(1));
    } else {
      horaEntrada = formatTimeOnly(lastEnd);
    }
    var lastExitFromProj = auditCalcularUltimaSalidaProyecto(routes, projNorm, geocercas);
    if (lastExitFromProj && lastEndDecimal <= 19.0) horaSalProy = formatTimeOnly(lastExitFromProj);
  }
  
  var touchesProj = auditRoutesTouchProject(routes, projNorm, geocercas);
  var alertaGeocerca = false;
  if (!touchesProj) {
    alertaGeocerca = true;
    horaSalProy = "";
    horaLlegProy = "";
  }
  
  var regresosCount = auditContarRegresosMismoProyecto(routes, projNorm, geocercas);
  
  return {
    deVal: formatDecimalToTime15Min(row.T_de || 8.0),
    aVal: formatDecimalToTime15Min(row.T_a || 18.0),
    horaSalida: horaSalida,
    horaEntrada: horaEntrada,
    tiempoRecorrido: blockMetrics.tiempoRecorrido,
    tiempoParadas: blockMetrics.tiempoParadas,
    paradas: blockMetrics.paradas,
    regresos: (regresosCount > 0) ? regresosCount : "",
    km: blockMetrics.km,
    horasExtra: horasExtraVal,
    horaSalProy: horaSalProy,
    horaLlegProy: horaLlegProy,
    alertaGeocerca: alertaGeocerca
  };
}

// ─────────────────────────────────────────────────────────────
//  7. HELPER COMPUTACIONALES DE TELEMETRÍA
// ─────────────────────────────────────────────────────────────

function auditCalcularMetricasDeBloque(routes, officeLat, officeLon) {
  if (!routes || !routes.length) return { km: "", tiempoRecorrido: "", paradas: "", tiempoParadas: "" };
  
  var totalKm = 0.0;
  var totalDurationSec = 0;
  var totalParadas = 0;
  var totalParadasSec = 0;
  
  for (var i = 0; i < routes.length; i++) {
    var rt = routes[i];
    var kmVal = parseFloat(rt.distance_km || rt.dist_km || 0);
    if (!isNaN(kmVal)) totalKm += kmVal;
    
    var durSec = parseFloat(rt.duration_sec || 0);
    if (!isNaN(durSec)) totalDurationSec += durSec;
    
    var pCount = parseInt(rt.stops_count || 0, 10);
    if (!isNaN(pCount) && pCount > 0) {
      totalParadas += pCount;
      var pDur = parseFloat(rt.stops_duration_sec || 0);
      if (!isNaN(pDur)) totalParadasSec += pDur;
    }
  }
  
  var paradasResult = "";
  var tiempoParadasResult = "";
  if (totalParadas > 0) {
    var avgMin = (totalParadasSec / totalParadas) / 60.0;
    if (avgMin > 10.0) {
      paradasResult = 1;
      tiempoParadasResult = formatSecToHMS(totalParadasSec / totalParadas);
    }
  }
  
  return {
    km: (totalKm > 0) ? Number(totalKm.toFixed(2)) : "",
    tiempoRecorrido: (totalDurationSec > 0) ? formatSecToHMS(totalDurationSec) : "",
    paradas: paradasResult,
    tiempoParadas: tiempoParadasResult
  };
}

function auditToDateObj(val) {
  if (!val) return null;
  if (val instanceof Date && !isNaN(val.getTime())) return val;
  var str = String(val).trim();
  if (str.indexOf('T') !== -1) str = str.split('T')[1];
  var spaceParts = str.split(' ');
  var timePart   = spaceParts[spaceParts.length - 1];
  var parts      = timePart.split(':');
  if (parts.length >= 2) {
    var h = parseInt(parts[0], 10) || 0;
    var m = parseInt(parts[1], 10) || 0;
    var s = parts.length > 2 ? (parseInt(parts[2], 10) || 0) : 0;
    var now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, s);
  }
  return null;
}

function auditObtenerPrimerInicio(routes) {
  if (!routes || !routes.length) return null;
  var first = null;
  for (var r = 0; r < routes.length; r++) {
    var dt = auditToDateObj(routes[r].start_time);
    if (dt && (first === null || dt < first)) {
      first = dt;
    }
  }
  return first;
}

function auditObtenerUltimoFin(routes) {
  if (!routes || !routes.length) return null;
  var last = null;
  for (var r = 0; r < routes.length; r++) {
    var dt = auditToDateObj(routes[r].end_time);
    if (dt && (last === null || dt > last)) {
      last = dt;
    }
  }
  return last;
}

function auditRoutesTouchProject(routes, projNorm, geocercas) {
  if (!routes || !routes.length) return false;
  for (var r = 0; r < routes.length; r++) {
    var rt = routes[r];
    var startGeoId = auditObtenerGeocercaDetectada(rt.start_lat, rt.start_lon, geocercas, [projNorm]);
    var destGeoId = auditObtenerGeocercaDetectada(rt.end_lat, rt.end_lon, geocercas, [projNorm]);
    if (startGeoId && auditCoincideGeocercaConProyecto(auditBuscarGeocercaPorId(geocercas, startGeoId), projNorm)) return true;
    if (destGeoId && auditCoincideGeocercaConProyecto(auditBuscarGeocercaPorId(geocercas, destGeoId), projNorm)) return true;
  }
  return false;
}

function auditCalcularPrimeraLlegadaProyecto(routes, projNorm, geocercas) {
  if (!routes || !routes.length) return null;
  for (var r = 0; r < routes.length; r++) {
    var rt = routes[r];
    var destGeoId = auditObtenerGeocercaDetectada(rt.end_lat, rt.end_lon, geocercas, [projNorm]);
    if (destGeoId && auditCoincideGeocercaConProyecto(auditBuscarGeocercaPorId(geocercas, destGeoId), projNorm)) {
      return rt.end_time;
    }
  }
  return null;
}

function auditCalcularUltimaSalidaProyecto(routes, projNorm, geocercas) {
  if (!routes || !routes.length) return null;
  for (var r = routes.length - 1; r >= 0; r--) {
    var rt = routes[r];
    var startGeoId = auditObtenerGeocercaDetectada(rt.start_lat, rt.start_lon, geocercas, [projNorm]);
    if (startGeoId && auditCoincideGeocercaConProyecto(auditBuscarGeocercaPorId(geocercas, startGeoId), projNorm)) {
      return rt.start_time;
    }
  }
  return null;
}

function auditContarRegresosMismoProyecto(routes, projNorm, geocercas) {
  if (!routes || routes.length < 2) return 0;
  var smartcorpVisits = 0;
  var inProject = false;
  
  for (var r = 0; r < routes.length; r++) {
    var rt = routes[r];
    var startGeo = auditObtenerGeocercaDetectada(rt.start_lat, rt.start_lon, geocercas, [projNorm]);
    var endGeo = auditObtenerGeocercaDetectada(rt.end_lat, rt.end_lon, geocercas, [projNorm]);
    
    if (endGeo === 'SMARTCORP' && inProject) {
      smartcorpVisits++;
      inProject = false;
    }
    if (startGeo && startGeo !== 'SMARTCORP' && auditCoincideGeocercaConProyecto(auditBuscarGeocercaPorId(geocercas, startGeo), projNorm)) {
      inProject = true;
    }
    if (endGeo && endGeo !== 'SMARTCORP' && auditCoincideGeocercaConProyecto(auditBuscarGeocercaPorId(geocercas, endGeo), projNorm)) {
      inProject = true;
    }
  }
  return smartcorpVisits > 1 ? (smartcorpVisits - 1) : 0;
}

function auditEsProyectoInterno(proyecto) {
  var pNorm = auditNormalizar(proyecto);
  return (pNorm === 'smarthaus gastos' || pNorm === 'oficina' || pNorm === 'smartcorp');
}

// ─────────────────────────────────────────────────────────────
//  8. DIAGNÓSTICO DETALLADO Y FORMATO DE SALIDA
// ─────────────────────────────────────────────────────────────

function auditEsNombreUnidadValido(name) {
  if (!name) return false;
  var norm = auditNormalizar(name);
  if (norm === '' || norm === 'na' || norm === 'n/a') return false;
  if (norm.indexOf('datos generales') !== -1) return false;
  if (norm.indexOf('resumen') !== -1) return false;
  if (norm.indexOf('dispositivo') !== -1) return false;
  if (norm.indexOf('reporte') !== -1) return false;
  if (norm.indexOf('ruta') !== -1) return false;
  if (norm.indexOf('fecha') !== -1) return false;
  if (norm.indexOf('total') !== -1) return false;
  return true;
}

function auditBuscarEquivalenciaUnidad(unidadUbiqo, mapaEquivalencias) {
  if (!unidadUbiqo) return '';
  var normUbi = auditNormalizar(unidadUbiqo);
  if (mapaEquivalencias[normUbi]) return mapaEquivalencias[normUbi];
  if (mapaEquivalencias[unidadUbiqo]) return mapaEquivalencias[unidadUbiqo];
  
  var matchNum = normUbi.match(/\b\d{1,3}\b/);
  if (matchNum) {
    var num = matchNum[0];
    for (var key in mapaEquivalencias) {
      if (key.indexOf(num) !== -1) {
        return mapaEquivalencias[key];
      }
    }
  }
  return unidadUbiqo;
}

function auditObtenerRutasUnidadStrict(dateUnitsData, rowUnidad, reverseMap, mapaEquivalencias) {
  if (!dateUnitsData) return [];
  var normBit = auditNormalizar(rowUnidad);
  if (!normBit || normBit === 'na') return [];
  
  // 1. Coincidencia directa exacta
  for (var key in dateUnitsData) {
    var keyNorm = auditNormalizar(key);
    if (keyNorm === normBit) return dateUnitsData[key];
  }
  
  // 2. Coincidencia usando mapa de equivalencias
  var mappedUnit = auditBuscarEquivalenciaUnidad(rowUnidad, mapaEquivalencias);
  var normMapped = auditNormalizar(mappedUnit);
  
  for (var key in dateUnitsData) {
    var keyNorm = auditNormalizar(key);
    var keyMapped = auditBuscarEquivalenciaUnidad(key, mapaEquivalencias);
    var keyMappedNorm = auditNormalizar(keyMapped);
    
    if (keyNorm === normMapped || keyMappedNorm === normBit || (normMapped && keyMappedNorm === normMapped)) {
      return dateUnitsData[key];
    }
  }
  
  // 3. Extraer el número de unidad (ej. "02" de "SH-U02-March 1" y "02 (March 1)")
  var numMatch = normBit.match(/\d+/);
  if (numMatch) {
    var numBitInt = parseInt(numMatch[0], 10);
    for (var key in dateUnitsData) {
      var keyNumMatch = auditNormalizar(key).match(/\d+/);
      if (keyNumMatch && parseInt(keyNumMatch[0], 10) === numBitInt) {
        return dateUnitsData[key];
      }
    }
  }
  
  return [];
}

// (Diagnóstico de GPS movido a Audit_GPS_Diagnostico.js)

// ─────────────────────────────────────────────────────────────
//  9. FUNCIONES AUXILIARES DE SOPORTE Y PARSEO
// ─────────────────────────────────────────────────────────────

function auditObtenerSpreadsheetConfiguracion() {
  if (AUDIT_GPS_CONFIG_SHEET_ID && AUDIT_GPS_CONFIG_SHEET_ID.indexOf('12nC3f') === -1) {
    try {
      return SpreadsheetApp.openById(AUDIT_GPS_CONFIG_SHEET_ID);
    } catch (e) {}
  }
  
  try {
    var files = DriveApp.getFilesByName('SMARTCORP_GPS_Configuracion');
    if (files.hasNext()) {
      var f = files.next();
      return SpreadsheetApp.openById(f.getId());
    }
  } catch (err) {}
  
  throw new Error('No se encontró la hoja "SMARTCORP_GPS_Configuracion" en Google Drive.');
}

function auditObtenerGeocercas(ssConfig) {
  var geocercas = {};
  try {
    var sh = ssConfig.getSheetByName('Proyectos_GPS');
    if (sh) {
      var data = sh.getDataRange().getValues();
      for (var r = 1; r < data.length; r++) {
        var id = String(data[r][0] || '').trim();
        var nom = String(data[r][1] || '').trim();
        var lat = parseFloat(data[r][2]);
        var lon = parseFloat(data[r][3]);
        var rad = parseFloat(data[r][4]) || 100.0;
        if (id && !isNaN(lat) && !isNaN(lon)) {
          geocercas[auditNormalizar(id)] = { id: id, nombre: nom, lat: lat, lon: lon, radio: rad };
        }
      }
    }
  } catch (e) {}
  return geocercas;
}

function auditObtenerMapaEquivalencias(ssConfig) {
  var map = {};
  try {
    var sh = ssConfig.getSheetByName('Relacion_Unidades');
    if (sh) {
      var data = sh.getDataRange().getValues();
      for (var r = 1; r < data.length; r++) {
        var gpsUnit = String(data[r][0] || '').trim();
        var bitUnit = String(data[r][1] || '').trim();
        if (gpsUnit && bitUnit) {
          map[gpsUnit] = bitUnit;
          map[auditNormalizar(gpsUnit)] = bitUnit;
          map[bitUnit] = bitUnit;
          map[auditNormalizar(bitUnit)] = bitUnit;
        }
      }
    }
  } catch (e) {}
  return map;
}

function auditObtenerProyectosEspeciales(ssConfig) {
  var esp = {};
  try {
    var sh = ssConfig.getSheetByName('Proyectos_Especiales');
    if (sh) {
      var data = sh.getDataRange().getValues();
      for (var r = 0; r < data.length; r++) {
        var val = String(data[r][0] || '').trim();
        if (val) esp[auditNormalizar(val)] = true;
      }
    }
  } catch (e) {}
  return esp;
}

function auditObtenerGeocercaDetectada(lat, lon, geocercas, preferredProjs) {
  if (isNaN(lat) || isNaN(lon)) return null;
  if (preferredProjs && preferredProjs.length > 0) {
    for (var p = 0; p < preferredProjs.length; p++) {
      var pNorm = auditNormalizar(preferredProjs[p]);
      var geo = geocercas[pNorm];
      if (geo) {
        var dist = auditHaversineDistance(lat, lon, geo.lat, geo.lon);
        if (dist <= 1500.0) return geo.id;
      }
    }
  }
  for (var key in geocercas) {
    var geo = geocercas[key];
    var dist = auditHaversineDistance(lat, lon, geo.lat, geo.lon);
    if (dist <= geo.radio) return geo.id;
  }
  return null;
}

function auditBuscarGeocercaPorId(geocercas, id) {
  if (!id) return null;
  return geocercas[auditNormalizar(id)] || null;
}

function auditCoincideGeocercaConProyecto(geo, projNorm) {
  if (!geo || !projNorm) return false;
  var gId = auditNormalizar(geo.id);
  var gNom = auditNormalizar(geo.nombre);
  return (gId === projNorm || gNom === projNorm);
}

function auditHaversineDistance(lat1, lon1, lat2, lon2) {
  var R = 6371000;
  var dLat = (lat2 - lat1) * Math.PI / 180;
  var dLon = (lon2 - lon1) * Math.PI / 180;
  var a = Math.sin(dLat/2) * Math.sin(dLat/2) +
          Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
          Math.sin(dLon/2) * Math.sin(dLon/2);
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

function auditObtenerFilasTecnico(currentData, activeTechName, dateStr) {
  var rows = [];
  if (!currentData || currentData.length < 2) return rows;
  var mBit = auditObtenerMapaIndicesBitacora(currentData[0]);
  
  for (var b = 1; b < currentData.length; b++) {
    var fDate = (mBit.FECHA !== undefined) ? auditFastNormalizarFechaKey(currentData[b][mBit.FECHA]) : '';
    if (fDate !== dateStr) continue;
    var fNombre = (mBit.NOMBRE !== undefined) ? String(currentData[b][mBit.NOMBRE] || '').trim() : '';
    if (fNombre === activeTechName) {
      rows.push({
        index: b,
        proyecto: (mBit.PROYECTO !== undefined) ? String(currentData[b][mBit.PROYECTO] || '') : '',
        nombre: fNombre,
        rol: (mBit.ROL !== undefined) ? String(currentData[b][mBit.ROL] || '').trim() : '',
        asunto: (mBit.ASUNTO !== undefined) ? String(currentData[b][mBit.ASUNTO] || '').trim() : '',
        unidad: (mBit.UNIDAD !== undefined) ? String(currentData[b][mBit.UNIDAD] || '').trim() : '',
        deOriginal: (mBit.DE !== undefined) ? currentData[b][mBit.DE] : '',
        aOriginal: (mBit.A !== undefined) ? currentData[b][mBit.A] : ''
      });
    }
  }
  return rows;
}

function auditFiltrarRutasPorTurno(routes, deOriginal, aOriginal) {
  if (!routes || routes.length === 0) return [];
  var deDec = parseTimeToDecimal(deOriginal || "8:00");
  var aDec = parseTimeToDecimal(aOriginal || "18:00");
  var esNocturno = (deDec >= 19.0 || deDec < 5.0 || aDec > 19.0 || (aDec < 5.0 && aDec > 0));
  
  return routes.filter(function(rt) {
    if (!rt) return false;
    var st = rt.start_time;
    if (!st) return true; // Si no hay hora explícita, no descartar

    var hour = 0, min = 0;
    if (st instanceof Date && !isNaN(st.getTime())) {
      hour = st.getHours();
      min  = st.getMinutes();
    } else {
      var stStr = String(st).trim();
      if (stStr.indexOf('T') !== -1) stStr = stStr.split('T')[1];
      var spaceParts = stStr.split(' ');
      var timePart   = spaceParts[spaceParts.length - 1];
      var parts      = timePart.split(':');
      if (parts.length >= 2) {
        hour = parseInt(parts[0], 10) || 0;
        min  = parseInt(parts[1], 10) || 0;
      }
    }

    var rtStart = hour + min / 60.0;
    var isRtNocturno = (rtStart >= 18.0 || rtStart < 6.0);
    return esNocturno ? isRtNocturno : !isRtNocturno;
  });
}

function auditInsertarFilaAdministrativa(sheet, targetRowIdx, dateStr, nombre, proyecto, de, a, asunto, unidad, obs, rol) {
  sheet.insertRowBefore(targetRowIdx);
  var sourceRowIdx = targetRowIdx + 1;
  if (sourceRowIdx > sheet.getLastRow()) sourceRowIdx = targetRowIdx - 1;
  
  var cols = sheet.getLastColumn();
  var sourceRange = sheet.getRange(sourceRowIdx, 1, 1, cols);
  var targetRange = sheet.getRange(targetRowIdx, 1, 1, cols);
  sourceRange.copyTo(targetRange);
  
  var rowValues = targetRange.getValues()[0];
  var rowFormulas = targetRange.getFormulas()[0];
  
  rowValues[2] = dateStr;
  rowValues[3] = proyecto;
  rowValues[4] = nombre;
  rowValues[5] = rol || "";
  rowValues[6] = de;
  rowValues[7] = a;
  rowValues[9] = unidad;
  rowValues[10] = "";
  rowValues[11] = asunto;
  rowValues[12] = "";
  rowValues[13] = "";
  rowValues[14] = "REVISAR";
  rowValues[15] = ""; rowValues[16] = ""; rowValues[17] = "";
  rowValues[18] = ""; rowValues[19] = ""; rowValues[20] = "";
  rowValues[21] = obs;
  rowValues[22] = ""; rowValues[23] = ""; rowValues[24] = ""; rowValues[25] = "";
  
  for (var cIdx = 0; cIdx < rowValues.length; cIdx++) {
    if (cIdx === 8 && rowFormulas[cIdx]) {
      rowValues[cIdx] = rowFormulas[cIdx];
    }
  }
  targetRange.setValues([rowValues]);
}

function auditCopiarFilasFechaPrueba(ssBitacora, shBitacora, dateStr) {
  var masterSh = ssBitacora.getSheetByName(AUDIT_BITACORA_TAB_NAME);
  if (!masterSh) return;
  var masterData = masterSh.getDataRange().getValues();
  if (masterData.length < 2) return;
  
  var mBit = auditObtenerMapaIndicesBitacora(masterData[0]);
  var fechaColIdx = (mBit.FECHA !== undefined) ? mBit.FECHA : 2;
  
  var rowsToCopy = [];
  for (var m = 1; m < masterData.length; m++) {
    var md = auditFastNormalizarFechaKey(masterData[m][fechaColIdx]);
    if (md === dateStr) {
      rowsToCopy.push(masterData[m]);
    }
  }
  if (rowsToCopy.length > 0) {
    var startRow = shBitacora.getLastRow() + 1;
    shBitacora.getRange(startRow, 1, rowsToCopy.length, rowsToCopy[0].length).setValues(rowsToCopy);
    Logger.log('[LOG] Copiadas ' + rowsToCopy.length + ' filas para la fecha ' + dateStr + ' en Bitacora_Prueba.');
  }
}

function auditParsearArchivoUbiqo(file) {
  var fileId = file.getId();
  if (_auditParseCache[fileId]) {
    return _auditParseCache[fileId];
  }
  
  var tempFile = null;
  var routes = [];
  var unitMap = {};
  var unitBlocks = [];
  var tempSs = null;
  
  try {
    var mimeType = file.getMimeType();
    
    // Si el archivo ya es Google Sheets, abrirlo directamente (0.1 segundos)
    if (mimeType === MimeType.GOOGLE_SHEETS || mimeType === 'application/vnd.google-apps.spreadsheet') {
      tempSs = SpreadsheetApp.openById(fileId);
    } else {
      var resource = {
        title: 'TEMP_GPS_' + file.getName().replace(/\.xlsx$/i, ''),
        mimeType: MimeType.GOOGLE_SHEETS
      };
      tempFile = Drive.Files.insert(resource, file.getBlob());
      if (!tempFile || !tempFile.id) {
        throw new Error('No se pudo crear la conversión temporal.');
      }
      tempSs = SpreadsheetApp.openById(tempFile.id);
    }
    
    if (!tempSs) {
      throw new Error('No se pudo abrir la hoja para lectura.');
    }
    
    var sheet = tempSs.getSheets()[0];
    var allData = sheet.getDataRange().getValues();
    
    var currentUnit = null;
    
    for (var r = 3; r < allData.length; r++) {
      var row = allData[r];
      var colAVal = String(row[0] || '').trim();
      var colBVal = String(row[1] || '').trim();
      
      if (r === 3 && colAVal.toLowerCase().indexOf('dispositivo') !== -1) {
        continue;
      }
      
      var isNewDevice = false;
      if (colAVal !== "" && auditEsNombreUnidadValido(colAVal)) {
        if (r + 1 < allData.length) {
          var nextRowBVal = String(allData[r+1][1] || '').toLowerCase().trim();
          if (nextRowBVal.indexOf('ruta') !== -1 || nextRowBVal.indexOf('tramo') !== -1 || nextRowBVal.indexOf('id') !== -1) {
            isNewDevice = true;
          }
        }
        if (!isNewDevice && r === 4) {
          isNewDevice = true;
        }
      }
      
      if (colAVal !== "" && auditEsNombreUnidadValido(colAVal)) {
        currentUnit = colAVal;
        if (colBVal === "" || colBVal.toLowerCase().indexOf('resumen') !== -1 || colBVal.toLowerCase().indexOf('datos') !== -1) {
          continue;
        }
      }
      
      if (currentUnit) {
        var startVal = row[2];
        var endVal = row[6];
        if (!startVal) continue;
        
        var startDt = (startVal instanceof Date) ? startVal : parseDateTimeJS(startVal);
        var endDt = (endVal instanceof Date) ? endVal : parseDateTimeJS(endVal);
        
        if (!startDt || isNaN(startDt.getTime())) continue;
        
        var startLat = parseCoordJS(row[4]);
        var startLon = parseCoordJS(row[5]);
        var endLat = parseCoordJS(row[8]);
        var endLon = parseCoordJS(row[9]);
        var distKm = parseDistJS(row[20]);
        var durSec = parseDurSecJS(row[21]);
        
        var rtObj = {
          id: routes.length + 1,
          unit_id: currentUnit,
          start_time: startDt,
          end_time: endDt || startDt,
          start_lat: startLat,
          start_lon: startLon,
          end_lat: endLat,
          end_lon: endLon,
          distance_km: distKm,
          dist_km: distKm,
          duration_sec: durSec,
          duration_raw: String(row[21] || ''),
          dur_mov_raw: String(row[21] || '')
        };
        
        routes.push(rtObj);
        
        if (!unitMap[currentUnit]) {
          unitMap[currentUnit] = { unidad: currentUnit, routes: [] };
          unitBlocks.push(unitMap[currentUnit]);
        }
        unitMap[currentUnit].routes.push(rtObj);
      }
    }
  } catch (err) {
    Logger.log('❌ Error parseando archivo GPS (' + file.getName() + '): ' + err.message);
  } finally {
    if (tempFile && tempFile.id) {
      try {
        Drive.Files.remove(tempFile.id);
      } catch (e) {}
    }
  }
  
  var parseResult = { status: 'success', units: unitBlocks, routes: routes };
  _auditParseCache[fileId] = parseResult;
  return parseResult;
}

function parseDateTimeJS(val) {
  if (!val) return null;
  if (val instanceof Date) return val;
  var str = String(val).trim();
  var parts = str.split(' ');
  if (parts.length >= 2) {
    var dateParts = parts[0].split('/');
    var timeParts = parts[1].split(':');
    if (dateParts.length === 3 && timeParts.length >= 2) {
      var d = parseInt(dateParts[0], 10);
      var m = parseInt(dateParts[1], 10) - 1;
      var y = parseInt(dateParts[2], 10);
      if (y < 100) y += 2000;
      var hh = parseInt(timeParts[0], 10);
      var mm = parseInt(timeParts[1], 10);
      var ss = timeParts.length > 2 ? parseInt(timeParts[2], 10) : 0;
      return new Date(y, m, d, hh, mm, ss);
    }
  }
  var dObj = new Date(str);
  return isNaN(dObj.getTime()) ? null : dObj;
}

function parseCoordJS(val) {
  if (typeof val === 'number') return val;
  if (!val) return 0.0;
  var num = parseFloat(String(val).replace(/,/g, '.').replace(/[^0-9.-]/g, ''));
  return isNaN(num) ? 0.0 : num;
}

function parseDistJS(val) {
  if (typeof val === 'number') return val;
  if (!val) return 0.0;
  var str = String(val).replace(/,/g, '.');
  var match = str.match(/([0-9.]+)/);
  if (match) {
    var num = parseFloat(match[1]);
    return isNaN(num) ? 0.0 : num;
  }
  return 0.0;
}

function parseDurSecJS(val) {
  if (typeof val === 'number') return val;
  if (!val) return 0;
  var str = String(val).toLowerCase().trim();
  var hours = 0, minutes = 0, seconds = 0;
  var matchH = str.match(/(\d+)\s*h/);
  if (matchH) hours = parseInt(matchH[1], 10);
  var matchM = str.match(/(\d+)\s*min/);
  if (matchM) minutes = parseInt(matchM[1], 10);
  var matchS = str.match(/(\d+)\s*s/);
  if (matchS) seconds = parseInt(matchS[1], 10);
  if (hours === 0 && minutes === 0 && seconds === 0) {
    if (str.indexOf(':') !== -1) {
      var p = str.split(':');
      hours = parseInt(p[0], 10) || 0;
      minutes = parseInt(p[1], 10) || 0;
      seconds = p.length > 2 ? (parseInt(p[2], 10) || 0) : 0;
    }
  }
  return (hours * 3600) + (minutes * 60) + seconds;
}

function parseTimeToDecimal(val) {
  if (!val) return 8.0;
  if (val instanceof Date) return val.getHours() + val.getMinutes() / 60.0;
  var str = String(val).trim();
  if (str.indexOf(':') !== -1) {
    var parts = str.split(':');
    return parseInt(parts[0], 10) + parseInt(parts[1], 10) / 60.0;
  }
  var num = parseFloat(str);
  return isNaN(num) ? 8.0 : num;
}

function formatDecimalToTime15Min(dec) {
  if (dec === undefined || dec === null || isNaN(dec)) return "8:00";
  var totalMin = Math.round(dec * 60);
  var hours = Math.floor(totalMin / 60);
  var mins = totalMin % 60;
  if (mins === 60) { hours += 1; mins = 0; }
  return hours + ':' + auditPad2(mins);
}

function formatTimeOnly(d) {
  if (!d) return '';
  if (d instanceof Date && !isNaN(d.getTime())) {
    return auditPad2(d.getHours()) + ':' + auditPad2(d.getMinutes()) + ':' + auditPad2(d.getSeconds());
  }
  var str = String(d).trim();
  if (str.indexOf('T') !== -1) str = str.split('T')[1];
  var spaceParts = str.split(' ');
  var timePart   = spaceParts[spaceParts.length - 1];
  var parts      = timePart.split(':');
  if (parts.length >= 2) {
    var h = parseInt(parts[0], 10) || 0;
    var m = parseInt(parts[1], 10) || 0;
    var s = parts.length > 2 ? (parseInt(parts[2], 10) || 0) : 0;
    return auditPad2(h) + ':' + auditPad2(m) + ':' + auditPad2(s);
  }
  return '';
}

function formatSecToHMS(totalSec) {
  if (!totalSec || totalSec <= 0) return "";
  var sec = Math.round(totalSec);
  var h = Math.floor(sec / 3600);
  var m = Math.floor((sec % 3600) / 60);
  var s = sec % 60;
  return auditPad2(h) + ':' + auditPad2(m) + ':' + auditPad2(s);
}
