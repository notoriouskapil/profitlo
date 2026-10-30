/**
 * Profitlo — calculation tests (no dependencies).
 * Run:  node tests/run-tests.js
 */
'use strict';
const assert = require('assert');
const C = require('../js/calculator.js');
const samples = require('../js/samples.js');

let passed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
    console.log('  ✓ ' + name);
  } catch (e) {
    console.error('  ✗ ' + name + '\n    ' + e.message);
    process.exitCode = 1;
  }
}
const close = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-6, `${msg}: expected ${b}, got ${a}`);
const sample = (id) => samples.find((s) => s.id === id).data;

console.log('Profitlo calculator tests');

test('textbook example without fees matches the spec formulas exactly', () => {
  const r = C.calculate({ rawMaterials: 40, packaging: 10, rent: 20000, price: 100, units: 500, equipment: 50000, inventoryUnits: 100 });
  close(r.variableCostPerUnit, 50, 'variable cost/unit');
  close(r.revenue, 50000, 'revenue');
  close(r.monthlyTotalCost, 20000 + 50 * 500, 'monthly total cost');
  close(r.profit, 5000, 'profit');
  close(r.margin, 10, 'margin');
  close(r.startupInvestment, 50000 + 100 * 50, 'startup investment');
  assert.strictEqual(r.breakEvenUnits, 400); // 20000 / (100 − 50)
  assert.strictEqual(r.status, 'profit');
  close(r.paybackMonths, 55000 / 5000, 'payback');
});

test('break-even rounds up to the next whole unit', () => {
  const r = C.calculate({ rawMaterials: 70, rent: 1000, price: 100, units: 10 });
  assert.strictEqual(r.breakEvenUnits, 34); // 1000 / 30 = 33.33 → 34
});

test('exact break-even does not over-round because of floating point', () => {
  const r = C.calculate({ rawMaterials: 0.7, rent: 0.3, price: 1, units: 1 });
  assert.strictEqual(r.breakEvenUnits, 1);
});

test('profitable sample (candles)', () => {
  const r = C.calculate(sample('candles'));
  close(r.variableCostPerUnit, 165, 'variable');
  close(r.revenue, 99750, 'revenue');
  close(r.monthlyTotalCost, 33000 + 41250 + 2992.5 + 4987.5, 'cost');
  close(r.profit, 17520, 'profit');
  assert.strictEqual(r.status, 'profit');
  assert.strictEqual(r.breakEvenUnits, 164); // 33000 / (399 − 165 − 31.92) = 163.3
  close(r.startupInvestment, 60000 + 200 * 165, 'investment');
  assert.ok(!r.warnings.includes('PRICE_BELOW_UNIT_COST'));
});

test('loss sample (tiffins with 18% app fee)', () => {
  const r = C.calculate(sample('tiffin'));
  close(r.profit, -48750, 'profit');
  assert.strictEqual(r.status, 'loss');
  assert.ok(r.margin < 0);
  assert.strictEqual(r.paybackMonths, null);
  assert.ok(r.warnings.includes('BELOW_BREAK_EVEN'));
});

test('under-priced sample warns that price is below unit cost', () => {
  const r = C.calculate(sample('soap'));
  assert.ok(r.warnings.includes('PRICE_BELOW_UNIT_COST'));
  assert.strictEqual(r.breakEvenUnits, null); // can never break even
  assert.strictEqual(r.status, 'loss');
});

test('empty input never throws and returns safe values', () => {
  const r = C.calculate({});
  assert.strictEqual(r.revenue, 0);
  assert.strictEqual(r.margin, null);
  assert.strictEqual(r.fullCostPerUnit, null);
  assert.strictEqual(r.suggestedPrice, null);
  assert.strictEqual(r.status, 'empty');
  assert.ok(r.warnings.includes('NO_PRICE') && r.warnings.includes('NO_UNITS'));
  C.calculate(undefined);
  C.calculate(null);
});

test('garbage, negative and infinite values are treated as 0', () => {
  const r = C.calculate({ price: 'abc', units: -50, rent: 'Infinity', rawMaterials: NaN, equipment: '1,500' });
  assert.strictEqual(r.price, 0);
  assert.strictEqual(r.units, 0);
  assert.strictEqual(r.monthlyFixedCosts, 0);
  assert.strictEqual(r.startupInvestment, 1500);
  for (const v of Object.values(r)) if (typeof v === 'number') assert.ok(Number.isFinite(v), 'non-finite value');
});

test('zero units → margin null, cost per unit null, but no crash', () => {
  const r = C.calculate({ price: 100, units: 0, rent: 5000, rawMaterials: 20 });
  assert.strictEqual(r.margin, null);
  assert.strictEqual(r.fullCostPerUnit, null);
  close(r.profit, -5000, 'profit');
  assert.strictEqual(r.breakEvenUnits, 63); // 5000 / 80 = 62.5
});

test('no fixed costs → break-even at 0 units', () => {
  const r = C.calculate({ price: 50, units: 10, rawMaterials: 20 });
  assert.strictEqual(r.breakEvenUnits, 0);
});

test('suggested price hits the target margin', () => {
  const input = { ...sample('candles'), targetMargin: 25 };
  const r = C.calculate(input);
  const check = C.calculate({ ...input, price: r.suggestedPrice });
  close(check.margin, 25, 'margin at suggested price');
});

test('break-even price gives ~zero profit', () => {
  const r = C.calculate(sample('tiffin'));
  const check = C.calculate({ ...sample('tiffin'), price: r.breakEvenPrice });
  assert.ok(Math.abs(check.profit) < 1e-6);
});

test('fees + tax of 100% never divide by zero', () => {
  const r = C.calculate({ price: 100, units: 10, feePercent: 60, taxPercent: 60 });
  assert.strictEqual(r.breakEvenPrice, null);
  assert.strictEqual(r.suggestedPrice, null);
  assert.ok(r.warnings.includes('DEDUCTIONS_TOO_HIGH'));
});

test('validation catches bad fields and accepts a good form', () => {
  const e = C.validate({ price: '', units: '-3', rent: 'x', feePercent: 150 });
  assert.ok(e.price && e.units && e.rent && e.feePercent);
  assert.deepStrictEqual(C.validate(sample('candles')), {});
});

test('scenario + levers + projection behave', () => {
  const base = C.calculate(sample('candles'));
  const up = C.scenario(sample('candles'), { unitsFactor: 1.5 });
  assert.ok(up.profit > base.profit);
  const lv = C.levers(sample('candles'));
  assert.strictEqual(lv.length, 4);
  assert.ok(lv[0].gain >= lv[3].gain);
  const p = C.projection(base, 12);
  assert.strictEqual(p.length, 13);
  close(p[0].cash, -base.startupInvestment, 'month 0');
  const grid = C.sensitivityGrid(sample('candles'), [-0.1, 0, 0.1], [-0.2, 0, 0.2]);
  close(grid[1][1], base.profit, 'grid centre = base');
});

console.log(`\n${passed} tests passed${process.exitCode ? ', some FAILED' : ''}.`);
