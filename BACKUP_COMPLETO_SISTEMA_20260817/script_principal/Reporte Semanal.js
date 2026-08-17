/**
 * GENERADOR DE REPORTE SEMANAL DE PROYECTOS - v3.2
 * Lógica: TOTAL REG topado a un máximo de 45 horas.
 */

const SS_ID = '18GFvQZdpmALvmmTFc70dXENJxImMR3bkHU04IG_UyyY';

function generateWeeklyReport() {
  const ss = SpreadsheetApp.openById(SS_ID);
  const reportSheet = ss.getSheetByName("REPORTE SEMANAL");
  const bitacoraSheet = ss.getSheetByName("Bitácora");
  const masterSheet = ss.getSheetByName("BD Proyectos Maestro");
  const generalesSheet = ss.getSheetByName("GENERALES");

  // --- 1. GESTIÓN DE FECHAS (B2 y B3) ---
  let fInicio = reportSheet.getRange("B2").getValue();
  let fFin = reportSheet.getRange("B3").getValue();

  if (!(fInicio instanceof Date) || !(fFin instanceof Date)) {
    const hoy = new Date();
    const diff = (hoy.getDay() === 0 ? 6 : hoy.getDay() - 1) + 7;
    fInicio = new Date(new Date().setDate(hoy.getDate() - diff));
    fInicio.setHours(0,0,0,0);
    fFin = new Date(fInicio);
    fFin.setDate(fInicio.getDate() + 6);
    fFin.setHours(23,59,59,999);
    reportSheet.getRange("B2").setValue(fInicio);
    reportSheet.getRange("B3").setValue(fFin);
  }

  // --- 2. FILTRO TÉCNICOS (INSTALACIONES + ACTIVO) ---
  const genData = generalesSheet.getDataRange().getValues();
  const tecnicosInstalaciones = genData.filter(row => {
    return String(row[4]).trim().toUpperCase() === "INSTALACIONES" && String(row[5]).trim().toUpperCase() === "ACTIVO";
  }).map(row => String(row[2]).trim().toUpperCase());
  
  // --- 3. MAPEO DE ESTIMACIONES ---
  const masterData = masterSheet.getDataRange().getValues();
  const mHeaders = masterData[0];
  let estimacionesDict = {};
  masterData.slice(1).forEach(row => {
    let nombreLimpio = String(row[mHeaders.indexOf("PROYECTOS")]).replace(/\s+/g, ' ').trim().toUpperCase();
    estimacionesDict[nombreLimpio] = parseFloat(row[mHeaders.indexOf("UNIDADES ESTIMADAS")]) || 0;
  });

  // --- 4. PROCESAMIENTO BITÁCORA ---
  const bitData = bitacoraSheet.getDataRange().getValues();
  const h = {
    fecha: bitData[0].indexOf("FECHA"),
    proyectoBitacora: bitData[0].indexOf("PROYECTO"),
    nombre: bitData[0].indexOf("NOMBRE"),
    horas: bitData[0].indexOf("CALCULO HORAS"),
    asunto: bitData[0].indexOf("ASUNTO")
  };

  let hProyLV = 0, hProyTot = 0, hAusTot = 0;
  let statsProy = {}, horasTec = {}, ausRaw = [];

  bitData.slice(1).forEach(row => {
    const rDate = new Date(row[h.fecha]);
    if (rDate < fInicio || rDate > fFin) return;

    const tName = String(row[h.nombre]).trim().toUpperCase();
    if (!tecnicosInstalaciones.includes(tName)) return;

    const pNameBitacora = String(row[h.proyectoBitacora]).replace(/\s+/g, ' ').trim().toUpperCase();
    const hrs = parseFloat(row[h.horas]) || 0;
    const asu = String(row[h.asunto]).toUpperCase();
    const esFDS = (rDate.getDay() === 0 || rDate.getDay() === 6);

    if (!horasTec[tName]) {
      horasTec[tName] = { totalRegAcumulado: 0, proyectoReporte: 0, fds: false, diasConAusencia: new Set() };
    }

    if (asu.includes("AUSENCIA")) {
      hAusTot += hrs;
      ausRaw.push({ n: tName, f: rDate, r: asu });
      horasTec[tName].diasConAusencia.add(Utilities.formatDate(rDate, "GMT", "yyyy-MM-dd"));
    } else {
      // Suma real sin topes para el cálculo interno
      horasTec[tName].totalRegAcumulado += hrs;
      
      if (pNameBitacora !== "SMARTHAUS GASTOS") {
        hProyTot += hrs;
        if (!esFDS) hProyLV += hrs;
        horasTec[tName].proyectoReporte += hrs;
        if (!statsProy[pNameBitacora]) statsProy[pNameBitacora] = { hSem: 0, hTot: 0, pers: new Set() };
        statsProy[pNameBitacora].hSem += hrs;
        statsProy[pNameBitacora].pers.add(tName);
      }
    }
    if (esFDS && hrs > 0) horasTec[tName].fds = true;
  });

  // Acumulado Histórico
  bitData.slice(1).forEach(row => {
    const pName = String(row[h.proyectoBitacora]).replace(/\s+/g, ' ').trim().toUpperCase();
    const asu = String(row[h.asunto]).toUpperCase();
    const hrs = parseFloat(row[h.horas]) || 0;
    if (pName !== "SMARTHAUS GASTOS" && !asu.includes("AUSENCIA") && statsProy[pName]) {
      statsProy[pName].hTot += hrs;
    }
  });

  // --- 5. CÁLCULOS PRODUCTIVIDAD ---
  let diasLabTotales = 0;
  let dLoop = new Date(fInicio);
  while (dLoop <= fFin) {
    if (dLoop.getDay() !== 0 && dLoop.getDay() !== 6) diasLabTotales++;
    dLoop.setDate(dLoop.getDate() + 1);
  }
  const capLV = tecnicosInstalaciones.length * 9 * diasLabTotales;
  const dispRealLV = capLV - hAusTot;
  const pLV = dispRealLV > 0 ? (hProyLV / dispRealLV) * 100 : 0;
  const pGlob = dispRealLV > 0 ? (hProyTot / dispRealLV) * 100 : 0;

  // --- 6. IMPRESIÓN ---
  reportSheet.getRange("A5:H1000").clearContent().setBackground(null).setFontWeight("normal");
  
  reportSheet.getRange(5, 1, 4, 2).setValues([
    ["PRODUCTIVIDAD L-V", pLV.toFixed(2) + "%"],
    ["PRODUCTIVIDAD GLOBAL (Inc. FDS)", pGlob.toFixed(2) + "%"],
    ["HORAS PROYECTO (TOTAL SEMANA)", hProyTot.toFixed(2)],
    ["DISPONIBILIDAD REAL L-V", dispRealLV.toFixed(2)]
  ]).setFontWeight("bold");

  // TABLA PROYECTOS
  let filasP = Object.keys(statsProy).map(n => {
    let est = estimacionesDict[n] || 0;
    let uTot = statsProy[n].hTot / 9;
    return [n, statsProy[n].pers.size, statsProy[n].hSem.toFixed(2), (statsProy[n].hSem/9).toFixed(2), uTot.toFixed(2), est.toFixed(2), (est - uTot).toFixed(2)];
  });

  if (filasP.length > 0) {
    reportSheet.getRange(10, 1, 1, 7).setValues([["PROYECTO", "PERS.", "HRS SEM", "UNID. SEM", "UNID. TOTALES", "ESTIMACIÓN", "DELTA TOTAL"]]).setBackground("#E0E0E0").setFontWeight("bold");
    reportSheet.getRange(11, 1, filasP.length, 7).setValues(filasP);
    filasP.forEach((f, i) => { if (parseFloat(f[4]) > parseFloat(f[5]) && parseFloat(f[5]) > 0) reportSheet.getRange(11 + i, 1, 1, 7).setBackground("#F4CCCC"); });
  }

  // TABLA TÉCNICOS (CON CAP DE 45 HORAS)
  let iT = 11 + filasP.length + 1;
  let fT = Object.keys(horasTec).map(n => {
    let diasAus = horasTec[n].diasConAusencia.size;
    let diasDisp = Math.max(0, diasLabTotales - diasAus);
    
    // APLICACIÓN DEL CAP: Si la suma de horas no-ausencia > 45, imprimimos 45.
    let totalReg = Math.min(horasTec[n].totalRegAcumulado, 45);
    
    let proyRep = horasTec[n].proyectoReporte;
    let util = totalReg > 0 ? (proyRep / totalReg) * 100 : 0;
    let deltaU = totalReg - proyRep;

    return [n, totalReg.toFixed(2), proyRep.toFixed(2), util.toFixed(2) + "%", deltaU.toFixed(2), diasDisp, horasTec[n].fds ? "SÍ" : "NO", util];
  }).sort((a,b) => b[7] - a[7]);
  
  if (fT.length > 0) {
    reportSheet.getRange(iT, 1, 1, 7).setValues([["TÉCNICO", "TOTAL REG", "PROYECTO", "% UTIL", "DELTA U.", "DÍAS DISP.", "FIN DE SEMANA"]]).setBackground("#E0E0E0").setFontWeight("bold");
    reportSheet.getRange(iT + 1, 1, fT.length, 7).setValues(fT.map(r => [r[0], r[1], r[2], r[3], r[4], r[5], r[6]]));
  }

  // TABLA AUSENCIAS
  let iA = iT + fT.length + 1;
  let mapAus = {};
  ausRaw.forEach(a => {
    let key = a.n + "|" + a.r;
    if (!mapAus[key]) mapAus[key] = [];
    mapAus[key].push(a.f);
  });
  let ausAgrupadas = Object.keys(mapAus).map(k => {
    let [nom, raz] = k.split("|");
    let f = mapAus[k].sort((a, b) => a - b);
    let d = f.length > 1 ? Utilities.formatDate(f[0], "GMT", "dd MMM") + " - " + Utilities.formatDate(f[f.length-1], "GMT", "dd MMM") : Utilities.formatDate(f[0], "GMT", "dd MMM");
    return [nom, d, raz];
  });
  if (ausAgrupadas.length > 0) {
    reportSheet.getRange(iA, 1, 1, 3).setValues([["TÉCNICO", "DÍA", "RAZÓN"]]).setBackground("#E0E0E0").setFontWeight("bold");
    reportSheet.getRange(iA + 1, 1, ausAgrupadas.length, 3).setValues(ausAgrupadas);
  }
}