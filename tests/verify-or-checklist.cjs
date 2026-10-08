const fs = require('fs');

const content = fs.readFileSync('src/constants.ts', 'utf8');

const match = content.match(/export const OR_CHECKLIST_ITEMS: AuditTemplateItem\[\] = \[([\s\S]*?)\];\s*export const PRE_DELIVERY/);
if (!match) {
  console.error('OR_CHECKLIST_ITEMS block not found');
  process.exit(1);
}

const idMatches = [...match[1].matchAll(/id:\s*"([^"]+)"/g)].map(m => m[1]);
const textMatches = [...match[1].matchAll(/text:\s*"([^"]+)"/g)].map(m => m[1]);
const descMatches = [...match[1].matchAll(/description:\s*"([^"]+)"/g)].map(m => m[1]);
const guidanceMatches = [...match[1].matchAll(/guidance:\s*"([^"]+)"/g)].map(m => m[1]);
const orderMatches = [...match[1].matchAll(/order:\s*(\d+)/g)].map(m => Number(m[1]));

console.log('Total items in OR_CHECKLIST_ITEMS:', idMatches.length);
console.log('Unique IDs count:', new Set(idMatches).size);

if (idMatches.length !== 27) {
  console.error('Expected 27 items, found ' + idMatches.length);
  process.exit(1);
}

if (new Set(idMatches).size !== 27) {
  console.error('Duplicate IDs found!');
  process.exit(1);
}

// Check orders 1 to 27
for (let i = 0; i < 27; i++) {
  if (orderMatches[i] !== i + 1) {
    console.error(`Order mismatch at index ${i}: expected ${i+1}, got ${orderMatches[i]}`);
    process.exit(1);
  }
}

console.log('All orders 1..27 verified.');

// Check subgerente-09 link
const subgerenteMatch = content.match(/id:\s*"subgerente-09"[\s\S]*?destinationItemText:\s*"([^"]+)"/);
if (!subgerenteMatch) {
  console.error('subgerente-09 scoreLinks not found');
  process.exit(1);
}
console.log('subgerente-09 destinationItemText:', subgerenteMatch[1]);
if (subgerenteMatch[1] !== '09. Creación del Comprobante de servicio DSP') {
  console.error('subgerente-09 link does not match question 09 text');
  process.exit(1);
}

// Check AUDIT_QUESTIONS.Ordenes
const auditQuestionsMatch = content.match(/"Ordenes":\s*\[\s*\.\.\.OR_CHECKLIST_ITEMS\.map/);
if (!auditQuestionsMatch) {
  console.error('AUDIT_QUESTIONS.Ordenes does not map from OR_CHECKLIST_ITEMS');
  process.exit(1);
}
console.log('AUDIT_QUESTIONS.Ordenes successfully maps to OR_CHECKLIST_ITEMS');

console.log('\n--- 27 PREGUNTAS OFICIALES VERIFICADAS ---');
idMatches.forEach((id, i) => {
  console.log(`${(i+1).toString().padStart(2, '0')}. [${id}] ${textMatches[i]}`);
  console.log(`    Indicación: ${descMatches[i]}`);
});
console.log('\nTODAS LAS COMPROBACIONES PASARON CON ÉXITO.');
