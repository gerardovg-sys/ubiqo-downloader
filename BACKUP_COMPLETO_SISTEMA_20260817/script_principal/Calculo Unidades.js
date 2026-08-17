/**
 * Reemplazo de fórmulas para las columnas de Unidades.
 * Calcula las unidades estimadas y totales consultando la Bitácora,
 * dividiendo las sumas de horas sobre 9 (1 unidad = 9 horas).
 */
function calcularUnidades() {
  const ssId = "18GFvQZdpmALvmmTFc70dXENJxImMR3bkHU04IG_UyyY";
  const ss = SpreadsheetApp.openById(ssId);
  
  const sheetProjects = ss.getSheetByName("BD Proyectos Maestro");
  const sheetBitacora = ss.getSheetByName("Bitácora");
  
  if (!sheetProjects || !sheetBitacora) {
    console.error("No se encontraron las hojas requeridas.");
    return;
  }

  const projectsData = sheetProjects.getDataRange().getValues();
  const bitacoraData = sheetBitacora.getDataRange().getValues();
  
  const pHeaders = projectsData[0];
  const bHeaders = bitacoraData[0];

  // 1. Encontrar índices en BD Proyectos Maestro (0-based)
  const idx_Proyecto = pHeaders.indexOf("PROYECTOS");
  const idx_DiasEst = pHeaders.indexOf("Días estimados");
  const idx_TecnicosEst = pHeaders.indexOf("Técnicos estimados");
  const idx_FechaAlta = pHeaders.indexOf("Fecha de alta");
  const idx_AreaAsignada = pHeaders.indexOf("Area asignada");
  
  // Columnas destino a sobreescribir
  const idx_UnidEst = pHeaders.indexOf("UNIDADES ESTIMADAS");
  const idx_UnidTotales = pHeaders.indexOf("Unidades totales");
  const idx_UnidTotalesProj = pHeaders.indexOf("Unidades totales (Proyecto)");
  const idx_UnidNoEst = pHeaders.indexOf("UNIDADES NO ESTIMADAS");
  const idx_UnidNoEstProj = pHeaders.indexOf("UNIDADES NO ESTIMADAS (Proyecto)");

  // 2. Encontrar índices en Bitácora (0-based)
  const idxB_Proyecto = bHeaders.indexOf("PROYECTO");
  const idxB_Horas = bHeaders.indexOf("CALCULO HORAS");
  const idxB_Asunto = bHeaders.indexOf("ASUNTO");

  if ([idx_Proyecto, idx_DiasEst, idx_TecnicosEst, idx_FechaAlta, idx_AreaAsignada, idx_UnidEst, idx_UnidTotales, idxB_Proyecto, idxB_Horas, idxB_Asunto].includes(-1)) {
    console.error("Error: Faltan columnas requeridas en los encabezados.");
    return;
  }

  // 3. Pre-calcular las sumas de la Bitácora en un Hash Map
  // Estructura: map[nombreProyecto] = { totalHoras: 0, totalHorasProjInstalacion: 0 }
  const bitacoraMap = {};

  for (let i = 1; i < bitacoraData.length; i++) {
    const row = bitacoraData[i];
    const projectName = row[idxB_Proyecto];
    let horas = parseFloat(row[idxB_Horas]);
    const asunto = row[idxB_Asunto];

    if (projectName && !isNaN(horas)) {
      if (!bitacoraMap[projectName]) {
        bitacoraMap[projectName] = { totalHoras: 0, totalHorasProjInstalacion: 0 };
      }
      
      bitacoraMap[projectName].totalHoras += horas;
      
      if (asunto === "Proyecto instalación") {
        bitacoraMap[projectName].totalHorasProjInstalacion += horas;
      }
    }
  }

  // 4. Procesar fila por fila en BD Proyectos Maestro
  // Preparar arreglos para actualizar en lote y mejorar rendimiento
  const update_UnidEst = [];
  const update_UnidTotales = [];
  const update_UnidTotalesProj = [];
  const update_UnidNoEst = [];
  const update_UnidNoEstProj = [];
  
  const cutoffDate = new Date("2025-01-01T00:00:00");

  for (let j = 1; j < projectsData.length; j++) {
    const row = projectsData[j];
    const projectName = row[idx_Proyecto];
    const fechaAlta = row[idx_FechaAlta];
    const areaAsignada = row[idx_AreaAsignada] ? row[idx_AreaAsignada].toString() : "";
    
    // Check eligibility
    let isEligible = false;
    if (fechaAlta instanceof Date && fechaAlta >= cutoffDate && areaAsignada.includes("Proyectos")) {
      isEligible = true;
    }
    
    if (!isEligible) {
      // If not eligible, push existing values so we don't overwrite them
      update_UnidEst.push([row[idx_UnidEst]]);
      update_UnidTotales.push([row[idx_UnidTotales]]);
      update_UnidTotalesProj.push([row[idx_UnidTotalesProj]]);
      update_UnidNoEst.push([row[idx_UnidNoEst]]);
      update_UnidNoEstProj.push([row[idx_UnidNoEstProj]]);
      continue;
    }
    
    // Obtener valores y parsear a número, 0 si está vacío o no es número
    const dias = parseFloat(row[idx_DiasEst]) || 0;
    const tecnicos = parseFloat(row[idx_TecnicosEst]) || 0;

    // A: UNIDADES ESTIMADAS
    const unidadesEstimadas = dias * tecnicos;

    // B: Unidades totales y Unidades totales (Proyecto)
    let unidadesTotales = 0;
    let unidadesTotalesProj = 0;
    
    if (projectName && bitacoraMap[projectName]) {
      // Divided by 9 ("over 9")
      unidadesTotales = bitacoraMap[projectName].totalHoras / 9;
      unidadesTotalesProj = bitacoraMap[projectName].totalHorasProjInstalacion / 9;
    }

    // C: UNIDADES NO ESTIMADAS
    const unidadesNoEstimadas = unidadesTotales - unidadesEstimadas;
    const unidadesNoEstimadasProj = unidadesTotalesProj - unidadesEstimadas;

    // Guardar para inserción en bloque
    update_UnidEst.push([unidadesEstimadas]);
    update_UnidTotales.push([unidadesTotales]);
    update_UnidTotalesProj.push([unidadesTotalesProj]);
    update_UnidNoEst.push([unidadesNoEstimadas]);
    update_UnidNoEstProj.push([unidadesNoEstimadasProj]);
  }

  // 5. Escribir los resultados de vuelta a la hoja
  const numRows = update_UnidEst.length;
  if (numRows > 0) {
    if (idx_UnidEst !== -1) sheetProjects.getRange(2, idx_UnidEst + 1, numRows, 1).setValues(update_UnidEst);
    if (idx_UnidTotales !== -1) sheetProjects.getRange(2, idx_UnidTotales + 1, numRows, 1).setValues(update_UnidTotales);
    if (idx_UnidTotalesProj !== -1) sheetProjects.getRange(2, idx_UnidTotalesProj + 1, numRows, 1).setValues(update_UnidTotalesProj);
    if (idx_UnidNoEst !== -1) sheetProjects.getRange(2, idx_UnidNoEst + 1, numRows, 1).setValues(update_UnidNoEst);
    if (idx_UnidNoEstProj !== -1) sheetProjects.getRange(2, idx_UnidNoEstProj + 1, numRows, 1).setValues(update_UnidNoEstProj);
    
    console.log("Cálculos de unidades actualizados correctamente para " + numRows + " filas.");
  }
}
