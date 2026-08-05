function generateDailyAgenda() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  const ganttSheet = ss.getSheetByName('Cronograma / Técnicos');
  const agendaSheet = ss.getSheetByName('Agenda');
  const masterSheet = ss.getSheetByName('BD Proyectos Maestro'); // New: Master projects database
  
  // Check if sheets exist
  if (!ganttSheet) {
    SpreadsheetApp.getUi().alert("Gantt sheet not found. Please check the sheet name.");
    return;
  }
  if (!agendaSheet) {
    SpreadsheetApp.getUi().alert("Agenda sheet not found. Please check the sheet name.");
    return;
  }
  if (!masterSheet) {
    SpreadsheetApp.getUi().alert("BD Proyectos Maestro sheet not found. Please check the sheet name.");
    return;
  }
  
  // Clear previous data in both output sections
  agendaSheet.getRange('B6:C').clear(); // Clear previous table data in Agenda
  agendaSheet.getRange('I5:J').clear(); // Clear previous output in the alternate format (including column J)
  
  const desiredDate = agendaSheet.getRange('C3').getValue(); // Date from C3
  if (!desiredDate) {
    SpreadsheetApp.getUi().alert("Please specify a date in cell C3.");
    return;
  }
  
  // CHANGE 1: Dynamically detect the last non-empty cell in column C starting from C15
  const startRow = 15;
  let lastRow = startRow;
  while (ganttSheet.getRange(lastRow, 3).getValue() !== '') {
    lastRow++;
  }
  lastRow--; // Go back to the last non-empty row
  
  const techniciansRange = ganttSheet.getRange(startRow, 3, lastRow - startRow + 1, 1);
  const technicians = techniciansRange.getValues(); // Array of technician names
  
  // --- MODIFIED CODE BLOCK: Dynamic Date Range ---
  const dateRowStartColumn = 5; // Column E
  const dateRowRow = 14;
  const lastDataColumn = ganttSheet.getLastColumn(); 
  // Calculate the number of columns from E (5) to the last data column
  const numDateColumns = lastDataColumn - dateRowStartColumn + 1;

  if (numDateColumns <= 0) {
    SpreadsheetApp.getUi().alert("Error: No date columns found starting from column E.");
    return;
  }
  
  // Get the dynamic range (e.g., E14:LastColInRow14)
  const dateRow = ganttSheet.getRange(dateRowRow, dateRowStartColumn, 1, numDateColumns);
  const dates = dateRow.getValues()[0]; // Get the date row as a 1D array
  // ------------------------------------------------
  
  const projectRange = ganttSheet.getRange(startRow, 5, lastRow - startRow + 1, dates.length); // Dynamic project range
  const projects = projectRange.getValues();
  
  // CHANGE 2: Load the project master data to find crew leaders
  const masterData = masterSheet.getDataRange().getValues();
  const masterHeaders = masterData[0];
  
  // Find column indices for "PROYECTOS" and "Encargado de proyecto"
  let projectColIndex = -1;
  let crewLeaderColIndex = -1;
  
  for (let col = 0; col < masterHeaders.length; col++) {
    if (masterHeaders[col] === 'PROYECTOS') {
      projectColIndex = col;
    }
    if (masterHeaders[col] === 'Encargado de proyecto') {
      crewLeaderColIndex = col;
    }
  }
  
  if (projectColIndex === -1 || crewLeaderColIndex === -1) {
    SpreadsheetApp.getUi().alert("Could not find 'PROYECTOS' or 'Encargado de proyecto' columns in BD Proyectos Maestro sheet.");
    return;
  }
  
  // Create a lookup map: project name -> crew leader name
  let crewLeaderMap = {};
  for (let i = 1; i < masterData.length; i++) { // Start from 1 to skip header
    let projectName = masterData[i][projectColIndex];
    let crewLeader = masterData[i][crewLeaderColIndex];
    if (projectName && crewLeader) {
      crewLeaderMap[projectName] = crewLeader;
    }
  }
  
  let output = []; // To store the results for the table format
  let formattedOutput = []; // To store the results for the alternate format (I5 onwards)
  
  // Find the column for the desired date
  let dateCol = -1;
  for (let col = 0; col < dates.length; col++) {
    // Note: Dates from getValues() are Date objects, so we compare their toDateString()
    if (dates[col] && new Date(dates[col]).toDateString() === new Date(desiredDate).toDateString()) {
      dateCol = col; // Column where the desired date is found (relative to the start of the 'dates' array)
      break;
    }
  }
  
  if (dateCol === -1) {
    SpreadsheetApp.getUi().alert("Date not found in Gantt chart.");
    return;
  }
  
  // Create the table header in the Agenda sheet
  agendaSheet.getRange('B5').setValue('Project');
  agendaSheet.getRange('C5').setValue('Technician');
  
  // Loop through each technician and get the project assigned for the desired date
  for (let row = 0; row < technicians.length; row++) {
    let technician = technicians[row][0]; // Technician's name
    let project = projects[row][dateCol]; // Project assigned to this technician on the desired date
    
    if (project) { // If a project exists for this technician
      output.push([project, technician]);
    }
  }
  
  // Sort the output array by the project name (first column)
  output.sort(function(a, b) {
    return a[0].localeCompare(b[0]);
  });
  
  // Output the sorted agenda data (table format) starting from row 6
  if (output.length > 0) {
    agendaSheet.getRange(6, 2, output.length, 2).setValues(output);
  } else {
    SpreadsheetApp.getUi().alert("No projects found for the selected date.");
  }
  
  // Prepare the alternate format output (one project followed by its technicians)
  let currentProject = '';
  let technicianCount = {}; // To track how many times each technician appears
  let rowIndex = 5; // Starting row for the alternate format
  
  output.forEach(function(row) {
    let project = row[0];
    let technician = row[1];
    
    if (project !== currentProject) {
      if (currentProject !== '') {
        formattedOutput.push(['', '']); // Add a blank row after each project group
        rowIndex++;
      }
      formattedOutput.push([project, '']); // Add the project name (no label in column J)
      currentProject = project;
      rowIndex++;
    }
    
    // CHANGE 3: Check if this technician is the crew leader for this project
    let crewLeaderLabel = '';
    if (crewLeaderMap[project] && crewLeaderMap[project] === technician) {
      crewLeaderLabel = 'Líder de cuadrilla';
    }
    
    // Add technician below the project with crew leader label if applicable
    formattedOutput.push([technician, crewLeaderLabel]);
    
    // Track the number of times each technician appears
    if (!technicianCount[technician]) {
      technicianCount[technician] = 1;
    } else {
      technicianCount[technician]++;
    }
    rowIndex++;
  });
  
  // Output the alternate format data starting from cell I5 (column I and J)
  if (formattedOutput.length > 0) {
    agendaSheet.getRange(5, 9, formattedOutput.length, 2).setValues(formattedOutput);
  }
  
  // Now apply yellow fill for duplicate technicians
  let row = 5; // Start from row 5 where output begins
  for (let i = 0; i < formattedOutput.length; i++) {
    let cellValue = formattedOutput[i][0]; // The technician name is in column I for technician rows
    
    // Check if the current row in the formatted output contains a technician name
    // (a technician row is one where the project leader label is NOT empty, or it is a project name)
    // We only want to highlight technicians (rows where the second column is not 'Líder de cuadrilla' or empty)
    if (formattedOutput[i][1] === 'Líder de cuadrilla' || (formattedOutput[i][1] === '' && formattedOutput[i][0] !== currentProject && formattedOutput[i][0] !== '')) {
       let technicianName = formattedOutput[i][0];
       // Check against the count map
       if (technicianCount[technicianName] && technicianCount[technicianName] > 1) { 
         agendaSheet.getRange(row, 9).setBackground('yellow');
       }
    }
    // Simple check: if the first column is a technician name (i.e., it has a count > 1)
    if (technicianCount[cellValue] && technicianCount[cellValue] > 1) { 
      agendaSheet.getRange(row, 9).setBackground('yellow');
    }
    
    row++;
  }
}