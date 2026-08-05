// --- CONFIGURACIÓN ---
const SHEET_EVALUACION_ID = '18GFvQZdpmALvmmTFc70dXENJxImMR3bkHU04IG_UyyY'; 
const SHEET_REPORTES_ID = '1QeFcpTbwfMRMLjoN0ghaFPNqm-EDg_1rqeQb-yp568w'; 
const DRIVE_ROOT_ID = '164CF8sASWNBAs7tjv4eMb12_KBBeLpw3'; 

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



function doGet() {
  return HtmlService.createHtmlOutputFromFile('index')
      .setTitle('Sistema de Gestión Integral')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

// 1. EVALUACIÓN (Bitácora)
function getDataBitacora() {
  return fetchData(SHEET_EVALUACION_ID, 'Bitácora', 'EVAL');
}

// 2. REPORTES (Zoho)
function getDataReportes() {
  return fetchData(SHEET_REPORTES_ID, 'Reportes limpios', 'REPO');
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

// 4. IMÁGENES DE REPORTE
function getReportImages(projectName, dateStr) {
  try {
    if (!projectName || !dateStr) return [];
    const root = DriveApp.getFolderById(DRIVE_ROOT_ID);
    const projectFolders = root.getFoldersByName(projectName);
    if (!projectFolders.hasNext()) return [];
    const projectFolder = projectFolders.next();
    
    const reportesFolders = projectFolder.getFoldersByName("Reportes");
    if (!reportesFolders.hasNext()) return [];
    const reportesFolder = reportesFolders.next();
    
    const parts = dateStr.split('-'); 
    const patterns = [
      dateStr,
      `${parts[0]}/${parts[1]}/${parts[2]}`,
      `${parts[2]}.${parts[1]}.${parts[0]}`,
      `${parts[2]}-${parts[1]}-${parts[0]}`,
      `${parts[0]}${parts[1]}${parts[2]}`
    ];
    
    const dayFolders = reportesFolder.getFolders();
    let targetFolder = null;
    while (dayFolders.hasNext()) {
      const f = dayFolders.next();
      const name = f.getName();
      for (let p of patterns) {
        if (name.includes(p)) { targetFolder = f; break; }
      }
      if (targetFolder) break;
    }
    
    if (!targetFolder) return [];
    
    const files = targetFolder.getFiles();
    const images = [];
    let count = 0;
    while (files.hasNext() && count < 12) {
      const file = files.next();
      const mime = file.getMimeType();
      if (mime === MimeType.JPEG || mime === MimeType.PNG) {
        const bytes = file.getBlob().getBytes();
        const base64 = Utilities.base64Encode(bytes);
        images.push(`data:${mime};base64,${base64}`);
        count++;
      }
    }
    return images;
  } catch (e) { return []; }
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

    const mappedData = rawData.map((row, index) => {
      if (type === 'EVAL') {
        if (!row[getIdx('NOMBRE')]) return null;
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
          horaLlegProy: row[getIdx('HORA LLEG PROY')]
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
  if (dateStr.includes('/')) {
    const parts = dateStr.split('/');
    if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
  return dateStr.split(' ')[0];
}