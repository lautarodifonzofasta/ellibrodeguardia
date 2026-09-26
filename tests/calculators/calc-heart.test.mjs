import { test } from 'node:test';
import assert from 'node:assert/strict';
import { interpret } from '../../js/calculators/calc-heart.js';

test('HEART boundaries', () => {
  assert.equal(interpret(0).severity, 'green');
  assert.equal(interpret(3).severity, 'green');
  assert.equal(interpret(4).severity, 'amber');
  assert.equal(interpret(6).severity, 'amber');
  assert.equal(interpret(7).severity, 'red');
  assert.equal(interpret(10).severity, 'red');
});
