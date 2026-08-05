/*function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
      .setTitle('Control de Errores - Proyectos')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

*/
function getProjectData() {
  const ssId = "18GFvQZdpmALvmmTFc70dXENJxImMR3bkHU04IG_UyyY";
  const sheet = SpreadsheetApp.openById(ssId).getSheetByName("BD Proyectos Maestro");
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  
  // Map headers to indices
  const idx = {
    name: headers.indexOf("PROYECTOS"),
    date: headers.indexOf("FECHA TERMINO"),
    status: headers.indexOf("Estado"),
    area: headers.indexOf("AREA ASIGNADA"),
    cat: headers.indexOf("Categoría"),
    estUnits: headers.indexOf("UNIDADES ESTIMADAS"),
    actUnits: headers.indexOf("Unidades totales (Proyecto)")
  };

  let filteredData = [];
  
  for (let i = 1; i < data.length; i++) {
    let row = data[i];
    // Filters: Status "12. Terminado", Area contains "Instalaciones", Specific Categories
    if (row[idx.status] === "12. Terminado" && 
        row[idx.area].toString().includes("Instalaciones") &&
        ["Instalación", "Servicios", "Mantenimiento"].includes(row[idx.cat])) {
      
      let est = parseFloat(row[idx.estUnits]) || 0;
      let act = parseFloat(row[idx.actUnits]) || 0;
      let error = est !== 0 ? (act - est) / est : 0; // Error percentage calculation

      filteredData.push({
        name: row[idx.name],
        date: new Date(row[idx.date]),
        error: error
      });
    }
  }

  // Sort by date to calculate Moving Range
  filteredData.sort((a, b) => a.date - b.date);

  // I-MR Calculations
  let sumError = 0;
  let sumMR = 0;
  for (let j = 0; j < filteredData.length; j++) {
    sumError += filteredData[j].error;
    if (j > 0) {
      sumMR += Math.abs(filteredData[j].error - filteredData[j-1].error);
    }
  }

  let avgError = sumError / filteredData.length;
  let avgMR = sumMR / (filteredData.length - 1);
  let ucl = avgError + (2.66 * avgMR);
  let lcl = avgError - (2.66 * avgMR);

  return {
    points: filteredData,
    avg: avgError,
    ucl: ucl,
    lcl: lcl
  };
}