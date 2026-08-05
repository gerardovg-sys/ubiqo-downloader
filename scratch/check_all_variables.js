const fs = require('fs');
const path = require('path');

const dir = 'c:\\Users\\MARCO\\Desktop\\HOLDING_IA\\BITACORA_SMARTCORP\\script_principal';
const files = ['Audit_GPS.js', 'Audit_ReporteEnviado.js', 'CustomMenu.js'];

let fullCode = '';
for (const file of files) {
  // Strip single-line and multi-line comments
  let content = fs.readFileSync(path.join(dir, file), 'utf8');
  content = content.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*/g, '');
  fullCode += content + '\n';
}

const declaredVars = new Set([
  'SpreadsheetApp', 'Logger', 'DriveApp', 'HtmlService', 'Utilities', 'MimeType', 'Math', 'String', 'Number', 'Date',
  'Object', 'Array', 'parseInt', 'parseFloat', 'isNaN', 'isFinite', 'console', 'encodeURIComponent', 'decodeURIComponent',
  'Drive', 'false', 'true', 'null', 'undefined'
]);

const varMatches = fullCode.matchAll(/(?:var|const|let|function)\s+([a-zA-Z0-9_$]+)/g);
for (const m of varMatches) {
  declaredVars.add(m[1]);
}

// Find all AUDIT_COL_BIT_* or AUDIT_* identifiers in code
const auditVars = fullCode.matchAll(/\b(AUDIT_[A-Z0-9_]+)\b/g);
let missingAuditVars = new Set();
for (const m of auditVars) {
  const id = m[1];
  if (!declaredVars.has(id)) {
    missingAuditVars.add(id);
  }
}

if (missingAuditVars.size > 0) {
  console.log("❌ MISSING AUDIT CONSTANTS IN CODE:", Array.from(missingAuditVars));
} else {
  console.log("✅ ALL AUDIT CONSTANTS DECLARED AND VALID IN CODE!");
}
