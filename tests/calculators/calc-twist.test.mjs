import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { interpret } from '../../js/calculators/calc-twist.js';
import { SCORED_CALCULATORS } from '../../js/calculators/index.js';

const read = path => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
const definition = JSON.parse(read('content/calculators/calc-twist.json'));
const pts = (id, label) => definition.groups.find(g => g.id === id).options.find(o => o.label === label).points;

test('TWIST bands (Barbosa): 0–2 low, 3–4 intermediate, 5–7 high', () => {
  assert.equal(interpret(0).severity, 'green');
  assert.equal(interpret(2).severity, 'green');
  assert.equal(interpret(3).severity, 'amber');
  assert.equal(interpret(4).severity, 'amber');
  assert.equal(interpret(5).severity, 'red');
  assert.equal(interpret(7).severity, 'red');
});

test('TWIST weights: swelling 2, hard testis 2, and 1 each for reflex, nausea and high-riding testis', () => {
  assert.equal(pts('twist-tumefaccion', 'Sí'), 2);
  assert.equal(pts('twist-duro', 'Sí'), 2);
  assert.equal(pts('twist-cremasterico', 'Ausente'), 1);
  assert.equal(pts('twist-nauseas', 'Sí'), 1);
  assert.equal(pts('twist-alto', 'Sí'), 1);
});

test('TWIST: five required findings, each with a zero-point answer, maximum 7', () => {
  assert.equal(definition.groups.length, 5);
  assert.equal(definition.requireAll, true);
  for (const g of definition.groups) {
    assert.equal(g.type, 'single', g.id);
    assert.equal(Math.min(...g.options.map(o => o.points)), 0, g.id);
  }
  const max = definition.groups.reduce((sum, g) => sum + Math.max(...g.options.map(o => o.points)), 0);
  assert.equal(max, 7);
  assert.equal(definition.maxScore, 7);
});

test('high risk tells the reader not to wait for the ultrasound; low risk says a low score does not rule torsion out', () => {
  assert.match(interpret(6).detail, /sin esperar la ecografía/);
  assert.match(interpret(1).detail, /no la descarta/);
});

test('TWIST is registered and embedded in the Escroto agudo module', () => {
  assert.equal(SCORED_CALCULATORS['calc-twist'], interpret);
  assert.match(read('content/modules/escroto-agudo.html'), /data-calculator="calc-twist"/);
});
