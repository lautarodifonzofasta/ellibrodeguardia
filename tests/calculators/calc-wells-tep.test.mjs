import { test } from 'node:test';
import assert from 'node:assert/strict';
import { interpret } from '../../js/calculators/calc-wells-tep.js';

test('Wells-TEP boundaries (source uses s>6 and s>=2 — easy to get off by one)', () => {
  assert.equal(interpret(0).severity, 'green');
  assert.equal(interpret(1).severity, 'green');
  assert.equal(interpret(2).severity, 'amber');
  assert.equal(interpret(6).severity, 'amber');
  assert.equal(interpret(7).severity, 'red');
});
