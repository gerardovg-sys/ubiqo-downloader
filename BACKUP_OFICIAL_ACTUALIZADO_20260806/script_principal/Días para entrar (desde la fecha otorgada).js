function calcularDiasParaEntrar() {
  const sheetId = "18GFvQZdpmALvmmTFc70dXENJxImMR3bkHU04IG_UyyY";
  const tabName = "BD Proyectos Maestro";
  const ss = SpreadsheetApp.openById(sheetId);
  const sheet = ss.getSheetByName(tabName);

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

  const col = name => headers.indexOf(name) + 1;
  const areaCol = col("Area asignada");
  const categoriaCol = col("Categoría");
  const accesoCol = col("Fecha de acceso otorgado (requerida de instalación)");
  const inicioCol = col("FECHA INICIO");
  const diasCol = col("Dias para entrar (desde la fecha requerida)");

  if ([areaCol, categoriaCol, accesoCol, inicioCol, diasCol].includes(0)) {
    throw new Error("Una o más columnas necesarias no se encontraron.");
  }

  const lastRow = sheet.getLastRow();
  const data = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();

  const results = data.map(row => {
    const area = row[areaCol - 1];
    const categoria = row[categoriaCol - 1];
    const fechaAcceso = row[accesoCol - 1];
    const fechaInicio = row[inicioCol - 1];

    if (typeof area === "string" && area.includes("Instalaciones") && categoria === "Instalación") {
      if (!(fechaAcceso instanceof Date) || !(fechaInicio instanceof Date)) {
        return ["NA"];
      }

      const days = getNetworkDays(fechaAcceso, fechaInicio);
      return [days];
    }

    return ["NA"];
  });

  sheet.getRange(2, diasCol, results.length, 1).setValues(results);
}

// Helper function: count working days excluding weekends
function getNetworkDays(start, end) {
  let count = 0;
  const step = start <= end ? 1 : -1;
  const date = new Date(start);

  while ((step > 0 && date <= end) || (step < 0 && date >= end)) {
    const day = date.getDay();
    if (day !== 0 && day !== 6) { // 0 = Sunday, 6 = Saturday
      count++;
    }
    date.setDate(date.getDate() + step);
  }

  return step > 0 ? count : -count;
}
