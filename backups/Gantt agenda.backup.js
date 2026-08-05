function DEPRECATEDgenerateDailyAgendacreateGanttAgendav1() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sourceSheet = ss.getSheetByName("Cronograma / Técnicos");
  const targetSheet = ss.getSheetByName("Gantt agenda");
  
  // Get date range from C4 and C5 (dd/mm/yyyy format)
  const startDateValue = targetSheet.getRange("C4").getValue();
  const endDateValue = targetSheet.getRange("C5").getValue();
  
  // Parse dd/mm/yyyy format
  const parseDate = (dateInput) => {
    if (dateInput instanceof Date) {
      return dateInput;
    }
    
    const dateStr = dateInput.toString();
    if (!dateStr || !dateStr.includes('/')) return null;
    
    const parts = dateStr.split('/');
    if (parts.length !== 3) return null;
    
    const day = parseInt(parts[0]);
    const month = parseInt(parts[1]) - 1; // Month is 0-based in JavaScript
    const year = parseInt(parts[2]);
    
    return new Date(year, month, day);
  };
  
  const startDate = parseDate(startDateValue);
  const endDate = parseDate(endDateValue);
  
  if (!startDate || !endDate) {
    SpreadsheetApp.getUi().alert("Invalid date format in C4 or C5. Use dd/mm/yyyy format (e.g., 15/01/2025)");
    return;
  }
  
  // Clear existing data (row 7 and everything from row 13 down, column D onwards)
  targetSheet.getRange("D7:Z7").clearContent().clearFormat();
  const lastRow = targetSheet.getLastRow();
  const lastCol = targetSheet.getLastColumn();
  if (lastRow >= 13 && lastCol >= 4) {
    targetSheet.getRange(13, 4, Math.max(1, lastRow - 12), Math.max(1, lastCol - 3)).clearContent().clearFormat();
  }
  
  // Get source data
  const sourceData = sourceSheet.getDataRange().getValues();
  
  // Find technician names (starting from C15, going down until empty)
  const technicianNames = [];
  let row = 14; // 0-based index for row 15
  while (row < sourceData.length && sourceData[row][2] !== "") {
    technicianNames.push(sourceData[row][2]);
    row++;
  }
  
  // Get source dates from E14 onwards (row 13, 0-based)
  const sourceDateRow = sourceData[13]; // Row 14, 0-based
  const sourceDates = [];
  for (let col = 4; col < sourceDateRow.length; col++) { // Starting from column E (index 4)
    if (sourceDateRow[col] !== "") {
      const parsedDate = parseDate(sourceDateRow[col]);
      if (parsedDate) {
        sourceDates.push({date: parsedDate, colIndex: col});
      }
    }
  }
  
  // Filter dates within specified range
  const filteredDates = sourceDates.filter(dateObj => 
    dateObj.date >= startDate && dateObj.date <= endDate
  );
  
  if (filteredDates.length === 0) {
    SpreadsheetApp.getUi().alert("No dates found within the specified range.");
    return;
  }
  
  // Collect project assignments
  const projectCounts = {}; // {projectName: {dateString: count}}
  
  for (let techIndex = 0; techIndex < technicianNames.length; techIndex++) {
    const techRow = sourceData[14 + techIndex]; // Technician data row
    
    for (const dateObj of filteredDates) {
      const project = techRow[dateObj.colIndex];
      if (project && project !== "") {
        const dateString = dateObj.date.toDateString();
        
        if (!projectCounts[project]) {
          projectCounts[project] = {};
        }
        if (!projectCounts[project][dateString]) {
          projectCounts[project][dateString] = 0;
        }
        projectCounts[project][dateString]++;
      }
    }
  }
  
  // Get unique projects
  const projects = Object.keys(projectCounts);
  if (projects.length === 0) {
    SpreadsheetApp.getUi().alert("No projects found in the specified date range.");
    return;
  }
  
  // Prepare date headers (dd/mm/yyyy format)
  const dateHeaders = filteredDates.map(dateObj => {
    const day = dateObj.date.getDate().toString().padStart(2, '0');
    const month = (dateObj.date.getMonth() + 1).toString().padStart(2, '0');
    const year = dateObj.date.getFullYear();
    return `${day}/${month}/${year}`;
  });
  
  // Write date headers to rows 7 and 13
  if (dateHeaders.length > 0) {
    const headerRange7 = targetSheet.getRange(7, 4, 1, dateHeaders.length);
    const headerRange13 = targetSheet.getRange(13, 4, 1, dateHeaders.length);
    
    headerRange7.setValues([dateHeaders]);
    headerRange13.setValues([dateHeaders]);
    
    // Format headers
    [headerRange7, headerRange13].forEach(range => {
      range.setFontWeight("bold")
           .setBackground("#f0f0f0")
           .setBorder(null, null, true, null, null, null);
    });
  }
  
  // Write project names and data
  for (let i = 0; i < projects.length; i++) {
    const project = projects[i];
    const rowIndex = 14 + i;
    
    // Write project name in column C
    targetSheet.getRange(rowIndex, 3).setValue(project);
    
    // Write people counts for each date
    const rowData = filteredDates.map(dateObj => {
      const dateString = dateObj.date.toDateString();
      return projectCounts[project][dateString] || 0;
    });
    
    if (rowData.length > 0) {
      targetSheet.getRange(rowIndex, 4, 1, rowData.length).setValues([rowData]);
    }
  }
  
  SpreadsheetApp.getUi().alert(`Gantt agenda created successfully!\nProjects: ${projects.length}\nDate range: ${dateHeaders.length} days`);
}