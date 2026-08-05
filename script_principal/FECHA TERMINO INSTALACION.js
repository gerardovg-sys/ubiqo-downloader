/**
 * Automatically fills "FECHA TERMINO INSTALACION" based on Bitácora dates
 * for specific subjects and project status conditions.
 */
function updateProjectCompletionDates() {
  const ssId = "18GFvQZdpmALvmmTFc70dXENJxImMR3bkHU04IG_UyyY";
  const ss = SpreadsheetApp.openById(ssId);
  
  // 1. Get data from sheets
  const sheetProjects = ss.getSheetByName("BD Proyectos Maestro");
  const sheetBitacora = ss.getSheetByName("Bitácora");
  
  const projectsData = sheetProjects.getDataRange().getValues();
  const bitacoraData = sheetBitacora.getDataRange().getValues();
  
  const pHeaders = projectsData[0];
  const bHeaders = bitacoraData[0];

  // 2. Identify Column Indices (0-based)
  const idxP_Project = pHeaders.indexOf("PROYECTOS");
  const idxP_Status = pHeaders.indexOf("Estado");
  const idxP_Termino = pHeaders.indexOf("FECHA TERMINO INSTALACION");
  
  const idxB_Project = bHeaders.indexOf("PROYECTO");
  const idxB_Date = bHeaders.indexOf("FECHA");
  const idxB_Asunto = bHeaders.indexOf("ASUNTO");

  // Error handling if headers are missing
  if ([idxP_Project, idxP_Status, idxP_Termino, idxB_Project, idxB_Date, idxB_Asunto].includes(-1)) {
    console.error("Error: Required columns not found.");
    return;
  }

  // 3. Create a Map of the latest dates in Bitácora (Filtered by Subject)
  const latestDatesMap = {};
  
  for (let i = 1; i < bitacoraData.length; i++) {
    const row = bitacoraData[i];
    const projectName = row[idxB_Project];
    const rawDate = row[idxB_Date];
    const asunto = row[idxB_Asunto];
    
    // Condition: Only "Proyecto instalación" or "Levantamiento"
    const isValidAsunto = (asunto === "Proyecto instalación" || asunto === "Levantamiento");

    if (projectName && rawDate instanceof Date && isValidAsunto) {
      if (!latestDatesMap[projectName] || rawDate > latestDatesMap[projectName]) {
        latestDatesMap[projectName] = rawDate;
      }
    }
  }

  // 4. Determine which rows in "BD Proyectos Maestro" need updating
  const updateValues = [];
  let changesFound = 0;

  for (let j = 1; j < projectsData.length; j++) {
    const row = projectsData[j];
    const status = row[idxP_Status];
    const existingDate = row[idxP_Termino];
    const projectName = row[idxP_Project];
    
    const isStatusMatch = (status === "12. Terminado" || status === "10. Listo para entregar");
    const isDateEmpty = (existingDate === "" || existingDate === null || existingDate === undefined);

    if (isStatusMatch && isDateEmpty && latestDatesMap[projectName]) {
      updateValues.push([latestDatesMap[projectName]]);
      changesFound++;
    } else {
      updateValues.push([existingDate]);
    }
  }

  // 5. Write back and Notify via log
  if (changesFound > 0) {
    sheetProjects.getRange(2, idxP_Termino + 1, updateValues.length, 1).setValues(updateValues);
    console.log(`Success: Updated ${changesFound} dates.`);
  } else {
    console.log("No updates needed.");
  }
}