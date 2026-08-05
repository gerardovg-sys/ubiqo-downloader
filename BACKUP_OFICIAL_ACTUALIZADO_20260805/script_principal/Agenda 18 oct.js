function DEPRECATEDgenerateDailyAgenda() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  const ganttSheet = ss.getSheetByName('Cronograma / Técnicos'); // Updated Gantt sheet name
  const agendaSheet = ss.getSheetByName('Agenda'); // Output Agenda sheet
  
  // Check if sheets exist
  if (!ganttSheet) {
    SpreadsheetApp.getUi().alert("Gantt sheet not found. Please check the sheet name.");
    return;
  }
  if (!agendaSheet) {
    SpreadsheetApp.getUi().alert("Agenda sheet not found. Please check the sheet name.");
    return;
  }
  
  // Clear previous data in both output sections
  agendaSheet.getRange('B6:C').clear(); // Clear previous table data in Agenda
  agendaSheet.getRange('I5:I').clear(); // Clear previous output in the alternate format
  
  const desiredDate = agendaSheet.getRange('C3').getValue(); // Date from C3
  if (!desiredDate) {
    SpreadsheetApp.getUi().alert("Please specify a date in cell C3.");
    return;
  }
  
  const techniciansRange = ganttSheet.getRange('C15:C34'); // Updated Technician names range
  const technicians = techniciansRange.getValues(); // Array of technician names
  
  const dateRow = ganttSheet.getRange('E14:PG14'); // Adjust 'Z' to cover all your date columns
  const dates = dateRow.getValues()[0]; // Get the date row as a 1D array
  
  const projectRange = ganttSheet.getRange('E15:PG34'); // Updated Project bars range
  const projects = projectRange.getValues();
  
  let output = []; // To store the results for the table format
  let formattedOutput = []; // To store the results for the alternate format (I5 onwards)
  
  // Find the column for the desired date
  let dateCol = -1;
  for (let col = 0; col < dates.length; col++) {
    if (dates[col] && new Date(dates[col]).toDateString() === new Date(desiredDate).toDateString()) {
      dateCol = col; // Column where the desired date is found
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
        formattedOutput.push(['']); // Add a blank row after each project group
        rowIndex++;
      }
      formattedOutput.push([project]); // Add the project name
      currentProject = project;
      rowIndex++;
    }
    
    // Add technician below the project
    formattedOutput.push([technician]);
    
    // Track the number of times each technician appears
    if (!technicianCount[technician]) {
      technicianCount[technician] = 1;
    } else {
      technicianCount[technician]++;
    }
    rowIndex++;
  });
  
  // Output the alternate format data starting from cell I5
  if (formattedOutput.length > 0) {
    agendaSheet.getRange(5, 9, formattedOutput.length, 1).setValues(formattedOutput);
  }
  
  // Now apply yellow fill for duplicate technicians
  let row = 5; // Start from row 5 where output begins
  for (let i = 0; i < formattedOutput.length; i++) {
    let cellValue = formattedOutput[i][0];
    if (technicianCount[cellValue] > 1) { // If technician appears more than once
      agendaSheet.getRange(row, 9).setBackground('yellow');
    }
    row++;
  }
}
