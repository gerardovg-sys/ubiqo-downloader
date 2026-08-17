/**
 * ============================================================
 *  SMARTCORP — Módulo de Diagnóstico Detallado GPS
 *  Archivo: Audit_GPS_Diagnostico.js
 *
 *  Propósito:
 *    Generar una radiografía limpia e instantánea (< 1 seg)
 *    de los tramos de Historial_GPS enriquecidos con la geocerca
 *    detectada (Inicio y Fin), priorizando en memoria los proyectos
 *    que la Bitácora reporta para ese día y esa unidad.
 *
 *  Versión : 3.3.0 (Fast Native Date Parsing & Precise Match)
 *  Fecha   : 04/08/2026
 * ============================================================
 */

/**
 * Normaliza cualquier fecha (Date object o String) a "DD/MM/YYYY" a velocidad V8 nativa.
 */
function auditFastNormalizarFechaKey(d) {
  if (!d) return '';
  if (d instanceof Date) {
    if (isNaN(d.getTime())) return '';
    var day   = d.getDate();
    var month = d.getMonth() + 1;
    var year  = d.getFullYear();
    return (day < 10 ? '0' + day : day) + '/' + (month < 10 ? '0' + month : month) + '/' + year;
  }
  return auditNormalizarFechaKey(d);
}

function ejecutarDiagnosticoDetalladoGPS(isSilent) {
  var ui = null;
  try { ui = SpreadsheetApp.getUi(); } catch (e) {}
  
  var ssActive = SpreadsheetApp.getActiveSpreadsheet();
  if (ssActive && !isSilent) ssActive.toast('🔬 Generando Radiografía Diagnóstico GPS...', 'Auditorías SMARTCORP', 10);
  
  try {
    var startTime = new Date().getTime();
    Logger.log('=== [DIAGNÓSTICO LOG 1] INICIO: ejecutarDiagnosticoDetalladoGPS (Fast Native Match) ===');
    
    var ssConfig          = auditObtenerSpreadsheetConfiguracion();
    var geocercas         = auditObtenerGeocercas(ssConfig);         // Geocercas de Proyectos_GPS
    var mapaEquivalencias = auditObtenerMapaEquivalencias(ssConfig); // Relación de unidades

    // ── LEER TRAMOS PENDIENTES DESDE Historial_GPS ──
    var histRes             = auditLeerHistorialPendiente(ssConfig);
    var routesByUnitAndDate = histRes.byUnitAndDate;
    var datesToProcess      = histRes.datesToProcess;

    if (!datesToProcess || datesToProcess.length === 0) {
      var shH = ssConfig.getSheetByName('Historial_GPS');
      var totalFilasH = shH ? shH.getLastRow() : 0;
      if (ui && !isSilent) {
        ui.alert(
          'ℹ️ Sin Datos Pendientes',
          'No se encontraron tramos con Estado="Pendiente" en Historial_GPS.\n\n' +
          'Detalles:\n' +
          '  • Libro Configuración: ' + ssConfig.getName() + '\n' +
          '  • Pestaña Historial_GPS: ' + (shH ? 'Existe (' + totalFilasH + ' filas)' : 'No existe') + '\n\n' +
          'Por favor carga un archivo GPS primero.',
          ui.ButtonSet.OK
        );
      }
      return;
    }

    var shDiag = ssConfig.getSheetByName('Diagnostico_GPS');
    if (shDiag) {
      shDiag.clear();
    } else {
      shDiag = ssConfig.insertSheet('Diagnostico_GPS');
    }
    
    // Encabezados súper limpios (12 columnas)
    var HEADERS_DIAG = [
      'Unidad', 'Fecha', 'Tramo_ID', 'Hora_Inicio', 'Lat_Lon_Inicio', 'Geocerca_Inicio',
      'Hora_Fin', 'Lat_Lon_Fin', 'Geocerca_Fin', 'Distancia_KM', 'Duracion', 'Proyecto_Bitacora'
    ];
    shDiag.appendRow(HEADERS_DIAG);
    shDiag.getRange(1, 1, 1, HEADERS_DIAG.length).setFontWeight('bold').setBackground('#d9ead3');
    
    // ── CARGAR BITÁCORA Y CREAR MEMORIA FLOTANTE POR DÍA (Ultra-rápido: < 0.1s) ──
    var ssBitacora = SpreadsheetApp.openById(AUDIT_BITACORA_SHEET_ID);
    var shBitacoraOriginal = ssBitacora.getSheetByName(AUDIT_BITACORA_TAB_NAME);
    var bitacoraPorFecha = {}; // { "30/07/2026": [ { unidadNorm, unidadRaw, proyecto, proyectoNorm } ] }

    if (shBitacoraOriginal) {
      var datosBitacora = shBitacoraOriginal.getDataRange().getValues();
      Logger.log('=== [DIAGNÓSTICO LOG 2] Datos de Bitácora leídos (' + datosBitacora.length + ' filas). Escaneando fechas...');
      
      var mBit = auditObtenerMapaIndicesBitacora(datosBitacora[0]);

      for (var b = 1; b < datosBitacora.length; b++) {
        var row       = datosBitacora[b];
        var fFechaRaw = (mBit.FECHA !== undefined) ? row[mBit.FECHA] : null;
        if (!fFechaRaw) continue;

        var fFecha = auditFastNormalizarFechaKey(fFechaRaw);
        if (!fFecha || datesToProcess.indexOf(fFecha) === -1) continue;

        var fUnidad   = (mBit.UNIDAD !== undefined) ? String(row[mBit.UNIDAD] || '').trim() : '';
        var fProyecto = (mBit.PROYECTO !== undefined) ? String(row[mBit.PROYECTO] || '').trim() : '';
        var fNombre   = (mBit.NOMBRE !== undefined) ? String(row[mBit.NOMBRE] || '').trim() : '';
        var normU     = auditNormalizar(fUnidad);
        var normP     = auditNormalizar(fProyecto);
        var normN     = auditNormalizar(fNombre);

        if (!bitacoraPorFecha[fFecha]) bitacoraPorFecha[fFecha] = [];
        bitacoraPorFecha[fFecha].push({
          unidadNorm:   normU,
          unidadRaw:    fUnidad,
          nombreNorm:   normN,
          nombreRaw:    fNombre,
          proyecto:     fProyecto,
          proyectoNorm: normP
        });
      }
    }
    Logger.log('=== [DIAGNÓSTICO LOG 3] Memoria flotante por día construida exitosamente.');

    var totalSegmentosLogs = [];

    // Recorrer fechas a procesar usando la memoria flotante del día
    for (var d = 0; d < datesToProcess.length; d++) {
      var dateStr     = datesToProcess[d];
      var unitsInDate = routesByUnitAndDate[dateStr] || {};
      
      // Memoria flotante del día en cuestión (filtrado ultrarrápido)
      var filasBitacoraDelDia = bitacoraPorFecha[dateStr] || [];
      Logger.log('=== [DIAGNÓSTICO LOG 4] Fecha ' + dateStr + ': ' + filasBitacoraDelDia.length + ' filas en Bitácora para este día.');

      for (var uNorm in unitsInDate) {
        var dayRoutes = unitsInDate[uNorm];
        if (!dayRoutes || dayRoutes.length === 0) continue;

        var unidadOriginal = dayRoutes[0].unit_id;
        var unidadBitacora = auditBuscarEquivalenciaUnidad(unidadOriginal, mapaEquivalencias);
        var normBitUnit    = auditNormalizar(unidadBitacora);

        // Extraer proyectos preferidos registrados en Bitácora para esta unidad en este día
        var preferredProjs   = [];
        var proyectosTextArr = [];

        for (var k = 0; k < filasBitacoraDelDia.length; k++) {
          var fBit = filasBitacoraDelDia[k];
          // Coincidencia flexible por Unidad O por Nombre del Técnico
          var matchUnidad = (
            (fBit.unidadNorm && (fBit.unidadNorm === uNorm || fBit.unidadNorm === normBitUnit || fBit.unidadNorm.indexOf(normBitUnit) !== -1 || normBitUnit.indexOf(fBit.unidadNorm) !== -1)) ||
            (fBit.nombreNorm && (fBit.nombreNorm === uNorm || fBit.nombreNorm === normBitUnit || fBit.nombreNorm.indexOf(normBitUnit) !== -1 || normBitUnit.indexOf(fBit.nombreNorm) !== -1)) ||
            (!fBit.unidadNorm && fBit.proyectoNorm)
          );

          if (matchUnidad) {
            if (fBit.proyectoNorm && preferredProjs.indexOf(fBit.proyectoNorm) === -1) {
              preferredProjs.push(fBit.proyectoNorm);
              proyectosTextArr.push(fBit.proyecto);
            }
          }
        }

        var proyectoBitacoraText = proyectosTextArr.length > 0 ? proyectosTextArr.join(' | ') : 'Sin registro en Bitácora';

        for (var r = 0; r < dayRoutes.length; r++) {
          var rt = dayRoutes[r];
          var latLonIni = rt.start_lat && rt.start_lon ? rt.start_lat.toFixed(6) + ", " + rt.start_lon.toFixed(6) : "N/A";
          var latLonFin = rt.end_lat && rt.end_lon ? rt.end_lat.toFixed(6) + ", " + rt.end_lon.toFixed(6) : "N/A";
          
          // Detectar geocercas con el algoritmo del SOP PRIORIZANDO los proyectos de la Bitácora
          var startGeoId = auditObtenerGeocercaDetectada(rt.start_lat, rt.start_lon, geocercas, preferredProjs);
          var destGeoId  = auditObtenerGeocercaDetectada(rt.end_lat, rt.end_lon, geocercas, preferredProjs);
          
          var locInicio = startGeoId || "Desconocido";
          var locFin    = destGeoId  || "Desconocido";

          // Duración limpia "HH:MM:SS"
          var durTexto = String(rt.duration_raw || rt.duration_hms || '').trim();
          if (!durTexto || durTexto === '00:00:00' || durTexto.indexOf('GMT') !== -1 || durTexto.indexOf('1899') !== -1) {
            durTexto = formatSecToHMS(rt.duration_sec);
          }
          
          totalSegmentosLogs.push([
            unidadOriginal,
            dateStr,
            r + 1,
            formatTimeOnly(rt.start_time),
            latLonIni,
            locInicio,
            formatTimeOnly(rt.end_time),
            latLonFin,
            locFin,
            rt.distance_km,
            durTexto,
            proyectoBitacoraText
          ]);
        }
      }
    }
    
    if (totalSegmentosLogs.length > 0) {
      // Escribir en bloque como texto estricto
      var range = shDiag.getRange(2, 1, totalSegmentosLogs.length, HEADERS_DIAG.length);
      range.setNumberFormat('@'); // Formato de texto puro
      range.setValues(totalSegmentosLogs);
      range.setHorizontalAlignment('left');
    }
    
    var elapsedSec = ((new Date().getTime() - startTime) / 1000).toFixed(1);
    if (ui && !isSilent) {
      ui.alert("🔬 Radiografía Diagnóstico GPS Completada (" + elapsedSec + "s)", 
               "Se procesaron " + datesToProcess.length + " fecha(s) usando memoria flotante por día en " + elapsedSec + " segundos.\n\n" +
               "Se escribieron " + totalSegmentosLogs.length + " tramos con geocercas priorizadas por Bitácora en la pestaña 'Diagnostico_GPS'.", 
               ui.ButtonSet.OK);
    }
             
  } catch (e) {
    Logger.log('❌ Error en ejecutarDiagnosticoDetalladoGPS: ' + e.message + '\n' + e.stack);
    if (ui && !isSilent) ui.alert('❌ Error de Diagnóstico', e.message, ui.ButtonSet.OK);
  }
}
