import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { interpret } from '../../js/calculators/calc-blatchford.js';

const definition = JSON.parse(readFileSync(new URL('../../content/calculators/calc-blatchford.json', import.meta.url), 'utf8'));

// Haemoglobin used to be two single-choice groups (men / women), so both could
// be ticked and counted twice.
test('Blatchford has one haemoglobin group and its maximum is 23', () => {
  const groups = definition.groups;
  assert.equal(groups.filter(g => /Hemoglobina/.test(g.label || '')).length, 1);
  const max = groups.reduce((sum, g) => {
    const pts = g.options.map(o => o.points);
    return sum + (g.type === 'single' ? Math.max(...pts) : pts.reduce((a, b) => a + b, 0));
  }, 0);
  assert.equal(max, 23);
});

test('Blatchford boundaries (source uses s===0, not s<=0)', () => {
  assert.equal(interpret(0).severity, 'green');
  assert.equal(interpret(1).severity, 'amber');
  assert.equal(interpret(6).severity, 'amber');
  assert.equal(interpret(7).severity, 'red');
});
