function generateGanttChart() {
  var sheetVisitas = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Visitas");
  var sheetCronogramaTecnicos = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Cronograma / Técnicos");

  // Get the data from Visitas sheet (headers in row 5)
  var visitasData = sheetVisitas.getRange(6, 1, sheetVisitas.getLastRow() - 5, 9).getValues(); // 9 columns (A to I)
  
  // Get the date range for Technicians (starting on row 14)
  var ganttDatesTecnicos = sheetCronogramaTecnicos.getRange(14, 5, 1, sheetCronogramaTecnicos.getLastColumn() - 4).getValues()[0];
  
  // Create an object to track projects assigned to each technician on each date
  var technicianAssignments = {};

  // Loop through Visitas data
  visitasData.forEach(function(row, index) {
    var programar = row[0]; // Column A: Programar (TRUE/FALSE)
    var proyecto = row[2];  // Column C: Proyecto
    var fechaInicio = new Date(row[4]); // Column E: Fecha Inicio
    var dias = row[5]; // Column F: Días
    var tecnicos = row[7] ? String(row[7]).split(",") : []; // Column H: Técnicos
    var finesDeSemana = row[8]; // Column I: Fines de Semana (TRUE/FALSE)

    if (programar) { // Only process if Programar is TRUE
      // Loop for technicians to track assignments
      tecnicos.forEach(function(tecnico) {
        var techRow = findTechnicianRow(tecnico.trim(), sheetCronogramaTecnicos);
        if (techRow !== -1) {
          var remainingDays = dias;
          for (var i = 0; i < ganttDatesTecnicos.length && remainingDays > 0; i++) {
            var currentDate = new Date(ganttDatesTecnicos[i]);
            var dayOfWeek = currentDate.getDay();
            
            // Skip weekends if Fines de Semana is FALSE
            if ((dayOfWeek === 6 || dayOfWeek === 0) && !finesDeSemana) {
              continue;
            }
            
            // Check if the current date falls within the project timeline
            if (currentDate >= fechaInicio) {
              var dateKey = techRow + "_" + i;
              
              if (!technicianAssignments[dateKey]) {
                technicianAssignments[dateKey] = [];
              }
              
              technicianAssignments[dateKey].push(proyecto);
              remainingDays--;
            }
          }
        }
      });
    }
  });
  
  // Fill in the Gantt chart based on collected assignments for technicians
  fillGanttChart(sheetCronogramaTecnicos, technicianAssignments, ganttDatesTecnicos);
}

// Function to fill in the Gantt chart based on assignments
function fillGanttChart(sheet, assignments, ganttDates) {
  for (var key in assignments) {
    var parts = key.split("_");
    var row = parseInt(parts[0]);
    var dateIndex = parseInt(parts[1]);
    var values = assignments[key];
    
    var displayString = values.join(", ");
    var targetCell = sheet.getRange(row, 5 + dateIndex); // Row for the technician, column for the date
    
    // Check for existing value in the target cell
    var existingValue = targetCell.getValue();

    // If there's an existing value, append the new project(s) and color orange
    if (existingValue && existingValue.trim() !== "") {
      displayString = existingValue + ", " + displayString;
      targetCell.setValue(displayString)
                .setFontColor("orange")
                .setBackground("orange");
    } else {
      // If cell is empty, add the new project(s) and color blue
      targetCell.setValue(displayString)
                .setFontColor("blue")
                .setBackground("blue");
    }
  }
}

// Helper function to find the technician's row in Cronograma / Técnicos sheet
function findTechnicianRow(tecnico, sheetCronogramaTecnicos) {
  var techRange = sheetCronogramaTecnicos.getRange(15, 3, sheetCronogramaTecnicos.getLastRow() - 14, 1).getValues(); // Names start in row 15
  for (var i = 0; i < techRange.length; i++) {
    if (techRange[i][0] === tecnico) {
      return i + 15;
    }
  }
  return -1;
}
