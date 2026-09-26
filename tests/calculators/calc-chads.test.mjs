import { test } from 'node:test';
import assert from 'node:assert/strict';
import { interpret } from '../../js/calculators/calc-chads.js';

test('CHA2DS2-VASc boundaries', () => {
  assert.equal(interpret(0).severity, 'green');
  assert.equal(interpret(1).severity, 'green');
  assert.equal(interpret(2).severity, 'amber');
  assert.equal(interpret(3).severity, 'amber');
  assert.equal(interpret(4).severity, 'red');
  assert.equal(interpret(9).severity, 'red');
});
