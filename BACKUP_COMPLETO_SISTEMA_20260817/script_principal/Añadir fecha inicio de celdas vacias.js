function updateAllStartDates() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // Define the sheets
  const projectsSheet = ss.getSheetByName("BD Proyectos Maestro");
  const bitacoraSheet = ss.getSheetByName("Bitácora");
  
  // Get data from BD Proyectos Maestro
  const projectsData = projectsSheet.getDataRange().getValues();
  
  // Get data from Bitácora
  const bitacoraData = bitacoraSheet.getDataRange().getValues();
  
  // Loop through BD Proyectos Maestro starting from the second row (assuming the first row is headers)
  for (let i = 1; i < projectsData.length; i++) {
    const projectName = projectsData[i][2]; // Column C (index 2)
    const startDate = projectsData[i][8];  // Column I (index 8)

    if (!startDate) { // If column I is empty
      // Find the oldest date in the Bitácora tab for this project
      const projectDates = bitacoraData
        .filter(row => row[3] === projectName) // Match project names (Column D in Bitácora, index 3)
        .map(row => row[2])                   // Extract dates (Column C in Bitácora, index 2)
        .filter(date => date instanceof Date); // Ensure it's a valid date
      
      if (projectDates.length > 0) {
        // Get the oldest date
        const oldestDate = new Date(Math.min(...projectDates.map(date => date.getTime())));
        
        // Update the start date in column I
        projectsSheet.getRange(i + 1, 9).setValue(oldestDate); // Row i+1, Column I (index 9)
        Logger.log(`Updated start date for ${projectName}: ${oldestDate}`);
      } else {
        Logger.log(`No valid dates found for ${projectName} in Bitácora.`);
      }
    }
  }
}
