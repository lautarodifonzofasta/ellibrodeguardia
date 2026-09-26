import { test } from 'node:test';
import assert from 'node:assert/strict';
import { interpret } from '../../js/calculators/calc-curb65.js';

test('CURB-65 boundaries', () => {
  assert.equal(interpret(0).severity, 'green');
  assert.equal(interpret(1).severity, 'green');
  assert.equal(interpret(2).severity, 'amber');
  assert.equal(interpret(3).severity, 'red');
  assert.equal(interpret(5).severity, 'red');
});
