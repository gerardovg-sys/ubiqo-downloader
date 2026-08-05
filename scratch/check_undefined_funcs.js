const fs = require('fs');
const path = require('path');

const dir = 'c:\\Users\\MARCO\\Desktop\\HOLDING_IA\\BITACORA_SMARTCORP\\script_principal';
const files = ['Audit_GPS.js', 'Audit_GPS_Ingestion.js', 'Audit_GPS_Historial.js', 'Audit_GPS_Diagnostico.js', 'Audit_GPS_Procesamiento.js', 'Audit_ReporteEnviado.js', 'CustomMenu.js'];

let allDeclaredFuncs = new Set();

for (const file of files) {
  const content = fs.readFileSync(path.join(dir, file), 'utf8');
  const matches = content.matchAll(/function\s+([a-zA-Z0-9_$]+)\s*\(/g);
  for (const m of matches) {
    allDeclaredFuncs.add(m[1]);
  }
}

console.log("Declared functions in Audit files:", Array.from(allDeclaredFuncs).sort());

for (const file of files) {
  const content = fs.readFileSync(path.join(dir, file), 'utf8');
  const calls = content.matchAll(/([a-zA-Z0-9_$]+)\s*\(/g);
  let missingInFile = new Set();
  for (const c of calls) {
    const fn = c[1];
    if (fn.startsWith('audit') || fn.startsWith('ejecutar') || fn.startsWith('abrir') || fn.startsWith('mostrar')) {
      if (!allDeclaredFuncs.has(fn)) {
        missingInFile.add(fn);
      }
    }
  }
  if (missingInFile.size > 0) {
    console.log(`[FILE] ${file} has MISSING function calls:`, Array.from(missingInFile));
  } else {
    console.log(`[FILE] ${file} -> ALL AUDIT / EJECUTAR / ABRIR FUNCTIONS DECLARED & VALID!`);
  }
}
