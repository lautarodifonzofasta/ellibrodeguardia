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

test('GCS labels match legacy text verbatim', () => {
  assert.equal(interpret(8).label, 'Coma severo');
  assert.equal(interpret(12).label, 'Coma moderado');
  assert.equal(interpret(15).label, 'Normal o leve');
});
