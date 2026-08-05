/**
 * Refines the Gantt Agenda: Removes Row 7, groups Absences at bottom,
 * and matches PC assignment colors to the lime project header.
 */
function createAndFormatGanttAgendaPrueba() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sourceSheet = ss.getSheetByName("Cronograma / Técnicos");
  const targetSheet = ss.getSheetByName("Gantt agenda");
  
  // 1. DATA FETCHING & PREP
  const startDate = targetSheet.getRange("B4").getValue();
  const endDate = targetSheet.getRange("B5").getValue();
  
  if (!(startDate instanceof Date) || !(endDate instanceof Date)) {
    SpreadsheetApp.getUi().alert("Invalid dates in B4 or B5.");
    return;
  }

  // Clear previous data
  targetSheet.getRange("B7:ZZ7").clearContent().clearFormat(); 
  targetSheet.getRange("B8:ZZ9").clearContent().clearFormat();
  targetSheet.getRange("B13:ZZ").clearContent().clearFormat();

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

  filteredDates.forEach(dObj => {
    const dStr = dObj.date.toDateString();
    sourceData.forEach(row => {
      const val = row[dObj.colIdx];
      if (val && val !== "") {
        projectCounts[val] = projectCounts[val] || {};
        projectCounts[val][dStr] = (projectCounts[val][dStr] || 0) + 1;
        if (val.toUpperCase().includes("AUSENCIA")) {
          ausenciaTotal[dStr] = (ausenciaTotal[dStr] || 0) + 1;
        }
      }
    });
  });

  // 2. SORTING (Absences at the bottom)
  const allProjects = Object.keys(projectCounts);
  const regularProjects = allProjects.filter(p => !p.toUpperCase().includes("AUSENCIA"));
  const ausenciaProjects = allProjects.filter(p => p.toUpperCase().includes("AUSENCIA"));
  const sortedProjects = [...regularProjects, ...ausenciaProjects];

  // 3. WRITE HEADERS & METRICS
  const headerStrings = filteredDates.map(d => Utilities.formatDate(d.date, ss.getSpreadsheetTimeZone(), "dd/MM/yyyy"));
  targetSheet.getRange(13, 4, 1, headerStrings.length).setValues([headerStrings]); 
  targetSheet.getRange(8, 4, 1, headerStrings.length).setValues([new Array(headerStrings.length).fill(lastTechIdx + 1)]);
  targetSheet.getRange(9, 4, 1, headerStrings.length).setValues([filteredDates.map(d => ausenciaTotal[d.date.toDateString()] || 0)]);

  // 4. BATCH DATA PREPARATION
  const numProj = sortedProjects.length;
  const numCols = headerStrings.length;
  if (numProj === 0) return;

  const bgMatrix = [];
  const fontMatrix = [];
  const todayStr = new Date().toDateString();

  for (let r = 0; r < numProj; r++) {
    const projOriginal = sortedProjects[r];
    const bgRow = [];
    const fontRow = [];
    
    let rowHeaderBg = "#FFFFFF";
    let rowHeaderFont = "#000000";
    let isPC = projOriginal.startsWith("PC -");
    let displayProj = projOriginal.replace("PC -", "").replace("!", "").trim();

    // Set Row Header Backgrounds
    if (projOriginal.startsWith("!")) { rowHeaderBg = "#660000"; rowHeaderFont = "#FFFFFF"; }
    else if (projOriginal.includes("AUSENCIA")) { rowHeaderBg = "#CC0000"; rowHeaderFont = "#FFFFFF"; }
    else if (projOriginal === "APARTADO") { rowHeaderBg = "#000000"; rowHeaderFont = "#FFFFFF"; }
    else if (isPC) { rowHeaderBg = "#D1DB70"; rowHeaderFont = "#000000"; }
    else if (projOriginal.startsWith("CAPACITACIÓN")) { rowHeaderBg = "#8E7CC3"; rowHeaderFont = "#FFFFFF"; }

    const rowNum = r + 14;
    if (isPC) {
      targetSheet.getRange(rowNum, 2).setValue("por confirmar").setFontStyle("italic").setHorizontalAlignment("right");
    }
    targetSheet.getRange(rowNum, 3).setValue(displayProj);
    
    // Header Formatting (B and C)
    const headerRange = targetSheet.getRange(rowNum, 2, 1, 2);
    headerRange.setBackground(rowHeaderBg).setFontColor(rowHeaderFont);
    if (projOriginal.includes("AUSENCIA") || projOriginal === "APARTADO") {
      targetSheet.getRange(rowNum, 3).setFontWeight("bold");
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
    }
    bgMatrix.push(bgRow);
    fontMatrix.push(fontRow);
    
    targetSheet.getRange(rowNum, 2, 1, numCols + 2).setBorder(null, null, true, null, null, null, "#D9D9D9", SpreadsheetApp.BorderStyle.SOLID);
  }

  // Batch update grid
  targetSheet.getRange(14, 4, numProj, numCols).setBackgrounds(bgMatrix).setFontColors(fontMatrix).setValues(
    sortedProjects.map(proj => filteredDates.map(d => projectCounts[proj][d.date.toDateString()] || 0))
  );

  // 5. TIMELINE & FOOTER
  const range13 = targetSheet.getRange(13, 4, 1, numCols);
  range13.setTextRotation(90).setBorder(null, null, true, null, null, null, "#000000", SpreadsheetApp.BorderStyle.SOLID_MEDIUM);
  
  filteredDates.forEach((d, idx) => {
    if (d.date.toDateString() === todayStr) {
      targetSheet.getRange(13, idx + 4).setBackground("#1155CC").setFontColor("#FFFFFF");
    }
  });

  targetSheet.getRange(14 + numProj, 2, 1, numCols + 2).setBorder(true, null, null, null, null, null, "#000000", SpreadsheetApp.BorderStyle.SOLID_MEDIUM);

  targetSheet.getRange("C6").setValue(Utilities.formatDate(new Date(), ss.getSpreadsheetTimeZone(), "dd/MM/yyyy HH:mm:ss"));
}