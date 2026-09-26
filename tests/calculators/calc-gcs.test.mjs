import { test } from 'node:test';
import assert from 'node:assert/strict';
import { interpret } from '../../js/calculators/calc-gcs.js';

test('GCS boundaries', () => {
  assert.equal(interpret(3).severity, 'red');
  assert.equal(interpret(8).severity, 'red');
  assert.equal(interpret(9).severity, 'amber');
  assert.equal(interpret(12).severity, 'amber');
  assert.equal(interpret(13).severity, 'green');
  assert.equal(interpret(15).severity, 'green');
});

test('GCS resultId matches severity band', () => {
  assert.equal(interpret(8).resultId, 'severe');
  assert.equal(interpret(12).resultId, 'moderate');
  assert.equal(interpret(15).resultId, 'normal');
});
