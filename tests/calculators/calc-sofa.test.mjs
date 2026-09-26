import { test } from 'node:test';
import assert from 'node:assert/strict';
import { interpret } from '../../js/calculators/calc-sofa.js';

test('SOFA boundaries', () => {
  assert.equal(interpret(0).severity, 'green');
  assert.equal(interpret(2).severity, 'green');
  assert.equal(interpret(3).severity, 'amber');
  assert.equal(interpret(6).severity, 'amber');
  assert.equal(interpret(7).severity, 'red');
  assert.equal(interpret(10).severity, 'red');
  assert.equal(interpret(11).severity, 'red');
  assert.equal(interpret(24).severity, 'red');
});

test('SOFA distinguishes the two red bands via resultId', () => {
  assert.equal(interpret(7).resultId, 'severe');
  assert.equal(interpret(11).resultId, 'critical');
});
