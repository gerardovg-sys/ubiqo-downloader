function evaluateProjects() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // Get the necessary sheets
  const resultadosEvSheet = ss.getSheetByName("Resultados ev.");
  const bdProyectosMaestroSheet = ss.getSheetByName("BD Proyectos Maestro");
  const bitacoraSheet = ss.getSheetByName("Bitácora");
  
  // Get data from each sheet
  const resultadosEvData = resultadosEvSheet.getDataRange().getValues();
  const bdMaestroData = bdProyectosMaestroSheet.getDataRange().getValues();
  const bitacoraData = bitacoraSheet.getDataRange().getValues();
  
  // Loop through each project in "Resultados ev." starting from row 4
  for (let i = 3; i < resultadosEvData.length; i++) {
    const projectName = resultadosEvData[i][0]; // Column A in "Resultados ev."
    const status = resultadosEvData[i][1]; // Column B in "Resultados ev."
    
    // If status is not "Por evaluar", skip to the next project
    if (status !== "Por evaluar") {
      continue;
    }
    
    // Look for the project in "BD Proyectos Maestro" (column C)
    let projectFoundInBDMaestro = false;
    let valueFromBDMaestro = 0;
    
    for (let j = 1; j < bdMaestroData.length; j++) {
      if (bdMaestroData[j][2] === projectName) { // Column C in "BD Proyectos Maestro"
        valueFromBDMaestro = bdMaestroData[j][24]; // Column Y in "BD Proyectos Maestro"
        projectFoundInBDMaestro = true;
        break;
      }
    }
    
    // Paste the value from BD Proyectos Maestro (even if it's empty or zero)
    if (projectFoundInBDMaestro) {
      resultadosEvSheet.getRange(i + 1, 3).setValue(valueFromBDMaestro); // Column C in "Resultados ev."
    } else {
      resultadosEvSheet.getRange(i + 1, 3).setValue("No existe el proyecto en BD Maestro"); // Column C in "Resultados ev."
    }
    
    // Now sum values from "Bitácora" (Column G) for the same project
    let totalSumFromBitacora = 0;
    
    for (let k = 1; k < bitacoraData.length; k++) {
      if (bitacoraData[k][2] === projectName) { // Column C in "Bitácora"
        totalSumFromBitacora += bitacoraData[k][6]; // Column G in "Bitácora"
      }
    }
    
    // Paste the sum in Column D of "Resultados ev."
    resultadosEvSheet.getRange(i + 1, 4).setValue(totalSumFromBitacora); // Column D in "Resultados ev."
  }
}
