const assert = require('assert');
const fs = require('fs');
const ts = require('typescript');

// Transpile or-audit.ts to CommonJS using TypeScript compiler API
const code = fs.readFileSync('src/services/or-audit.ts', 'utf8');
const transpiled = ts.transpileModule(code, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

const moduleScope = { exports: {} };
const fn = new Function('module', 'exports', 'require', transpiled);
fn(moduleScope, moduleScope.exports, require);

const {
  calculateRoleScores,
  calculateCampaignRoleMetrics,
  getEffectiveResponsibleRoles,
} = moduleScope.exports;

console.log('=== TEST SUITE: CORRECCIÓN DE PUNTAJES POR RESPONSABLE ===\n');

// Mock Template based on constants.ts
const templateItems = [
  { id: 'or-01', text: '01. Ingreso / Entrega', responsibleRoles: ['asesor'], weight: 1 },
  { id: 'or-06', text: '07. Falla denunciada', responsibleRoles: ['asesor', 'tecnico'], weight: 1 },
  { id: 'or-26', text: '13. Validación de Ampliaciones de OR', responsibleRoles: ['asesor', 'tecnico', 'controller'], weight: 1 },
  { id: 'or-12', text: '16. Campo de Ampliaciones: registro', responsibleRoles: ['tecnico', 'controller'], weight: 1 },
  { id: 'or-15', text: '20. Vale de Repuestos', responsibleRoles: ['tecnico', 'repuestos'], weight: 1 },
  { id: 'or-21', text: '26. Lavador — Reloj + Firma', responsibleRoles: ['lavador'], weight: 1 },
];

// Test 1: Repuestos obtiene 100% cuando todos sus controles aplicables están conformes
{
  const audits = [
    {
      orderNumber: '1001',
      items: [
        { id: 'or-15', question: '20. Vale de Repuestos', status: 'pass', weight: 1 },
      ],
    },
    {
      orderNumber: '1002',
      items: [
        { id: 'or-15', question: '20. Vale de Repuestos', status: 'pass', weight: 1 },
      ],
    },
    {
      orderNumber: '1003',
      items: [
        { id: 'or-15', question: '20. Vale de Repuestos', status: 'na', weight: 1 },
      ],
    },
  ];

  const metrics = calculateCampaignRoleMetrics(audits, templateItems);
  const repuestos = metrics.find((m) => m.role === 'repuestos');

  assert.strictEqual(repuestos.applicableControls, 2, 'Debe haber 2 controles aplicables para Repuestos');
  assert.strictEqual(repuestos.compliantControls, 2, 'Debe haber 2 controles conformes');
  assert.strictEqual(repuestos.deviationsCount, 0, 'No debe haber desvíos para Repuestos');
  assert.strictEqual(repuestos.compliance, 100, 'El cumplimiento debe ser 100%');
  console.log('✔ Test 1 superado: Repuestos obtiene 100% cuando sus controles están conformes.');
}

// Test 2: Un incumplimiento del Asesor no afecta a Repuestos cuando este no figura como responsable
{
  const audits = [
    {
      orderNumber: '1001',
      staffName: 'Mauro Gutierrez',
      items: [
        // Falla en asesor (punto 1)
        { id: 'or-01', question: '01. Ingreso / Entrega', status: 'fail', comment: 'Sin hora de cierre' },
        // Falla en ampliaciones (punto 13 - Asesor, Técnico, Controller)
        { id: 'or-26', question: '13. Validación de Ampliaciones de OR', status: 'fail', comment: 'Sin firma cliente' },
        // Vale de repuestos conforme (punto 20)
        { id: 'or-15', question: '20. Vale de Repuestos', status: 'pass' },
      ],
    },
  ];

  const metrics = calculateCampaignRoleMetrics(audits, templateItems);
  const repuestos = metrics.find((m) => m.role === 'repuestos');
  const asesor = metrics.find((m) => m.role === 'asesor');

  assert.strictEqual(repuestos.compliance, 100, 'Repuestos debe mantenerse en 100%');
  assert.strictEqual(repuestos.deviationsCount, 0, 'Repuestos no debe tener desvíos');
  assert.strictEqual(asesor.deviationsCount, 2, 'Asesor debe tener 2 desvíos');
  assert.strictEqual(asesor.compliance, 0, 'Asesor debe tener 0% (0 de 2)');
  console.log('✔ Test 2 superado: Incumplimiento del Asesor y Ampliaciones no afecta a Repuestos.');
}

// Test 3: Los ítems compartidos afectan a todos los responsables seleccionados
{
  const audits = [
    {
      orderNumber: '1001',
      items: [
        // Falla compartida en Vale de repuestos (Técnico + Repuestos)
        { id: 'or-15', question: '20. Vale de Repuestos', status: 'fail', comment: 'Falta firma del repuestero' },
      ],
    },
  ];

  const metrics = calculateCampaignRoleMetrics(audits, templateItems);
  const tecnico = metrics.find((m) => m.role === 'tecnico');
  const repuestos = metrics.find((m) => m.role === 'repuestos');
  const asesor = metrics.find((m) => m.role === 'asesor');

  assert.strictEqual(tecnico.deviationsCount, 1, 'Técnico debe recibir el desvío');
  assert.strictEqual(repuestos.deviationsCount, 1, 'Repuestos debe recibir el desvío');
  assert.strictEqual(asesor.deviationsCount, 0, 'Asesor no debe ser afectado');
  assert.strictEqual(repuestos.compliance, 0, 'Repuestos debe ser 0%');
  assert.strictEqual(tecnico.compliance, 0, 'Técnico debe ser 0%');
  console.log('✔ Test 3 superado: Ítem compartido penaliza a todos los responsables asignados.');
}

// Test 4: Las respuestas N/A y Pendiente se excluyen correctamente
{
  const audits = [
    {
      orderNumber: '1001',
      items: [
        { id: 'or-15', question: '20. Vale de Repuestos', status: 'na' },
        { id: 'or-01', question: '01. Ingreso / Entrega', status: undefined }, // pendiente
      ],
    },
  ];

  const metrics = calculateCampaignRoleMetrics(audits, templateItems);
  const repuestos = metrics.find((m) => m.role === 'repuestos');
  const asesor = metrics.find((m) => m.role === 'asesor');

  assert.strictEqual(repuestos.applicableControls, 0, 'Repuestos no debe tener controles aplicables');
  assert.strictEqual(repuestos.compliance, null, 'Repuestos debe marcar null (Sin evaluación)');
  assert.strictEqual(asesor.applicableControls, 0, 'Asesor no debe tener controles aplicables');
  assert.strictEqual(asesor.compliance, null, 'Asesor debe marcar null (Sin evaluación)');
  console.log('✔ Test 4 superado: Respuestas N/A y pendientes se excluyen (Sin evaluación).');
}

// Test 5: Simulación exacta de la campaña 08/10/2026: 19 ORs, 16 desvíos, 1 falla en ampliación
{
  // 19 órdenes:
  // En orden 1 a 4: Vale de Repuestos es SÍ.
  // En orden 5: Validación de Ampliaciones (punto 13) es NO (desvío de ampliación). Vale de Repuestos es SÍ.
  // En órdenes 6 a 19: Vale de Repuestos es N/A.
  const audits = [];
  for (let i = 1; i <= 19; i++) {
    const isOrder5 = i === 5;
    const hasVale = i <= 5;

    audits.push({
      orderNumber: `OR-${1000 + i}`,
      staffName: 'Mauro Gutierrez',
      items: [
        { id: 'or-01', question: '01. Ingreso / Entrega', status: 'pass' },
        { id: 'or-26', question: '13. Validación de Ampliaciones de OR', status: isOrder5 ? 'fail' : 'pass' },
        { id: 'or-15', question: '20. Vale de Repuestos', status: hasVale ? 'pass' : 'na' },
      ],
    });
  }

  const metrics = calculateCampaignRoleMetrics(audits, templateItems);
  const repuestos = metrics.find((m) => m.role === 'repuestos');
  const controller = metrics.find((m) => m.role === 'controller');

  // Repuestos SOLO tiene el punto 20: 5 órdenes con SÍ, 14 con N/A -> 5 conformes, 0 desvíos -> 100%
  assert.strictEqual(repuestos.applicableControls, 5);
  assert.strictEqual(repuestos.compliantControls, 5);
  assert.strictEqual(repuestos.deviationsCount, 0);
  assert.strictEqual(repuestos.compliance, 100, 'Repuestos debe obtener 100%');

  // Controller y Técnico sí fueron afectados por la falla en Ampliaciones de la orden 5
  assert.strictEqual(controller.deviationsCount, 1, 'Controller debe registrar el desvío de ampliación');
  assert.strictEqual(controller.deviations[0].order, 'OR-1005');
  console.log('✔ Test 5 superado: Caso real reconstruido — Repuestos obtiene 100% y Controller absorbe el desvío de ampliación.');
}

// Test 6: Evitar que promedios simples produzcan resultados engañosos
{
  // Auditoría A: 1 control aplicable, 1 conforme (100%)
  // Auditoría B: 9 controles aplicables, 8 conformes (88.8%)
  // Promedio simple: (100 + 88.8) / 2 = 94.4%
  // Ponderado real: (1 + 8) / (1 + 9) = 9 / 10 = 90%
  const audits = [
    {
      orderNumber: 'A',
      items: [
        { id: 'or-15', question: '20. Vale de Repuestos', status: 'pass', weight: 1 },
      ],
    },
    {
      orderNumber: 'B',
      items: [
        { id: 'or-15', question: '20. Vale de Repuestos', status: 'fail', weight: 1 },
        ...Array.from({ length: 8 }, (_, i) => ({
          id: `custom-${i}`,
          question: `Extra ${i}`,
          responsibleRoles: ['repuestos'],
          status: 'pass',
          weight: 1,
        })),
      ],
    },
  ];

  const metrics = calculateCampaignRoleMetrics(audits, templateItems);
  const repuestos = metrics.find((m) => m.role === 'repuestos');

  assert.strictEqual(repuestos.applicableControls, 10, 'Total de controles debe ser 10');
  assert.strictEqual(repuestos.compliantControls, 9, 'Conformes debe ser 9');
  assert.strictEqual(repuestos.compliance, 90, 'El cumplimiento consolidado debe ser 90%, no 94%');
  console.log('✔ Test 6 superado: Consolidación ponderada de campaña evita distorsión de promedios simples.');
}

// Test 7: Reconstrucción segura de auditorías históricas con roles obsoletos en item
{
  // Simular una auditoría guardada en el pasado que tenía "repuestos" en item 13
  const legacyAudit = {
    orderNumber: 'HIST-99',
    items: [
      {
        id: 'or-26',
        question: '13. Validación de Ampliaciones de OR',
        responsibleRoles: ['tecnico', 'repuestos', 'controller', 'asesor'], // legacy erróneo guardado en sheet
        status: 'fail',
        comment: 'Firma incompleta',
      },
      {
        id: 'or-15',
        question: '20. Vale de Repuestos',
        responsibleRoles: ['tecnico', 'repuestos'],
        status: 'pass',
      },
    ],
  };

  // Reconstrucción pasando templateItems oficial:
  const metrics = calculateCampaignRoleMetrics([legacyAudit], templateItems);
  const repuestos = metrics.find((m) => m.role === 'repuestos');

  assert.strictEqual(repuestos.compliance, 100, 'Al pasar el template oficial, Repuestos se reconstruye al 100%');
  assert.strictEqual(repuestos.deviationsCount, 0, 'No absorbe el desvío histórico mal asignado');
  console.log('✔ Test 7 superado: Reconstrucción segura histórica mediante plantilla sin alterar datos originales.');
}

console.log('\nTODAS LAS PRUEBAS DE CUMPLIMIENTO POR ROL PASARON CON ÉXITO.');
