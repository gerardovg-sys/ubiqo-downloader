/**
 * Automated XLOOKUP Simulator (Dual Column Version)
 * Trigger: On Edit
 */

function installableOnEdit(e) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const targetSheetName = "BD Proyectos Maestro";
  const sourceSheetName = "Usuarios_AppSheet";
  
  // 1. Get the range and sheet being edited
  const range = e.range;
  const sheet = range.getSheet();
  const row = range.getRow();
  const col = range.getColumn();
  
  // 2. Only run if we are on the correct sheet and NOT the header row
  if (sheet.getName() !== targetSheetName || row < 2) return;

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  
  // Mapping column indexes for "Encargado de proyecto"
  const nameColIndex = headers.indexOf("Encargado de proyecto") + 1;
  const emailColIndex = headers.indexOf("Encargado de proyecto_Correo") + 1;
  
  // Mapping column indexes for "Vendedor"
  const vendedorColIndex = headers.indexOf("Vendedor") + 1;
  const vendedorEmailColIdx = headers.indexOf("Vendedor_Correo") + 1;

  // 3. Determine which column was edited and set the target output column
  let targetEmailCol = null;
  
  if (col === nameColIndex) {
    targetEmailCol = emailColIndex;
  } else if (col === vendedorColIndex) {
    targetEmailCol = vendedorEmailColIdx;
  } else {
    // If neither relevant column was edited, exit
    return;
  }

  const nameToLookup = range.getValue();

  // 4. If the cell was cleared, optional: clear the corresponding email
  if (!nameToLookup) {
    if (targetEmailCol > 0) sheet.getRange(row, targetEmailCol).clearContent();
    return;
  }

  // 5. Access Source Data
  const sourceSheet = ss.getSheetByName(sourceSheetName);
  const sourceData = sourceSheet.getDataRange().getValues();
  const sourceHeaders = sourceData[0];
  
  const srcNameIdx = sourceHeaders.indexOf("Nombre");
  const srcEmailIdx = sourceHeaders.indexOf("Correo_Usuario");

  // 6. Perform the Lookup
  let foundEmail = null;
  for (let i = 1; i < sourceData.length; i++) {
    if (sourceData[i][srcNameIdx] === nameToLookup) {
      foundEmail = sourceData[i][srcEmailIdx];
      break; 
    }
  }

  // 7. Write the result to the specific target column identified in step 3
  if (foundEmail && targetEmailCol > 0) {
    sheet.getRange(row, targetEmailCol).setValue(foundEmail);
  }
}