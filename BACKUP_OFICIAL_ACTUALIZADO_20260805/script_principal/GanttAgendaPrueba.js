/**
 * Refines the Gantt Agenda: Removes Row 7, groups Absences at bottom,
 * and matches PC assignment colors to the lime project header.
 */
function createAndFormatGanttAgendaPrueba() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sourceSheet = ss.getSheetByName("Cronograma / Técnicos");
  const targetSheet = ss.getSheetByName("Gantt agenda");
  
  // 1. DATA FETCHING & PREP
  const startDate = targetSheet.getRange("A2").getValue();
  const endDate = targetSheet.getRange("A3").getValue();
  
  if (!(startDate instanceof Date) || !(endDate instanceof Date)) {
    SpreadsheetApp.getUi().alert("Invalid dates in A2 or A3.");
    return;
  }

  // Clear top metrics (Rows 1 and 2, Col C onwards) - clearContent only to preserve conditional formatting
  targetSheet.getRange("C1:ZZ2").clearContent(); 
  
  // Clear Row 5 (Dates and Timestamp)
  targetSheet.getRange("A5:ZZ5").clearContent().clearFormat();

  // Find surgical technician range in source
  const sourceC = sourceSheet.getRange("C15:C").getValues();
  let lastTechIdx = 0;
  for (let i = 0; i < sourceC.length; i++) {
    if (sourceC[i][0] === "") break;
    lastTechIdx = i;
  }
  
  const sourceDates = sourceSheet.getRange(14, 5, 1, sourceSheet.getLastColumn() - 4).getValues()[0];
  const sourceData = sourceSheet.getRange(15, 5, lastTechIdx + 1, sourceDates.length).getValues();

  const filteredDates = [];
  sourceDates.forEach((d, idx) => {
    if (d instanceof Date && d >= startDate && d <= endDate) {
      filteredDates.push({date: d, colIdx: idx});
    }
  });

  const projectCounts = {}; 
  const ausenciaTotal = {}; 
  const projectTechnicians = {};

  filteredDates.forEach(dObj => {
    const dStr = dObj.date.toDateString();
    sourceData.forEach((row, techIndex) => {
      const val = row[dObj.colIdx];
      if (val && val !== "") {
        const techName = sourceC[techIndex][0];
        projectCounts[val] = projectCounts[val] || {};
        projectCounts[val][dStr] = (projectCounts[val][dStr] || 0) + 1;
        
        projectTechnicians[val] = projectTechnicians[val] || {};
        if (techName) {
          projectTechnicians[val][techName] = projectTechnicians[val][techName] || {};
          projectTechnicians[val][techName][dStr] = true;
        }

        if (val.toUpperCase().includes("AUSENCIA")) {
          ausenciaTotal[dStr] = (ausenciaTotal[dStr] || 0) + 1;
        }
      }
    });
  });

  // Calculate total rows needed for the new grid
  let totalRowsNeeded = Object.keys(projectCounts).length;
  for (const proj in projectTechnicians) {
    totalRowsNeeded += Object.keys(projectTechnicians[proj]).length;
  }

  const rowsToInsert = totalRowsNeeded > 0 ? totalRowsNeeded + 10 : 10;
  const maxRowsBefore = targetSheet.getMaxRows();

  // MUST insert new rows BEFORE deleting, to avoid "cannot delete all non-frozen rows" error
  targetSheet.insertRowsAfter(5, rowsToInsert);
  
  // Now delete the old rows which have been pushed down
  if (maxRowsBefore > 5) {
    targetSheet.deleteRows(6 + rowsToInsert, maxRowsBefore - 5);
  }

  // 2. SORTING (Apartado and Absences at the top)
  const allProjects = Object.keys(projectCounts);
  const apartado = allProjects.filter(p => p.trim().toUpperCase() === "APARTADO");
  const ausencia = allProjects.filter(p => p.toUpperCase().includes("AUSENCIA") && p.trim().toUpperCase() !== "APARTADO");
  const regularProjects = allProjects.filter(p => p.trim().toUpperCase() !== "APARTADO" && !p.toUpperCase().includes("AUSENCIA"));
  const sortedProjects = [...apartado, ...ausencia, ...regularProjects];

  // 3. WRITE HEADERS & METRICS
  const headerStrings = filteredDates.map(d => Utilities.formatDate(d.date, ss.getSpreadsheetTimeZone(), "dd/MM/yyyy"));
  targetSheet.getRange(5, 3, 1, headerStrings.length).setValues([headerStrings]); 
  targetSheet.getRange(1, 3, 1, headerStrings.length).setValues([new Array(headerStrings.length).fill(lastTechIdx + 1)]);
  targetSheet.getRange(2, 3, 1, headerStrings.length).setValues([filteredDates.map(d => ausenciaTotal[d.date.toDateString()] || 0)]);

  // 4. BATCH DATA PREPARATION
  const numProj = sortedProjects.length;
  const numCols = headerStrings.length;
  if (numProj === 0) return;

  const bgMatrix = [];
  const fontMatrix = [];
  const valueMatrix = [];
  const todayStr = new Date().toDateString();
  
  let currentRow = 6;

  for (let r = 0; r < numProj; r++) {
    const projOriginal = sortedProjects[r];
    const bgRow = [];
    const fontRow = [];
    const valRow = [];
    
    let rowHeaderBg = "#E0E0E0"; // Medium gray for project rows
    let rowHeaderFont = "#000000";
    let isPC = projOriginal.startsWith("PC -");
    let displayProj = projOriginal.replace("PC -", "").replace("!", "").trim();

    // Set Row Header Backgrounds
    if (projOriginal.startsWith("!")) { rowHeaderBg = "#660000"; rowHeaderFont = "#FFFFFF"; }
    else if (projOriginal.includes("AUSENCIA")) { rowHeaderBg = "#CC0000"; rowHeaderFont = "#FFFFFF"; }
    else if (projOriginal === "APARTADO") { rowHeaderBg = "#000000"; rowHeaderFont = "#FFFFFF"; }
    else if (isPC) { rowHeaderBg = "#D1DB70"; rowHeaderFont = "#000000"; }
    else if (projOriginal.startsWith("CAPACITACIÓN")) { rowHeaderBg = "#8E7CC3"; rowHeaderFont = "#FFFFFF"; }

    if (isPC) {
      targetSheet.getRange(currentRow, 1).setValue("por confirmar").setFontStyle("italic").setHorizontalAlignment("right");
    } else {
      targetSheet.getRange(currentRow, 1).setValue("").setFontStyle("normal"); // Clear previous values
    }
    targetSheet.getRange(currentRow, 2).setValue(displayProj).setHorizontalAlignment("left");
    
    // Header Formatting (A and B)
    const headerRange = targetSheet.getRange(currentRow, 1, 1, 2);
    headerRange.setBackground(rowHeaderBg).setFontColor(rowHeaderFont);
    if (projOriginal.includes("AUSENCIA") || projOriginal === "APARTADO") {
      targetSheet.getRange(currentRow, 2).setFontWeight("bold");
    } else {
      targetSheet.getRange(currentRow, 2).setFontWeight("normal");
    }

    // Grid Columns Logic
    for (let c = 0; c < numCols; c++) {
      const dObj = filteredDates[c];
      const isWeekend = (dObj.date.getDay() === 0 || dObj.date.getDay() === 6);
      const val = projectCounts[projOriginal][dObj.date.toDateString()] || 0;

      let cellBg = isWeekend ? "#EFEFEF" : "#FFFFFF";
      let cellFont = cellBg; // Invisible for zeros

      if (val > 0) {
        if (projOriginal === "APARTADO" || projOriginal.includes("AUSENCIA")) {
          cellBg = rowHeaderBg;
          cellFont = "#FFFFFF"; 
        } else if (isPC) {
          // PC Projects match their Lime background
          cellBg = "#D1DB70";
          cellFont = "#000000"; // Black font for visibility on Lime
        } else {
          cellBg = "#3C78D8"; // Confirmed blue
          cellFont = "#FFFFFF";
        }
      }
      bgRow.push(cellBg);
      fontRow.push(cellFont);
      valRow.push(val > 0 ? val : "");
    }
    bgMatrix.push(bgRow);
    fontMatrix.push(fontRow);
    valueMatrix.push(valRow);
    
    targetSheet.getRange(currentRow, 1, 1, numCols + 2).setBorder(null, null, true, null, null, null, "#D9D9D9", SpreadsheetApp.BorderStyle.SOLID);
    currentRow++;

    // Add Technician Rows
    const techs = Object.keys(projectTechnicians[projOriginal] || {}).sort();
    if (techs.length > 0) {
      const techStartRow = currentRow;
      
      for (const tech of techs) {
        targetSheet.getRange(currentRow, 1).setValue("").setBackground("#FFFFFF").setBorder(null, null, true, null, null, null, "#D9D9D9", SpreadsheetApp.BorderStyle.SOLID);
        targetSheet.getRange(currentRow, 2).setValue("↳ " + tech).setFontWeight("normal").setHorizontalAlignment("right").setBackground("#FFFFFF").setFontColor("#000000").setBorder(null, null, true, null, null, null, "#D9D9D9", SpreadsheetApp.BorderStyle.SOLID);
        
        const tBgRow = [];
        const tFontRow = [];
        const tValRow = [];
        
        for (let c = 0; c < numCols; c++) {
          const dObj = filteredDates[c];
          const hasTech = projectTechnicians[projOriginal][tech][dObj.date.toDateString()];
          const isWeekend = (dObj.date.getDay() === 0 || dObj.date.getDay() === 6);
          
          tBgRow.push(isWeekend ? "#EFEFEF" : "#eaf2f8"); // Gray for weekend, lighter blue for weekday
          tFontRow.push("#5f6368"); // Dark grey font
          tValRow.push(hasTech ? "X" : "");
        }
        bgMatrix.push(tBgRow);
        fontMatrix.push(tFontRow);
        valueMatrix.push(tValRow);
        currentRow++;
      }
      
      // Group the newly added technician rows
      try {
        targetSheet.getRange(techStartRow, 1, techs.length, 1).shiftRowGroupDepth(1);
      } catch (e) {}
    }
  }

  const totalRenderedRows = currentRow - 6;

  // Batch update grid
  targetSheet.getRange(6, 3, totalRenderedRows, numCols)
    .setBackgrounds(bgMatrix)
    .setFontColors(fontMatrix)
    .setValues(valueMatrix)
    .setHorizontalAlignment("center")
    .setNumberFormat("0"); // Force integer formatting instead of inherited Date

  // 5. TIMELINE & FOOTER
  const range5 = targetSheet.getRange(5, 3, 1, numCols);
  range5.setTextRotation(90).setBorder(null, null, true, null, null, null, "#000000", SpreadsheetApp.BorderStyle.SOLID_MEDIUM);
  
  filteredDates.forEach((d, idx) => {
    if (d.date.toDateString() === todayStr) {
      targetSheet.getRange(5, idx + 3).setBackground("#1155CC").setFontColor("#FFFFFF");
    }
  });

  targetSheet.getRange(currentRow, 1, 1, numCols + 2).setBorder(true, null, null, null, null, null, "#000000", SpreadsheetApp.BorderStyle.SOLID_MEDIUM);

  targetSheet.getRange("A5").setValue("Última actualización " + Utilities.formatDate(new Date(), ss.getSpreadsheetTimeZone(), "dd/MM/yyyy HH:mm:ss"));

  // Collapse all technician row groups by default
  try { targetSheet.collapseAllRowGroups(); } catch (e) {}
}