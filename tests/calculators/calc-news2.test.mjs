import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { interpret } from '../../js/calculators/calc-news2.js';

const definition = JSON.parse(readFileSync(new URL('../../content/calculators/calc-news2.json', import.meta.url), 'utf8'));
const group = id => definition.groups.find(g => g.id === id);
const pts = (id, label) => group(id).options.find(o => o.label === label).points;

test('NEWS2 has the seven parameters, every one required, and a maximum of 20', () => {
  assert.equal(definition.groups.length, 7);
  assert.equal(definition.requireAll, true);
  const max = definition.groups.reduce((sum, g) => sum + Math.max(...g.options.map(o => o.points)), 0);
  assert.equal(max, 20);
  assert.equal(definition.maxScore, 20);
});

test('NEWS2 weights match the RCP 2017 chart at the edges', () => {
  assert.equal(pts('news-fr', '≤8'), 3);
  assert.equal(pts('news-fr', '21–24'), 2);
  assert.equal(pts('news-fr', '≥25'), 3);
  assert.equal(pts('news-o2', 'Recibe oxígeno'), 2);
  assert.equal(pts('news-pas', '≤90'), 3);
  assert.equal(pts('news-pas', '≥220'), 3);
  assert.equal(pts('news-pas', '111–219'), 0);
  assert.equal(pts('news-fc', '≤40'), 3);
  assert.equal(pts('news-fc', '41–50'), 1);
  assert.equal(pts('news-fc', '≥131'), 3);
  assert.equal(pts('news-temp', '≤35,0'), 3);
  assert.equal(pts('news-temp', '≥39,1'), 2);
  assert.equal(pts('news-spo2', 'Escala 1 · ≤91%'), 3);
  assert.equal(pts('news-spo2', 'Escala 2 · 88–92%, o ≥93% respirando aire'), 0);
  assert.equal(pts('news-spo2', 'Escala 2 · ≥97% con oxígeno'), 3);
});

test('NEWS2 bands by aggregate score', () => {
  assert.equal(interpret(0, { points: [0, 0, 0, 0, 0, 0, 0] }).label, 'Sin alteraciones');
  assert.equal(interpret(4, { points: [1, 1, 2, 0, 0, 0, 0] }).severity, 'green');
  assert.equal(interpret(5, { points: [2, 2, 1, 0, 0, 0, 0] }).severity, 'amber');
  assert.equal(interpret(6, { points: [2, 2, 2, 0, 0, 0, 0] }).label, 'Riesgo medio');
  assert.equal(interpret(7, { points: [3, 2, 2, 0, 0, 0, 0] }).severity, 'red');
  assert.equal(interpret(20, { points: [3, 3, 2, 3, 3, 3, 3] }).severity, 'red');
});

test('a single parameter scoring 3 raises a low aggregate to an urgent review', () => {
  const lone = interpret(3, { points: [3, 0, 0, 0, 0, 0, 0] });
  assert.equal(lone.severity, 'amber');
  assert.match(lone.label, /un parámetro en 3/);
  // Same total without any 3 stays low.
  assert.equal(interpret(3, { points: [1, 1, 1, 0, 0, 0, 0] }).severity, 'green');
  // At 5 or more the aggregate band wins.
  assert.equal(interpret(5, { points: [3, 2, 0, 0, 0, 0, 0] }).label, 'Riesgo medio');
});

test('NEWS2 works without context (older engine callers)', () => {
  assert.equal(interpret(2).severity, 'green');
});
