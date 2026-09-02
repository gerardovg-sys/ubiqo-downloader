function generateUpgradedLongAgenda() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // Get the 'Agenda detallada' and Gantt chart sheets
  const agendaSheet = ss.getSheetByName('Agenda detallada');
  const ganttSheet = ss.getSheetByName('Cronograma / Técnicos');

  // Ensure sheets exist
  if (!agendaSheet || !ganttSheet) {
    SpreadsheetApp.getUi().alert("One or more sheets not found. Please check the sheet names.");
    return;
  }

  // Clear the previous data starting from row 8
  agendaSheet.getRange('D8:BA').clear(); // Clear values
  agendaSheet.getRange('D8:BA').setBackground(null); // Clear background colors

  // Get the date range from C4 (Start date) and C5 (End date)
  const startDate = agendaSheet.getRange('C4').getValue();
  const endDate = agendaSheet.getRange('C5').getValue();

  if (!startDate || !endDate) {
    SpreadsheetApp.getUi().alert("Please specify both start and end dates in cells C4 and C5.");
    return;
  }

  const start = new Date(startDate);
  const end = new Date(endDate);

  const techniciansRange = ganttSheet.getRange('C15:C34');
  const technicians = techniciansRange.getValues();

  const dateRow = ganttSheet.getRange('E14:PG14').getValues()[0];
  const projectRange = ganttSheet.getRange('E15:PG31').getValues();

  let columnOffset = 0; // Start writing the data in column D (4th column)
  let maxSummaryRows = 0; // To track the maximum summary rows used
  const detailedAgendas = {}; // Store detailed agendas for all days

  // Loop through each day in the date range
  for (let currentDate = new Date(start); currentDate <= end; currentDate.setDate(currentDate.getDate() + 1)) {
    const dayOfWeek = currentDate.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) continue; // Skip weekends

    let dateCol = -1;
    for (let col = 0; col < dateRow.length; col++) {
      if (dateRow[col] && new Date(dateRow[col]).toDateString() === currentDate.toDateString()) {
        dateCol = col;
        break;
      }
    }
    if (dateCol === -1) continue;

    let totalAusencias = 0;
    let scheduledTechnicians = 0;
    let projectCounts = {};
    const detailedAgenda = {};

    // Process technician assignments
    for (let row = 0; row < technicians.length; row++) {
      const project = projectRange[row][dateCol];
      if (project && !project.toLowerCase().includes("ausencia")) {
        scheduledTechnicians++;
        if (!projectCounts[project]) {
          projectCounts[project] = 1;
          detailedAgenda[project] = [];
        } else {
          projectCounts[project]++;
        }
        detailedAgenda[project].push(technicians[row][0]);
      }
      if (project && project.toLowerCase().includes("ausencia")) {
        totalAusencias++;
      }
    }

    const totalActiveTechnicians = 20;
    const availableTechniciansCount = totalActiveTechnicians - totalAusencias;
    const techniciansWithNoAssignment = availableTechniciansCount - scheduledTechnicians;

    // Write summary
    const summaryStartRow = 8;
    let currentRow = summaryStartRow;
    agendaSheet.getRange(currentRow++, 4 + columnOffset).setValue(currentDate).setFontWeight('bold').setBackground('#D3D3D3');
    agendaSheet.getRange(currentRow++, 4 + columnOffset).setValue("Técnicos disponibles").offset(0, 1).setValue(availableTechniciansCount);
    agendaSheet.getRange(currentRow++, 4 + columnOffset).setValue("AUSENCIAS").offset(0, 1).setValue(totalAusencias);
    agendaSheet.getRange(currentRow++, 4 + columnOffset).setValue("Técnicos programados").offset(0, 1).setValue(scheduledTechnicians);
    agendaSheet.getRange(currentRow++, 4 + columnOffset).setValue("Técnicos sin asignación").offset(0, 1).setValue(techniciansWithNoAssignment);

    // Write project summary
    agendaSheet.getRange(currentRow++, 4 + columnOffset).setValue("Proyectos programados").setFontWeight("bold");
    for (let project in projectCounts) {
      agendaSheet.getRange(currentRow, 4 + columnOffset).setValue(project);
      agendaSheet.getRange(currentRow++, 5 + columnOffset).setValue(projectCounts[project]);
    }

    maxSummaryRows = Math.max(maxSummaryRows, currentRow);

    // Save the detailed agenda for this day
    detailedAgendas[currentDate.toDateString()] = detailedAgenda;

    // Move to the next column set for the next day's summary
    columnOffset += 3;
  }

  // Start detailed agendas after the max summary height + 2 blank rows
  let detailedStartRow = maxSummaryRows + 2;

  // Reset columnOffset to 0 for detailed agenda
  columnOffset = 0;
  for (let currentDate = new Date(start); currentDate <= end; currentDate.setDate(currentDate.getDate() + 1)) {
    const dayOfWeek = currentDate.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) continue; // Skip weekends

    const detailedAgenda = detailedAgendas[currentDate.toDateString()];
    if (!detailedAgenda) continue;

    let detailedRow = detailedStartRow;
    for (let project in detailedAgenda) {
      // Write project name with gray background
      agendaSheet.getRange(detailedRow++, 4 + columnOffset).setValue(project).setBackground('#D3D3D3');
      detailedAgenda[project].forEach(technician => {
        agendaSheet.getRange(detailedRow++, 4 + columnOffset).setValue(technician);
      });
      // Add a blank row between projects
      detailedRow++;
    }

    // Move to the next column set for the next day's detailed agenda
    columnOffset += 3;
  }

  // Add a timestamp to C6
  const now = new Date();
  agendaSheet.getRange('C6').setValue(`${now.toLocaleDateString()} ${now.toLocaleTimeString()}`);
}
