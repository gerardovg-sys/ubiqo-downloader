// --- CONFIGURACIÓN ---
const SHEET_EVALUACION_ID = '18GFvQZdpmALvmmTFc70dXENJxImMR3bkHU04IG_UyyY'; 
const SHEET_REPORTES_ID = '14vPIvvrc2Cag61_BCdXJd4Cd-yksfV1RqmzMhKesqao'; 
const FOLDER_FOTOS_ID = '10JF5XvMfaJzKHbLYFxGdcKRjI6gHFge2'; 
const SHEET_REPORTES_OLD_ID = '1QeFcpTbwfMRMLjoN0ghaFPNqm-EDg_1rqeQb-yp568w';
const SHEET_PENDIENTES_COM_ID = '17MFxiKLrC8fm3nOFHh_qM3WW9ojqelqpYitMZhPZl6o'; 

function abrirTablero() {
  // Definimos la URL aquí mismo para evitar errores de referencia
  const WEB_APP_URL = 'https://script.google.com/a/macros/smartcorp.com.mx/s/AKfycbzHrUM7bu2LRPTMV7bLRgVHb1NaWSbZgLqYLIPDRqPVUQe9nVx4yyw2ZzseUOneEDToZQ/exec';

  // Generamos un HTML simple con un botón gigante que lleva a tu URL
  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <base target="_top">
        <style>
          body { font-family: 'Segoe UI', sans-serif; text-align: center; padding: 30px; color: #333; background-color: #f9fafb; }
          .btn {
            display: inline-block; padding: 15px 30px; background-color: #4f46e5; color: white;
            text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1); transition: transform 0.1s, background 0.2s;
            margin-top: 10px;
          }
          .btn:hover { background-color: #4338ca; transform: translateY(-1px); }
          .btn:active { transform: translateY(1px); }
          h3 { margin-top: 0; color: #1f2937; }
          p { margin-bottom: 20px; color: #6b7280; font-size: 14px; }
        </style>
      </head>
      <body>
        <h3>📊 Sistema de Gestión Integral</h3>
        <p>Haz clic en el botón para abrir el tablero en pantalla completa:</p>
        
        <a href="${WEB_APP_URL}" target="_blank" class="btn" id="link">
          ABRIR TABLERO 🚀
        </a>
        
        <script>
          // Intentamos clic automático (a veces los navegadores lo bloquean, por eso dejamos el botón)
          setTimeout(function() {
            document.getElementById('link').click();
          }, 500);
        </script>
      </body>
    </html>
  `;

  const html = HtmlService.createHtmlOutput(htmlContent)
      .setWidth(450)
      .setHeight(300);
      
  SpreadsheetApp.getUi().showModalDialog(html, 'Abriendo Sistema...');
}



function doGet(e) {
  if (e && e.parameter && e.parameter.token === "SMARTCORP_UBIQO_SECURE_TOKEN_2026") {
    return handleUbiqoGet(e);
  }
  if (e && e.parameter && e.parameter.test === '1') {
    try {
      const ss = SpreadsheetApp.openById(SHEET_REPORTES_ID);
      const sheets = ss.getSheets().map(s => {
        const name = s.getName();
        let headers = [];
        let sampleRows = [];
        try {
          const range = s.getDataRange();
          if (range) {
            const vals = range.getValues();
            headers = vals[0];
            sampleRows = vals.slice(1, 6);
          }
        } catch(err) {
          headers = ["Error: " + err.toString()];
        }
        return { name: name, headers: headers, rows: s.getLastRow(), sampleRows: sampleRows };
      });
      return HtmlService.createHtmlOutput("<h3>Estructura del Spreadsheet de Reportes</h3><pre>" + JSON.stringify(sheets, null, 2) + "</pre>");
    } catch(err) {
      return HtmlService.createHtmlOutput("<h3>Error de Conexión</h3><pre>" + err.toString() + "</pre>");
    }
  }
  return HtmlService.createTemplateFromFile('index')
      .evaluate()
      .setTitle('Sistema de Gestión Integral')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}


// 1. EVALUACIÓN (Bitácora)
function getDataBitacora() {
  return fetchData(SHEET_EVALUACION_ID, 'Bitácora', 'EVAL');
}

// 2. REPORTES (Unificado: REPORTES_GENERAL y Reportes limpios)
function getDataReportes() {
  try {
    const ssNew = SpreadsheetApp.openById(SHEET_REPORTES_ID);
    const ssOld = SpreadsheetApp.openById(SHEET_REPORTES_OLD_ID);
    
    let combined = [];
    
    // A. Leer de la fuente nueva (REPORTES_GENERAL)
    const sheetNew = ssNew.getSheetByName('REPORTES_GENERAL');
    if (sheetNew) {
      const values = sheetNew.getDataRange().getDisplayValues();
      if (values.length >= 2) {
        const headers = values[0].map(h => h.toUpperCase().trim());
        const getIdx = (name) => headers.indexOf(name.toUpperCase());
        
        const idxIdReporte = getIdx('ID_REPORTE');
        const idxNombreProj = getIdx('NOMBREPROYECTO');
        let idxFechaRep = getIdx('FECHA_REFERENCIA');
        if (idxFechaRep === -1) {
          idxFechaRep = getIdx('FECHA_REPORTE');
        }
        const idxSupervisor = getIdx('ID_SUPERVISOR');
        const idxActividad = getIdx('ACTIVIDAD_PRINCIPAL');
        const idxDescripcion = getIdx('DESCRIPCION_TRABAJO');
        const idxPendientes = getIdx('ACTIVIDADES_PENDIENTES');
        const idxEstatus = getIdx('ESTADO_PROYECTO');
        const idxHorasExtra = getIdx('CANTIDAD_HORAS_EXTRA');
        const idxLink = getIdx('LINK_PUBLICO');
        const idxEquipo = getIdx('EQUIPO_TRABAJO_MANUAL');
        const idxIncidencias = getIdx('HUBO_INCIDENCIAS');
        const idxDetalleIncidencias = getIdx('DETALLE_INCIDENCIAS');
        
        values.slice(1).forEach((row, index) => {
          if (!row[idxNombreProj]) return;
          combined.push({
            id: 'new-' + (index + 1),
            idReporte: row[idxIdReporte] || '',
            proyecto: row[idxNombreProj],
            fecha: formatDateToISO(row[idxFechaRep]),
            autor: row[idxSupervisor] || '',
            actividades: row[idxActividad] || '',
            descripcion: row[idxDescripcion] || '',
            pendientes: row[idxPendientes] || '',
            estatus: row[idxEstatus] || 'EN PROCESO',
            cantHorasExtra: row[idxHorasExtra] || '0',
            linkPublico: row[idxLink] || '',
            equipo: row[idxEquipo] || '',
            incidencias: (row[idxIncidencias] || 'NO') === 'SI' ? (row[idxDetalleIncidencias] || 'SI') : 'NO',
            source: 'new'
          });
        });
      }
    }
    
    // B. Leer de la fuente antigua (Reportes limpios)
    const sheetOld = ssOld.getSheetByName('Reportes limpios');
    if (sheetOld) {
      const values = sheetOld.getDataRange().getDisplayValues();
      if (values.length >= 2) {
        const headers = values[0].map(h => h.toUpperCase().trim());
        const getIdx = (name) => headers.indexOf(name.toUpperCase());
        
        const idxNombreProj = getIdx('PROYECTO / TICKET SOPORTE / LEVANTAMIENTO');
        const idxFechaRep = getIdx('FECHA DE VISITA');
        const idxSupervisor = getIdx('PERSONA QUIEN LLENA EL FORMULARIO');
        const idxActividad = getIdx('ACTIVIDADES REALIZADAS:');
        const idxDescripcion = getIdx('COMENTARIOS');
        const idxPendientes = getIdx('ACTIVIDADES PENDIENTES:');
        const idxEstatus = getIdx('EL PROYECTO / TICKET / LEVANTAMIENTO SE ENCUENTRA:');
        const idxHorasExtra = getIdx('CANTIDAD DE HORAS EXTRAS');
        const idxEquipo = getIdx('EQUIPO INTEGRADO POR:');
        
        values.slice(1).forEach((row, index) => {
          if (!row[idxNombreProj]) return;
          combined.push({
            id: 'old-' + (index + 1),
            idReporte: '', 
            proyecto: row[idxNombreProj],
            fecha: formatDateToISO(row[idxFechaRep]),
            autor: row[idxSupervisor] || '',
            actividades: row[idxActividad] || '',
            descripcion: row[idxDescripcion] || '',
            pendientes: row[idxPendientes] || '',
            estatus: row[idxEstatus] || 'EN PROCESO',
            cantHorasExtra: row[idxHorasExtra] || '0',
            linkPublico: '',
            equipo: row[idxEquipo] || '',
            incidencias: 'NO', 
            source: 'old'
          });
        });
      }
    }
    
    return JSON.stringify(combined);
  } catch (error) {
    Logger.log("Error en getDataReportes: " + error);
    return JSON.stringify([]);
  }
}

// 3. TÉCNICOS ACTIVOS (NUEVO)
function getTecnicosActivos() {
  // Lee la hoja GRAL SISTEMA para obtener listado oficial y estado
  try {
    const ss = SpreadsheetApp.openById(SHEET_EVALUACION_ID);
    const sheet = ss.getSheetByName('GRAL SISTEMA');
    if (!sheet) return JSON.stringify([]);
    
    const data = sheet.getDataRange().getDisplayValues();
    if (data.length < 2) return JSON.stringify([]);
    
    const headers = data[0].map(h => h.toUpperCase().trim());
    const idxNombre = headers.indexOf('TÉCNICOS ACTIVOS');
    const idxEstado = headers.indexOf('ESTADO');
    
    const tecnicos = data.slice(1).map(row => ({
      nombre: row[idxNombre],
      estado: row[idxEstado] ? row[idxEstado].toUpperCase() : 'INACTIVO'
    })).filter(t => t.nombre); // Filtrar vacíos
    
    return JSON.stringify(tecnicos);
  } catch (e) {
    Logger.log("Error obteniendo técnicos: " + e);
    return JSON.stringify([]);
  }
}

// 4. IMÁGENES DE REPORTE (Nueva carpeta de Drive consolidada)
function getReportImages(reportId) {
  try {
    if (!reportId) return [];
    const ss = SpreadsheetApp.openById(SHEET_REPORTES_ID);
    const sheet = ss.getSheetByName('EVIDENCIA_FOTOS');
    if (!sheet) return [];
    
    const data = sheet.getDataRange().getValues();
    if (data.length < 2) return [];
    
    const headers = data[0].map(h => h.toUpperCase().trim());
    const idxReporte = headers.indexOf('ID_REPORTE');
    const idxFoto = headers.indexOf('FOTOGRAFIA');
    const idxDesc = headers.indexOf('DESCRIPCION_FOTO');
    
    const fotosRequeridas = [];
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][idxReporte]).trim() === String(reportId).trim()) {
        const rawFoto = String(data[i][idxFoto]).trim();
        let cleanFoto = rawFoto;
        if (rawFoto.includes('//')) {
          cleanFoto = rawFoto.split('//').pop();
        } else if (rawFoto.includes('/')) {
          cleanFoto = rawFoto.split('/').pop();
        }
        fotosRequeridas.push({
          nombre: cleanFoto.trim(),
          descripcion: data[i][idxDesc]
        });
      }
    }
    
    if (fotosRequeridas.length === 0) return [];
    
    const folder = DriveApp.getFolderById(FOLDER_FOTOS_ID);
    const images = [];
    
    // Mapa en caché de los archivos del Drive en minúscula
    const fileMap = {};
    const filesIter = folder.getFiles();
    while (filesIter.hasNext()) {
      const f = filesIter.next();
      fileMap[f.getName().toLowerCase().trim()] = f;
    }
    
    for (let foto of fotosRequeridas) {
      if (!foto.nombre) continue;
      const lookupName = foto.nombre.toLowerCase();
      let file = fileMap[lookupName];
      if (!file) {
        // Tolerancia a extensiones omitidas en Spreadsheet
        file = fileMap[lookupName + '.jpg'] || fileMap[lookupName + '.jpeg'] || fileMap[lookupName + '.png'] || fileMap[lookupName + '.gif'];
      }
      
      if (file) {
        // Habilitar visibilidad para que cargue en el navegador del cliente
        try {
          file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        } catch(err) {
          try {
            file.setSharing(DriveApp.Access.DOMAIN_WITH_LINK, DriveApp.Permission.VIEW);
          } catch(e2) {
            // Ignorar en caso de restricciones de directivas empresariales
          }
        }
        
        const fileId = file.getId();
        images.push({
          src: `https://docs.google.com/uc?export=view&id=${fileId}`,
          thumbnail: `https://lh3.googleusercontent.com/d/${fileId}=w400`,
          descripcion: foto.descripcion || ''
        });
      }
    }
    return images;
  } catch (e) {
    Logger.log("Error getReportImages: " + e);
    return [];
  }
}

// --- UTILIDADES ---
function fetchData(id, sheetName, type) {
  try {
    const ss = SpreadsheetApp.openById(id);
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) throw new Error(`No se encontró la hoja "${sheetName}"`);
    const dataRange = sheet.getDataRange();
    const values = dataRange.getDisplayValues();
    if (values.length < 2) return JSON.stringify([]);
    const headers = values[0].map(h => h.toUpperCase().trim());
    const rawData = values.slice(1);
    const getIdx = (name) => headers.indexOf(name.toUpperCase());
    const idxRol = getIdx('ROL');

    const mappedData = rawData.map((row, index) => {
      if (type === 'EVAL') {
        if (!row[getIdx('NOMBRE')]) return null;
        const getVal = (name) => {
          const idx = getIdx(name);
          return idx !== -1 ? (row[idx] || '') : '';
        };
        return {
          id: index + 1,
          fecha: formatDateToISO(row[getIdx('FECHA')]),
          nombre: row[getIdx('NOMBRE')],
          proyecto: row[getIdx('PROYECTO')],
          horaSalida: row[getIdx('HORA DE SALIDA')],
          horaEntrada: row[getIdx('HORA DE ENTRADA')],
          reporteEnv: row[getIdx('REPORTE ENV.')],
          tiempoParadas: row[getIdx('TIEMPO DE PARADAS')],
          nota: row[getIdx('NOTA')],
          regresos: row[getIdx('REGRESOS')],
          asistencia: row[getIdx('ASISTENCIA')] || 'NORMAL',
          horaSalProy: row[getIdx('HORA SAL PROY')],
          horaLlegProy: row[getIdx('HORA LLEG PROY')],
          rol: idxRol !== -1 ? (row[idxRol] || '') : '',
          sap: getVal('SAP'),
          de: getVal('DE'),
          a: getVal('A'),
          calculoHoras: getVal('CALCULO HORAS'),
          unidad: getVal('UNIDAD'),
          asunto: getVal('ASUNTO')
        };
      } else {
        return {
          id: index + 1,
          addedTime: row[getIdx('ADDED TIME')],
          proyecto: row[getIdx('PROYECTO / TICKET SOPORTE / LEVANTAMIENTO')],
          autor: row[getIdx('PERSONA QUIEN LLENA EL FORMULARIO')],
          fecha: formatDateToISO(row[getIdx('FECHA DE VISITA')]),
          equipo: row[getIdx('EQUIPO INTEGRADO POR:')],
          inicio: row[getIdx('HORA DE INICIO DE ACTIVIDADES:')],
          fin: row[getIdx('HORA DE TÉRMINO DE ACTIVIDADES:')],
          actividades: row[getIdx('ACTIVIDADES REALIZADAS:')],
          pendientes: row[getIdx('ACTIVIDADES PENDIENTES:')],
          estatus: row[getIdx('EL PROYECTO / TICKET / LEVANTAMIENTO SE ENCUENTRA:')],
          comentarios: row[getIdx('COMENTARIOS')],
          cantHorasExtra: row[getIdx('CANTIDAD DE HORAS EXTRAS')]
        };
      }
    }).filter(item => item !== null);
    return JSON.stringify(mappedData);
  } catch (error) { return JSON.stringify([]); }
}

function formatDateToISO(dateStr) {
  if (!dateStr) return '';
  if (dateStr instanceof Date) {
    const y = dateStr.getFullYear();
    const m = String(dateStr.getMonth() + 1).padStart(2, '0');
    const d = String(dateStr.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const str = String(dateStr).trim();
  const match = str.match(/^(\d{4})[\-\/](\d{2})[\-\/](\d{2})/);
  if (match) {
    return `${match[1]}-${match[2]}-${match[3]}`;
  }
  const matchSlash = str.match(/^(\d{1,2})[\-\/](\d{1,2})[\-\/](\d{4})/);
  if (matchSlash) {
    const p1 = parseInt(matchSlash[1], 10);
    const p2 = parseInt(matchSlash[2], 10);
    const year = matchSlash[3];
    
    let day, month;
    if (p1 > 12) {
      day = p1;
      month = p2;
    } else if (p2 > 12) {
      day = p2;
      month = p1;
    } else {
      day = p1;
      month = p2; // Por defecto DD/MM/YYYY
    }
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }
  return str.split(' ')[0];
}

// 5. GENERACIÓN DE RESUMENES (IA Gemini y Fallback Tradicional)
function generarResumenInteligente(projectName) {
  try {
    const reportesRaw = getDataReportes();
    const parsed = JSON.parse(reportesRaw);
    const projectReports = parsed.filter(r => r.proyecto === projectName);
    
    if (projectReports.length === 0) {
      return "No hay reportes de obra para este proyecto.";
    }
    
    // Consolidar texto para el prompt
    let bitacoraTexto = "";
    projectReports.forEach((r, idx) => {
      bitacoraTexto += `Reporte del día (${r.fecha}):\n`;
      bitacoraTexto += `- Actividades: ${r.actividades}\n`;
      bitacoraTexto += `- Descripción: ${r.descripcion}\n`;
      bitacoraTexto += `- Pendientes: ${r.pendientes}\n`;
      bitacoraTexto += `- Estatus: ${r.estatus}\n`;
      if (r.incidencias && r.incidencias !== 'NO') {
        bitacoraTexto += `- Incidencias: ${r.incidencias}\n`;
      }
      bitacoraTexto += `\n`;
    });
    
    const apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
    if (!apiKey) {
      // Fallback tradicional si no hay clave de API configurada
      return generarResumenTradicional(projectName, projectReports);
    }
    
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    const payload = {
      contents: [{
        parts: [{
          text: `Eres un asistente de dirección e ingeniería experto en control de proyectos de obra. Analiza el siguiente historial de reportes diarios del proyecto "${projectName}" y elabora un Resumen Ejecutivo estructurado para la gerencia.\n\nHistorial del proyecto:\n${bitacoraTexto}\n\nEscribe el resumen en español, con viñetas claras e incluye:\n1. Estatus general del avance del proyecto.\n2. Principales logros y trabajos ya concluidos.\n3. Actividades críticas que están pendientes.\n4. Problemas, incidencias o alertas operativas reportadas (si no hay ninguna, dilo explícitamente).\n\nSé conciso, estructurado, ejecutivo y muy directo. Evita introducciones genéricas.`
        }]
      }]
    };
    
    const options = {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };
    
    const response = UrlFetchApp.fetch(url, options);
    const json = JSON.parse(response.getContentText());
    if (json.candidates && json.candidates[0].content.parts[0].text) {
      return json.candidates[0].content.parts[0].text;
    } else {
      return generarResumenTradicional(projectName, projectReports) + "\n\n(Nota: Falla al contactar a la IA de Gemini, se muestra resumen tradicional).";
    }
  } catch (e) {
    Logger.log("Error generarResumenInteligente: " + e);
    try {
      const parsed = JSON.parse(getDataReportes());
      const projectReports = parsed.filter(r => r.proyecto === projectName);
      return generarResumenTradicional(projectName, projectReports) + "\n\n(Nota: Ocurrió un error de conexión al contactar a Gemini, se muestra resumen tradicional: " + e.toString() + ").";
    } catch(err) {
      return "Error al generar resumen: " + e.toString();
    }
  }
}

function generarResumenTradicional(projectName, reports) {
  let totalHoras = 0;
  let statusCounts = {};
  let logsText = "";
  
  reports.forEach(r => {
    const s = r.estatus || 'Sin Estatus';
    statusCounts[s] = (statusCounts[s] || 0) + 1;
    totalHoras += (Number(r.cantHorasExtra) || 0);
    logsText += `\n• FECHA: ${r.fecha}\n  - Actividades: ${r.actividades}\n  - Trabajo: ${r.descripcion}\n  - Pendientes: ${r.pendientes}\n  - Incidencias: ${r.incidencias}\n`;
  });
  
  const estatusTexto = Object.entries(statusCounts).map(([k,v]) => `   - ${k}: ${v} reporte(s)`).join('\n');
  
  return `RESUMEN DE PROYECTO (MÓDULO TRADICIONAL)
========================================
PROYECTO: ${projectName}
TOTAL DE REPORTES: ${reports.length}

1. CONTEO DE REPORTES POR ESTATUS:
${estatusTexto || '   - Sin datos'}

2. MÉTRICAS CLAVE:
   - Total Horas Extra Reportadas: ${totalHoras} hrs
   - Primer Reporte: ${reports[0] ? reports[0].fecha : 'N/A'}
   - Último Reporte: ${reports[reports.length-1] ? reports[reports.length-1].fecha : 'N/A'}

3. DETALLES DE VISITAS:
${logsText || '   - Sin actividades registradas.'}`;
}

// 6. BD PROYECTOS MAESTRO (Extraer catálogo maestro e indicadores globales)
function getBDProyectosMaestro() {
  try {
    const ss = SpreadsheetApp.openById(SHEET_EVALUACION_ID);
    const sheet = ss.getSheetByName('BD Proyectos Maestro');
    if (!sheet) throw new Error('No se encontró la hoja "BD Proyectos Maestro"');
    
    const values = sheet.getDataRange().getDisplayValues();
    if (values.length < 2) return JSON.stringify([]);
    
    const headers = values[0].map(h => h.toUpperCase().trim());
    const rawData = values.slice(1);
    
    // Búsqueda flexible de índices con fallbacks
    const getIdx = (names) => {
      const namesArray = Array.isArray(names) ? names : [names];
      for (let name of namesArray) {
        const uName = name.toUpperCase().trim();
        const exact = headers.indexOf(uName);
        if (exact !== -1) return exact;
        const partial = headers.findIndex(h => h.includes(uName));
        if (partial !== -1) return partial;
      }
      return -1;
    };
    
    const idxSap = getIdx('SAP');
    const idxProyecto = getIdx('PROYECTOS');
    const idxFechaInicio = getIdx('FECHA INICIO');
    const idxEstado = getIdx('ESTADO');
    const idxCatProj = getIdx('CAT. DEL PROYECTO');
    const idxVendedor = getIdx('VENDEDOR');
    const idxUnidadesEst = getIdx(['UNIDADES ESTIMADAS', 'UNID. ESTIMADAS', 'UNIDADES EST', 'UNID EST', 'U. EST']);
    const idxUnidadesTot = getIdx(['UNIDADES TOTALES', 'UNID. TOTALES', 'UNIDADES TOT', 'UNID TOT', 'U. TOT', 'UNIDADES REALES']);
    const idxDiasEst = getIdx('DÍAS ESTIMADOS');
    const idxEncargado = getIdx(['ENCARGADO DE PROYECTO', 'ENCARGADO', 'RESPONSABLE', 'LIDER DE PROYECTO']);
    
    // Log para depuración en Apps Script
    console.log("BD Proyectos Maestro Mapped Indices: " + JSON.stringify({
      sap: idxSap,
      proyecto: idxProyecto,
      fechaInicio: idxFechaInicio,
      estado: idxEstado,
      catProj: idxCatProj,
      vendedor: idxVendedor,
      unidadesEst: idxUnidadesEst,
      unidadesTot: idxUnidadesTot,
      diasEst: idxDiasEst,
      encargado: idxEncargado
    }));
    
    const mapped = rawData.map(row => {
      if (!row[idxProyecto]) return null;
      return {
        sap: idxSap !== -1 ? (row[idxSap] || '') : '',
        proyecto: idxProyecto !== -1 ? (row[idxProyecto] || '') : '',
        fechaInicio: idxFechaInicio !== -1 ? (row[idxFechaInicio] || '') : '',
        estado: idxEstado !== -1 ? (row[idxEstado] || '') : '',
        catProyecto: idxCatProj !== -1 ? (row[idxCatProj] || '') : '',
        vendedor: idxVendedor !== -1 ? (row[idxVendedor] || '') : '',
        unidadesEstimadas: idxUnidadesEst !== -1 ? (row[idxUnidadesEst] || '0') : '0',
        unidadesTotales: idxUnidadesTot !== -1 ? (row[idxUnidadesTot] || '0') : '0',
        diasEstimados: idxDiasEst !== -1 ? (row[idxDiasEst] || '0') : '0',
        encargado: idxEncargado !== -1 ? (row[idxEncargado] || '') : ''
      };
    }).filter(item => item !== null);
    
    return JSON.stringify(mapped);
  } catch (error) {
    Logger.log("Error en getBDProyectosMaestro: " + error);
    return JSON.stringify([]);
  }
}

// 7. PENDIENTES Y COMENTARIOS (Sheet 17MFxiKL...)
function getPendientesYComentarios(sapId) {
  try {
    const ss = SpreadsheetApp.openById(SHEET_PENDIENTES_COM_ID);
    const result = { pendientes: [], comentarios: [] };
    
    // A. Leer Pendientes
    const shPendientes = ss.getSheetByName('Pendientes');
    if (shPendientes) {
      const vals = shPendientes.getDataRange().getDisplayValues();
      if (vals.length >= 2) {
        const headers = vals[0].map(h => h.toUpperCase().trim());
        const getIdx = (name) => headers.indexOf(name.toUpperCase());
        
        const idxProj = getIdx('PROYECTO_ID');
        const idxCat = getIdx('CATEGORÍA');
        const idxStatus = getIdx('STATUS');
        const idxFecha = getIdx('FECHA_REPORTE');
        const idxFuente = getIdx('FUENTE_REPORTE');
        const idxTitulo = getIdx('TÍTULO_PENDIENTE');
        const idxDesc = getIdx('DESCRIPCIÓN');
        const idxRazon = getIdx('RAZÓN');
        const idxParteResp = getIdx('PARTE_RESPONSABLE');
        const idxResp = getIdx('RESPONSABLE');
        
        result.pendientes = vals.slice(1).map(row => {
          if (String(row[idxProj]).trim().toUpperCase() !== String(sapId).trim().toUpperCase()) return null;
          return {
            categoria: row[idxCat] || '',
            status: row[idxStatus] || '',
            fechaReporte: formatDateToISO(row[idxFecha]),
            fuenteReporte: row[idxFuente] || '',
            titulo: row[idxTitulo] || '',
            descripcion: row[idxDesc] || '',
            razon: row[idxRazon] || '',
            parteResponsable: row[idxParteResp] || '',
            responsable: row[idxResp] || ''
          };
        }).filter(Boolean);
      }
    }
    
    // B. Leer Comentarios
    const shComentarios = ss.getSheetByName('Comentarios');
    if (shComentarios) {
      const vals = shComentarios.getDataRange().getDisplayValues();
      if (vals.length >= 2) {
        const headers = vals[0].map(h => h.toUpperCase().trim());
        const getIdx = (name) => headers.indexOf(name.toUpperCase());
        
        const idxProj = getIdx('PROYECTO_ID');
        const idxFecha = getIdx('FECHA');
        const idxResp = getIdx('RESPONSABLE');
        const idxCatNeg = getIdx('CATEGORÍA_NEGATIVO');
        const idxDesc = getIdx('DESCRIPCIÓN');
        const idxPrevYN = getIdx('PREVENCION_Y/N');
        const idxPrevDesc = getIdx('PREVENCION_DESCRIPCION');
        
        result.comentarios = vals.slice(1).map(row => {
          if (String(row[idxProj]).trim().toUpperCase() !== String(sapId).trim().toUpperCase()) return null;
          let datePart = row[idxFecha] || '';
          if (datePart.includes(' ')) {
            datePart = datePart.split(' ')[0];
          }
          return {
            fecha: formatDateToISO(datePart),
            responsable: row[idxResp] || '',
            categoriaNegativo: row[idxCatNeg] || '',
            descripcion: row[idxDesc] || '',
            prevencionYN: row[idxPrevYN] || 'NO',
            prevencionDescripcion: row[idxPrevDesc] || ''
          };
        }).filter(Boolean);
      }
    }
    
    return JSON.stringify(result);
  } catch (error) {
    Logger.log("Error en getPendientesYComentarios: " + error);
    return JSON.stringify({ pendientes: [], comentarios: [] });
  }
}

// ══════════════════════════════════════════════════════════════════
//  MÓDULO: REPORTE SEMANAL AUTOMÁTICO POR TÉCNICO
//  Versión 1.1.0 — 20/Jul/2026
// ══════════════════════════════════════════════════════════════════

/**
 * Lee la hoja DB_PERSONAL del Spreadsheet de Reportes y retorna
 * solo el personal con Activo = TRUE.
 * @returns {Array<{idPersonal, nombre, rol, email}>}
 */
function getPersonalActivo() {
  try {
    const ss = SpreadsheetApp.openById(SHEET_REPORTES_ID);
    const sheet = ss.getSheetByName('DB_PERSONAL');
    if (!sheet) {
      Logger.log('getPersonalActivo: No se encontró la hoja DB_PERSONAL');
      return [];
    }
    const data = sheet.getDataRange().getValues();
    if (data.length < 2) return [];

    const headers = data[0].map(h => String(h).toUpperCase().trim());
    const idxId      = headers.indexOf('ID_PERSONAL');
    const idxNombre  = headers.indexOf('NOMBRE_COMPLETO');
    const idxRol     = headers.indexOf('ROL');
    const idxEmail   = headers.indexOf('EMAIL');
    const idxActivo  = headers.indexOf('ACTIVO');

    const personal = [];
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const esActivo = (row[idxActivo] === true || String(row[idxActivo]).toUpperCase().trim() === 'TRUE');
      if (!esActivo) continue;
      const nombre = String(row[idxNombre] || '').trim();
      if (!nombre) continue;
      personal.push({
        idPersonal : row[idxId]    || '',
        nombre     : nombre,
        rol        : String(row[idxRol]   || '').trim(),
        email      : String(row[idxEmail] || '').trim()
      });
    }
    Logger.log('getPersonalActivo: ' + personal.length + ' técnicos activos encontrados.');
    return personal;
  } catch (e) {
    Logger.log('Error en getPersonalActivo: ' + e);
    return [];
  }
}

function calcularEvaluacionSemanalTecnico(nombreTecnico, fechaInicio, fechaFin) {
  // ── Leer Bitácora ──────────────────────────────────────────────
  const ss    = SpreadsheetApp.openById(SHEET_EVALUACION_ID);
  const sheet = ss.getSheetByName('Bitácora');
  if (!sheet) throw new Error('No se encontró la hoja Bitácora');

  const raw     = sheet.getDataRange().getDisplayValues();
  const headers = raw[0].map(h => h.toUpperCase().trim());
  const gIdx    = (name) => headers.indexOf(name.toUpperCase());

  const idxFecha    = gIdx('FECHA');
  const idxNombre   = gIdx('NOMBRE');
  const idxSalida   = gIdx('HORA DE SALIDA');
  const idxEntrada  = gIdx('HORA DE ENTRADA');
  const idxReporte  = gIdx('REPORTE ENV.');
  const idxParadas  = gIdx('TIEMPO DE PARADAS');
  const idxAsist    = gIdx('ASISTENCIA');
  const idxProj     = gIdx('PROYECTO');
  const idxRol      = gIdx('ROL');
  const idxRegresos = gIdx('REGRESOS');

  const normNombre = nombreTecnico.toLowerCase().trim();

  const rows = [];
  for (let i = 1; i < raw.length; i++) {
    const row = raw[i];
    const nombre = String(row[idxNombre] || '').toLowerCase().trim();
    if (!nombre || nombre !== normNombre) continue;

    const fechaRaw = row[idxFecha];
    if (!fechaRaw) continue;
    const fechaISO = formatDateToISO(fechaRaw);
    if (!fechaISO) continue;

    // Filtrar rango
    const d = new Date(fechaISO + 'T12:00:00');
    if (d < fechaInicio || d > fechaFin) continue;

    const asistencia = String(row[idxAsist] || 'NORMAL').toUpperCase().trim();
    const reporte    = String(row[idxReporte] || '').toUpperCase().trim();
    const numRegresos = idxRegresos !== -1 ? (Number(row[idxRegresos]) || 0) : 0;

    rows.push({
      fecha      : fechaISO,
      proyecto   : String(row[idxProj] || '').trim(),
      rol        : String(row[idxRol]  || '').trim(),
      horaSalida : String(row[idxSalida] || '').trim(),
      horaEntrada: String(row[idxEntrada] || '').trim(),
      reporte    : reporte || 'NA',
      asistencia : asistencia,
      tiempoParadas: String(row[idxParadas] || '').trim(),
      regresos   : numRegresos
    });
  }

  // ── Helpers de conversión y cálculo ────────────────────────────
  const timeToMinutes = (timeStr) => {
    if (!timeStr || typeof timeStr !== 'string' || timeStr === '00:00') return 0;
    try {
      const parts = timeStr.split(':');
      const h = parseInt(parts[0], 10);
      const m = parseInt(parts[1] || '0', 10);
      return (h || 0) * 60 + (m || 0);
    } catch (e) {
      return 0;
    }
  };

  const calcSalidaScore = (hora) => {
    const min = timeToMinutes(hora);
    if (min === 0) return null;
    const lim1 = timeToMinutes('08:20'); // 500
    const lim2 = timeToMinutes('08:30'); // 510
    if (min <= lim1) return 10;
    if (min > lim2) return 0;
    return Math.max(0, 10 - ((min - lim1) * 0.5)); // Baja 0.5 pts por min
  };

  const calcEntradaScore = (hora) => {
    const min = timeToMinutes(hora);
    if (min === 0) return null;
    const opt = timeToMinutes('17:50'); // 1070
    const lim = timeToMinutes('17:40'); // 1060
    if (min >= opt) return 10;
    if (min < lim) return 0;
    return Math.max(0, 10 - ((opt - min) * 0.5)); // Baja 0.5 pts por min
  };

  const calcReportesScore = (repsList) => {
    let val = 0, sum = 0;
    repsList.forEach(r => {
      if (!r || r === 'NA') return;
      val++;
      const t = r.toUpperCase().trim();
      if (t === 'SI') sum += 1;
      else if (t === 'FT' || t === 'FF' || t === 'FT FF') sum += 0.5;
    });
    return val === 0 ? 10 : sum * (10 / val);
  };

  // ── Cálculos Globales Semanales ─────────────────────────────
  let sal = 0, salC = 0, ent = 0, entC = 0, par = 0, reg = 0, ret = 0, fal = 0;
  const reps = [];

  rows.forEach(r => {
    const sS = calcSalidaScore(r.horaSalida);
    if (sS !== null) { sal += sS; salC++; }
    const sE = calcEntradaScore(r.horaEntrada);
    if (sE !== null) { ent += sE; entC++; }
    reps.push(r.reporte);
    const isAusencia = ['VACACIONES', 'PERMISO', 'INCAPACIDAD'].includes(r.asistencia);
    if (!isAusencia) { par += timeToMinutes(r.tiempoParadas); }
    reg += r.regresos;
    if (r.asistencia === 'RETARDO') ret++;
    if (r.asistencia === 'FALTA') fal++;
  });

  const promAM = salC > 0 ? sal / salC : 10;
  const promPM = entC > 0 ? ent / entC : 10;
  const promRep = calcReportesScore(reps);
  const promPar = par > 10 ? 0 : 10;
  const penalizacion = (reg * 0.5) + (ret * 0.5) + (fal * 1.0);
  const promFinal = Math.max(0, (promAM * 0.25 + promPM * 0.25 + promRep * 0.40 + promPar * 0.10) - penalizacion);

  const diasObra = [...new Set(rows.filter(r => 
    r.asistencia !== 'FALTA' && 
    r.asistencia !== 'VACACIONES' && 
    r.asistencia !== 'PERMISO' && 
    r.asistencia !== 'INCAPACIDAD'
  ).map(r => r.fecha))].length;

  const diasTotales = [...new Set(rows.map(r => r.fecha))].length;
  const reportesSI  = rows.filter(r => r.reporte === 'SI').length;
  const reportesFT  = rows.filter(r => r.reporte === 'FT' || r.reporte === 'FF').length;
  const reportesNO  = rows.filter(r => r.reporte === 'NO').length;
  const reportesNA  = rows.filter(r => r.reporte === 'NA').length;

  const formatFechaLegible = (iso) => {
    if (!iso) return '—';
    const [y, m, d] = iso.split('-');
    const meses = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
    return `${d} ${meses[parseInt(m,10)-1]} ${y}`;
  };

  const iniStr = formatFechaLegible(formatDateToISO(fechaInicio));
  const finStr = formatFechaLegible(formatDateToISO(fechaFin));
  const pad = (str, len) => String(str || '').substring(0, len).padEnd(len, ' ');
  const separador = '─'.repeat(85);

  let tablaDetalle = `${pad('FECHA', 12)} | ${pad('PROYECTO', 20)} | ${pad('SALIDA', 6)} | ${pad('ENTRADA', 7)} | ${pad('REP', 5)} | ${pad('PAR', 5)} | ${pad('REG', 3)} | ${pad('RET', 3)} | ${pad('FAL', 3)} | ${pad('FINAL', 5)}\n`;
  tablaDetalle += separador + '\n';
  rows.forEach(r => {
    const isFalta = r.asistencia === 'FALTA';
    const isRetardo = r.asistencia === 'RETARDO';
    const isAusencia = ['VACACIONES', 'PERMISO', 'INCAPACIDAD'].includes(r.asistencia);
    let amVal = calcSalidaScore(r.horaSalida), pmVal = calcEntradaScore(r.horaEntrada), repVal = calcReportesScore([r.reporte]), parMins = timeToMinutes(r.tiempoParadas), parVal = parMins > 10 ? 0 : 10;
    let dailyFinal = isFalta ? 0 : isAusencia ? 10 : Math.max(0, ((amVal !== null ? amVal : 10)*0.25 + (pmVal !== null ? pmVal : 10)*0.25 + (repVal !== null ? repVal : 10)*0.4 + parVal*0.1) - ((r.regresos * 0.5) + (isRetardo ? 0.5 : 0)));
    tablaDetalle += `${pad(r.fecha, 12)} | ${pad(r.proyecto, 20)} | ${pad(r.horaSalida || '—', 6)} | ${pad(r.horaEntrada || '—', 7)} | ${pad(r.reporte, 5)} | ${pad(parMins + 'm', 5)} | ${pad(r.regresos, 3)} | ${pad(isRetardo?1:0, 3)} | ${pad(isFalta?1:0, 3)} | ${pad(dailyFinal.toFixed(2), 5)} ${isFalta ? 'FALTA' : isRetardo ? 'RET' : isAusencia ? r.asistencia : ''}\n`;
  });

  let textoResumen = `REPORTE SEMANAL DE DESEMPEÑO - SMARTCORP\nTécnico: ${nombreTecnico}\nSemana: ${iniStr} al ${finStr}\n\n1. DESEMPEÑO GENERAL\n${separador}\n   * Nota Promedio Final: ${promFinal.toFixed(2)} / 10\n   * Días en Obra: ${diasObra} / ${diasTotales}\n\n2. REPORTES\n   - SI: ${reportesSI}, FT/FF: ${reportesFT}, NO: ${reportesNO}, NA: ${reportesNA}\n\n3. KPIs\n   * AM: ${promAM.toFixed(2)}, PM: ${promPM.toFixed(2)}, REP: ${promRep.toFixed(2)}, PAR: ${promPar.toFixed(2)}\n\n4. INCIDENCIAS\n   * Faltas: ${fal}, Retardos: ${ret}, Regresos: ${reg}, Pen: -${penalizacion.toFixed(2)}\n\n5. DETALLE\n${tablaDetalle}`;

  const filasTabla = rows.map(r => {
    const isFalta = r.asistencia === 'FALTA', isRetardo = r.asistencia === 'RETARDO', isAusencia = ['VACACIONES', 'PERMISO', 'INCAPACIDAD'].includes(r.asistencia);
    let amVal = calcSalidaScore(r.horaSalida), pmVal = calcEntradaScore(r.horaEntrada), repVal = calcReportesScore([r.reporte]), parMins = timeToMinutes(r.tiempoParadas), parVal = parMins > 10 ? 0 : 10;
    let dailyFinal = isFalta ? 0 : isAusencia ? 10 : Math.max(0, ((amVal !== null ? amVal : 10)*0.25 + (pmVal !== null ? pmVal : 10)*0.25 + (repVal !== null ? repVal : 10)*0.4 + parVal*0.1) - ((r.regresos * 0.5) + (isRetardo ? 0.5 : 0)));
    return `<tr style="background:${isFalta?'#fee2e2':isAusencia?'#f8fafc':dailyFinal>=8?'#d1fae5':'#fef9c3'}"><td>${r.fecha}</td><td>${r.proyecto||'—'}</td><td>${r.horaSalida||'—'}</td><td>${r.horaEntrada||'—'}</td><td>${isFalta?'FALTA':isAusencia?r.asistencia:'OK'}</td><td>${r.reporte}</td><td>${amVal!==null?amVal.toFixed(1):'—'}</td><td>${pmVal!==null?pmVal.toFixed(1):'—'}</td><td>${parMins}m</td><td>${r.regresos}</td><td>${dailyFinal.toFixed(2)}</td></tr>`;
  }).join('');

  const colorProm = promFinal >= 8 ? '#16a34a' : promFinal >= 6 ? '#d97706' : '#dc2626';

  const htmlPDF = `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8">
<style>
  body{font-family:Arial,sans-serif;margin:20px;color:#1e293b;font-size:13px}
  h1{color:#4f46e5;font-size:17px;margin-bottom:2px}
  .sub{color:#64748b;font-size:11px;margin-bottom:14px}
  .kpi-row{display:flex;gap:10px;margin-bottom:14px;flex-wrap:wrap}
  .kpi{background:#f1f5f9;border-radius:8px;padding:8px 14px;min-width:100px;text-align:center}
  .kpi label{display:block;font-size:9px;color:#64748b;font-weight:bold;text-transform:uppercase;margin-bottom:3px}
  .kpi .val{font-size:18px;font-weight:900;color:#1e293b}
  .ok{color:#16a34a} .warn{color:#d97706} .bad{color:#dc2626}
  h2{font-size:13px;color:#4f46e5;margin:14px 0 6px;border-bottom:2px solid #e0e7ff;padding-bottom:4px}
  table{width:100%;border-collapse:collapse;font-size:11px;margin-bottom:14px}
  thead tr{background:#4f46e5;color:white}
  thead th{padding:6px;border:1px solid #4338ca;text-align:center;font-size:10px}
  tbody td{padding:5px;border:1px solid #cbd5e1;text-align:center}
  .inc-row{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:14px}
  .inc{border-radius:8px;padding:8px 14px;min-width:140px;font-size:12px}
  .inc strong{display:block;font-size:16px;font-weight:900;margin-bottom:2px}
  .inc span{font-size:10px;color:#64748b}
  .formula{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px;font-size:10px;color:#64748b;margin-bottom:14px}
  .footer{margin-top:12px;font-size:9px;color:#94a3b8;text-align:center;border-top:1px solid #e2e8f0;padding-top:8px}
</style>
</head>
<body>
  <h1>Reporte Semanal de Desempeño</h1>
  <p class="sub">Técnico: <strong>${nombreTecnico}</strong> &nbsp;|&nbsp; Semana: ${iniStr} al ${finStr} &nbsp;|&nbsp; Generado: ${new Date().toLocaleString('es-MX')}</p>

  <h2>1. Resumen General</h2>
  <div class="kpi-row">
    <div class="kpi"><label>Nota Final</label><span class="val" style="color:${colorProm}">${promFinal.toFixed(2)}</span></div>
    <div class="kpi"><label>Días Obra</label><span class="val">${diasObra} / ${diasTotales}</span></div>
    <div class="kpi"><label>Nota AM</label><span class="val">${promAM.toFixed(1)}</span></div>
    <div class="kpi"><label>Nota PM</label><span class="val">${promPM.toFixed(1)}</span></div>
    <div class="kpi"><label>Nota Rep.</label><span class="val">${promRep.toFixed(1)}</span></div>
    <div class="kpi"><label>Nota Par.</label><span class="val">${promPar.toFixed(1)}</span></div>
  </div>

  <h2>2. Reportes Enviados</h2>
  <div class="kpi-row">
    <div class="kpi"><label>SI (a tiempo)</label><span class="val ok">${reportesSI}</span></div>
    <div class="kpi"><label>FT/FF (tarde)</label><span class="val warn">${reportesFT}</span></div>
    <div class="kpi"><label>NO (sin rep.)</label><span class="val ${reportesNO>0?'bad':'ok'}">${reportesNO}</span></div>
    <div class="kpi"><label>NA (no aplica)</label><span class="val">${reportesNA}</span></div>
  </div>

  <h2>3. Incidencias Operativas</h2>
  <div class="inc-row">
    <div class="inc" style="background:${fal>0?'#fee2e2':'#f0fdf4'};border:1px solid ${fal>0?'#fca5a5':'#bbf7d0'}">
      <strong class="${fal>0?'bad':'ok'}">${fal}</strong>
      <span>Faltas &nbsp;(−${(fal*1.0).toFixed(1)} pts)</span>
    </div>
    <div class="inc" style="background:${ret>0?'#fef9c3':'#f0fdf4'};border:1px solid ${ret>0?'#fde047':'#bbf7d0'}">
      <strong class="${ret>0?'warn':'ok'}">${ret}</strong>
      <span>Retardos &nbsp;(−${(ret*0.5).toFixed(1)} pts)</span>
    </div>
    <div class="inc" style="background:${reg>0?'#fff1f0':'#f0fdf4'};border:1px solid ${reg>0?'#fca5a5':'#bbf7d0'}">
      <strong class="${reg>0?'bad':'ok'}">${reg}</strong>
      <span>Regresos &nbsp;(−${(reg*0.5).toFixed(1)} pts)</span>
    </div>
    <div class="inc" style="background:#f1f5f9;border:1px solid #cbd5e1">
      <strong style="color:#dc2626">−${penalizacion.toFixed(2)}</strong>
      <span>Penalización Total</span>
    </div>
  </div>

  <div class="formula">
    <strong>Fórmula de calificación:</strong> Nota Final = (AM×0.25 + PM×0.25 + Reportes×0.40 + Paradas×0.10) − (Faltas×1.0 + Retardos×0.5 + Regresos×0.5)<br>
    Objetivos de puntualidad: Salida AM (Oficina a Obra) &le; 08:20 AM | Entrada PM (Regreso a Oficina) &ge; 05:50 PM (17:50)
  </div>

  <h2>4. Detalle por Día</h2>
  <table>
    <thead><tr>
      <th>Fecha</th><th>Proyecto</th><th>Sal. AM (Obj &le; 08:20)</th><th>Ent. PM (Obj &ge; 17:50)</th>
      <th>Asistencia</th><th>Reporte</th><th>AM</th><th>PM</th><th>Par.</th><th>Reg.</th><th>Final</th>
    </tr></thead>
    <tbody>${filasTabla || '<tr><td colspan="11" style="text-align:center;padding:16px;color:#94a3b8">Sin registros en esta semana</td></tr>'}</tbody>
  </table>

  <div class="footer">
    Generado automáticamente · Sistema de Gestión Integral SMARTCORP · ${new Date().toLocaleString('es-MX')}
  </div>
</body>
</html>`;

  return { rows, kpi: { diasTotales: diasObra, promFinal, promAM, promPM, promRep, promPar, reportesSI, reportesFT, reportesNO, reportesNA, faltas: fal, retardos: ret, regresos: reg, penalizacion }, textoResumen, htmlPDF };
}

/**
 *
 * @param {string} modo  'prueba' → todos los correos van a gerardovg@smartcorp.com.mx
 *                       'todos'  → cada técnico recibe su correo en su email registrado
 */
function enviarReporteSemanalIndividual(modo) {
  try {
    const hoy = new Date();
    const diaSemana = hoy.getDay();
    const diasDesdeUltimoLunes = diaSemana === 0 ? 6 : diaSemana - 1;
    const lunesPasado = new Date(hoy);
    lunesPasado.setDate(hoy.getDate() - diasDesdeUltimoLunes - 7);
    lunesPasado.setHours(0, 0, 0, 0);

    const domingoPasado = new Date(lunesPasado);
    domingoPasado.setDate(lunesPasado.getDate() + 6);
    domingoPasado.setHours(23, 59, 59, 999);

    Logger.log('Semana a evaluar: ' + lunesPasado.toDateString() + ' → ' + domingoPasado.toDateString());

    const personal = getPersonalActivo();
    if (personal.length === 0) {
      Logger.log('enviarReporteSemanal: No se encontraron técnicos activos.');
      return;
    }

    const targets = (modo === 'prueba') ? [personal[0]] : personal;
    const emailPrueba = 'gerardovg@smartcorp.com.mx';

    let enviados = 0, errores = 0;

    targets.forEach(tecnico => {
      try {
        const { kpi, textoResumen, htmlPDF } = calcularEvaluacionSemanalTecnico(
          tecnico.nombre, lunesPasado, domingoPasado
        );

        const blob = Utilities.newBlob(htmlPDF, 'text/html', 'reporte.html').getAs('application/pdf');
        blob.setName('Reporte_Semana_' + tecnico.nombre.replace(/\s+/g, '_') + '.pdf');

        const destinatario = (modo === 'prueba') ? emailPrueba : tecnico.email;
        if (!destinatario || !destinatario.includes('@')) {
          Logger.log('Correo inválido para ' + tecnico.nombre + ': ' + destinatario);
          errores++;
          return;
        }

        const fmtFecha = (d) => d.getDate() + '/' + (d.getMonth()+1) + '/' + d.getFullYear();
        const asunto = `Reporte Semanal de Desempeño - ${fmtFecha(lunesPasado)} al ${fmtFecha(domingoPasado)}`;
        const encabezadoNombre = (modo === 'prueba') ? '(PRUEBA) Técnico: ' + tecnico.nombre : '';

        GmailApp.sendEmail(
          destinatario,
          asunto,
          encabezadoNombre + '\n\n' + textoResumen,
          {
            name        : 'Sistema SMARTCORP - Reporte Automático',
            htmlBody    : (modo === 'prueba' ? `<p style="background:#fef9c3;padding:8px;border-radius:6px"><strong>[PRUEBA]</strong> - Este correo corresponde a: <strong>${tecnico.nombre}</strong></p>` : '') + htmlPDF,
            attachments : [blob]
          }
        );

        Logger.log('✅ Correo enviado a ' + destinatario + ' para ' + tecnico.nombre);
        enviados++;

      } catch (eInner) {
        Logger.log('❌ Error procesando técnico ' + tecnico.nombre + ': ' + eInner);
        errores++;
      }
    });

    Logger.log('Resumen envío: ' + enviados + ' enviados, ' + errores + ' errores. Modo: ' + modo);

    try {
      const ui = SpreadsheetApp.getUi();
      ui.alert('✅ Envío Completado',
        `📧 Modo: ${modo === 'prueba' ? 'PRUEBA (→ gerardovg@smartcorp.com.mx)' : 'PRODUCCIÓN'}\n` +
        `✅ Correos enviados : ${enviados}\n` +
        `❌ Errores          : ${errores}\n` +
        `📅 Semana evaluada  : ${lunesPasado.toDateString()} → ${domingoPasado.toDateString()}`,
        ui.ButtonSet.OK);
    } catch(e) {}

  } catch (e) {
    Logger.log('Error crítico en enviarReporteSemanalIndividual: ' + e + '\n' + e.stack);
  }
}

/**
 * Función ejecutada automáticamente por el trigger cada lunes a las 11 AM.
 * NO modificar el nombre de esta función.
 * Actualmente PAUSADA a solicitud del usuario.
 */
function ejecutarEnvioSemanal() {
  Logger.log('⏸️ Envío semanal automático PAUSADO. No se enviaron correos.');
  // enviarReporteSemanalIndividual('todos');
}

/**
 * Elimina los triggers automáticos del proyecto para pausar el envío semanal.
 */
function pausarTriggerSemanal() {
  let count = 0;
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === 'ejecutarEnvioSemanal') {
      ScriptApp.deleteTrigger(t);
      count++;
    }
  });

  Logger.log('⏸️ Trigger semanal pausado. Disparadores eliminados: ' + count);

  try {
    const ui = SpreadsheetApp.getUi();
    ui.alert('⏸️ Envío Automático Pausado',
      'Se han desactivado los envíos automáticos de los lunes a las 11:00 AM.\n\n' +
      'El sistema está en PAUSA hasta nuevo aviso.',
      ui.ButtonSet.OK);
  } catch(e) {}
}

/**
 * Crea (o recrea) el trigger semanal de lunes a las 11 AM.
 * Ejecutar UNA SOLA VEZ desde el editor de Apps Script o desde el menú.
 */
function crearTriggerSemanal() {
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === 'ejecutarEnvioSemanal') {
      ScriptApp.deleteTrigger(t);
    }
  });

  ScriptApp.newTrigger('ejecutarEnvioSemanal')
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.MONDAY)
    .atHour(11)
    .create();

  Logger.log('✅ Trigger semanal creado: Lunes a las 11 AM.');

  try {
    const ui = SpreadsheetApp.getUi();
    ui.alert('✅ Trigger Creado',
      'El sistema enviará automáticamente los reportes de desempeño\ncada LUNES a las 11:00 AM.\n\n' +
      'Puedes verificarlo en: Apps Script → Triggers (ícono ⏰)',
      ui.ButtonSet.OK);
  } catch(e) {}
}

/**
 * Función puente sin parámetros para el menú del Spreadsheet (Prueba 1 técnico).
 */
function lanzarReportePrueba() {
  enviarReporteSemanalIndividual('prueba');
}

/**
 * Ejecuta una prueba especial para la semana del 6 al 12 de Julio de 2026.
 * Toma los primeros 5 técnicos activos y les envía su evaluación
 * a gerardovg@smartcorp.com.mx para auditoría visual.
 */
function lanzarPruebaJulio() {
  try {
    // Rango solicitado: 6 de Julio de 2026 al 12 de Julio de 2026
    const fechaInicio = new Date('2026-07-06T00:00:00');
    const fechaFin = new Date('2026-07-12T23:59:59');

    const personal = getPersonalActivo();
    if (personal.length === 0) {
      throw new Error('No se encontraron técnicos activos en DB_PERSONAL.');
    }

    // Tomar máximo 5 técnicos para no saturar la casilla de correos
    const targets = personal.slice(0, 5);
    const emailDestinatario = 'gerardovg@smartcorp.com.mx';

    let enviados = 0, errores = 0;
    let nombresEnviados = [];

    targets.forEach(tecnico => {
      try {
        const { kpi, textoResumen, htmlPDF } = calcularEvaluacionSemanalTecnico(
          tecnico.nombre, fechaInicio, fechaFin
        );

        // Generar el blob PDF
        const blob = Utilities.newBlob(htmlPDF, 'text/html', 'reporte.html').getAs('application/pdf');
        blob.setName(`Prueba_Julio_${tecnico.nombre.replace(/\s+/g, '_')}.pdf`);

        const asunto = `[PRUEBA 6-12 JUL] Reporte Desempeño - ${tecnico.nombre}`;

        GmailApp.sendEmail(
          emailDestinatario,
          asunto,
          `[ALERTA] MODO PRUEBA HISTÓRICO (Semana 6 al 12 de Julio 2026)\n` +
          `Este reporte corresponde a: ${tecnico.nombre}\n\n` +
          textoResumen,
          {
            name        : 'SMARTCORP - Auditoría Histórica (Prueba)',
            htmlBody    : `<p style="background:#dbeafe;padding:8px;border-radius:6px;border:1px solid #bfdbfe;color:#1e3a8a"><strong>[PRUEBA DE EVALUACIÓN HISTÓRICA]</strong><br>Semana evaluada: <strong>06/Jul/2026 al 12/Jul/2026</strong><br>Técnico: <strong>${tecnico.nombre}</strong></p>` + htmlPDF,
            attachments : [blob]
          }
        );

        nombresEnviados.push(tecnico.nombre);
        enviados++;
      } catch (err) {
        Logger.log(`Error enviando prueba para ${tecnico.nombre}: ${err}`);
        errores++;
      }
    });

    try {
      const ui = SpreadsheetApp.getUi();
      ui.alert('🔬 Prueba de Julio Enviada',
        `📧 Destinatario: ${emailDestinatario}\n` +
        `✅ Correos enviados: ${enviados}\n` +
        `❌ Errores: ${errores}\n\n` +
        `Técnicos evaluados:\n• ` + nombresEnviados.join('\n• '),
        ui.ButtonSet.OK);
    } catch(e) {}

  } catch (e) {
    Logger.log('Error en lanzarPruebaJulio: ' + e);
    try {
      SpreadsheetApp.getUi().alert('❌ Error al procesar', e.toString(), SpreadsheetApp.getUi().ButtonSet.OK);
    } catch(e2) {}
  }
}