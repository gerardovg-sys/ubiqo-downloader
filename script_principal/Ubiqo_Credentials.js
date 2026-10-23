function handleUbiqoGet(e) {
  if (!e || e.parameter.token !== "SMARTCORP_UBIQO_SECURE_TOKEN_2026") {
    return ContentService.createTextOutput("Unauthorized").setMimeType(ContentService.MimeType.TEXT);
  }

  // ── Candado Pre-Descarga: Consulta de estado de fecha para evitar descargas duplicadas ──
  if (e.parameter.action === "check_candado" || e.parameter.action === "check_status") {
    var fechaQuery = e.parameter.fecha || e.parameter.date || "";
    var resCandado = auditVerificarCandadoFecha(fechaQuery);
    return ContentService.createTextOutput(JSON.stringify(resCandado)).setMimeType(ContentService.MimeType.JSON);
  }

  // ── Lectura de Log_Mejora_Continua para análisis estadístico ──
  if (e.parameter.action === "get_log_mejora") {
    var ssConfigLog = (typeof auditObtenerSpreadsheetConfiguracion === 'function') ? auditObtenerSpreadsheetConfiguracion() : null;
    var shLog = ssConfigLog ? ssConfigLog.getSheetByName("Log_Mejora_Continua") : null;
    var logRows = (shLog && shLog.getLastRow() > 0) ? shLog.getDataRange().getDisplayValues() : [];
    return ContentService.createTextOutput(JSON.stringify({ status: "ok", rows: logRows })).setMimeType(ContentService.MimeType.JSON);
  }
  
  try {
    var sheets = SpreadsheetApp.getActiveSpreadsheet().getSheets();
    var targetSheet = null;
    for (var i = 0; i < sheets.length; i++) {
      var name = sheets[i].getName().toLowerCase();
      if (name.indexOf("ubiqo") !== -1 || name.indexOf("cred") !== -1 || name.indexOf("config") !== -1) {
        targetSheet = sheets[i];
        break;
      }
    }
    if (!targetSheet) {
      return ContentService.createTextOutput(JSON.stringify({ error: "No credentials sheet found" })).setMimeType(ContentService.MimeType.JSON);
    }
    
    var values = targetSheet.getDataRange().getValues();
    var user = "";
    var pass = "";
    for (var i = 0; i < values.length; i++) {
      for (var j = 0; j < values[i].length; j++) {
        var val = String(values[i][j] || '').trim();
        var valLower = val.toLowerCase();
        if (valLower === "usuario" || valLower === "user" || valLower === "username") {
          user = String(values[i][j+1] || '').trim();
        } else if (valLower === "contraseña" || valLower === "password" || valLower === "pass") {
          pass = String(values[i][j+1] || '').trim();
        }
      }
    }
    return ContentService.createTextOutput(JSON.stringify({ user: user, pass: pass })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ error: err.message })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  try {
    var token = e.parameter.token;
    if (token !== "SMARTCORP_UBIQO_SECURE_TOKEN_2026") {
      return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "Unauthorized" })).setMimeType(ContentService.MimeType.JSON);
    }
    
    var postData = JSON.parse(e.postData.contents);
    var filename = postData.filename;
    var base64 = postData.base64;
    
    if (!filename || !base64) {
      return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "Missing filename or base64 data" })).setMimeType(ContentService.MimeType.JSON);
    }
    
    var result = auditGuardarArchivoGPS(filename, base64);
    return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: err.message })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * 🔒 CANDADO DE SEGURIDAD PRE-DESCARGA
 * Verifica si una fecha ya fue procesada o descargada para evitar descargas redundantes,
 * duplicación de datos o sobrescritura involuntaria de Bitácora.
 *
 * @param {string} fechaParam - Fecha a verificar en formato DD/MM/YYYY o DD-MM-YYYY.
 * @returns {Object} { candado_activo: boolean, motivo: string, tipo: string }
 */
function auditVerificarCandadoFecha(fechaParam) {
  if (!fechaParam) {
    return { candado_activo: false, motivo: "No se proporcionó fecha para validar." };
  }

  try {
    // Normalizar fecha a formatos slash (DD/MM/YYYY) y dash (DD-MM-YYYY)
    var cleanFecha = String(fechaParam).trim().replace(/-/g, '/');
    var parts = cleanFecha.split('/');
    var slashDate = cleanFecha;
    var dashDate  = cleanFecha.replace(/\//g, '-');
    if (parts.length === 3) {
      var d = ('0' + parseInt(parts[0], 10)).slice(-2);
      var m = ('0' + parseInt(parts[1], 10)).slice(-2);
      var y = parts[2];
      slashDate = d + '/' + m + '/' + y;
      dashDate  = d + '-' + m + '-' + y;
    }

    // NOTA IMPORTANTE: NO validar por nombre de archivo en Drive (GPS_Procesados / GPS_Pendientes)
    // porque las subidas manuales guardaban la fecha de subida (HOY) en el nombre del archivo en vez de
    // la fecha real de las rutas GPS (AYER), provocando falsos bloqueos al día siguiente.
    // La validación se hace exclusivamente contra la fecha real de datos en Bitácora Real e Historial_GPS.

    // ── 2. CANDADO: BITÁCORA REAL (Solo últimas 300 filas para velocidad instantánea) ──
    try {
      var ssBitacora = SpreadsheetApp.openById(AUDIT_BITACORA_SHEET_ID);
      var shBitacora = ssBitacora.getSheetByName(AUDIT_BITACORA_TAB_NAME);
      if (shBitacora) {
        var bitLastRow = shBitacora.getLastRow();
        var bitLastCol = shBitacora.getLastColumn();
        if (bitLastRow > 1) {
          var bHeaders = shBitacora.getRange(1, 1, 1, bitLastCol).getValues()[0];
          var bMap = (typeof auditObtenerMapaIndicesBitacora === 'function') 
            ? auditObtenerMapaIndicesBitacora(bHeaders) 
            : {};
          var bColFecha = (bMap.FECHA !== undefined) ? bMap.FECHA : 2;
          var bColKM    = (bMap.KM !== undefined) ? bMap.KM : 22;
          var bColSal   = (bMap.SALIDA !== undefined) ? bMap.SALIDA : 15;

          var startBitRow = Math.max(2, bitLastRow - 300);
          var bitData = shBitacora.getRange(startBitRow, 1, bitLastRow - startBitRow + 1, bitLastCol).getValues();

          for (var r = bitData.length - 1; r >= 0; r--) {
            var rFecha = (typeof auditFastNormalizarFechaKey === 'function')
              ? auditFastNormalizarFechaKey(bitData[r][bColFecha])
              : String(bitData[r][bColFecha] || '').trim();
            if (rFecha === slashDate) {
              var kmVal = parseFloat(bitData[r][bColKM]);
              var salVal = String(bitData[r][bColSal] || '').trim();
              if ((!isNaN(kmVal) && kmVal > 0) || salVal !== '') {
                Logger.log('[CANDADO] 🔒 La fecha ' + slashDate + ' ya tiene datos en Bitácora Real.');
                return {
                  candado_activo: true,
                  motivo: "La fecha " + slashDate + " ya está procesada con métricas GPS en Bitácora Real.",
                  tipo: "bitacora_real"
                };
              }
            }
          }
        }
      }
    } catch (bitErr) {
      Logger.log('[CANDADO AVISO] Error revisando Bitácora Real: ' + bitErr.message);
    }

    // ── 3. CANDADO: HISTORIAL_GPS (Últimas 400 filas) ──
    try {
      var ssConfig = (typeof auditObtenerSpreadsheetConfiguracion === 'function')
        ? auditObtenerSpreadsheetConfiguracion()
        : null;
      if (ssConfig) {
        var shHist = ssConfig.getSheetByName('Historial_GPS');
        if (shHist) {
          var hLastRow = shHist.getLastRow();
          var hLastCol = shHist.getLastColumn();
          if (hLastRow > 1) {
            var hHeaders = shHist.getRange(1, 1, 1, hLastCol).getValues()[0];
            var hColFecha = 1, hColEstado = 12;
            for (var c = 0; c < hHeaders.length; c++) {
              var hName = String(hHeaders[c] || '').trim().toLowerCase();
              if (hName === 'fecha') hColFecha = c;
              if (hName === 'estado') hColEstado = c;
            }

            var startHistRow = Math.max(2, hLastRow - 600);
            var hData = shHist.getRange(startHistRow, 1, hLastRow - startHistRow + 1, hLastCol).getValues();

            for (var hr = hData.length - 1; hr >= 0; hr--) {
              var hFecha = (typeof auditFormatDate === 'function')
                ? auditFormatDate(hData[hr][hColFecha])
                : String(hData[hr][hColFecha] || '').trim();
              var hEst = String(hData[hr][hColEstado] || '').trim().toLowerCase();
              if (hFecha === slashDate && (hEst === 'procesado' || hEst === 'pendiente')) {
                Logger.log('[CANDADO] 🔒 La fecha ' + slashDate + ' ya existe en Historial_GPS (' + hEst + ').');
                return {
                  candado_activo: true,
                  motivo: "La fecha " + slashDate + " ya fue registrada previamente en Historial_GPS (" + hEst + ").",
                  tipo: "historial_procesado"
                };
              }
            }
          }
        }
      }
    } catch (histErr) {
      Logger.log('[CANDADO AVISO] Error revisando Historial_GPS: ' + histErr.message);
    }

    return { candado_activo: false, motivo: "Fecha no procesada aún. Se permite descarga." };

  } catch (err) {
    Logger.log('[CANDADO ERROR]: ' + err.message);
    return { candado_activo: false, error: err.message };
  }
}

