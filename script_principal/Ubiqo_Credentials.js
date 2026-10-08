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

    // ── 1. CANDADO: BITÁCORA REAL ──
    try {
      var ssBitacora = SpreadsheetApp.openById(AUDIT_BITACORA_SHEET_ID);
      var shBitacora = ssBitacora.getSheetByName(AUDIT_BITACORA_TAB_NAME);
      if (shBitacora && shBitacora.getLastRow() > 1) {
        var bitData = shBitacora.getDataRange().getValues();
        var bHeaders = bitData[0];
        var bMap = (typeof auditObtenerMapaIndicesBitacora === 'function') 
          ? auditObtenerMapaIndicesBitacora(bHeaders) 
          : {};
        var bColFecha = (bMap.FECHA !== undefined) ? bMap.FECHA : 2;
        var bColKM    = (bMap.KM !== undefined) ? bMap.KM : 22;
        var bColSal   = (bMap.HORA_SALIDA !== undefined) ? bMap.HORA_SALIDA : 15;

        for (var r = 1; r < bitData.length; r++) {
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
    } catch (bitErr) {
      Logger.log('[CANDADO AVISO] Error revisando Bitácora Real: ' + bitErr.message);
    }

    // ── 2. CANDADO: HISTORIAL_GPS (Estado = "Procesado") ──
    try {
      var ssConfig = (typeof auditObtenerSpreadsheetConfiguracion === 'function')
        ? auditObtenerSpreadsheetConfiguracion()
        : null;
      if (ssConfig) {
        var shHist = ssConfig.getSheetByName('Historial_GPS');
        if (shHist && shHist.getLastRow() > 1) {
          var hData = shHist.getDataRange().getValues();
          var hHeaders = hData[0];
          var hColFecha = 1, hColEstado = 12;
          for (var c = 0; c < hHeaders.length; c++) {
            var hName = String(hHeaders[c] || '').trim().toLowerCase();
            if (hName === 'fecha') hColFecha = c;
            if (hName === 'estado') hColEstado = c;
          }

          for (var hr = 1; hr < hData.length; hr++) {
            var hFecha = (typeof auditFormatDate === 'function')
              ? auditFormatDate(hData[hr][hColFecha])
              : String(hData[hr][hColFecha] || '').trim();
            var hEst = String(hData[hr][hColEstado] || '').trim().toLowerCase();
            if (hFecha === slashDate && hEst === 'procesado') {
              Logger.log('[CANDADO] 🔒 La fecha ' + slashDate + ' ya está marcada como Procesado en Historial_GPS.');
              return {
                candado_activo: true,
                motivo: "La fecha " + slashDate + " ya fue procesada previamente en Historial_GPS.",
                tipo: "historial_procesado"
              };
            }
          }
        }
      }
    } catch (histErr) {
      Logger.log('[CANDADO AVISO] Error revisando Historial_GPS: ' + histErr.message);
    }

    // ── 3. CANDADO: ARCHIVOS EXISTENTES EN DRIVE ──
    try {
      var folderProcesados = DriveApp.getFolderById(AUDIT_GPS_PROCESADOS_FOLDER_ID);
      if (folderProcesados) {
        var filesProc = folderProcesados.getFiles();
        while (filesProc.hasNext()) {
          var fName = filesProc.next().getName();
          if (fName.indexOf(dashDate) !== -1 || fName.indexOf(slashDate) !== -1) {
            Logger.log('[CANDADO] 🔒 Archivo de la fecha ' + dashDate + ' ya existe en GPS_Procesados.');
            return {
              candado_activo: true,
              motivo: "El reporte (" + dashDate + ") ya existe en la carpeta GPS_Procesados.",
              tipo: "archivo_procesado"
            };
          }
        }
      }

      var folderPend = DriveApp.getFolderById(AUDIT_GPS_PENDIENTES_FOLDER_ID);
      if (folderPend) {
        var filesPend = folderPend.getFiles();
        while (filesPend.hasNext()) {
          var pName = filesPend.next().getName();
          if (pName.indexOf(dashDate) !== -1 || pName.indexOf(slashDate) !== -1) {
            Logger.log('[CANDADO] 🔒 Archivo de la fecha ' + dashDate + ' ya está en GPS_Pendientes.');
            return {
              candado_activo: true,
              motivo: "El reporte (" + dashDate + ") ya se encuentra en GPS_Pendientes esperando procesamiento.",
              tipo: "archivo_pendiente"
            };
          }
        }
      }
    } catch (driveErr) {
      Logger.log('[CANDADO AVISO] Error revisando carpetas Drive: ' + driveErr.message);
    }

    return { candado_activo: false, motivo: "Fecha no procesada aún. Se permite descarga." };

  } catch (err) {
    Logger.log('[CANDADO ERROR]: ' + err.message);
    return { candado_activo: false, error: err.message };
  }
}

