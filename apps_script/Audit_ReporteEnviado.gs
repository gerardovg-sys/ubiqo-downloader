/**
 * ============================================================
 *  SMARTCORP – Sistema de Auditorías de Bitácora
 *  Archivo: Audit_ReporteEnviado.gs
 *
 *  Propósito:
 *    Auditar la columna "REPORTE ENV." de la Bitácora para
 *    una fecha seleccionada, comparando contra los registros
 *    de REPORTES_GENERAL y asignando:
 *      • "SI"  → reporte enviado a tiempo
 *      • "FT"  → Fuera de Tiempo (fecha reporte ≠ fecha ref.)
 *      • "NO"  → no se encontró reporte para esa persona/proyecto
 *      • "NA"  → la fila no corresponde a "Proyecto instalación"
 *
 *  Versión : 1.0.0
 *  Fecha   : 2026-06-19
 *  Proyecto: BITACORA_SMARTCORP
 *
 *  Dependencias globales (definidas en Menu_Auditorias.gs):
 *    BITACORA_SHEET_ID, BITACORA_TAB_NAME,
 *    REPORTES_SHEET_ID, REPORTES_TAB_NAME
 * ============================================================
 */

// ─────────────────────────────────────────────────────────────
//  ÍNDICES DE COLUMNAS — BITÁCORA (base 0)
// ─────────────────────────────────────────────────────────────
var COL_BIT_FECHA       = 2;   // "FECHA"
var COL_BIT_PROYECTO    = 3;   // "PROYECTO"
var COL_BIT_NOMBRE      = 4;   // "NOMBRE"
var COL_BIT_REPORTE_ENV = 10;  // "REPORTE ENV."
var COL_BIT_ASUNTO      = 11;  // "ASUNTO"

// ─────────────────────────────────────────────────────────────
//  ÍNDICES DE COLUMNAS — REPORTES_GENERAL (base 0)
// ─────────────────────────────────────────────────────────────
var COL_REP_FECHA_REPORTE    = 1;   // "Fecha_Reporte"
var COL_REP_NOMBRE_PROYECTO  = 3;   // "NombreProyecto"
var COL_REP_FECHA_REFERENCIA = 4;   // "Fecha_Referencia"
var COL_REP_EQUIPO_MANUAL    = 36;  // "Equipo_Trabajo_Manual"

// ─────────────────────────────────────────────────────────────
//  CONSTANTE: valor de ASUNTO que activa la auditoría de reporte
// ─────────────────────────────────────────────────────────────
var ASUNTO_INSTALACION = 'proyecto instalación';


// ═════════════════════════════════════════════════════════════
//  FUNCIÓN PRINCIPAL: auditarReporteEnviadoPorFecha
// ═════════════════════════════════════════════════════════════

/**
 * Función principal que:
 *  1. Solicita una fecha al usuario (DD/MM/YYYY).
 *  2. Carga datos de Bitácora y REPORTES_GENERAL.
 *  3. Construye un mapa de búsqueda desde REPORTES_GENERAL.
 *  4. Itera las filas de Bitácora que coinciden con la fecha.
 *  5. Escribe SI / FT / NO / NA en la columna REPORTE ENV.
 *  6. Muestra un resumen de resultados al usuario.
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
      'Ingresa la fecha a auditar en formato DD/MM/YYYY:\n\n' +
      'Ejemplo: 15/06/2026',
      ui.ButtonSet.OK_CANCEL
    );

    // Si el usuario cancela, terminar
    if (respuesta.getSelectedButton() === ui.Button.CANCEL) {
      Logger.log('Usuario canceló el ingreso de fecha.');
      ui.alert('ℹ️ Operación cancelada.', 'No se realizaron cambios.', ui.ButtonSet.OK);
      return;
    }

    var fechaTexto = respuesta.getResponseText().trim();
    Logger.log('Fecha ingresada por el usuario: ' + fechaTexto);

    // Validar formato DD/MM/YYYY con regex
    var regexFecha = /^(\d{2})\/(\d{2})\/(\d{4})$/;
    if (!regexFecha.test(fechaTexto)) {
      ui.alert(
        '❌ Formato incorrecto',
        'La fecha "' + fechaTexto + '" no tiene el formato DD/MM/YYYY.\n\n' +
        'Por favor intenta de nuevo.',
        ui.ButtonSet.OK
      );
      Logger.log('Formato de fecha inválido: ' + fechaTexto);
      return;
    }

    // Validar que sea una fecha real (día/mes dentro de rango)
    var partes  = fechaTexto.split('/');
    var dia     = parseInt(partes[0], 10);
    var mes     = parseInt(partes[1], 10);
    var anio    = parseInt(partes[2], 10);
    var fechaJS = new Date(anio, mes - 1, dia);

    if (
      fechaJS.getDate()     !== dia  ||
      fechaJS.getMonth()    !== mes - 1 ||
      fechaJS.getFullYear() !== anio
    ) {
      ui.alert(
        '❌ Fecha inválida',
        '"' + fechaTexto + '" no es una fecha calendario válida.\n\n' +
        'Por favor verifica día, mes y año.',
        ui.ButtonSet.OK
      );
      Logger.log('Fecha calendario inválida: ' + fechaTexto);
      return;
    }

    Logger.log('Fecha validada correctamente: ' + fechaTexto);


    // ──────────────────────────────────────────────
    //  PASO 2: Cargar datos de ambas hojas
    // ──────────────────────────────────────────────

    Logger.log('Abriendo hoja Bitácora (ID: ' + BITACORA_SHEET_ID + ')…');
    var ssBitacora  = SpreadsheetApp.openById(BITACORA_SHEET_ID);
    var shBitacora  = ssBitacora.getSheetByName(BITACORA_TAB_NAME);

    if (!shBitacora) {
      throw new Error('No se encontró la pestaña "' + BITACORA_TAB_NAME +
                      '" en el archivo de Bitácora.');
    }

    Logger.log('Abriendo hoja REPORTES_GENERAL (ID: ' + REPORTES_SHEET_ID + ')…');
    var ssReportes  = SpreadsheetApp.openById(REPORTES_SHEET_ID);
    var shReportes  = ssReportes.getSheetByName(REPORTES_TAB_NAME);

    if (!shReportes) {
      throw new Error('No se encontró la pestaña "' + REPORTES_TAB_NAME +
                      '" en el archivo de Reportes General.');
    }

    // Obtener todos los datos (incluye fila de encabezados en índice 0)
    var datosBitacora = shBitacora.getDataRange().getValues();
    var datosReportes = shReportes.getDataRange().getValues();

    Logger.log('Filas cargadas — Bitácora: ' + datosBitacora.length +
               ' | REPORTES_GENERAL: ' + datosReportes.length);


    // ──────────────────────────────────────────────
    //  PASO 3: Construir mapa de búsqueda desde
    //          REPORTES_GENERAL filtrando por
    //          Fecha_Referencia == fechaTexto
    // ──────────────────────────────────────────────

    /**
     * Mapa de búsqueda:
     *   clave  = normalize(NombreProyecto) + '|' + normalize(nombre_persona)
     *   valor  = Array de objetos { fechaReporte, fechaReferencia }
     *            (una persona puede aparecer varias veces en el mismo proyecto)
     */
    var mapaReportes = {};
    var filasReporteCoincidentes = 0;

    // Empezar desde fila 1 para omitir encabezados
    for (var r = 1; r < datosReportes.length; r++) {
      var filaRep = datosReportes[r];

      // Obtener y normalizar Fecha_Referencia
      var celdaFechaRef = filaRep[COL_REP_FECHA_REFERENCIA];
      var fechaRefStr   = formatDate(celdaFechaRef);

      // Solo procesar filas cuya Fecha_Referencia coincida con la fecha seleccionada
      if (fechaRefStr !== fechaTexto) continue;

      filasReporteCoincidentes++;

      var nombreProyecto   = filaRep[COL_REP_NOMBRE_PROYECTO]  || '';
      var celdaFechaRep    = filaRep[COL_REP_FECHA_REPORTE];
      var equipoManualRaw  = filaRep[COL_REP_EQUIPO_MANUAL]    || '';

      var fechaReporteStr  = formatDate(celdaFechaRep);
      var proyectoNorm     = normalizarTexto(nombreProyecto);

      // Dividir Equipo_Trabajo_Manual por comas y procesar cada persona
      var personas = String(equipoManualRaw).split(',');

      for (var p = 0; p < personas.length; p++) {
        var personaNorm = normalizarTexto(personas[p]);

        // Ignorar entradas vacías
        if (!personaNorm) continue;

        var claveMap = proyectoNorm + '|' + personaNorm;

        if (!mapaReportes[claveMap]) {
          mapaReportes[claveMap] = [];
        }

        mapaReportes[claveMap].push({
          fechaReporte    : fechaReporteStr,
          fechaReferencia : fechaRefStr
        });

        Logger.log('Mapa → clave: "' + claveMap +
                   '" | fechaReporte: ' + fechaReporteStr +
                   ' | fechaReferencia: ' + fechaRefStr);
      }
    }

    Logger.log('Filas de REPORTES_GENERAL que coinciden con ' + fechaTexto +
               ': ' + filasReporteCoincidentes);
    Logger.log('Entradas únicas en el mapa de búsqueda: ' +
               Object.keys(mapaReportes).length);


    // ──────────────────────────────────────────────
    //  PASO 4: Iterar Bitácora y clasificar cada fila
    // ──────────────────────────────────────────────

    // Contadores para el resumen
    var contTotal = 0;
    var contSI    = 0;
    var contFT    = 0;
    var contNO    = 0;
    var contNA    = 0;

    // Array de cambios: { filaIndex, valor }
    // Se acumulan para escribirlos en lote al final
    var cambios = [];

    // Empezar desde fila 1 para omitir encabezados
    for (var b = 1; b < datosBitacora.length; b++) {
      var filaBit = datosBitacora[b];

      // Comparar FECHA de Bitácora con la fecha seleccionada
      var celdaFechaBit = filaBit[COL_BIT_FECHA];
      var fechaBitStr   = formatDate(celdaFechaBit);

      if (fechaBitStr !== fechaTexto) continue;

      // Esta fila corresponde a la fecha seleccionada
      contTotal++;

      var asunto   = String(filaBit[COL_BIT_ASUNTO] || '').trim();
      var proyecto = String(filaBit[COL_BIT_PROYECTO] || '');
      var nombre   = String(filaBit[COL_BIT_NOMBRE]   || '');

      Logger.log('Fila Bitácora #' + (b + 1) +
                 ' | Proyecto: "' + proyecto +
                 '" | Nombre: "' + nombre +
                 '" | Asunto: "' + asunto + '"');

      var valorResultado;

      // ── Verificar si el asunto corresponde a "Proyecto instalación"
      var asuntoNorm = normalizarTexto(asunto);
      var targetAsuntoNorm = normalizarTexto(ASUNTO_INSTALACION);
      if (asuntoNorm !== targetAsuntoNorm) {
        // No aplica auditoría de reporte
        valorResultado = 'NA';
        contNA++;
        Logger.log('  → NA (asunto no es "Proyecto instalación": "' + asunto + '")');

      } else {
        // ── Buscar en el mapa por proyecto + nombre
        var clavesBusqueda = generarClavesNormalizadas(proyecto, nombre);
        var coincidencias  = null;

        for (var k = 0; k < clavesBusqueda.length; k++) {
          if (mapaReportes[clavesBusqueda[k]]) {
            coincidencias = mapaReportes[clavesBusqueda[k]];
            Logger.log('  Coincidencia encontrada con clave: "' + clavesBusqueda[k] + '"');
            break;
          }
        }

        if (!coincidencias) {
          // No se encontró reporte para esta persona/proyecto
          valorResultado = 'NO';
          contNO++;
          Logger.log('  → NO (sin coincidencia en REPORTES_GENERAL)');

        } else {
          // Evaluar si el reporte fue enviado a tiempo o fuera de tiempo
          // SI  = fechaReporte == fechaReferencia para AL MENOS UNA coincidencia
          // FT  = TODAS las coincidencias tienen fechaReporte != fechaReferencia

          var tieneSI = false;
          var tieneFT = false;

          for (var c = 0; c < coincidencias.length; c++) {
            var match = coincidencias[c];
            if (match.fechaReporte === match.fechaReferencia) {
              tieneSI = true;
            } else {
              tieneFT = true;
            }
          }

          if (tieneSI) {
            // Al menos un reporte fue enviado a tiempo → SI tiene prioridad
            valorResultado = 'SI';
            contSI++;
            Logger.log('  → SI (reporte enviado a tiempo)');
          } else {
            // Todos fuera de tiempo
            valorResultado = 'FT';
            contFT++;
            Logger.log('  → FT (fuera de tiempo — fechaReporte != fechaReferencia)');
          }
        }
      }

      // Acumular cambio para escritura en lote
      cambios.push({ filaIndex: b, valor: valorResultado });

    } // fin loop Bitácora


    // ──────────────────────────────────────────────
    //  PASO 5: Escribir cambios en lote y mostrar
    //          resumen al usuario
    // ──────────────────────────────────────────────

    if (cambios.length === 0) {
      ui.alert(
        '⚠️ Sin resultados',
        'No se encontraron filas en Bitácora con la fecha ' + fechaTexto + '.\n\n' +
        'Verifica que la fecha ingresada exista en la columna FECHA.',
        ui.ButtonSet.OK
      );
      Logger.log('No se encontraron filas coincidentes en Bitácora para: ' + fechaTexto);
      return;
    }

    Logger.log('Escribiendo ' + cambios.length + ' cambios en Bitácora…');

    // Escribir cada valor en la celda correspondiente de REPORTE ENV.
    // Columna base-0: COL_BIT_REPORTE_ENV = 10 → columna Sheets (base-1): 11
    var colSheets = COL_BIT_REPORTE_ENV + 1; // conversión a base-1 para getRange

    for (var i = 0; i < cambios.length; i++) {
      var cambio     = cambios[i];
      var filaSheets = cambio.filaIndex + 1; // conversión a base-1

      shBitacora.getRange(filaSheets, colSheets).setValue(cambio.valor);
    }

    Logger.log('Cambios escritos exitosamente.');

    // Construir mensaje de resumen
    var resumen =
      '✅ Auditoría completada para la fecha: ' + fechaTexto + '\n\n' +
      '─────────────────────────────────\n' +
      '📊 Resultados:\n' +
      '  • Total de filas procesadas : ' + contTotal + '\n' +
      '  • ✅ SI  (a tiempo)         : ' + contSI    + '\n' +
      '  • ⏰ FT  (fuera de tiempo)  : ' + contFT    + '\n' +
      '  • ❌ NO  (no encontrado)    : ' + contNO    + '\n' +
      '  • ➖ NA  (no aplica)        : ' + contNA    + '\n' +
      '─────────────────────────────────\n' +
      'Los valores han sido escritos en\n' +
      'la columna "REPORTE ENV." de la Bitácora.';

    Logger.log('=== RESUMEN ===\n' + resumen);

    ui.alert(
      '🔍 Resumen de Auditoría – SMARTCORP',
      resumen,
      ui.ButtonSet.OK
    );

  } catch (e) {
    // Error inesperado: mostrar mensaje amigable y registrar detalle
    Logger.log('ERROR en auditarReporteEnviadoPorFecha: ' + e.message + '\n' + e.stack);
    ui.alert(
      '❌ Error inesperado',
      'Ocurrió un error durante la auditoría:\n\n' + e.message + '\n\n' +
      'Revisa los Registros (Apps Script > Registros de ejecución) para más detalles.',
      ui.ButtonSet.OK
    );
  }
}


// ═════════════════════════════════════════════════════════════
//  FUNCIONES AUXILIARES
// ═════════════════════════════════════════════════════════════

/**
 * Convierte un valor de celda de Google Sheets a string "DD/MM/YYYY".
 * Maneja correctamente:
 *   • Objetos Date (como los devuelve Sheets cuando hay formato de fecha)
 *   • Strings que ya vienen en formato DD/MM/YYYY
 *   • Strings en otros formatos (se intentan parsear)
 *   • Valores nulos/vacíos → devuelve ""
 *
 * @param  {Date|string|number} valor  El valor crudo de la celda.
 * @return {string}                    Fecha formateada "DD/MM/YYYY" o "".
 */
function formatDate(valor) {
  if (!valor && valor !== 0) return '';

  // Si es un objeto Date nativo de JS (lo más común en Sheets)
  if (valor instanceof Date) {
    if (isNaN(valor.getTime())) return '';

    var d  = valor.getDate();
    var m  = valor.getMonth() + 1; // getMonth() es base 0
    var y  = valor.getFullYear();

    return pad2(d) + '/' + pad2(m) + '/' + y;
  }

  // Si ya es un string, normalizar
  var str = String(valor).trim();

  // Patrón DD/MM/YYYY ya correcto
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(str)) {
    return str;
  }

  // Patrón D/M/YYYY o DD/M/YYYY o D/MM/YYYY → normalizar a 2 dígitos
  var partes = str.split('/');
  if (partes.length === 3) {
    var pd = partes[0], pm = partes[1], py = partes[2];
    if (pd.length <= 2 && pm.length <= 2 && py.length === 4) {
      return pad2(parseInt(pd, 10)) + '/' +
             pad2(parseInt(pm, 10)) + '/' + py;
    }
  }

  // Intentar construir fecha desde el string
  var fecha = new Date(str);
  if (!isNaN(fecha.getTime())) {
    var d2 = fecha.getDate();
    var m2 = fecha.getMonth() + 1;
    var y2 = fecha.getFullYear();
    return pad2(d2) + '/' + pad2(m2) + '/' + y2;
  }

  // No se pudo parsear
  Logger.log('formatDate: no se pudo convertir el valor: "' + str + '"');
  return str;
}


/**
 * Agrega un cero a la izquierda si el número tiene un solo dígito.
 * @param  {number} n  Número a formatear.
 * @return {string}    String con al menos 2 dígitos.
 */
function pad2(n) {
  return n < 10 ? '0' + n : String(n);
}


/**
 * Normaliza un texto para comparación:
 *   • Convierte a minúsculas
 *   • Elimina espacios al inicio/final
 *   • Colapsa espacios internos múltiples a uno solo
 *
 * @param  {string} texto  El texto a normalizar.
 * @return {string}        Texto normalizado.
 */
function normalizarTexto(texto) {
  if (!texto && texto !== 0) return '';
  return String(texto)
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\u200b\u200c\u200d\ufeff]/g, "")
    .replace(/\s+/g, ' ');
}


/**
 * Genera un arreglo de posibles claves de búsqueda para el mapa,
 * aplicando diferentes normalizaciones al proyecto y nombre.
 * Esto aumenta las probabilidades de coincidencia ante pequeñas
 * diferencias de formato entre las dos hojas.
 *
 * @param  {string} proyecto  Nombre del proyecto (desde Bitácora).
 * @param  {string} nombre    Nombre de la persona (desde Bitácora).
 * @return {string[]}         Arreglo de claves candidatas a buscar.
 */
function generarClavesNormalizadas(proyecto, nombre) {
  var pNorm  = normalizarTexto(proyecto);
  var nNorm  = normalizarTexto(nombre);

  var claves = [];

  // Clave principal: proyecto|nombre completo
  claves.push(pNorm + '|' + nNorm);

  // Variante: solo primer nombre (por si Equipo_Trabajo_Manual
  // usa nombre abreviado)
  var partsNombre = nNorm.split(' ');
  if (partsNombre.length > 1) {
    claves.push(pNorm + '|' + partsNombre[0]);
  }

  // Variante: nombre completo sin el segundo apellido
  // (toma las primeras 2 partes del nombre: nombre + primer apellido)
  if (partsNombre.length >= 3) {
    claves.push(pNorm + '|' + partsNombre[0] + ' ' + partsNombre[1]);
  }

  return claves;
}
