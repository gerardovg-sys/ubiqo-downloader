/**
 * ============================================================
 *  SMARTCORP – Sistema de Auditorías de Bitácora
 *  Archivo: Menu_Auditorias.gs
 *
 *  Propósito:
 *    • Crear el menú personalizado "🔍 Auditorías SMARTCORP"
 *      cada vez que se abra la hoja de cálculo.
 *    • Proveer la función informativa "Acerca del sistema".
 *
 *  Versión : 1.0.0
 *  Fecha   : 2026-06-19
 *  Proyecto: BITACORA_SMARTCORP
 * ============================================================
 */

// ─────────────────────────────────────────────────────────────
//  CONSTANTES GLOBALES DEL PROYECTO
//  (compartidas con Audit_ReporteEnviado.gs dentro del mismo
//   proyecto de Apps Script)
// ─────────────────────────────────────────────────────────────

/** ID del Google Sheet de la Bitácora */
var BITACORA_SHEET_ID = '18GFvQZdpmALvmmTFc70dXENJxImMR3bkHU04IG_UyyY';

/** Nombre de la pestaña dentro de la Bitácora */
var BITACORA_TAB_NAME = 'Bitácora';

/** ID del Google Sheet de Reportes General */
var REPORTES_SHEET_ID = '14vPIvvrc2Cag61_BCdXJd4Cd-yksfV1RqmzMhKesqao';

/** Nombre de la pestaña dentro de Reportes General */
var REPORTES_TAB_NAME = 'REPORTES_GENERAL';

/** Información de versión del sistema */
var VERSION_INFO = {
  version   : '1.0.0',
  fecha     : '19/06/2026',
  scriptId  : '(nuevo proyecto independiente)',
  autor     : 'SMARTCORP – Equipo de Automatización',
  descripcion: 'Sistema de auditoría automática de reportes enviados\nen Bitácora SMARTCORP.'
};


// ─────────────────────────────────────────────────────────────
//  TRIGGER: onOpen
//  Se ejecuta automáticamente al abrir la hoja de cálculo.
//  Agrega el menú personalizado de auditorías.
// ─────────────────────────────────────────────────────────────

/**
 * Crea el menú "🔍 Auditorías SMARTCORP" en la barra de menús
 * de Google Sheets cada vez que se abre el archivo.
 *
 * Para instalar este trigger:
 *   Apps Script > Activadores > Agregar activador
 *   Función: onOpen  |  Evento: Al abrir
 */
function onOpen() {
  try {
    var ui = SpreadsheetApp.getUi();

    ui.createMenu('🔍 Auditorías SMARTCORP')
      .addItem('📋 Llenar Reporte Enviado por Fecha', 'auditarReporteEnviadoPorFecha')
      .addSeparator()
      .addItem('ℹ️ Acerca del sistema', 'mostrarAcercaDe')
      .addToUi();

    Logger.log('Menú "Auditorías SMARTCORP" creado correctamente.');

  } catch (e) {
    // En contextos sin UI (ejecución por API) se registra pero no falla.
    Logger.log('Error al crear el menú: ' + e.message);
  }
}


// ─────────────────────────────────────────────────────────────
//  FUNCIÓN: mostrarAcercaDe
//  Muestra un cuadro de información sobre el sistema.
// ─────────────────────────────────────────────────────────────

/**
 * Despliega un cuadro de diálogo con la información de versión
 * y descripción del sistema de auditorías.
 */
function mostrarAcercaDe() {
  var ui = SpreadsheetApp.getUi();

  var mensaje =
    '📌 SISTEMA DE AUDITORÍAS SMARTCORP\n' +
    '─────────────────────────────────────\n' +
    'Versión     : ' + VERSION_INFO.version     + '\n' +
    'Fecha       : ' + VERSION_INFO.fecha       + '\n' +
    'Autor       : ' + VERSION_INFO.autor       + '\n' +
    '\n' +
    VERSION_INFO.descripcion + '\n' +
    '\n' +
    '📂 Bitácora ID:\n  ' + BITACORA_SHEET_ID  + '\n' +
    '📂 Reportes ID:\n  ' + REPORTES_SHEET_ID  + '\n' +
    '\n' +
    '⚙️ Script ID: ' + VERSION_INFO.scriptId;

  ui.alert(
    'ℹ️ Acerca del Sistema de Auditorías',
    mensaje,
    ui.ButtonSet.OK
  );

  Logger.log('Dialog "Acerca de" mostrado al usuario.');
}
