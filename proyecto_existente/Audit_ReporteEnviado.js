/**
 * ============================================================
 *  SMARTCORP – Sistema de Auditorías de Bitácora
 *  Archivo: Audit_ReporteEnviado.js
 *
 *  Propósito:
 *    Auditar la columna "REPORTE ENV." de la Bitácora para
 *    una fecha seleccionada, comparando contra los registros
 *    de REPORTES_GENERAL y asignando:
 *      • "SI"  → reporte enviado a tiempo
 *      • "FT"  → Fuera de Tiempo (Fecha_Reporte ≠ Fecha_Referencia)
 *      • "NO"  → no se encontró reporte para esa persona/proyecto
 *      • "NA"  → la fila no corresponde a "Proyecto instalación"
 *
 *  Versión : 1.0.0
 *  Fecha   : 19/06/2026
 *
 *  IMPORTANTE: Este archivo no contiene onOpen().
 *  El menú se registra desde CustomMenu.js en el onOpen() existente.
 * ============================================================
 */

// ─────────────────────────────────────────────────────────────
//  IDs DE LAS HOJAS (modificar aquí si cambian)
// ─────────────────────────────────────────────────────────────
var AUDIT_BITACORA_SHEET_ID  = '18GFvQZdpmALvmmTFc70dXENJxImMR3bkHU04IG_UyyY';
var AUDIT_BITACORA_TAB_NAME  = 'Bitácora';
var AUDIT_REPORTES_SHEET_ID  = '14vPIvvrc2Cag61_BCdXJd4Cd-yksfV1RqmzMhKesqao';
var AUDIT_REPORTES_TAB_NAME  = 'REPORTES_GENERAL';

// ─────────────────────────────────────────────────────────────
//  ÍNDICES DE COLUMNAS — BITÁCORA (base 0)
// ─────────────────────────────────────────────────────────────
var AUDIT_COL_BIT_FECHA        = 2;   // "FECHA"
var AUDIT_COL_BIT_PROYECTO     = 3;   // "PROYECTO"
var AUDIT_COL_BIT_NOMBRE       = 4;   // "NOMBRE"
var AUDIT_COL_BIT_REPORTE_ENV  = 10;  // "REPORTE ENV."
var AUDIT_COL_BIT_ASUNTO       = 11;  // "ASUNTO"

// ─────────────────────────────────────────────────────────────
//  ÍNDICES DE COLUMNAS — REPORTES_GENERAL (base 0)
// ─────────────────────────────────────────────────────────────
var AUDIT_COL_REP_FECHA_REPORTE    = 1;   // "Fecha_Reporte"
var AUDIT_COL_REP_NOMBRE_PROYECTO  = 3;   // "NombreProyecto"
var AUDIT_COL_REP_FECHA_REFERENCIA = 4;   // "Fecha_Referencia"
var AUDIT_COL_REP_EQUIPO_MANUAL    = 36;  // "Equipo_Trabajo_Manual"

// Valor de ASUNTO que activa la auditoría de reporte
var AUDIT_ASUNTO_INSTALACION = 'proyecto instalación';

// Versión del módulo de auditorías
var AUDIT_VERSION = '1.0.0 (19/06/2026)';


// ═════════════════════════════════════════════════════════════
//  FUNCIÓN PRINCIPAL: auditarReporteEnviadoPorFecha
// ═════════════════════════════════════════════════════════════

/**
 * Función principal invocada desde el menú 🔍 Auditorías SMARTCORP.
 * Solicita una fecha, cruza datos entre Bitácora y REPORTES_GENERAL,
 * y escribe SI / FT / NO / NA en la columna REPORTE ENV.
 */
function auditarReporteEnviadoPorFecha() {
  var ui = SpreadsheetApp.getUi();

  try {

    // ──────────────────────────────────────────────
    //  PASO 1: Solicitar fecha al usuario
    // ──────────────────────────────────────────────
    Logger.log('=== INICIO: auditarReporteEnviadoPorFecha ===');

    var respuesta = ui.prompt(
      '📅 Seleccionar Fecha de Auditoría',
      'Ingresa la fecha a auditar en formato DD/MM/YYYY:\n\nEjemplo: 15/06/2026',
      ui.ButtonSet.OK_CANCEL
    );

    if (respuesta.getSelectedButton() === ui.Button.CANCEL) {
      Logger.log('Usuario canceló el ingreso de fecha.');
      return;
    }

    var fechaTexto = respuesta.getResponseText().trim();
    Logger.log('Fecha ingresada: ' + fechaTexto);

    // Validar formato DD/MM/YYYY
    var regexFecha = /^(\d{2})\/(\d{2})\/(\d{4})$/;
    if (!regexFecha.test(fechaTexto)) {
      ui.alert('❌ Formato incorrecto',
        'La fecha "' + fechaTexto + '" no tiene el formato DD/MM/YYYY.\n\nIntenta de nuevo.',
        ui.ButtonSet.OK);
      return;
    }

    // Validar que sea una fecha calendario real
    var partes  = fechaTexto.split('/');
    var dia     = parseInt(partes[0], 10);
    var mes     = parseInt(partes[1], 10);
    var anio    = parseInt(partes[2], 10);
    var fechaJS = new Date(anio, mes - 1, dia);

    if (fechaJS.getDate() !== dia || fechaJS.getMonth() !== mes - 1 || fechaJS.getFullYear() !== anio) {
      ui.alert('❌ Fecha inválida',
        '"' + fechaTexto + '" no es una fecha válida.\nVerifica día, mes y año.',
        ui.ButtonSet.OK);
      return;
    }

    Logger.log('Fecha validada: ' + fechaTexto);


    // ──────────────────────────────────────────────
    //  PASO 2: Cargar datos de ambas hojas
    // ──────────────────────────────────────────────

    var ssBitacora = SpreadsheetApp.openById(AUDIT_BITACORA_SHEET_ID);
    var shBitacora = ssBitacora.getSheetByName(AUDIT_BITACORA_TAB_NAME);
    if (!shBitacora) {
      throw new Error('No se encontró la pestaña "' + AUDIT_BITACORA_TAB_NAME + '" en la Bitácora.');
    }

    var ssReportes = SpreadsheetApp.openById(AUDIT_REPORTES_SHEET_ID);
    var shReportes = ssReportes.getSheetByName(AUDIT_REPORTES_TAB_NAME);
    if (!shReportes) {
      throw new Error('No se encontró la pestaña "' + AUDIT_REPORTES_TAB_NAME + '" en REPORTES_GENERAL.');
    }

    var datosBitacora = shBitacora.getDataRange().getValues();
    var datosReportes = shReportes.getDataRange().getValues();

    Logger.log('Filas cargadas — Bitácora: ' + datosBitacora.length + ' | Reportes: ' + datosReportes.length);


    // ──────────────────────────────────────────────
    //  PASO 3: Construir mapa de búsqueda desde
    //          REPORTES_GENERAL filtrando por
    //          Fecha_Referencia == fechaTexto
    // ──────────────────────────────────────────────

    var mapaReportes = {};
    var filasCoincidentes = 0;

    for (var r = 1; r < datosReportes.length; r++) {
      var filaRep       = datosReportes[r];
      var fechaRefStr   = auditFormatDate(filaRep[AUDIT_COL_REP_FECHA_REFERENCIA]);

      if (fechaRefStr !== fechaTexto) continue;
      filasCoincidentes++;

      var nombreProyecto  = String(filaRep[AUDIT_COL_REP_NOMBRE_PROYECTO] || '');
      var fechaRepStr     = auditFormatDate(filaRep[AUDIT_COL_REP_FECHA_REPORTE]);
      var equipoRaw       = String(filaRep[AUDIT_COL_REP_EQUIPO_MANUAL] || '');
      var proyectoNorm    = auditNormalizar(nombreProyecto);

      var personas = equipoRaw.split(',');
      for (var p = 0; p < personas.length; p++) {
        var personaNorm = auditNormalizar(personas[p]);
        if (!personaNorm) continue;

        var clave = proyectoNorm + '|' + personaNorm;
        if (!mapaReportes[clave]) mapaReportes[clave] = [];
        mapaReportes[clave].push({ fechaReporte: fechaRepStr, fechaReferencia: fechaRefStr });
      }
    }

    Logger.log('Reportes con Fecha_Referencia=' + fechaTexto + ': ' + filasCoincidentes);
    Logger.log('Entradas en mapa: ' + Object.keys(mapaReportes).length);


    // ──────────────────────────────────────────────
    //  PASO 4: Iterar Bitácora y clasificar cada fila
    // ──────────────────────────────────────────────

    var contTotal = 0, contSI = 0, contFT = 0, contNO = 0, contNA = 0;
    var cambios = [];

    for (var b = 1; b < datosBitacora.length; b++) {
      var filaBit     = datosBitacora[b];
      var fechaBitStr = auditFormatDate(filaBit[AUDIT_COL_BIT_FECHA]);

      if (fechaBitStr !== fechaTexto) continue;
      contTotal++;

      var asunto   = String(filaBit[AUDIT_COL_BIT_ASUNTO]  || '').trim();
      var proyecto = String(filaBit[AUDIT_COL_BIT_PROYECTO] || '');
      var nombre   = String(filaBit[AUDIT_COL_BIT_NOMBRE]   || '');

      Logger.log('Fila #' + (b + 1) + ' | Proyecto: "' + proyecto + '" | Nombre: "' + nombre + '" | Asunto: "' + asunto + '"');

      var resultado;

      if (asunto.toLowerCase() !== AUDIT_ASUNTO_INSTALACION) {
        // No aplica auditoría de reporte
        resultado = 'NA';
        contNA++;
        Logger.log('  → NA');

      } else {
        // Buscar en el mapa con variantes de nombre
        var claves = auditGenerarClaves(proyecto, nombre);
        var matches = null;

        for (var k = 0; k < claves.length; k++) {
          if (mapaReportes[claves[k]]) {
            matches = mapaReportes[claves[k]];
            break;
          }
        }

        if (!matches) {
          resultado = 'NO';
          contNO++;
          Logger.log('  → NO (sin coincidencia)');
        } else {
          var tieneSI = false;
          for (var c = 0; c < matches.length; c++) {
            if (matches[c].fechaReporte === matches[c].fechaReferencia) {
              tieneSI = true;
              break;
            }
          }
          resultado = tieneSI ? 'SI' : 'FT';
          tieneSI ? contSI++ : contFT++;
          Logger.log('  → ' + resultado);
        }
      }

      cambios.push({ filaIndex: b, valor: resultado });
    }


    // ──────────────────────────────────────────────
    //  PASO 5: Escribir cambios y mostrar resumen
    // ──────────────────────────────────────────────

    if (cambios.length === 0) {
      ui.alert('⚠️ Sin resultados',
        'No se encontraron filas en Bitácora con la fecha ' + fechaTexto + '.\n\nVerifica que la fecha exista en la columna FECHA.',
        ui.ButtonSet.OK);
      return;
    }

    var colSheets = AUDIT_COL_BIT_REPORTE_ENV + 1; // base-1 para getRange
    for (var i = 0; i < cambios.length; i++) {
      shBitacora.getRange(cambios[i].filaIndex + 1, colSheets).setValue(cambios[i].valor);
    }

    Logger.log('Cambios escritos: ' + cambios.length);

    var resumen =
      '✅ Auditoría completada — ' + fechaTexto + '\n\n' +
      '─────────────────────────────\n' +
      'Total de filas procesadas : ' + contTotal + '\n' +
      '✅ SI  (a tiempo)         : ' + contSI    + '\n' +
      '⏰ FT  (fuera de tiempo)  : ' + contFT    + '\n' +
      '❌ NO  (no encontrado)    : ' + contNO    + '\n' +
      '➖ NA  (no aplica)        : ' + contNA    + '\n' +
      '─────────────────────────────\n' +
      'Valores escritos en columna\n"REPORTE ENV." de la Bitácora.';

    ui.alert('🔍 Resumen – Auditorías SMARTCORP', resumen, ui.ButtonSet.OK);

  } catch (e) {
    Logger.log('ERROR: ' + e.message + '\n' + e.stack);
    ui.alert('❌ Error inesperado',
      e.message + '\n\nRevisa Registros de ejecución para más detalles.',
      ui.ButtonSet.OK);
  }
}


// ═════════════════════════════════════════════════════════════
//  DIÁLOGO: Acerca del sistema de auditorías
// ═════════════════════════════════════════════════════════════

/**
 * Muestra información sobre la versión del módulo de auditorías.
 * Nombre único para evitar conflicto con cualquier función existente.
 */
function mostrarAcercaDeAuditorias() {
  var ui = SpreadsheetApp.getUi();
  ui.alert(
    'ℹ️ Auditorías SMARTCORP',
    '📌 MÓDULO DE AUDITORÍAS\n' +
    '─────────────────────────\n' +
    'Versión : ' + AUDIT_VERSION + '\n\n' +
    'Bitácora ID:\n  ' + AUDIT_BITACORA_SHEET_ID + '\n\n' +
    'Reportes ID:\n  ' + AUDIT_REPORTES_SHEET_ID + '\n\n' +
    'Este módulo no modifica código existente.\n' +
    'Solo agrega funcionalidad de auditoría.',
    ui.ButtonSet.OK
  );
}


// ═════════════════════════════════════════════════════════════
//  FUNCIONES AUXILIARES (prefijo "audit" para evitar conflictos)
// ═════════════════════════════════════════════════════════════

/**
 * Convierte un valor de celda Sheets a string "DD/MM/YYYY".
 * Maneja Date objects y strings con formato variable.
 */
function auditFormatDate(valor) {
  if (!valor && valor !== 0) return '';

  if (valor instanceof Date) {
    if (isNaN(valor.getTime())) return '';
    return auditPad2(valor.getDate()) + '/' +
           auditPad2(valor.getMonth() + 1) + '/' +
           valor.getFullYear();
  }

  var str = String(valor).trim();

  // Ya está en formato DD/MM/YYYY
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(str)) return str;

  // Formato con dígitos variables (ej. 5/6/2026)
  var partes = str.split('/');
  if (partes.length === 3 && partes[2].length === 4) {
    return auditPad2(parseInt(partes[0], 10)) + '/' +
           auditPad2(parseInt(partes[1], 10)) + '/' + partes[2];
  }

  // Intentar parsear como fecha genérica
  var fecha = new Date(str);
  if (!isNaN(fecha.getTime())) {
    return auditPad2(fecha.getDate()) + '/' +
           auditPad2(fecha.getMonth() + 1) + '/' +
           fecha.getFullYear();
  }

  Logger.log('auditFormatDate: no se pudo convertir "' + str + '"');
  return str;
}

/** Agrega cero a la izquierda si el número tiene un dígito. */
function auditPad2(n) {
  return n < 10 ? '0' + n : String(n);
}

/**
 * Normaliza texto: minúsculas, sin espacios extra al inicio/final,
 * espacios internos colapsados a uno solo.
 */
function auditNormalizar(texto) {
  if (!texto && texto !== 0) return '';
  return String(texto).toLowerCase().trim().replace(/\s+/g, ' ');
}

/**
 * Genera variantes de clave para mayor tolerancia en nombres.
 * Ej: nombre completo, solo primer nombre, nombre + primer apellido.
 */
function auditGenerarClaves(proyecto, nombre) {
  var pNorm  = auditNormalizar(proyecto);
  var nNorm  = auditNormalizar(nombre);
  var claves = [pNorm + '|' + nNorm];

  var partes = nNorm.split(' ');
  if (partes.length > 1) claves.push(pNorm + '|' + partes[0]);
  if (partes.length >= 3) claves.push(pNorm + '|' + partes[0] + ' ' + partes[1]);

  return claves;
}
