import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { interpret } from '../../js/calculators/calc-wells-tep.js';

const definition = JSON.parse(readFileSync(new URL('../../content/calculators/calc-wells-tep.json', import.meta.url), 'utf8'));
const options = definition.groups[0].options;
const points = label => options.find(o => o.label.startsWith(label)).points;

test('Wells-TEP boundaries (source uses s>6 and s>=2 — easy to get off by one)', () => {
  assert.equal(interpret(0).severity, 'green');
  assert.equal(interpret(1).severity, 'green');
  assert.equal(interpret(1.5).severity, 'green');
  assert.equal(interpret(2).severity, 'amber');
  assert.equal(interpret(6).severity, 'amber');
  assert.equal(interpret(6.5).severity, 'red');
  assert.equal(interpret(7).severity, 'red');
});

// The engine adds up `points`, not the `badge` text. These three items were
// once stored as 1 while their badge said 1.5, which silently lowered the score.
test('Wells-TEP items carry the published weights', () => {
  assert.equal(points('Signos o síntomas de TVP'), 3);
  assert.equal(points('Diagnóstico alternativo'), 3);
  assert.equal(points('FC >100'), 1.5);
  assert.equal(points('Inmovilización o cirugía'), 1.5);
  assert.equal(points('TEP o TVP previo'), 1.5);
  assert.equal(points('Hemoptisis'), 1);
  assert.equal(points('Cáncer activo'), 1);
  assert.equal(options.reduce((sum, o) => sum + o.points, 0), 12.5);
});

test('every Wells-TEP badge matches the points it stands for', () => {
  for (const o of options) {
    assert.equal(parseFloat(o.badge.replace('+', '').replace(',', '.')), o.points, o.label);
  }
});

test('DVT signs + tachycardia + previous VTE + haemoptysis is high probability', () => {
  const score = points('Signos o síntomas de TVP') + points('FC >100') + points('TEP o TVP previo') + points('Hemoptisis');
  assert.equal(score, 7);
  assert.equal(interpret(score).severity, 'red');
});
