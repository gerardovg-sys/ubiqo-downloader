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
      
      if (auditEsFilaAusencia(fProj, fAsunto)) {
        if (mBitInit.DE !== undefined) sheet.getRange(rowNum, mBitInit.DE + 1).setValue("8:00");
        if (mBitInit.A !== undefined) sheet.getRange(rowNum, mBitInit.A + 1).setValue("18:00");
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
  
  // Pass 1: Inserción agrupada de filas administrativas (Inicio tardío o retorno temprano)
  auditProcesarInsercionFilasAdministrativasAgrupadas(sheet, uniqueTechs, dateStr, dateUnitsData, geocercas, officeLat, officeLon, mapaEquivalencias, especiales);
  
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
    var mBitFinal = auditObtenerMapaIndicesBitacora(fullHeaders);
    if (mBitFinal.KM !== undefined && mBitFinal.KM >= 0) {
      sheet.getRange(2, mBitFinal.KM + 1, lastRow - 1, 1).setNumberFormat("0.00");
    }
  }
}

// ─────────────────────────────────────────────────────────────
//  4. PASS 1: INSERCIÓN DE FILAS ADMINISTRATIVAS AGRUPADAS
// ─────────────────────────────────────────────────────────────

function auditProcesarInsercionFilasAdministrativasAgrupadas(sheet, uniqueTechs, dateStr, dateUnitsData, geocercas, officeLat, officeLon, mapaEquivalencias, especiales) {
  var reverseMap = {};
  for (var gpsKey in mapaEquivalencias) {
    reverseMap[auditNormalizar(mapaEquivalencias[gpsKey])] = gpsKey;
  }
  
  var currentData = sheet.getDataRange().getValues();
  var mBit = auditObtenerMapaIndicesBitacora(currentData[0]);
  
  var tardioItems = [];
  var tempranoItems = [];
  
  for (var t = 0; t < uniqueTechs.length; t++) {
    var techName = uniqueTechs[t];
    var techRows = auditObtenerFilasTecnico(currentData, techName, dateStr);
    if (!techRows || techRows.length === 0) continue;
    
    var hasSmarthaus = techRows.some(function(r) { return auditNormalizar(r.proyecto) === 'smarthaus gastos'; });
    if (hasSmarthaus) continue;
    
    var installRows = techRows.filter(function(r) { return !auditEsProyectoInterno(r.proyecto, r.asunto); });
    if (installRows.length === 0) continue;
    
    var isOnlySpecial = (installRows.length === 1 && (especiales[auditNormalizar(installRows[0].proyecto)] || auditEsProyectoInterno(installRows[0].proyecto, installRows[0].asunto)));
    if (isOnlySpecial) continue;
    
    for (var i = 0; i < installRows.length; i++) {
      var r = installRows[i];
      var routes = auditObtenerRutasUnidadStrict(dateUnitsData, r.unidad, reverseMap, mapaEquivalencias);
      r.routes = auditFiltrarRutasPorTurno(routes, r.deOriginal, r.aOriginal);
    }
    
    var firstInstall = installRows[0];
    var lastInstall  = installRows[installRows.length - 1];
    
    var firstStart = auditObtenerPrimerInicio(firstInstall.routes);
    var firstStartDec = firstStart ? (firstStart.getHours() + firstStart.getMinutes() / 60.0) : 8.0;
    
    var lastEnd = auditObtenerUltimoFin(lastInstall.routes);
    var lastEndDec = lastEnd ? (lastEnd.getHours() + lastEnd.getMinutes() / 60.0) : 18.0;
    
    if (firstStartDec - 8.0 >= 1.0) {
      var startTardioDec = Math.ceil(firstStartDec * 4) / 4.0;
      var startStr = formatDecimalToTime15Min(startTardioDec);
      tardioItems.push({
        techName: techName,
        rol: techRows[0].rol,
        de: "8:00",
        a: startStr,
        obs: "[GPS] Fila administrativa autogenerada por inicio tardio (08:00 a " + startStr + ")",
        refRow: firstInstall.index + 1
      });
    } else if (lastEndDec < 17.0) {
      var endTempranoDec = Math.floor(lastEndDec * 4) / 4.0;
      var endStr = formatDecimalToTime15Min(endTempranoDec);
      tempranoItems.push({
        techName: techName,
        rol: techRows[0].rol,
        de: endStr,
        a: "18:00",
        obs: "[GPS] Fila administrativa autogenerada por retorno temprano (" + endStr + " a 18:00)",
        refRow: lastInstall.index + 1
      });
    }
  }
  
  // 1. Inserción agrupada de inicio tardío (al principio del bloque)
  if (tardioItems.length > 0) {
    var minRow = 999999;
    for (var i = 0; i < tardioItems.length; i++) {
      if (tardioItems[i].refRow < minRow) minRow = tardioItems[i].refRow;
    }
    for (var i = 0; i < tardioItems.length; i++) {
      var item = tardioItems[i];
      auditInsertarFilaAdministrativa(sheet, minRow + i, dateStr, item.techName, "SMARTHAUS GASTOS", item.de, item.a, "Oficina", "NA", item.obs, item.rol);
    }
  }
  
  // Actualizar datos actuales tras posibles inserciones tardías
  currentData = sheet.getDataRange().getValues();
  
  // 2. Inserción agrupada de retorno temprano (al final de todo el bloque de la fecha)
  if (tempranoItems.length > 0) {
    var maxRow = 0;
    for (var b = 1; b < currentData.length; b++) {
      var fFecha = (mBit.FECHA !== undefined) ? auditNormalizarFechaKey(currentData[b][mBit.FECHA]) : '';
      if (fFecha === dateStr) {
        if (b + 1 > maxRow) maxRow = b + 1;
      }
    }
    if (maxRow > 0) {
      for (var i = 0; i < tempranoItems.length; i++) {
        var item = tempranoItems[i];
        auditInsertarFilaAdministrativa(sheet, maxRow + 1 + i, dateStr, item.techName, "SMARTHAUS GASTOS", item.de, item.a, "Oficina", "NA", item.obs, item.rol);
      }
    }
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
  
  for (var i = 0; i < gpsRows.length; i++) {
    var row = gpsRows[i];
    var routes = auditObtenerRutasUnidadStrict(dateUnitsData, row.unidad, reverseMap, mapaEquivalencias);
    row.routes = auditFiltrarRutasPorTurno(routes, row.deOriginal, row.aOriginal);
    Logger.log('   -> Fila ' + (row.index + 1) + ': Proyecto="' + row.proyecto + '", Unidad="' + row.unidad + '" | Rutas vinculadas: ' + (routes ? routes.length : 0) + ' (Filtradas turno: ' + (row.routes ? row.routes.length : 0) + ')');
  }
  
  var installRows = gpsRows.filter(function(r) {
    return !auditEsProyectoInterno(r.proyecto, r.asunto);
  });
  
  if (installRows.length === 0) {
    for (var i = 0; i < gpsRows.length; i++) {
      var row = gpsRows[i];
      var rowNum = row.index + 1;
      var matrixRowIdx = rowNum - 2;
      if (matrixRowIdx >= 0 && matrixRowIdx < allValues.length) {
        var fullRow = allValues[matrixRowIdx];
        if (auditEsFilaAusencia(row.proyecto, row.asunto)) {
          var deIdx = mBit.DE;
          var aIdx = mBit.A;
          if (deIdx !== undefined) fullRow[deIdx] = "8:00";
          if (aIdx !== undefined) fullRow[aIdx] = "18:00";
        }
      }
    }
    return;
  }
  
  var isOnlySpecialProject = (installRows.length === 1 && (especiales[auditNormalizar(installRows[0].proyecto)] || auditEsProyectoInterno(installRows[0].proyecto, installRows[0].asunto)));
  
  for (var k = 0; k < installRows.length; k++) {
    installRows[k]._boundaryStart = 8.0;
    installRows[k]._boundaryEnd = 18.0;
  }
  
  // 1. Transiciones entre proyectos múltiples (Encadenamiento exacto DE = A anterior)
  for (var k = 0; k < installRows.length - 1; k++) {
    var rowPrev = installRows[k];
    var rowCurr = installRows[k + 1];
    var pNormPrev = auditNormalizar(rowPrev.proyecto);
    var pNormCurr = auditNormalizar(rowCurr.proyecto);
    var allUnitRoutes = rowPrev.routes || [];
    
    var boundaryDec = null;
    
    // Si cambiaron de camioneta física en el día:
    var diffUnits = (rowPrev.unidad && rowCurr.unidad && auditNormalizar(rowPrev.unidad) !== auditNormalizar(rowCurr.unidad));
    
    if (diffUnits) {
      var prevOfficeDec = null;
      for (var r = allUnitRoutes.length - 1; r >= 0; r--) {
        var rt = allUnitRoutes[r];
        var distEndOffice = auditHaversineDistance(rt.end_lat, rt.end_lon, officeLat, officeLon);
        if (distEndOffice <= 350.0) {
          var offDate = auditToDateObj(rt.end_time);
          if (offDate) {
            prevOfficeDec = offDate.getHours() + offDate.getMinutes() / 60.0;
            break;
          }
        }
      }
      var currRoutes = rowCurr.routes || [];
      var currFirstStart = auditObtenerPrimerInicio(currRoutes);
      var currStartDec = currFirstStart ? (currFirstStart.getHours() + currFirstStart.getMinutes() / 60.0) : null;
      
      if (prevOfficeDec !== null && currStartDec !== null && prevOfficeDec <= currStartDec) {
        boundaryDec = Math.ceil(prevOfficeDec * 4) / 4.0;
      } else if (currStartDec !== null && currStartDec > 12.0) {
        boundaryDec = Math.floor(currStartDec * 4) / 4.0;
      } else {
        boundaryDec = 13.0; // Corte estándar mediodía
      }
    } else {
      // a) Verificar salida de geocerca de Proyecto Anterior
      var prevExitTime = auditCalcularUltimaSalidaProyecto(allUnitRoutes, pNormPrev, geocercas);
      
      // b) Verificar si pasaron por oficina matriz tras salir del proyecto
      var officeVisitDec = null;
      if (prevExitTime) {
        for (var r = 0; r < allUnitRoutes.length; r++) {
          var rt = allUnitRoutes[r];
          if (auditToDateObj(rt.start_time) >= auditToDateObj(prevExitTime)) {
            var distEndOffice = auditHaversineDistance(rt.end_lat, rt.end_lon, officeLat, officeLon);
            if (distEndOffice <= 250.0) {
              var offDate = auditToDateObj(rt.end_time);
              if (offDate) {
                officeVisitDec = offDate.getHours() + offDate.getMinutes() / 60.0;
                break;
              }
            }
          }
        }
      }
      
      if (officeVisitDec !== null) {
        boundaryDec = Math.ceil(officeVisitDec * 4) / 4.0;
      } else if (prevExitTime) {
        var prevExitDate = auditToDateObj(prevExitTime);
        var prevExitDec = prevExitDate.getHours() + prevExitDate.getMinutes() / 60.0;
        boundaryDec = Math.ceil(prevExitDec * 4) / 4.0;
      } else {
        // Especiales o sin geocerca: buscar traslado principal inter-sitios (> 5 km)
        var maxTransitTime = null;
        var maxDist = 0;
        for (var r = 0; r < allUnitRoutes.length; r++) {
          var dKm = parseFloat(allUnitRoutes[r].distance_km || allUnitRoutes[r].dist_km || 0);
          if (dKm > 5.0 && dKm > maxDist) {
            maxDist = dKm;
            maxTransitTime = auditToDateObj(allUnitRoutes[r].start_time);
          }
        }
        if (maxTransitTime) {
          var transitDec = maxTransitTime.getHours() + maxTransitTime.getMinutes() / 60.0;
          boundaryDec = Math.ceil(transitDec * 4) / 4.0;
        } else {
          boundaryDec = 13.0;
        }
      }
    }
    
    rowPrev._boundaryEnd = boundaryDec;
    rowCurr._boundaryStart = boundaryDec;
    rowPrev.T_a = boundaryDec;
    rowCurr.T_de = boundaryDec;
  }
  
  // 2. Horarios exteriores (Primer y Último proyecto)
  var firstInstall = installRows[0];
  var firstStart = auditObtenerPrimerInicio(firstInstall.routes);
  if (firstStart) {
    var fsDec = firstStart.getHours() + firstStart.getMinutes() / 60.0;
    firstInstall.T_de = (fsDec - 8.0 >= 1.0 && !isOnlySpecialProject) ? (Math.ceil(fsDec * 4) / 4.0) : 8.0;
  } else {
    firstInstall.T_de = 8.0;
  }
  firstInstall._boundaryStart = firstInstall.T_de;
  
  var lastInstall = installRows[installRows.length - 1];
  var lastEnd = auditObtenerUltimoFin(lastInstall.routes);
  if (lastEnd) {
    var leDec = lastEnd.getHours() + lastEnd.getMinutes() / 60.0;
    if (leDec > 19.0) {
      lastInstall.T_a = Math.ceil(leDec * 4) / 4.0;
    } else if (leDec < 17.0 && !isOnlySpecialProject) {
      lastInstall.T_a = Math.floor(leDec * 4) / 4.0;
    } else {
      lastInstall.T_a = 18.0;
    }
  } else {
    lastInstall.T_a = 18.0;
  }
  lastInstall._boundaryEnd = lastInstall.T_a;
  
  // Candado de Integridad Temporal: DE jamás puede ser mayor o igual a A
  for (var k = 0; k < installRows.length; k++) {
    var rowInst = installRows[k];
    if (rowInst.T_de !== undefined && rowInst.T_a !== undefined && rowInst.T_de >= rowInst.T_a) {
      Logger.log('   ⚠️ [ALERTA CORREGIDA] Horario invertido detectado en ' + rowInst.proyecto + ' (DE=' + rowInst.T_de + ', A=' + rowInst.T_a + '). Restaurando horario coherente.');
      var origDe = parseTimeToDecimal(rowInst.deOriginal) || 8.0;
      var origA  = parseTimeToDecimal(rowInst.aOriginal) || 18.0;
      if (origDe < origA) {
        rowInst.T_de = origDe;
        rowInst.T_a  = origA;
      } else {
        rowInst.T_de = Math.max(8.0, rowInst.T_a - 2.0);
      }
      rowInst._boundaryStart = rowInst.T_de;
      rowInst._boundaryEnd   = rowInst.T_a;
    }
  }
  
  // 3. Partición estricta de rutas por proyecto (Evitar duplicación de KM y Tiempos)
  if (installRows.length > 1) {
    for (var k = 0; k < installRows.length; k++) {
      var rowInst = installRows[k];
      var bStart = (rowInst._boundaryStart !== undefined) ? rowInst._boundaryStart : 0.0;
      var bEnd   = (rowInst._boundaryEnd !== undefined) ? rowInst._boundaryEnd : 24.0;
      
      if (rowInst.routes && rowInst.routes.length > 0) {
        rowInst.routes = rowInst.routes.filter(function(rt) {
          var stObj = auditToDateObj(rt.start_time);
          if (!stObj) return true;
          var stHour = stObj.getHours() + stObj.getMinutes() / 60.0;
          return (stHour >= (bStart - 0.05) && stHour < (bEnd + 0.05));
        });
      }
    }
  }
  
  for (var i = 0; i < gpsRows.length; i++) {
    var row = gpsRows[i];
    var rowNum = row.index + 1;
    var matrixRowIdx = rowNum - 2;
    if (matrixRowIdx < 0 || matrixRowIdx >= allValues.length) continue;
    
    if (auditEsProyectoInterno(row.proyecto, row.asunto)) {
      if (auditEsFilaAusencia(row.proyecto, row.asunto)) {
        var fullRow = allValues[matrixRowIdx];
        var deIdx = mBit.DE;
        var aIdx = mBit.A;
        if (deIdx !== undefined) fullRow[deIdx] = "8:00";
        if (aIdx !== undefined) fullRow[aIdx] = "18:00";
      }
      continue;
    }
    
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
      var pNorm = auditNormalizar(row.proyecto);
      var geo = geocercas[pNorm];
      var warning = geo ? "[GPS] REVISAR: El vehiculo no visito la geocerca de este proyecto." : "[GPS] REVISAR: Proyecto sin geocerca registrada en catalogo Proyectos_GPS.";
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
    var espHorasExtra = "";
    var lastEndEsp = auditObtenerUltimoFin(routes);
    if (isLastOfPerson && lastEndEsp) {
      var lastEndDecEsp = lastEndEsp.getHours() + lastEndEsp.getMinutes() / 60.0;
      if (lastEndDecEsp > 19.0) {
        espHorasExtra = Number((lastEndDecEsp - 18.0).toFixed(1));
        row.T_a = Math.ceil(lastEndDecEsp * 4) / 4.0;
      }
    }
    return {
      deVal: formatDecimalToTime15Min(row.T_de || 8.0), aVal: formatDecimalToTime15Min(row.T_a || 18.0),
      horaSalida: "", horaEntrada: "",
      tiempoRecorrido: blockMetricsEsp.tiempoRecorrido,
      tiempoParadas: "", paradas: "", regresos: "",
      km: blockMetricsEsp.km, horasExtra: espHorasExtra, horaSalProy: "", horaLlegProy: "",
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
      row.T_a = Math.ceil(lastEndDecimal * 4) / 4.0;
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

function auditCalcularPermanenciaEnGeocerca(routes, rIndex, geoTarget) {
  if (!routes || rIndex >= routes.length || !geoTarget) return 0;
  
  var arrivalDate = auditToDateObj(routes[rIndex].end_time);
  if (!arrivalDate) return 0;
  
  var rad = geoTarget.radio ? Math.max(geoTarget.radio, 300.0) : 500.0;
  var departureDate = null;
  
  for (var k = rIndex + 1; k < routes.length; k++) {
    var rtNext = routes[k];
    var stDate = auditToDateObj(rtNext.start_time);
    var dStart = auditHaversineDistance(rtNext.start_lat, rtNext.start_lon, geoTarget.lat, geoTarget.lon);
    
    // Si el siguiente tramo arranca cerca o con deriva periférica (hasta 1,500m)
    if (dStart <= rad || dStart <= 1500.0) {
      departureDate = stDate;
      break;
    }
  }
  
  if (!departureDate && rIndex < routes.length - 1) {
    // Si el siguiente tramo inició fuera, la permanencia fue hasta el inicio de ese siguiente viaje
    departureDate = auditToDateObj(routes[rIndex + 1].start_time);
  }
  
  if (departureDate && departureDate > arrivalDate) {
    return (departureDate.getTime() - arrivalDate.getTime()) / 1000.0;
  }
  
  // Si es el último tramo del día, asumir estancia suficiente de fin de jornada
  return 1800;
}

function auditCalcularPrimeraLlegadaProyecto(routes, projNorm, geocercas) {
  if (!routes || !routes.length) return null;
  var geoTarget = geocercas[projNorm];
  var radioTarget = geoTarget ? (geoTarget.radio ? Math.max(geoTarget.radio, 300.0) : 500.0) : 500.0;
  
  for (var r = 0; r < routes.length; r++) {
    var rt = routes[r];
    var isMatch = false;
    var currentGeo = geoTarget;
    
    if (geoTarget) {
      var dist = auditHaversineDistance(rt.end_lat, rt.end_lon, geoTarget.lat, geoTarget.lon);
      if (dist <= radioTarget) isMatch = true;
    }
    
    if (!isMatch) {
      var destGeoId = auditObtenerGeocercaDetectada(rt.end_lat, rt.end_lon, geocercas, [projNorm]);
      if (destGeoId && auditCoincideGeocercaConProyecto(auditBuscarGeocercaPorId(geocercas, destGeoId), projNorm)) {
        currentGeo = auditBuscarGeocercaPorId(geocercas, destGeoId);
        isMatch = true;
      }
    }
    
    if (isMatch && currentGeo) {
      var dwellSec = auditCalcularPermanenciaEnGeocerca(routes, r, currentGeo);
      // Umbral adaptativo: 10 minutos (600s), o si es el último tramo del turno
      if (dwellSec >= 600 || (r === routes.length - 1 && dwellSec >= 300)) {
        return rt.end_time;
      }
    }
  }
  
  // Fallback de consistencia: si el vehículo tocó la geocerca de destino, no dejar llegada vacía
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
  if (!routes || routes.length < 3) return 0;
  var regresosCount = 0;
  var state = 'INITIAL';
  
  for (var r = 0; r < routes.length; r++) {
    var rt = routes[r];
    var startGeo = auditObtenerGeocercaDetectada(rt.start_lat, rt.start_lon, geocercas, [projNorm]);
    var endGeo   = auditObtenerGeocercaDetectada(rt.end_lat, rt.end_lon, geocercas, [projNorm]);
    
    var isEndOffice   = (endGeo === 'SMARTCORP' || endGeo === 'OFICINA');
    var isStartOffice = (startGeo === 'SMARTCORP' || startGeo === 'OFICINA');
    
    var isEndTargetProj   = (endGeo && auditCoincideGeocercaConProyecto(auditBuscarGeocercaPorId(geocercas, endGeo), projNorm));
    var isStartTargetProj = (startGeo && auditCoincideGeocercaConProyecto(auditBuscarGeocercaPorId(geocercas, startGeo), projNorm));
    
    if (state === 'INITIAL') {
      if (isEndTargetProj) {
        state = 'IN_PROJ';
      }
    } else if (state === 'IN_PROJ') {
      if (isEndOffice) {
        state = 'IN_OFFICE';
      }
    } else if (state === 'IN_OFFICE') {
      if (isEndTargetProj) {
        regresosCount++;
        state = 'IN_PROJ';
      } else if (endGeo && !isEndOffice && !isEndTargetProj) {
        state = 'INITIAL';
      }
    }
  }
  return regresosCount;
}

function auditEsFilaAusencia(proyecto, asunto) {
  var p = auditNormalizar(proyecto);
  var a = auditNormalizar(asunto);
  var keywords = ['ausencia', 'falta', 'incapacidad', 'vacaciones', 'permiso', 'suspension'];
  for (var k = 0; k < keywords.length; k++) {
    if (p.indexOf(keywords[k]) !== -1 || a.indexOf(keywords[k]) !== -1) return true;
  }
  return false;
}

function auditEsProyectoInterno(proyecto, asunto) {
  var pNorm = auditNormalizar(proyecto);
  if (pNorm === 'smarthaus gastos' || pNorm === 'oficina' || pNorm === 'smartcorp') return true;
  if (auditEsFilaAusencia(proyecto, asunto)) return true;
  return false;
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
      for (var key in geocercas) {
        var geo = geocercas[key];
        if (auditCoincideGeocercaConProyecto(geo, pNorm)) {
          var dist = auditHaversineDistance(lat, lon, geo.lat, geo.lon);
          var rad = geo.radio ? Math.max(geo.radio, 1500.0) : 1500.0;
          if (dist <= rad) return geo.id;
        }
      }
    }
  }
  for (var key in geocercas) {
    var geo = geocercas[key];
    var dist = auditHaversineDistance(lat, lon, geo.lat, geo.lon);
    var rad = geo.radio ? Math.max(geo.radio, 300.0) : 500.0;
    if (dist <= rad) return geo.id;
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
  if (gId === projNorm || gNom === projNorm) return true;
  if (gId && (gId.indexOf(projNorm) !== -1 || projNorm.indexOf(gId) !== -1)) return true;
  if (gNom && (gNom.indexOf(projNorm) !== -1 || projNorm.indexOf(gNom) !== -1)) return true;
  
  // Coincidencia inteligente por Token Ancla (Raíz de 2 palabras)
  var stopWords = { 'servicio': 1, 'servicios': 1, 'aires': 1, 'aire': 1, 'mantenimiento': 1, 'mantto': 1, 'instalacion': 1, 'pci': 1, 'cctv': 1, 'poliza': 1, 'ac': 1, 'site': 1, 'fase': 1, 'idf': 1, 'ampliacion': 1, 'oficinas': 1, 'oficina': 1 };
  var pTokens = projNorm.split(' ').filter(function(t) { return t.length > 1 && !stopWords[t] && !/^\d{4}$/.test(t); });
  var gTokens = (gId + ' ' + gNom).split(' ').filter(function(t) { return t.length > 1 && !stopWords[t] && !/^\d{4}$/.test(t); });
  
  if (pTokens.length >= 2) {
    var anchor = pTokens.slice(0, 2).join(' '); // ej. 'notaria 31'
    if (gTokens.join(' ').indexOf(anchor) !== -1) return true;
  }
  return false;
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
    var isRtNocturno = (rtStart >= 19.5 || rtStart < 5.5);
    return esNocturno ? isRtNocturno : !isRtNocturno;
  });
}

function auditInsertarFilaAdministrativa(sheet, targetRowIdx, dateStr, nombre, proyecto, de, a, asunto, unidad, obs, rol) {
  sheet.insertRowBefore(targetRowIdx);
  var sourceRowIdx = targetRowIdx + 1;
  if (sourceRowIdx > sheet.getLastRow()) sourceRowIdx = targetRowIdx - 1;
  
  var cols = sheet.getLastColumn();
  var headers = sheet.getRange(1, 1, 1, cols).getValues()[0];
  var mBit = auditObtenerMapaIndicesBitacora(headers);
  
  var sourceRange = sheet.getRange(sourceRowIdx, 1, 1, cols);
  var targetRange = sheet.getRange(targetRowIdx, 1, 1, cols);
  sourceRange.copyTo(targetRange);
  
  var rowValues = targetRange.getValues()[0];
  var rowFormulas = targetRange.getFormulas()[0];
  
  var formulaNames = ['ID', 'Q', 'SAP', 'CALCULO HORAS', 'CÁLCULO HORAS'];
  for (var c = 0; c < rowValues.length; c++) {
    var hNorm = auditNormalizar(headers[c]);
    var isFormulaCol = false;
    for (var f = 0; f < formulaNames.length; f++) {
      if (auditNormalizar(formulaNames[f]) === hNorm) { isFormulaCol = true; break; }
    }
    if (isFormulaCol && rowFormulas[c]) {
      rowValues[c] = rowFormulas[c];
    } else {
      rowValues[c] = "";
    }
  }
  
  if (mBit.FECHA !== undefined) rowValues[mBit.FECHA] = dateStr;
  if (mBit.PROYECTO !== undefined) rowValues[mBit.PROYECTO] = proyecto;
  if (mBit.NOMBRE !== undefined) rowValues[mBit.NOMBRE] = nombre;
  if (mBit.ROL !== undefined) rowValues[mBit.ROL] = rol || "";
  if (mBit.DE !== undefined) rowValues[mBit.DE] = de;
  if (mBit.A !== undefined) rowValues[mBit.A] = a;
  if (mBit.UNIDAD !== undefined) rowValues[mBit.UNIDAD] = unidad;
  if (mBit.ASUNTO !== undefined) rowValues[mBit.ASUNTO] = asunto;
  if (mBit.REV !== undefined) rowValues[mBit.REV] = "REVISAR";
  if (mBit.OBSERVACIONES !== undefined) rowValues[mBit.OBSERVACIONES] = obs;
  
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
