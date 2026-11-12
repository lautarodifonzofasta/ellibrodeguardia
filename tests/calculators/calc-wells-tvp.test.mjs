import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { interpret } from '../../js/calculators/calc-wells-tvp.js';

const definition = JSON.parse(readFileSync(new URL('../../content/calculators/calc-wells-tvp.json', import.meta.url), 'utf8'));
const options = definition.groups[0].options;

test('Wells-TVP boundaries: unlikely <=1, likely 2, high >=3 (score ranges from -2 to 9)', () => {
  assert.equal(interpret(-2).severity, 'green');
  assert.equal(interpret(0).severity, 'green');
  assert.equal(interpret(1).severity, 'green');
  assert.equal(interpret(2).severity, 'amber');
  assert.equal(interpret(3).severity, 'red');
  assert.equal(interpret(9).severity, 'red');
});

test('Wells-TVP has the nine +1 criteria and the -2 for an alternative diagnosis', () => {
  const plus = options.filter(o => o.points === 1);
  assert.equal(plus.length, 9);
  assert.ok(plus.some(o => o.label.startsWith('TVP previa')));
  assert.ok(plus.some(o => o.label.startsWith('Pantorrilla >3 cm')));
  assert.deepEqual(options.filter(o => o.points !== 1).map(o => o.points), [-2]);
});
