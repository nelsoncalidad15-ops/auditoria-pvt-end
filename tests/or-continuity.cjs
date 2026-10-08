const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

const source = fs.readFileSync('src/utils/audit-helpers.ts', 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const moduleForHelpers = { exports: {} };
vm.runInNewContext(compiled, {
  exports: moduleForHelpers.exports,
  require: () => ({}),
  window: undefined,
});
const { buildGroupedHistory, getOrdersForSample } = moduleForHelpers.exports;

function order(id, orderNumber, sampleId, auditBatchName = 'Campaña') {
  return { id, orderNumber, sampleId, auditBatchName, date: '2026-10-08', location: 'Jujuy', auditorId: 'a', role: 'Ordenes', entityType: 'or', items: [], totalScore: 90 };
}

test('grouped history keeps distinct samples separate even with the same name', () => {
  const grouped = buildGroupedHistory([order('one', '12345', 'sample-a'), order('two', '12346', 'sample-a'), order('three', '12347', 'sample-b')]);
  assert.equal(grouped.length, 2);
  assert.equal(grouped.map((group) => group.childAudits.length).sort().join(','), '1,2');
});

test('new orders can continue a legacy sample without changing historical IDs', () => {
  const grouped = buildGroupedHistory([order('legacy', '12345'), order('legacy-two', '12346'), order('new', '12347', 'legacy')]);
  assert.equal(grouped.length, 1);
  assert.equal(grouped[0].childAudits.length, 3);
  assert.equal(grouped[0].childAudits.find((child) => child.orderNumber === '12345').id, 'legacy');
});

test('continuing a legacy sample lists every saved OR, not only the reference OR', () => {
  const audits = [
    order('legacy', '5442607'),
    order('legacy-two', '5442231'),
    order('legacy-three', '5442069'),
    order('legacy-four', '5442584'),
    order('legacy-five', '5442150'),
  ];
  const groups = buildGroupedHistory(audits);
  const sample = { sampleId: 'legacy', auditBatchName: 'Campaña', date: '2026-10-08', location: 'Jujuy' };
  assert.equal(getOrdersForSample(audits, groups, sample).length, 5);
  assert.equal(getOrdersForSample([...audits, order('other', '5449999', 'other')], groups, sample).length, 5);
});

const server = vm.createContext({});
vm.runInContext(fs.readFileSync('apps-script/Code.gs', 'utf8'), server);
test('server rejects a duplicate OR in the same sample and permits a separate sample', () => {
  server.getSheetRows_ = () => [{ auditId: 'saved', role: 'Ordenes', orderNumber: '12345', sampleId: 'sample-a', auditBatchName: 'Campaña', location: 'Jujuy' }];
  assert.throws(() => server.assertOrderIsAvailable_(null, order('new', '12345', 'sample-a')), /CONFLICT_OR/);
  assert.doesNotThrow(() => server.assertOrderIsAvailable_(null, order('new', '12345', 'sample-b')));
});
