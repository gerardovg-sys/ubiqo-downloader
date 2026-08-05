function actualizarMesAnio() {
  const sheetId = "18GFvQZdpmALvmmTFc70dXENJxImMR3bkHU04IG_UyyY";
  const tabName = "BD Proyectos Maestro";
  const ss = SpreadsheetApp.openById(sheetId);
  const sheet = ss.getSheetByName(tabName);

  // Get headers to locate columns
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const fechaAltaCol = headers.indexOf("Fecha de alta") + 1;
  const mesAnioCol = headers.indexOf("Mes/Año") + 1;

  if (fechaAltaCol === 0 || mesAnioCol === 0) {
    throw new Error("No se encontraron las columnas 'Fecha de alta' o 'Mes/Año'");
  }

  const lastRow = sheet.getLastRow();
  const fechas = sheet.getRange(2, fechaAltaCol, lastRow - 1).getValues();

  const mesesEspanol = [
    "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"
  ];

  const resultados = fechas.map(([fecha]) => {
    if (fecha instanceof Date && !isNaN(fecha.getTime())) {
      const mes = mesesEspanol[fecha.getMonth()];
      const anio = fecha.getFullYear();
      return [`${mes} ${anio}`];
    } else {
      return [""];
    }
  });

  // Paste values in "Mes/Año" column starting from row 2
  sheet.getRange(2, mesAnioCol, resultados.length, 1).setValues(resultados);
}
