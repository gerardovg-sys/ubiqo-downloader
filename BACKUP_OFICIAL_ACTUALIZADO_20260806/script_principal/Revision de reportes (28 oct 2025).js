// --- IDs and Sheet Names ---
const SPREADSHEET_ID_1 = '18GFvQZdpmALvmmTFc70dXENJxImMR3bkHU04IG_UyyY'; // 'Bitácora' sheet
const SPREADSHEET_ID_2 = '1QeFcpTbwfMRMLjoN0ghaFPNqm-EDg_1rqeQb-yp568w'; // 'Reportes limpios' & Form Responses
const BITACORA_SHEET_NAME = 'Bitácora';
const REPORTES_SHEET_NAME = 'Reportes limpios';
const FORM_RESPONSE_SHEET_NAME = 'Reportes'; // Raw form data

// --- "NA" PROJECT LIST ---
// --- Edit this list to change which projects are set to "NA" ---
const NA_PROJECTS = new Set([
  'SMARTHAUS GASTOS',
  'FALTAS'
]);
// --- END "NA" SECTION ---

// --- List of ALL 22 columns to be parsed ---
// Both 'Reportes' and 'Reportes limpios' MUST contain all these headers.
// The order does not matter.
const ALL_COLUMN_NAMES = [
  'Added Time',
  'Proyecto / Ticket Soporte / Levantamiento',
  'Persona quien llena el formulario',
  'Fecha de visita',
  'Equipo integrado por:',
  'Hora de inicio de actividades:',
  'Hora de término de actividades:',
  'Actividades realizadas:',
  'Actividades pendientes:',
  'El proyecto / ticket / levantamiento se encuentra:',
  '¿Acudió personal de apoyo?',
  'Personal de apoyo:',
  'Número de días para terminar',
  'Número de técnicos para terminar',
  'Material o equipo para regresar',
  'Comentarios',
  '¿Acudió personal de PMI?',
  '¿Cuáles son sus nombres?',
  '¿Se trabajaron las 8 horas efectivas?',
  '¿Por que no?',
  '¿Se trabajaron horas extra?',
  'Cantidad de horas extras',
  'El proyecto / ticket / levantamiento se encuentra:'
];

// --- Column Headers for the CHECKER script ---
// The checker *only* needs these columns from 'Reportes limpios'
const COL_REPORTES_CHECKER = {
  ADDED_TIME: 'Added Time',
  PROYECTO: 'Proyecto / Ticket Soporte / Levantamiento',
  FECHA_VISITA: 'Fecha de visita',
  HORA_TERMINO: 'Hora de término de actividades:' // <-- NEW COLUMN FOR 9 PM RULE
};

// --- Column Headers for the BITACORA script ---
const COL_BITACORA = {
  FECHA: 'FECHA',
  PROYECTO: 'PROYECTO',
  REPORTE_ENV: 'REPORTE ENV.'
};

// --- Time Constants ---
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const NINE_PM_MS = 21 * 60 * 60 * 1000; // 9 PM = 21:00

// ===================================================================
// --- SCRIPT 1: REPORT PARSER FUNCTIONS ---
// (Dynamically maps all 22 columns)
// ===================================================================

/**
 * Main function to process raw form responses.
 * It reads from 'Reportes', checks for duplicates in 'Reportes limpios',
 * and copies new data to 'Reportes limpios', mapping all 22 columns.
 */
function runReportParser() {
  Logger.log('--- Starting Report Parser ---');
  const ui = SpreadsheetApp.getUi(); // For alerts, in case of manual run
  
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID_2); // Opens Spreadsheet 2
    const formSheet = ss.getSheetByName(FORM_RESPONSE_SHEET_NAME);
    const reportSheet = ss.getSheetByName(REPORTES_SHEET_NAME);

    if (!formSheet) throw new Error(`Sheet not found: "${FORM_RESPONSE_SHEET_NAME}"`);
    if (!reportSheet) throw new Error(`Sheet not found: "${REPORTES_SHEET_NAME}"`);

    // --- 1. Get Destination Headers and Build Duplicate Check ---
    const reportesLimpiosData = reportSheet.getDataRange().getValues();
    const destHeaders = reportesLimpiosData.shift() || []; // Headers of 'Reportes limpios'
    const destColCount = destHeaders.length;
    
    // Find indices of the 3 "key" columns for duplicate checking
    const destKeyCols = findHeaderIndices(destHeaders, [
      'Added Time', 
      'Proyecto / Ticket Soporte / Levantamiento', 
      'Fecha de visita'
    ]);
    
    const existingReports = new Set();
    reportesLimpiosData.forEach(row => {
      const addedTime = parseAndNormalizeDate(row[destKeyCols['Added Time']]);
      const proyecto = row[destKeyCols['Proyecto / Ticket Soporte / Levantamiento']];
      const fechaVisita = parseAndNormalizeDate(row[destKeyCols['Fecha de visita']]);

      if (proyecto && fechaVisita && addedTime) {
        const key = `${addedTime.getTime()}|${proyecto}|${fechaVisita.getTime()}`;
        existingReports.add(key);
      }
    });
    Logger.log(`Found ${existingReports.size} reports already in 'Reportes limpios'.`);

    // --- 2. Get Source Data and Build Column Map ---
    const formSheetData = formSheet.getDataRange().getValues();
    const sourceHeaders = formSheetData.shift() || []; // Headers of 'Reportes'
    
    // Create a dynamic map from source to destination
    const sourceColMap = {};
    const destHeaderIndices = findHeaderIndices(destHeaders, ALL_COLUMN_NAMES);
    const sourceHeaderIndices = findHeaderIndices(sourceHeaders, ALL_COLUMN_NAMES);

    ALL_COLUMN_NAMES.forEach(colName => {
      const sourceIndex = sourceHeaderIndices[colName];
      const destIndex = destHeaderIndices[colName];
      
      if (sourceIndex > -1 && destIndex > -1) {
        sourceColMap[sourceIndex] = destIndex;
      }
    });
    Logger.log(`Mapped ${Object.keys(sourceColMap).length} columns between sheets.`);

    // We also need the source indices for our "key" columns for checking
    const sourceKeyCols = findHeaderIndices(sourceHeaders, [
      'Added Time', 
      'Proyecto / Ticket Soporte / Levantamiento', 
      'Fecha de visita'
    ]);
    
    // --- 3. Process Source Data and Find New Rows ---
    let lastReportRow = reportSheet.getLastRow();
    const newDataToAppend = [];
    
    Logger.log(`Found ${formSheetData.length} data rows in form responses.`);

    formSheetData.forEach(sourceRow => {
      // Get the key data from the *source* row
      const addedTime = parseAndNormalizeDate(sourceRow[sourceKeyCols['Added Time']]);
      const proyecto = sourceRow[sourceKeyCols['Proyecto / Ticket Soporte / Levantamiento']];
      const fechaVisita = parseAndNormalizeDate(sourceRow[sourceKeyCols['Fecha de visita']]);

      if (proyecto && fechaVisita && addedTime) {
        // Create the unique key to check for duplicates
        const key = `${addedTime.getTime()}|${proyecto}|${fechaVisita.getTime()}`;

        if (!existingReports.has(key)) {
          // This is a new report! Create the new row.
          const newRow = new Array(destColCount).fill(null); // Create empty row
          
          // Use our dynamic map to fill the row
          for (const sourceIndex in sourceColMap) {
            const destIndex = sourceColMap[sourceIndex];
            newRow[destIndex] = sourceRow[sourceIndex];
          }
          
          newDataToAppend.push(newRow);
          existingReports.add(key); // Add to set to prevent duplicates from same run
        }
      }
    });

    // --- 4. Write New Data ---
    if (newDataToAppend.length > 0) {
      Logger.log(`Adding ${newDataToAppend.length} new rows to 'Reportes limpios'.`);
      // Paste data, using the correct column count from the destination sheet
      reportSheet.getRange(lastReportRow + 1, 1, newDataToAppend.length, destColCount).setValues(newDataToAppend);
      
    } else {
      Logger.log('No new reports to parse.');
    }
    
    Logger.log('--- Report Parser Finished ---');

  } catch(e) {
    Logger.log(`SCRIPT ERROR (Parser): ${e.message}\nStack: ${e.stack}`);
    ui.alert(`Script Error (Parser): ${e.message}\nStack: ${e.stack}`);
  }
}

/**
 * Helper function: Finds the indices of multiple columns.
 * @param {string[]} headers - The array of header names.
 * @param {string[]} colNamesToFind - The column names to find.
 * @return {Object} An object mapping column names to their 0-based index.
 */
function findHeaderIndices(headers, colNamesToFind) {
  const indices = {};
  colNamesToFind.forEach(colName => {
    const index = headers.indexOf(colName);
    if (index === -1) {
      Logger.log(`Warning: Column not found: "${colName}"`);
      // We don't throw an error, just return -1. This allows the script
      // to run even if a non-essential column is missing.
    }
    indices[colName] = index;
  });
  return indices;
}


// ===================================================================
// --- SCRIPT 2: BITÁCORA REPORT CHECKER FUNCTIONS ---
// (Now includes the 9 PM grace period logic)
// ===================================================================

/**
 * MANUAL function to run the report check logic.
 * This function NOW RUNS THE PARSER FIRST.
 */
function runReportCheck() {
  const ui = SpreadsheetApp.getUi();
  
  // --- STEP 1: RUN THE PARSER ---
  Logger.log('Starting Step 1: Parsing new reports...');
  ui.alert('Step 1 of 2: Parsing new reports. Please wait...');
  runReportParser();
  Logger.log('Parser finished. Starting Step 2: Report Check.');
  ui.alert('Step 1 complete. \n\nStep 2 of 2: Please enter the date to check.');
  // --- END STEP 1 ---

  Logger.log('--- Starting Manual Report Check ---');

  // 1. Get Target Date
  const dateResponse = ui.prompt('Check Reports', 'Enter the date to check (e.g., dd/mm/yy or dd/mm/yyyy):', ui.ButtonSet.OK_CANCEL);

  if (dateResponse.getSelectedButton() !== ui.Button.OK) {
    Logger.log('User cancelled the prompt.');
    return; // User cancelled
  }

  const dateString = dateResponse.getResponseText();
  const targetDate = parseAndNormalizeDate(dateString);

  if (!targetDate) {
    ui.alert('Error', `Invalid date format: "${dateString}". Please use dd/mm/yy or dd/mm/yyyy.`, ui.ButtonSet.OK);
    Logger.log(`Error: Invalid date format: "${dateString}"`);
    return;
  }

  const targetDateTime = targetDate.getTime();
  Logger.log(`Target date parsed: ${targetDate.toDateString()}`);

  try {
    // 2. Read Data
    Logger.log('Opening spreadsheets...');
    const ss1 = SpreadsheetApp.openById(SPREADSHEET_ID_1);
    const ss2 = SpreadsheetApp.openById(SPREADSHEET_ID_2);

    const bitacoraSheet = ss1.getSheetByName(BITACORA_SHEET_NAME);
    const reportesSheet = ss2.getSheetByName(REPORTES_SHEET_NAME);

    if (!bitacoraSheet) throw new Error(`Sheet not found: "${BITACORA_SHEET_NAME}" in SS1`);
    if (!reportesSheet) throw new Error(`Sheet not found: "${REPORTES_SHEET_NAME}" in SS2`);

    Logger.log('Reading data from "Bitácora" (ss1)...');
    const bitacoraData = bitacoraSheet.getDataRange().getValues();
    Logger.log(`Read ${bitacoraData.length} rows from "Bitácora".`);

    Logger.log('Reading data from "Reportes limpios" (ss2)...');
    const reportesData = reportesSheet.getDataRange().getValues();
    Logger.log(`Read ${reportesData.length} rows from "Reportes limpios".`);

    // 3. Find Column Indices
    const bitacoraHeaders = bitacoraData.shift(); // Remove header row
    const reportesHeaders = reportesData.shift(); // Remove header row

    // This uses the *checker-specific* column list, which is correct.
    const bCols = findColumns(bitacoraHeaders, COL_BITACORA);
    const rCols = findColumns(reportesHeaders, COL_REPORTES_CHECKER);
    Logger.log('Column headers found successfully.');

    // 4. Build Report Map (from ss2, 'Reportes limpios')
    const reportMap = new Map();

    reportesData.forEach(row => {
      const proyecto = row[rCols.PROYECTO];
      const fechaVisita = parseAndNormalizeDate(row[rCols.FECHA_VISITA]);
      const addedTime = parseAndNormalizeDate(row[rCols.ADDED_TIME]);
      // --- NEW ---
      const horaTerminoStr = row[rCols.HORA_TERMINO];
      const finishTimestamp = getFullFinishTimestamp(fechaVisita, horaTerminoStr);
      // --- END NEW ---

      if (proyecto && fechaVisita && addedTime) {
        const key = `${proyecto}|${fechaVisita.getTime()}`;
        // Store both submission time and finish time
        reportMap.set(key, { submissionTime: addedTime, finishTimestamp: finishTimestamp });
      }
    });
    Logger.log(`Built Report Map with ${reportMap.size} entries.`);

    // 5. Process "Bitácora" (ss1) - Build list of updates
    const updatesToMake = []; // Will store {row: R, col: C, value: V}
    let rowsToUpdate = 0;

    for (let i = 0; i < bitacoraData.length; i++) {
      const row = bitacoraData[i];
      const originalValue = row[bCols.REPORTE_ENV];
      const fechaBitacora = parseAndNormalizeDate(row[bCols.FECHA]);

      // Check A: Match Target Date?
      if (fechaBitacora && fechaBitacora.getTime() === targetDateTime) {
        // Check B: Already Filled?
        if (String(originalValue).trim() === '') {
          // Get project name. Make it a string and trim whitespace just in case
          const proyecto = String(row[bCols.PROYECTO]).trim();
          const currentRowNum = i + 2; // +1 for 0-index, +1 for shifted header
          let newValue = '';

          // --- "NA" CHECK ---
          if (NA_PROJECTS.has(proyecto)) {
            newValue = 'NA';
          } else {
            // --- UPDATED LOGIC (now in 'else' block) ---
            const key = `${proyecto}|${targetDateTime}`;

            if (reportMap.has(key)) {
              // Report Found
              const reportData = reportMap.get(key);
              const submissionDateTime = reportData.submissionTime.getTime();
              const finishTimestamp = reportData.finishTimestamp; // This is a number (timestamp)

              if (submissionDateTime === targetDateTime) {
                // Case 1: Submitted same day
                newValue = 'SI';
              } else if (submissionDateTime === targetDateTime + ONE_DAY_MS) {
                // Case 2: Submitted next day. Check for grace period.
                const gracePeriodStart = targetDateTime + NINE_PM_MS; // 9 PM on the visit day
                
                if (finishTimestamp && finishTimestamp >= gracePeriodStart) {
                  // Case 3: Finished late, so next-day submission is OK
                  newValue = 'SI';
                } else {
                  // Case 4: Finished early, next-day is LATE
                  newValue = 'FT';
                }
              } else if (submissionDateTime > targetDateTime + ONE_DAY_MS) {
                 // Case 5: Submitted 2+ days later. Always late.
                 newValue = 'FT';
              } else {
                 // Case 6: Submitted *before* the visit date.
                 newValue = 'CHECK';
              }
            } else {
              // No Report Found
              newValue = 'NO';
            }
          } // --- END NEW/EXISTING LOGIC ---

          Logger.log(`Row ${currentRowNum}: Project "${proyecto}". Setting: "${newValue}"`);
          // Add this update to our list
          updatesToMake.push({
            row: currentRowNum,
            col: bCols.REPORTE_ENV + 1, // +1 for 1-based index
            value: newValue
          });
          rowsToUpdate++;
        }
      }
    }

    Logger.log(`Processing complete. ${rowsToUpdate} rows will be updated.`);

    // 6. Write All Updates (One by one to avoid timeout)
    if (updatesToMake.length > 0) {
      Logger.log('Writing updates to "Bitácora" sheet one by one...');

      updatesToMake.forEach(update => {
        bitacoraSheet.getRange(update.row, update.col).setValue(update.value);
      });

      // Force the spreadsheet to save all pending changes
      SpreadsheetApp.flush();
      Logger.log('Write complete and flushed.');
    } else {
      Logger.log('No updates to write.');
    }

    ui.alert('Process Complete', `Checked reports for ${dateString}.\n${rowsToUpdate} rows were updated.`, ui.ButtonSet.OK);

  } catch (e) {
    Logger.log(`SCRIPT ERROR (Checker): ${e.message}\nStack: ${e.stack}`);
    ui.alert('Script Error (Checker)', `An error occurred: ${e.message}\nStack: ${e.stack}`, ui.ButtonSet.OK);
  }
}

/**
 * AUTOMATED version of the script that runs for "yesterday's" date.
 * Designed to be run on a daily time-based trigger.
 * This function NOW RUNS THE PARSER FIRST.
 */
function runReportCheck_Yesterday() {
  Logger.log('--- Starting Daily Triggered Report Check (for Yesterday) ---');

  // --- STEP 1: RUN THE PARSER (Silently) ---
  Logger.log('Starting Step 1: Parsing new reports...');
  try {
    runReportParser();
    Logger.log('Parser finished. Starting Step 2: Report Check for Yesterday.');
  } catch (e) {
    Logger.log(`CRITICAL ERROR: Parser failed during automated run: ${e.message}\nStack: ${e.stack}`);
    // Optional: Send an email on failure
    // MailApp.sendEmail("your-email@example.com", "Script Error: Report PARSER", `An error occurred: ${e.message}\nStack: ${e.stack}`);
    return; // Stop execution if parser fails
  }
  // --- END STEP 1 ---

  // 1. Get Target Date (Yesterday)
  const today = new Date();
  const targetDate = new Date(today);
  targetDate.setDate(today.getDate() - 1); // Set to yesterday

  // Normalize to midnight, just like the manual script
  targetDate.setHours(0, 0, 0, 0);

  const targetDateTime = targetDate.getTime();
  Logger.log(`Target date is: ${targetDate.toDateString()}`);

  try {
    // 2. Read Data
    Logger.log('Opening spreadsheets...');
    const ss1 = SpreadsheetApp.openById(SPREADSHEET_ID_1);
    const ss2 = SpreadsheetApp.openById(SPREADSHEET_ID_2);

    const bitacoraSheet = ss1.getSheetByName(BITACORA_SHEET_NAME);
    const reportesSheet = ss2.getSheetByName(REPORTES_SHEET_NAME);

    if (!bitacoraSheet) throw new Error(`Sheet not found: "${BITACORA_SHEET_NAME}" in SS1`);
    if (!reportesSheet) throw new Error(`Sheet not found: "${REPORTES_SHEET_NAME}" in SS2`);

    Logger.log('Reading data from "Bitácora" (ss1)...');
    const bitacoraData = bitacoraSheet.getDataRange().getValues();
    Logger.log(`Read ${bitacoraData.length} rows from "Bitácora".`);

    Logger.log('Reading data from "Reportes limpios" (ss2)...');
    const reportesData = reportesSheet.getDataRange().getValues();
    Logger.log(`Read ${reportesData.length} rows from "Reportes limpios".`);

    // 3. Find Column Indices
    const bitacoraHeaders = bitacoraData.shift(); // Remove header row
    const reportesHeaders = reportesData.shift(); // Remove header row

    const bCols = findColumns(bitacoraHeaders, COL_BITACORA);
    const rCols = findColumns(reportesHeaders, COL_REPORTES_CHECKER);
    Logger.log('Column headers found successfully.');

    // 4. Build Report Map (from ss2)
    const reportMap = new Map();

    reportesData.forEach(row => {
      const proyecto = row[rCols.PROYECTO];
      const fechaVisita = parseAndNormalizeDate(row[rCols.FECHA_VISITA]);
      const addedTime = parseAndNormalizeDate(row[rCols.ADDED_TIME]);
      // --- NEW ---
      const horaTerminoStr = row[rCols.HORA_TERMINO];
      const finishTimestamp = getFullFinishTimestamp(fechaVisita, horaTerminoStr);
      // --- END NEW ---

      if (proyecto && fechaVisita && addedTime) {
        const key = `${proyecto}|${fechaVisita.getTime()}`;
        reportMap.set(key, { submissionTime: addedTime, finishTimestamp: finishTimestamp });
      }
    });
    Logger.log(`Built Report Map with ${reportMap.size} entries.`);

    // 5. Process "Bitácora" (ss1) - Build list of updates
    const updatesToMake = []; // Will store {row: R, col: C, value: V}
    let rowsToUpdate = 0;

    for (let i = 0; i < bitacoraData.length; i++) {
      const row = bitacoraData[i];
      const originalValue = row[bCols.REPORTE_ENV];
      const fechaBitacora = parseAndNormalizeDate(row[bCols.FECHA]);

      // Check A: Match Target Date?
      if (fechaBitacora && fechaBitacora.getTime() === targetDateTime) {
        // Check B: Already Filled?
        if (String(originalValue).trim() === '') {
          const proyecto = String(row[bCols.PROYECTO]).trim();
          const currentRowNum = i + 2; // +1 for 0-index, +1 for shifted header
          let newValue = '';

          // --- "NA" CHECK ---
          if (NA_PROJECTS.has(proyecto)) {
            newValue = 'NA';
          } else {
            // --- UPDATED LOGIC (now in 'else' block) ---
            const key = `${proyecto}|${targetDateTime}`;

            if (reportMap.has(key)) {
              // Report Found
              const reportData = reportMap.get(key);
              const submissionDateTime = reportData.submissionTime.getTime();
              const finishTimestamp = reportData.finishTimestamp;

              if (submissionDateTime === targetDateTime) {
                // Case 1: Submitted same day
                newValue = 'SI';
              } else if (submissionDateTime === targetDateTime + ONE_DAY_MS) {
                // Case 2: Submitted next day. Check for grace period.
                const gracePeriodStart = targetDateTime + NINE_PM_MS; // 9 PM on the visit day
                
                if (finishTimestamp && finishTimestamp >= gracePeriodStart) {
                  // Case 3: Finished late, so next-day submission is OK
                  newValue = 'SI';
                } else {
                  // Case 4: Finished early, next-day is LATE
                  newValue = 'FT';
                }
              } else if (submissionDateTime > targetDateTime + ONE_DAY_MS) {
                 // Case 5: Submitted 2+ days later. Always late.
                 newValue = 'FT';
              } else {
                 // Case 6: Submitted *before* the visit date.
                 newValue = 'CHECK';
              }
            } else {
              // No Report Found
              newValue = 'NO';
            }
          } // --- END NEW/EXISTING LOGIC ---

          Logger.log(`Row ${currentRowNum}: Project "${proyecto}". Setting: "${newValue}"`);
          updatesToMake.push({
            row: currentRowNum,
            col: bCols.REPORTE_ENV + 1, // +1 for 1-based index
            value: newValue
          });
          rowsToUpdate++;
        }
      }
    }

    Logger.log(`Processing complete. ${rowsToUpdate} rows will be updated.`);

    // 6. Write All Updates (One by one to avoid timeout)
    if (updatesToMake.length > 0) {
      Logger.log('Writing updates to "Bitácora" sheet one by one...');

      updatesToMake.forEach(update => {
        bitacoraSheet.getRange(update.row, update.col).setValue(update.value);
      });

      SpreadsheetApp.flush();
      Logger.log('Write complete and flushed.');
    } else {
      Logger.log('No updates to write.');
    }

    Logger.log(`Process Complete. Checked reports for ${targetDate.toDateString()}.\n${rowsToUpdate} rows were updated.`);

  } catch (e) {
    Logger.log(`SCRIPT ERROR (Checker): ${e.message}\nStack: ${e.stack}`);
    // Optional: Send an email on failure
    // MailApp.sendEmail("your-email@example.com", "Script Error: Report CHECKER", `An error occurred: ${e.message}\nStack: ${e.stack}`);
  }
}


// ===================================================================
// --- COMMON HELPER FUNCTIONS ---
// (Used by both Parser and Checker)
// ===================================================================

/**
 * Utility to find column indices from headers (for 'Bitácora' and 'Reportes limpios').
 * This is the simple version for the CHECKER.
 */
function findColumns(headers, colNames) {
  const indices = {};
  for (const key in colNames) {
    const colName = colNames[key];
    const index = headers.indexOf(colName);
    if (index === -1) {
      throw new Error(`Could not find required column: "${colName}"`);
    }
    indices[key] = index;
  }
  return indices;
}

/**
 * --- NEW HELPER FUNCTION ---
 * Combines a visit date with a "hh:mm am/pm" time string to create
 * a full, accurate timestamp for the end of a shift.
 * Handles "next morning" (e.g., 2:00 am) finish times.
 * @param {Date} visitDate - The date of the visit (normalized to midnight).
 * @param {string} finishTimeInput - A string, e.g., "10:30 pm" or "2:00 am".
 * @return {number|null} A JS timestamp (milliseconds) or null if invalid.
 */
function getFullFinishTimestamp(visitDate, finishTimeInput) {
  if (!visitDate || typeof finishTimeInput !== 'string' || finishTimeInput.trim() === '') {
    return null;
  }

  try {
    // 1. Parse the "hh:mm am/pm" string
    const timeParts = finishTimeInput.match(/(\d{1,2}):(\d{2})\s*(am|pm)/i);
    if (!timeParts) {
      Logger.log(`Invalid time format: "${finishTimeInput}"`);
      return null;
    }

    let hours = parseInt(timeParts[1], 10);
    const minutes = parseInt(timeParts[2], 10);
    const period = timeParts[3].toLowerCase();

    // 2. Convert to 24-hour format
    if (period === 'pm' && hours !== 12) {
      hours += 12;
    } else if (period === 'am' && hours === 12) {
      hours = 0; // Midnight case
    }
    
    // 3. Create the new timestamp
    const finishTimestamp = new Date(visitDate.getTime());
    finishTimestamp.setHours(hours, minutes, 0, 0);

    // 4. Handle "next morning" scenario
    // If shift ends between 12 AM (0) and 6 AM (6), assume it's the *next* day.
    if (hours >= 0 && hours <= 6) {
      finishTimestamp.setDate(finishTimestamp.getDate() + 1);
    }
    
    return finishTimestamp.getTime();

  } catch (e) {
    Logger.log(`Error parsing finish time: ${e.message}`);
    return null;
  }
}


/**
 * Parses various date formats (strings or date objects)
 * and returns a Date object set to midnight.
 */
function parseAndNormalizeDate(dateInput) {
  try {
    if (!dateInput) return null;

    let date;

    // Case 1: Already a Date object (from spreadsheet)
    if (dateInput instanceof Date) {
      date = dateInput;
    }
    // Case 2: String
    else if (typeof dateInput === 'string') {
      const parts = dateInput.trim().split(' ')[0].split('/'); // Gets 'dd/mm/yy' or 'dd/mm/yyyy'
      if (parts.length !== 3) return null;

      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10); // Month is 1-based in string
      let year = parseInt(parts[2], 10);

      if (isNaN(day) || isNaN(month) || isNaN(year)) return null;

      // Handle 'yy' format
      if (year < 100) {
        year += 2000;
      }

      // Create date (month is 0-based in Date constructor)
      date = new Date(year, month - 1, day);

      // Validate parse (e.g., 31/02/2025 becomes 03/03/2025)
      if (date.getDate() !== day || date.getMonth() !== (month - 1) || date.getFullYear() !== year) {
        return null; // Invalid date
      }
    } else {
      return null; // Not a string or date
    }

    // Normalize to midnight
    date.setHours(0, 0, 0, 0);
    return date;

  } catch (e) {
    return null; // Return null on any parsing error
  }
}

