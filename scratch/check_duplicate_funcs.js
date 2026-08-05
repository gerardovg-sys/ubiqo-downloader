const fs = require('fs');
const path = require('path');

const dir = 'c:\\Users\\MARCO\\Desktop\\HOLDING_IA\\BITACORA_SMARTCORP\\script_principal';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.js') && !f.startsWith('.'));

let funcMap = {}; // { funcName: [fileName1, fileName2, ...] }

files.forEach(file => {
  const content = fs.readFileSync(path.join(dir, file), 'utf8');
  const lines = content.split('\n');
  lines.forEach((line, idx) => {
    const match = line.match(/^\s*function\s+([a-zA-Z0-0_]+)\s*\(/);
    if (match) {
      const fnName = match[1];
      if (!funcMap[fnName]) funcMap[fnName] = [];
      funcMap[fnName].push(`${file}:${idx+1}`);
    }
  });
});

console.log('=== VERIFICACIÓN DE FUNCIONES DUPLICADAS ===');
let duplicatesFound = false;
for (let fn in funcMap) {
  if (funcMap[fn].length > 1) {
    duplicatesFound = true;
    console.log(`❌ DUPLICADA: "${fn}" se encontró en:`);
    funcMap[fn].forEach(loc => console.log(`   - ${loc}`));
  }
}

if (!duplicatesFound) {
  console.log('✅ PERFECTO: No existe NINGUNA función duplicada entre los archivos .js');
}
