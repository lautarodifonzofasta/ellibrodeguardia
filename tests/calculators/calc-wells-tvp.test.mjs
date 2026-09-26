import { test } from 'node:test';
import assert from 'node:assert/strict';
import { interpret } from '../../js/calculators/calc-wells-tvp.js';

test('Wells-TVP boundaries (source allows negative scores via the -2 option)', () => {
  assert.equal(interpret(-2).severity, 'green');
  assert.equal(interpret(0).severity, 'green');
  assert.equal(interpret(1).severity, 'green');
  assert.equal(interpret(2).severity, 'amber');
  assert.equal(interpret(6).severity, 'amber');
  assert.equal(interpret(7).severity, 'red');
});
