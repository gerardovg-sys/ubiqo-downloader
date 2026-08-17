function dumpJulyData() {
  const SHEET_EVALUACION_ID = '18GFvQZdpmALvmmTFc70dXENJxImMR3bkHU04IG_UyyY';
  const ss = SpreadsheetApp.openById(SHEET_EVALUACION_ID);
  const sheet = ss.getSheetByName('Bitácora');
  if (!sheet) return;
  const data = sheet.getDataRange().getDisplayValues();
  const headers = data[0].map(h => h.toUpperCase().trim());
  const gIdx = (name) => headers.indexOf(name.toUpperCase());
  
  const idxFecha = gIdx('FECHA');
  const idxNombre = gIdx('NOMBRE');
  const idxProj = gIdx('PROYECTO');
  const idxSalida = gIdx('HORA DE SALIDA');
  const idxEntrada = gIdx('HORA DE ENTRADA');
  const idxReporte = gIdx('REPORTE ENV.');
  const idxAsist = gIdx('ASISTENCIA');
  const idxParadas = gIdx('TIEMPO DE PARADAS');
  const idxRegresos = gIdx('REGRESOS');
  
  const targets = [
    'Ricardo Gabriel González',
    'Daniela Suzzette Montes Ruiz',
    'Luis Rodríguez Martínez',
    'Alejandro Hernández Ferrusca',
    'Fernando Daniel Tornez Perea'
  ].map(t => t.toLowerCase().trim());
  
  const fechaInicio = new Date('2026-07-06T00:00:00');
  const fechaFin = new Date('2026-07-12T23:59:59');
  
  const results = [];
  
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const nombre = String(row[idxNombre] || '').toLowerCase().trim();
    if (!targets.includes(nombre)) continue;
    
    // Parse fecha
    const fechaRaw = row[idxFecha];
    if (!fechaRaw) continue;
    const parts = fechaRaw.split('/');
    let d;
    if (parts.length === 3) {
      d = new Date(`${parts[2]}-${parts[1]}-${parts[0]}T12:00:00`);
    } else {
      d = new Date(fechaRaw.split(' ')[0] + 'T12:00:00');
    }
    
    if (d >= fechaInicio && d <= fechaFin) {
      results.push({
        fila: i + 1,
        fecha: fechaRaw,
        nombre: row[idxNombre],
        proyecto: row[idxProj],
        salida: row[idxSalida],
        entrada: row[idxEntrada],
        reporte: row[idxReporte],
        asistencia: row[idxAsist],
        paradas: row[idxParadas],
        regresos: row[idxRegresos]
      });
    }
  }
  
  // Write to sheet
  const targetSheetName = "DEBUG_JULIO";
  let targetSheet = ss.getSheetByName(targetSheetName);
  if (!targetSheet) {
    targetSheet = ss.insertSheet(targetSheetName);
  } else {
    targetSheet.clear();
  }
  
  const outHeaders = ["Fila", "Fecha", "Nombre", "Proyecto", "Salida", "Entrada", "Reporte", "Asistencia", "Paradas", "Regresos"];
  targetSheet.appendRow(outHeaders);
  
  const outRows = results.map(r => [
    r.fila, r.fecha, r.nombre, r.proyecto, r.salida, r.entrada, r.reporte, r.asistencia, r.paradas, r.regresos
  ]);
  
  if (outRows.length > 0) {
    targetSheet.getRange(2, 1, outRows.length, outHeaders.length).setValues(outRows);
  }
  
  try {
    SpreadsheetApp.getUi().alert('✅ Datos volcados', 'Se creó/actualizó la pestaña DEBUG_JULIO con los datos reales de la semana del 6 al 12 de Julio.', SpreadsheetApp.getUi().ButtonSet.OK);
  } catch(e) {}
}
