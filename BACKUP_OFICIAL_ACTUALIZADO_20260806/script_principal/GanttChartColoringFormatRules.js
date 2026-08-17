/**
 * Optimized Gantt Formatting Script (Contains-Search Version)
 * Highlights cells if they CONTAIN the text in dropdowns C5, C6, C7, or C8.
 */
function refreshGanttFormatting() {
  const ss = SpreadsheetApp.openById("18GFvQZdpmALvmmTFc70dXENJxImMR3bkHU04IG_UyyY");
  const sheet = ss.getSheetByName("Cronograma / Técnicos");
  
  // 1. DYNAMIC RANGE IDENTIFICATION (Stop at first gap in Col C)
  const colCValues = sheet.getRange("C15:C").getValues();
  let lastTechRow = 14; 
  
  for (let i = 0; i < colCValues.length; i++) {
    if (colCValues[i][0] === "") break; 
    lastTechRow = i + 15;
  }
  
  const lastColPotential = sheet.getLastColumn();
  const checkWidth = Math.max(1, lastColPotential - 4);
  const row14Values = sheet.getRange(14, 5, 1, checkWidth).getValues()[0];
  let lastDateCol = 5;
  for (let j = 0; j < row14Values.length; j++) {
    if (row14Values[j] !== "") lastDateCol = j + 5;
  }

  const numRows = lastTechRow - 14 + 1; 
  const numCols = lastDateCol - 5 + 1;
  const fullGanttArea = sheet.getRange(14, 5, numRows, numCols);
  const dateRowRange = sheet.getRange(14, 5, 1, numCols);
  const ganttDataRange = sheet.getRange(15, 5, lastTechRow - 15 + 1, numCols);
  
  // 2. RESET & STRUCTURAL FORMATTING
  fullGanttArea.clearFormat();
  sheet.clearConditionalFormatRules();
  fullGanttArea.setWrapStrategy(SpreadsheetApp.WrapStrategy.CLIP);
  
  // Row 14 Styling
  dateRowRange.setTextRotation(90);
  dateRowRange.setBorder(null, null, true, null, null, null, "#000000", SpreadsheetApp.BorderStyle.SOLID_MEDIUM);

  // Footer Boundary (Top border below last tech)
  sheet.getRange(lastTechRow + 1, 5, 1, numCols)
       .setBorder(true, null, null, null, null, null, "#000000", SpreadsheetApp.BorderStyle.SOLID_MEDIUM);

  // 3. PREPARE BATCH COLORS (Base Layer)
  const gridValues = fullGanttArea.getValues();
  const bgColors = [];
  const fontColors = [];

  for (let r = 0; r < gridValues.length; r++) {
    const bgRow = [];
    const fontRow = [];
    for (let c = 0; c < gridValues[r].length; c++) {
      const dateCell = gridValues[0][c]; 
      const cellValue = gridValues[r][c];
      let isWeekend = (dateCell instanceof Date) && (dateCell.getDay() === 0 || dateCell.getDay() === 6);

      if (isWeekend) {
        bgRow.push("#EFEFEF");
        fontRow.push(r === 0 ? "#000000" : "#EFEFEF");
      } else {
        if (r === 0) { // Date Row
          bgRow.push("#FFFFFF");
          fontRow.push("#000000");
        } else { // Data Rows (Invisible Blue)
          if (cellValue !== "") {
            bgRow.push("#3C78D8");
            fontRow.push("#3C78D8");
          } else {
            bgRow.push("#FFFFFF");
            fontRow.push("#000000");
          }
        }
      }
    }
    bgColors.push(bgRow);
    fontColors.push(fontRow);
  }

  fullGanttArea.setBackgrounds(bgColors);
  fullGanttArea.setFontColors(fontColors);

  // 4. CONDITIONAL FORMATTING RULES
  const rules = [];

  // Rule: Today Highlight (Row 14)
  rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied("=E$14=TODAY()")
    .setBackground("#1155CC").setFontColor("#FFFFFF").setRanges([dateRowRange]).build());

  // Rules 1-4: Dropdowns (Contains Search Logic)
  const drops = [
    {c: "$C$5", b: "#ff972d", f: "#000000"}, // Orange
    {c: "$C$6", b: "#27c164", f: "#000000"}, // Green
    {c: "$C$7", b: "#f168c4", f: "#000000"}, // Pink
    {c: "$C$8", b: "#0f4198", f: "#FFFFFF"}  // Dark Blue
  ];

  drops.forEach(d => {
    // Formula logic: If dropdown is NOT empty AND cell is NOT empty AND dropdown text is FOUND in cell
    const formula = "=AND(LEN(" + d.c + ")>0, LEN(E15)>0, ISNUMBER(SEARCH(" + d.c + ", E15)))";
    rules.push(SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied(formula)
      .setBackground(d.b).setFontColor(d.f).setBold(true).setRanges([ganttDataRange]).build());
  });

  // Rules 5-9: Prefix Overrides (Invisible)
  const prefixes = [
    {t: "!", bg: "#660000"}, {t: "AUSENCIA -", bg: "#cc0000"},
    {t: "APARTADO", bg: "#000000"}, {t: "PC -", bg: "#d1db70"}, {t: "CAPACITACIÓN", bg: "#8E7CC3"}
  ];
  prefixes.forEach(p => {
    rules.push(SpreadsheetApp.newConditionalFormatRule()
      .whenTextStartsWith(p.t).setBackground(p.bg).setFontColor(p.bg).setRanges([ganttDataRange]).build());
  });

  sheet.setConditionalFormatRules(rules);
}