/**
 * Optimized Sync: Only writes to rows that actually changed.
 */
function syncProjectMetrics() {
  const PROJ_SS_ID = "18GFvQZdpmALvmmTFc70dXENJxImMR3bkHU04IG_UyyY";
  const VERI_SS_ID = "17MFxiKLrC8fm3nOFHh_qM3WW9ojqelqpYitMZhPZl6o";
  
  console.info("Starting optimized sync...");
  
  const projSs = SpreadsheetApp.openById(PROJ_SS_ID);
  const veriSs = SpreadsheetApp.openById(VERI_SS_ID);
  const projSheet = projSs.getSheetByName("BD Proyectos Maestro");
  const veriSheet = veriSs.getSheetByName("Verificación");

  // 1. Load Verification Data (In-memory is fast)
  const veriData = veriSheet.getDataRange().getValues();
  const veriHeaders = veriData.shift();
  const vIdx = getHeaderMap(veriHeaders, "Verificación");
  
  const totalsMap = {};
  veriData.forEach((row) => {
    const id = String(row[vIdx["Proyecto_ID"]]).trim();
    if (!id || id === "undefined") return;
    const meters = parseFloat(row[vIdx["Metros_Cable"]]) || 0;
    if (!totalsMap[id]) totalsMap[id] = { count: 0, meters: 0 };
    totalsMap[id].count++;
    totalsMap[id].meters += meters;
  });

  // 2. Load Project Data
  const projRange = projSheet.getDataRange();
  const projData = projRange.getValues();
  const projHeaders = projData.shift();
  const pIdx = getHeaderMap(projHeaders, "BD Proyectos Maestro");

  let updatedRowsCount = 0;

  // 3. Identify ONLY rows that need changes
  // We iterate through the sheet data but we don't write it all back.
  projData.forEach((row, index) => {
    const sapId = String(row[pIdx["SAP"]]).trim();
    const currentStatus = String(row[pIdx["Escaneo nodos"]]).trim();
    
    // Only check eligible projects that have data in Verification
    if ((currentStatus === "Pendiente" || currentStatus === "Comenzado") && totalsMap[sapId]) {
      
      const newNodos = totalsMap[sapId].count;
      const newMetros = totalsMap[sapId].meters;
      const oldNodos = parseFloat(row[pIdx["NodosEscaneados"]]) || 0;
      const oldMetros = parseFloat(row[pIdx["MetrosEscaneados"]]) || 0;

      // Check if values actually differ to avoid unnecessary writing
      if (newNodos !== oldNodos || newMetros !== oldMetros) {
        const rowNumber = index + 2; // +1 for header, +1 for 0-based index
        
        // Update status if jumping from 0
        if (oldNodos === 0 && newNodos > 0 && currentStatus === "Pendiente") {
          projSheet.getRange(rowNumber, pIdx["Escaneo nodos"] + 1).setValue("Comenzado");
        }

        // Update the counts specifically for this row
        projSheet.getRange(rowNumber, pIdx["NodosEscaneados"] + 1).setValue(newNodos);
        projSheet.getRange(rowNumber, pIdx["MetrosEscaneados"] + 1).setValue(newMetros);
        
        updatedRowsCount++;
        if (updatedRowsCount % 10 === 0) console.log(`Updated ${updatedRowsCount} rows so far...`);
      }
    }
  });

  console.info(`Sync Finished. Total rows modified: ${updatedRowsCount}`);
}

function getHeaderMap(headers, sheetName) {
  const map = {};
  headers.forEach((h, i) => { if (h) map[h.toString().trim()] = i; });
  const expected = sheetName === "Verificación" 
    ? ["Proyecto_ID", "Metros_Cable"] 
    : ["SAP", "Escaneo nodos", "NodosEscaneados", "MetrosEscaneados"];
  expected.forEach(key => {
    if (map[key] === undefined) throw new Error(`Missing Header: ${key}`);
  });
  return map;
}