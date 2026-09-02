function createProjectSummary2() {
  try {
    // Get the target spreadsheet and sheets
    const targetSpreadsheetId = "18GFvQZdpmALvmmTFc70dXENJxImMR3bkHU04IG";
    const sourceSpreadsheetId = "18GFvQZdpmALvmmTFc70dXENJxImMR3bkHU04IG_UyyY";
    
    console.log("Opening target spreadsheet...");
    let targetSpreadsheet;
    try {
      targetSpreadsheet = SpreadsheetApp.openById(targetSpreadsheetId);
    } catch (error) {
      throw new Error("Cannot open target spreadsheet. Please check the spreadsheet ID and permissions: " + targetSpreadsheetId);
    }
    
    console.log("Opening source spreadsheet...");
    let sourceSpreadsheet;
    try {
      sourceSpreadsheet = SpreadsheetApp.openById(sourceSpreadsheetId);
    } catch (error) {
      throw new Error("Cannot open source spreadsheet. Please check the spreadsheet ID and permissions: " + sourceSpreadsheetId);
    }
    
    console.log("Getting sheets...");
    const targetSheet = targetSpreadsheet.getSheetByName("Resumen agenda");
    if (!targetSheet) {
      throw new Error("Sheet 'Resumen agenda' not found in target spreadsheet");
    }
    
    const scheduleSheet = sourceSpreadsheet.getSheetByName("Cronograma / Técnicos");
    if (!scheduleSheet) {
      throw new Error("Sheet 'Cronograma / Técnicos' not found in source spreadsheet");
    }
    
    const projectsSheet = sourceSpreadsheet.getSheetByName("BD Proyectos Maestro");
    if (!projectsSheet) {
      throw new Error("Sheet 'BD Proyectos Maestro' not found in source spreadsheet");
    }
    
    // Get date range from target sheet
    const startDateCell = targetSheet.getRange("C4").getValue();
    const endDateCell = targetSheet.getRange("C5").getValue();
    
    // Validate dates
    if (!isValidDate(startDateCell) || !isValidDate(endDateCell)) {
      SpreadsheetApp.getUi().alert("Please enter a valid date range");
      return;
    }
    
    const startDate = new Date(startDateCell);
    const endDate = new Date(endDateCell);
    
    if (startDate > endDate) {
      SpreadsheetApp.getUi().alert("Please enter a valid date range");
      return;
    }
    
    // Clear existing output
    clearOutputArea(targetSheet);
    
    // Get projects database
    const projectsData = getProjectsDatabase(projectsSheet);
    
    // Process Gantt chart
    const assignments = processGanttChart(scheduleSheet, startDate, endDate);
    
    // Create output table
    const outputData = createOutputTable(assignments, projectsData);
    
    // Write to sheet
    writeOutputToSheet(targetSheet, outputData);
    
    // Add execution timestamp
    const now = new Date();
    const timestamp = Utilities.formatDate(now, Session.getScriptTimeZone(), "dd/MM/yyyy hh:mm:ss a");
    targetSheet.getRange("C6").setValue(timestamp);
    
  } catch (error) {
    console.error("Error in createProjectSummary:", error);
    SpreadsheetApp.getUi().alert("An error occurred: " + error.message);
  }
}

function isValidDate(date) {
  return date instanceof Date && !isNaN(date.getTime());
}

function clearOutputArea(sheet) {
  // Clear from D8 onwards (assuming reasonable range)
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  
  if (lastRow >= 8 && lastCol >= 4) {
    sheet.getRange(8, 4, Math.max(lastRow - 7, 100), Math.max(lastCol - 3, 20)).clear();
  }
}

function getProjectsDatabase(projectsSheet) {
  const data = projectsSheet.getDataRange().getValues();
  const headers = data[0];
  
  // Find column indices
  const projectCol = headers.indexOf("PROYECTOS");
  const sapCol = headers.indexOf("SAP");
  const techCol = headers.indexOf("Técnicos estimados");
  const daysCol = headers.indexOf("Días estimados");
  const clientCol = headers.indexOf("Cat. del Cliente");
  
  const projectsMap = new Map();
  
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (row[projectCol]) {
      const projectName = row[projectCol].toString().trim();
      projectsMap.set(projectName, {
        sap: sapCol >= 0 ? (row[sapCol] || "missing") : "missing",
        technicians: techCol >= 0 ? (row[techCol] || "missing") : "missing",
        days: daysCol >= 0 ? (row[daysCol] || "missing") : "missing",
        clientCategory: clientCol >= 0 ? (row[clientCol] || "missing") : "missing"
      });
    }
  }
  
  return projectsMap;
}

function processGanttChart(scheduleSheet, startDate, endDate) {
  const data = scheduleSheet.getDataRange().getValues();
  
  // Find dates row (row 14, index 13)
  const datesRow = data[13];
  
  // Find date columns within range (starting from column E, index 4)
  const dateColumns = [];
  for (let col = 4; col < datesRow.length; col++) {
    const cellValue = datesRow[col];
    if (cellValue) {
      const dateStr = cellValue.toString();
      const parsedDate = parseDateFromGantt(dateStr);
      if (parsedDate && parsedDate >= startDate && parsedDate <= endDate) {
        dateColumns.push({
          col: col,
          date: parsedDate,
          dateStr: dateStr
        });
      }
    }
  }
  
  // Find the "BAJA" row to determine where assignments end
  let lastAssignmentRow = data.length - 1;
  for (let row = 14; row < data.length; row++) {
    if (data[row][2] === "BAJA") {
      lastAssignmentRow = row - 1;
      break;
    }
  }
  
  // Process assignments
  const assignmentMap = new Map();
  
  for (let row = 14; row <= lastAssignmentRow; row++) {
    for (const dateInfo of dateColumns) {
      const cellValue = data[row][dateInfo.col];
      if (cellValue) {
        const assignments = cellValue.toString().split(',').map(a => a.trim()).filter(a => a);
        
        for (const assignment of assignments) {
          if (!assignmentMap.has(assignment)) {
            assignmentMap.set(assignment, {
              dates: new Set(),
              dayCount: 0
            });
          }
          
          const assignmentData = assignmentMap.get(assignment);
          const dateKey = dateInfo.date.toDateString();
          
          if (!assignmentData.dates.has(dateKey)) {
            assignmentData.dates.add(dateKey);
            // Calculate fractional day based on number of assignments on this date/row
            assignmentData.dayCount += 1 / assignments.length;
          }
        }
      }
    }
  }
  
  return assignmentMap;
}

function parseDateFromGantt(dateStr) {
  try {
    // Handle "dd-mmm" format
    const parts = dateStr.split('-');
    if (parts.length === 2) {
      const day = parseInt(parts[0]);
      const monthStr = parts[1].toLowerCase();
      
      const months = {
        'ene': 0, 'feb': 1, 'mar': 2, 'abr': 3, 'may': 4, 'jun': 5,
        'jul': 6, 'ago': 7, 'sep': 8, 'oct': 9, 'nov': 10, 'dic': 11,
        'jan': 0, 'feb': 1, 'mar': 2, 'apr': 3, 'may': 4, 'jun': 5,
        'jul': 6, 'aug': 7, 'sep': 8, 'oct': 9, 'nov': 10, 'dec': 11
      };
      
      const month = months[monthStr];
      if (month !== undefined && day >= 1 && day <= 31) {
        const currentYear = new Date().getFullYear();
        return new Date(currentYear, month, day);
      }
    }
    
    // Try to parse as date object if it's already a date
    if (dateStr instanceof Date) {
      return dateStr;
    }
    
    return null;
  } catch (error) {
    return null;
  }
}

function createOutputTable(assignmentMap, projectsData) {
  const outputData = [];
  
  // Headers
  const headers = [
    "Semana",
    "SAP", 
    "Proyecto",
    "Fecha visita inicial",
    "Fecha visita final", 
    "Días programados",
    "Técnicos estimados",
    "Días estimados",
    "Categoría de cliente"
  ];
  outputData.push(headers);
  
  // Process each assignment
  for (const [assignmentName, assignmentData] of assignmentMap) {
    const dates = Array.from(assignmentData.dates).map(d => new Date(d)).sort((a, b) => a - b);
    
    if (dates.length > 0) {
      const initialDate = dates[0];
      const endDate = dates[dates.length - 1];
      const weekNumber = getWeekNumber(initialDate);
      
      // Get project data
      let projectInfo;
      if (projectsData.has(assignmentName)) {
        projectInfo = projectsData.get(assignmentName);
      } else {
        projectInfo = {
          sap: "NA",
          technicians: "NA", 
          days: "NA",
          clientCategory: "NA"
        };
      }
      
      const row = [
        `Semana ${weekNumber}`,
        projectInfo.sap,
        assignmentName,
        Utilities.formatDate(initialDate, Session.getScriptTimeZone(), "dd/MM/yyyy"),
        Utilities.formatDate(endDate, Session.getScriptTimeZone(), "dd/MM/yyyy"),
        Math.round(assignmentData.dayCount * 10) / 10, // Round to 1 decimal
        projectInfo.technicians,
        projectInfo.days,
        projectInfo.clientCategory
      ];
      
      outputData.push(row);
    }
  }
  
  // Sort by week number and assignment name
  const dataRows = outputData.slice(1);
  dataRows.sort((a, b) => {
    const weekA = parseInt(a[0].replace("Semana ", ""));
    const weekB = parseInt(b[0].replace("Semana ", ""));
    
    if (weekA !== weekB) {
      return weekA - weekB;
    }
    return a[2].localeCompare(b[2]); // Sort by project name
  });
  
  return [headers, ...dataRows];
}

function getWeekNumber(date) {
  const firstJan = new Date(date.getFullYear(), 0, 1);
  const days = Math.floor((date - firstJan) / (24 * 60 * 60 * 1000));
  return Math.ceil((days + firstJan.getDay() + 1) / 7);
}

function writeOutputToSheet(sheet, outputData) {
  if (outputData.length === 0) return;
  
  const startRow = 8;
  const startCol = 4; // Column D
  
  // Write data
  const range = sheet.getRange(startRow, startCol, outputData.length, outputData[0].length);
  range.setValues(outputData);
  
  // Format headers (bold)
  const headerRange = sheet.getRange(startRow, startCol, 1, outputData[0].length);
  headerRange.setFontWeight("bold");
  headerRange.setBackground("#E0E0E0");
  
  // Apply alternating colors based on week
  if (outputData.length > 1) {
    let currentWeek = "";
    let colorToggle = true;
    
    for (let i = 1; i < outputData.length; i++) {
      const week = outputData[i][0];
      
      if (week !== currentWeek) {
        currentWeek = week;
        colorToggle = !colorToggle;
      }
      
      const rowRange = sheet.getRange(startRow + i, startCol, 1, outputData[0].length);
      if (colorToggle) {
        rowRange.setBackground("#F5F5F5");
      } else {
        rowRange.setBackground("#FFFFFF");
      }
    }
  }
  
  // Auto-resize columns
  for (let col = 0; col < outputData[0].length; col++) {
    sheet.autoResizeColumn(startCol + col);
  }
}