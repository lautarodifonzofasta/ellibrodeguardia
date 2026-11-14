import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { interpret } from '../../js/calculators/calc-oakland.js';

const definition = JSON.parse(readFileSync(new URL('../../content/calculators/calc-oakland.json', import.meta.url), 'utf8'));
const pts = (id, label) => definition.groups.find(g => g.id === id).options.find(o => o.label === label).points;

test('Oakland: 8 or less is safe discharge, 9 or more is admission', () => {
  assert.equal(interpret(0).severity, 'green');
  assert.equal(interpret(8).severity, 'green');
  assert.equal(interpret(9).severity, 'red');
  assert.equal(interpret(35).severity, 'red');
});

test('Oakland has seven required items and a maximum of 35', () => {
  assert.equal(definition.groups.length, 7);
  assert.equal(definition.requireAll, true);
  const max = definition.groups.reduce((sum, g) => sum + Math.max(...g.options.map(o => o.points)), 0);
  assert.equal(max, 35);
});

test('Oakland weights match the published score', () => {
  assert.equal(pts('oak-edad', '≥70'), 2);
  assert.equal(pts('oak-sexo', 'Varón'), 1);
  assert.equal(pts('oak-fc', '≥110'), 3);
  assert.equal(pts('oak-pas', '<90'), 5);
  assert.equal(pts('oak-pas', '90–119'), 4);
  assert.equal(pts('oak-pas', '≥160'), 0);
  assert.equal(pts('oak-hb', '<7'), 22);
  assert.equal(pts('oak-hb', '7–8,9'), 17);
  assert.equal(pts('oak-hb', '9–10,9'), 13);
  assert.equal(pts('oak-hb', '11–12,9'), 8);
  assert.equal(pts('oak-hb', '13–15,9'), 4);
});

test('a young woman with normal vitals goes home with Hb 13, not with Hb 10', () => {
  // <40 (0) + woman (0) + no previous admission (0) + no blood on DRE (0) + HR <70 (0) + SBP 130–159 (2)
  const base = pts('oak-pas', '130–159');
  assert.equal(base + pts('oak-hb', '13–15,9'), 6);
  assert.equal(interpret(base + pts('oak-hb', '13–15,9')).severity, 'green');
  assert.equal(interpret(base + pts('oak-hb', '9–10,9')).severity, 'red');
});
