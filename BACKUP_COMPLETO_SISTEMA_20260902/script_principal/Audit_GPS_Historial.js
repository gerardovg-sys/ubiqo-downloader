/**
 * ============================================================
 *  SMARTCORP — Módulo de Lectura y Escritura de Historial_GPS
 *  Archivo: Audit_GPS_Historial.js
 *
 *  Propósito:
 *    Leer tramos pendientes del Historial_GPS y entregarlos
 *    listos a los módulos de Diagnóstico y Procesamiento.
 *    Con logs de diagnóstico integrados.
 *
 *  Versión : 1.4.0
 *  Fecha   : 04/08/2026
 * ============================================================
 */

function auditLeerHistorialPendiente(ssConfig) {
  Logger.log('=== [HISTORIAL LOG] Inicio auditLeerHistorialPendiente ===');
  var shHistorial = ssConfig.getSheetByName('Historial_GPS');
  var empty = {
    byUnitAndDate: {}, datesToProcess: [],
    shHistorial: shHistorial, pendingRowIndices: []
  };

  if (!shHistorial) {
    Logger.log('[HISTORIAL LOG] ❌ Pestaña Historial_GPS no existe en el libro configuracion.');
    return empty;
  }

  var lastRow = shHistorial.getLastRow();
  Logger.log('[HISTORIAL LOG] Pestaña Historial_GPS encontrada. Filas totales: ' + lastRow);

  if (lastRow <= 1) {
    Logger.log('[HISTORIAL LOG] ⚠️ Historial_GPS no tiene filas de datos (lastRow <= 1).');
    return empty;
  }

  var data = shHistorial.getDataRange().getValues();
  Logger.log('[HISTORIAL LOG] Filas leídas de la hoja: ' + data.length);

  // ── Mapear columnas dinámicamente por nombre de encabezado ──
  var headers = data[0];
  Logger.log('[HISTORIAL LOG] Encabezados Fila 1: ' + JSON.stringify(headers));

  var colMap = {};
  for (var c = 0; c < headers.length; c++) {
    var hName = String(headers[c] || '').trim().toLowerCase();
    if (hName) colMap[hName] = c;
  }

  var idxUnidad  = colMap['unidad']                     !== undefined ? colMap['unidad']                     : 0;
  var idxFecha   = colMap['fecha']                      !== undefined ? colMap['fecha']                      : 1;
  var idxHoraIni = colMap['hora_inicio']                !== undefined ? colMap['hora_inicio']                : 2;
  var idxLatIni  = colMap['lat_inicio']                 !== undefined ? colMap['lat_inicio']                 : 3;
  var idxLonIni  = colMap['lon_inicio']                 !== undefined ? colMap['lon_inicio']                 : 4;
  var idxHoraFin = colMap['hora_fin']                   !== undefined ? colMap['hora_fin']                   : 5;
  var idxLatFin  = colMap['lat_fin']                    !== undefined ? colMap['lat_fin']                    : 6;
  var idxLonFin  = colMap['lon_fin']                    !== undefined ? colMap['lon_fin']                    : 7;
  var idxDist    = colMap['distancia_segmento']         !== undefined ? colMap['distancia_segmento']         : 8;
  var idxDur     = colMap['duracion_segmento']          !== undefined ? colMap['duracion_segmento']          : 9;
  var idxParadas = colMap['paradas_duracion_hh_mm_ss']  !== undefined ? colMap['paradas_duracion_hh_mm_ss']  :
                  (colMap['paradas_count']              !== undefined ? colMap['paradas_count']              : 10);
  var idxArchivo = colMap['archivo_origen']             !== undefined ? colMap['archivo_origen']             : 11;
  var idxEstado  = colMap['estado']                     !== undefined ? colMap['estado']                     : 12;

  Logger.log('[HISTORIAL LOG] Índices detectados: Unidad=' + idxUnidad + ', Fecha=' + idxFecha + ', Estado=' + idxEstado);

  var byUnitAndDate     = {};
  var datesToProcess    = {};
  var pendingRowIndices = [];
  var rowsEvaluated     = 0;
  var rowsAccepted      = 0;

  for (var r = 1; r < data.length; r++) {
    rowsEvaluated++;
    var row       = data[r];
    var estadoRaw = String(row[idxEstado] || '').trim().toLowerCase();

    // Aceptar 'pendiente', 'pendientes' o celda vacía
    var esPendiente = (estadoRaw === 'pendiente' || estadoRaw === 'pendientes' || estadoRaw === '');
    var unidad      = String(row[idxUnidad] || '').trim();
    var fecha       = auditFormatDate(row[idxFecha]);

    if (r <= 5) {
      Logger.log('[HISTORIAL LOG] Fila ' + (r+1) + ': Unidad="' + unidad + '", FechaRaw="' + row[idxFecha] + '", FechaParsed="' + fecha + '", EstadoRaw="' + estadoRaw + '", esPendiente=' + esPendiente);
    }

    if (!esPendiente || !unidad || !fecha) {
      continue;
    }

    rowsAccepted++;
    pendingRowIndices.push(r + 1);
    datesToProcess[fecha] = true;

    var unitNorm = auditNormalizar(unidad);
    if (!byUnitAndDate[fecha])           byUnitAndDate[fecha] = {};
    if (!byUnitAndDate[fecha][unitNorm]) byUnitAndDate[fecha][unitNorm] = [];

    var horaIniStr = auditExtractTimeHMS(row[idxHoraIni]);
    var horaFinStr = auditExtractTimeHMS(row[idxHoraFin]);

    var startDt = auditReconstruirFechaHora(fecha, horaIniStr);
    var endDt   = auditReconstruirFechaHora(fecha, horaFinStr);

    var durHms     = auditExtractTimeHMS(row[idxDur]);
    var durSec     = auditHmsToSec(durHms);
    var distKm     = parseFloat(row[idxDist] || 0) || 0;
    var paradasHms = String(row[idxParadas] || '').trim();
    var paradasSec = auditHmsToSec(paradasHms);

    byUnitAndDate[fecha][unitNorm].push({
      unit_id:        unidad,
      start_time:     startDt,
      end_time:       endDt,
      start_lat:      parseFloat(row[idxLatIni]) || 0,
      start_lon:      parseFloat(row[idxLonIni]) || 0,
      end_lat:        parseFloat(row[idxLatFin]) || 0,
      end_lon:        parseFloat(row[idxLonFin]) || 0,
      distance_km:    distKm,
      dist_km:        distKm,
      duration_raw:   durHms,
      duration_sec:   durSec,
      paradas_hms:    paradasHms,
      paradas_sec:    paradasSec,
      archivo_origen: String(row[idxArchivo] || ''),
      _histRowIndex:  r + 1
    });
  }

  var fechasArr = Object.keys(datesToProcess);
  Logger.log('[HISTORIAL LOG] Fin auditLeerHistorialPendiente. Filas evaluadas: ' + rowsEvaluated + ', Aceptadas: ' + rowsAccepted + ' | Fechas: ' + JSON.stringify(fechasArr));

  return {
    byUnitAndDate:     byUnitAndDate,
    datesToProcess:    fechasArr,
    shHistorial:       shHistorial,
    pendingRowIndices: pendingRowIndices
  };
}

function auditMarcarHistorialProcesado(shHistorial, rowIndices) {
  if (!shHistorial || !rowIndices || rowIndices.length === 0) return;
  var data      = shHistorial.getDataRange().getValues();
  var headers   = data[0];
  var colEstado = 13; // base 1 default M

  for (var c = 0; c < headers.length; c++) {
    if (String(headers[c] || '').trim().toLowerCase() === 'estado') {
      colEstado = c + 1;
      break;
    }
  }

  for (var i = 0; i < rowIndices.length; i++) {
    shHistorial.getRange(rowIndices[i], colEstado).setValue('Procesado');
  }
  Logger.log('[HISTORIAL LOG] ✅ ' + rowIndices.length + ' filas marcadas como Procesado.');
}

function auditCalcularParadasDeHistorial(tramos) {
  if (!tramos || tramos.length === 0) return { paradas: '', tiempoParadas: '' };

  var numParadas = 0;
  var totalSec   = 0;

  for (var i = 0; i < tramos.length; i++) {
    var sec = tramos[i].paradas_sec || 0;
    if (sec > 0) {
      numParadas++;
      totalSec += sec;
    }
  }

  if (numParadas === 0) return { paradas: '', tiempoParadas: '' };

  var avgSec = totalSec / numParadas;
  var avgMin = avgSec / 60.0;

  if (avgMin > 10) {
    return {
      paradas:       1,
      tiempoParadas: formatSecToHMS(avgSec)
    };
  }

  return { paradas: '', tiempoParadas: '' };
}

function auditExtractTimeHMS(val) {
  if (!val && val !== 0) return '00:00:00';

  if (val instanceof Date) {
    if (isNaN(val.getTime())) return '00:00:00';
    return auditPad2(val.getHours()) + ':' +
           auditPad2(val.getMinutes()) + ':' +
           auditPad2(val.getSeconds());
  }

  var str = String(val).trim();
  if (str.indexOf('T') !== -1) {
    var timePart = str.split('T')[1];
    if (timePart) str = timePart.split('.')[0].split('Z')[0].split('-')[0].split('+')[0];
  }
  var spaceParts = str.split(' ');
  var timeStr    = spaceParts[spaceParts.length - 1];
  var parts      = timeStr.split(':');

  if (parts.length >= 2) {
    var h = parseInt(parts[0], 10) || 0;
    var m = parseInt(parts[1], 10) || 0;
    var s = parts.length > 2 ? (parseInt(parts[2], 10) || 0) : 0;
    return auditPad2(h) + ':' + auditPad2(m) + ':' + auditPad2(s);
  }

  return '00:00:00';
}

function auditHmsToSec(hms) {
  if (!hms) return 0;
  var parts = String(hms).trim().split(':');
  if (parts.length >= 2) {
    var h = parseInt(parts[0], 10) || 0;
    var m = parseInt(parts[1], 10) || 0;
    var s = parts.length > 2 ? (parseInt(parts[2], 10) || 0) : 0;
    return (h * 3600) + (m * 60) + s;
  }
  return 0;
}

function auditReconstruirFechaHora(fechaStr, horaStr) {
  if (!fechaStr || !horaStr) return null;
  var fParts = fechaStr.split('/');
  var hParts = horaStr.split(':');
  if (fParts.length !== 3 || hParts.length < 2) return null;

  var d   = parseInt(fParts[0], 10);
  var m   = parseInt(fParts[1], 10) - 1;
  var y   = parseInt(fParts[2], 10);
  var h   = parseInt(hParts[0], 10);
  var min = parseInt(hParts[1], 10);
  var sec = hParts.length > 2 ? parseInt(hParts[2], 10) : 0;

  if (isNaN(d) || isNaN(m) || isNaN(y) || isNaN(h) || isNaN(min)) return null;
  return new Date(y, m, d, h, min, sec);
}
