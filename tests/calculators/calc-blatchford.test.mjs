import { test } from 'node:test';
import assert from 'node:assert/strict';
import { interpret } from '../../js/calculators/calc-blatchford.js';

test('Blatchford boundaries (source uses s===0, not s<=0)', () => {
  assert.equal(interpret(0).severity, 'green');
  assert.equal(interpret(1).severity, 'amber');
  assert.equal(interpret(6).severity, 'amber');
  assert.equal(interpret(7).severity, 'red');
});
