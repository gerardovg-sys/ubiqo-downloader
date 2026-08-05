/**
 * Main function to be triggered.
 * Checks "Bitácora" for "NO" reports and cross-references with "Reportes limpios".
 * -- THIS VERSION INCLUDES DETAILED CONTEXT (SOURCE, ROW, PROJECT) IN ALL LOGS --
 */
function checkPendingReports() {
  // --- Configuration ---
  const ss1_ID = "18GFvQZdpmALvmmTFc70dXENJxImMR3bkHU04IG_UyyY";
  const bitacoraSheetName = "Bitácora";
  const ss2_ID = "1QeFcpTbwfMRMLjoN0ghaFPNqm-EDg_1rqeQb-yp568w";
  const reportesSheetName = "Reportes limpios";
  
  const bitacoraCols = {
    fecha: "FECHA",
    proyecto: "PROYECTO",
    reporteEnv: "REPORTE ENV."
  };
  const reportesCols = {
    fecha: "Fecha de visita",
    proyecto: "Proyecto / Ticket Soporte / Levantamiento",
    addedTime: "Added Time"
  };
  // --- End Configuration ---
  
  const S1_SOURCE_NAME = `Bitácora (ss1)`;
  const S2_SOURCE_NAME = `Reportes limpios (ss2)`;

  try {
    // 1. Get connections to both sheets
    const ss1 = SpreadsheetApp.openById(ss1_ID);
    const bitacoraSheet = ss1.getSheetByName(bitacoraSheetName);
    if (!bitacoraSheet) {
      throw new Error(`Sheet "${bitacoraSheetName}" not found in ss1.`);
    }

    const ss2 = SpreadsheetApp.openById(ss2_ID);
    const reportesSheet = ss2.getSheetByName(reportesSheetName);
    if (!reportesSheet) {
      throw new Error(`Sheet "${reportesSheetName}" not found in ss2.`);
    }

    // 2. Build the lookup map from "Reportes limpios"
    // Pass the source name to the function for logging
    const reportesMap = buildReportesMap(reportesSheet, reportesCols, S2_SOURCE_NAME);
    Logger.log(`(Source: ${S2_SOURCE_NAME}) Built lookup map with ${Object.keys(reportesMap).length} entries.`);

    // 3. Get "Bitácora" data and headers
    const bitacoraRange = bitacoraSheet.getDataRange();
    const bitacoraData = bitacoraRange.getValues();
    const bitacoraHeaders = bitacoraData.shift(); // Remove headers
    
    const bitacoraIndices = getHeaderIndices(bitacoraHeaders, bitacoraCols, S1_SOURCE_NAME);

    // 4. Define the 3-month date filter
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 2);
    threeMonthsAgo.setHours(0, 0, 0, 0); // Set to start of the day
    
    Logger.log(`--- Starting Report Check (Source: ${S1_SOURCE_NAME}) ---`);
    let updatesMade = 0;
    let rowsChecked = 0;
    const updates = []; // To store updates

    // 5. Iterate through "Bitácora" data
    for (let i = 0; i < bitacoraData.length; i++) {
      const row = bitacoraData[i];
      const sheetRowIndex = i + 2; // +1 for 1-based index, +1 for shifted header
      
      const reporteEnv = row[bitacoraIndices.reporteEnv];
      const bitacoraProject = row[bitacoraIndices.proyecto].toString().trim();
      const fechaVal = row[bitacoraIndices.fecha];

      // Condition 1: Is report pending?
      if (reporteEnv.toString().toUpperCase() === "NO") {
        rowsChecked++; // Count this as a row we are actively checking
        
        const bitacoraDate = parseCustomDate(fechaVal);

        if (!bitacoraDate) {
          Logger.log(`(Source: ${S1_SOURCE_NAME}) Row ${sheetRowIndex} (Project: ${bitacoraProject}): Outcome -> NO. (SKIPPED: Invalid 'FECHA' format: "${fechaVal}")`);
          continue;
        }

        // Condition 2: Is it within the last 3 months?
        if (bitacoraDate >= threeMonthsAgo) {
          
          const normalizedDateKey = `${bitacoraDate.getDate()}/${bitacoraDate.getMonth() + 1}/${bitacoraDate.getFullYear()}`;
          const lookupKey = `${bitacoraProject}|${normalizedDateKey}`;

          // Condition 3: Does a matching report exist in the map?
          if (reportesMap.hasOwnProperty(lookupKey)) {
            
            const addedTime = reportesMap[lookupKey]; // This is a Date object

            // Condition 4: Was it added *after* the service date?
            if (addedTime > bitacoraDate) {
              
              const sheetColIndex = bitacoraIndices.reporteEnv + 1; // +1 for 1-based index
              updates.push({
                range: bitacoraSheet.getRange(sheetRowIndex, sheetColIndex),
                value: "FT"
              });
              updatesMade++;
              Logger.log(`(Source: ${S1_SOURCE_NAME}) Row ${sheetRowIndex} (Project: ${bitacoraProject}): Outcome -> FT. (Found matching report added at ${addedTime.toLocaleString()})`);
              
            } else {
              Logger.log(`(Source: ${S1_SOURCE_NAME}) Row ${sheetRowIndex} (Project: ${bitacoraProject}): Outcome -> NO. (Match found, but 'Added Time' ${addedTime.toLocaleString()} is not after 'FECHA' ${bitacoraDate.toLocaleDateString()})`);
            }
          } else {
            Logger.log(`(Source: ${S1_SOURCE_NAME}) Row ${sheetRowIndex} (Project: ${bitacoraProject}): Outcome -> NO. (No matching report found for date ${normalizedDateKey})`);
          }
        } else {
          Logger.log(`(Source: ${S1_SOURCE_NAME}) Row ${sheetRowIndex} (Project: ${bitacoraProject}): Outcome -> NO. (SKIPPED: 'FECHA' ${fechaVal} is older than 3 months)`);
        }
      }
    }
    
    Logger.log(`--- Report Check Finished (Source: ${S1_SOURCE_NAME}) ---`);

    // 6. Apply all updates to the sheet
    if (updates.length > 0) {
      updates.forEach(update => {
        update.range.setValue(update.value);
      });
      Logger.log(`(Source: ${S1_SOURCE_NAME}) Summary: ${updatesMade} rows updated to 'FT'. ${rowsChecked - updatesMade} 'NO' rows checked remained 'NO'.`);
    } else {
      Logger.log(`(Source: ${S1_SOURCE_NAME}) Summary: No updates were necessary. ${rowsChecked} 'NO' rows checked.`);
    }

  } catch (e) {
    Logger.log(`(Source: ${S1_SOURCE_NAME}) CRITICAL ERROR in checkPendingReports: ${e.message}`);
    Logger.log(e.stack);
  }
}

/**
 * Helper function to find column indices from header names.
 */
function getHeaderIndices(headers, colNames, sourceName = 'Unknown') {
  const indices = {};
  for (const key in colNames) {
    const colName = colNames[key];
    const index = headers.indexOf(colName);
    if (index === -1) {
      throw new Error(`(Source: ${sourceName}) Required header not found: "${colName}"`);
    }
    indices[key] = index;
  }
  return indices;
}

/**
 * Builds a lookup map from the "Reportes limpios" sheet.
 * Includes detailed logging with source, row, and project.
 */
function buildReportesMap(sheet, colNames, sourceName) {
  const data = sheet.getDataRange().getValues();
  const headers = data.shift(); // Remove headers
  const indices = getHeaderIndices(headers, colNames, sourceName);
  
  const map = {};

  data.forEach((row, i) => {
    const sheetRowIndex = i + 2; // +1 for 0-based index, +1 for shifted header
    let project = `(Project Unknown: Col ${indices.proyecto})`;
    try {
      project = row[indices.proyecto].toString().trim();
      const fechaVisitaVal = row[indices.fecha];
      const addedTimeVal = row[indices.addedTime];

      // Skip if essential data is missing
      if (!project || !fechaVisitaVal || !addedTimeVal) {
        // Log only if project was found but other data is missing
        if(project) {
           Logger.log(`(Source: ${sourceName}) Row ${sheetRowIndex} (Project: ${project}): Skipped. (Missing required data)`);
        }
        return;
      }

      const fechaVisita = parseCustomDate(fechaVisitaVal);
      if (!fechaVisita) {
        Logger.log(`(Source: ${sourceName}) Row ${sheetRowIndex} (Project: ${project}): Skipped. (Invalid 'Fecha de visita' format: "${fechaVisitaVal}")`);
        return;
      }

      const addedTime = parseCustomDate(addedTimeVal, true); // true = has time
      if (!addedTime) {
        Logger.log(`(Source: ${sourceName}) Row ${sheetRowIndex} (Project: ${project}): Skipped. (Invalid 'Added Time' format: "${addedTimeVal}")`);
        return;
      }
      
      const normalizedDateKey = `${fechaVisita.getDate()}/${fechaVisita.getMonth() + 1}/${fechaVisita.getFullYear()}`;
      const compositeKey = `${project}|${normalizedDateKey}`;
      
      map[compositeKey] = addedTime;

    } catch (e) {
      Logger.log(`(Source: ${sourceName}) Error processing row ${sheetRowIndex} (Project: ${project}): ${e.message}.`);
    }
  });
  return map;
}

/**
 * Robustly parses date strings (dd/mm/yy, dd/mm/yyyy, dd/mm/yyyy hh:mm:ss)
 * or a valid Date object.
 * -- This version does NOT log on failure, it just returns null. --
 * -- The calling function is responsible for logging the context. --
 */
function parseCustomDate(dateInput, hasTime = false) {
  if (dateInput instanceof Date) {
    return dateInput;
  }
  
  if (typeof dateInput !== 'string' || dateInput.trim() === "") {
    return null;
  }

  try {
    let day, month, year;
    let hours = 0, minutes = 0, seconds = 0;
    
    const parts = dateInput.split(' ');
    
    // Check for "25-Aug-2025" format
    if (parts[0].includes('-')) {
      const dateParts = parts[0].split('-');
      if (dateParts.length === 3) {
        day = parseInt(dateParts[0], 10);
        month = new Date(Date.parse(dateParts[1] + " 1, 2012")).getMonth(); // Convert "Aug" to 7 (0-indexed)
        year = parseInt(dateParts[2], 10);
      } else {
        return null; // Invalid dash-format
      }
    } 
    // Check for "dd/mm/yyyy" format
    else if (parts[0].includes('/')) {
      const dateParts = parts[0].split('/');
      day = parseInt(dateParts[0], 10);
      month = parseInt(dateParts[1], 10) - 1; // Month is 0-indexed in JS Date
      year = parseInt(dateParts[2], 10);
    } 
    // Unrecognized format
    else {
      return null;
    }
    
    // Handle 2-digit year (yy) -> yyyy
    if (year < 100) {
      year += 2000; // Assume 21st century (e.g., 25 -> 2025)
    }

    if (hasTime && parts.length > 1 && parts[1]) {
      const timeParts = parts[1].split(':');
      hours = parseInt(timeParts[0], 10) || 0;
      minutes = parseInt(timeParts[1], 10) || 0;
      seconds = parseInt(timeParts[2], 10) || 0;
    }

    if (isNaN(day) || isNaN(month) || isNaN(year)) {
      return null;
    }

    const dateObj = new Date(year, month, day, hours, minutes, seconds);
    
    if (dateObj.getFullYear() !== year || dateObj.getMonth() !== month || dateObj.getDate() !== day) {
        return null; // Date overflow (e.g., Feb 31)
    }
    
    return dateObj;

  } catch (e) {
    // Failure to parse, return null. The calling function will log the error.
    return null;
  }
}