import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { interpret } from '../../js/calculators/calc-nihss.js';
import { SCORED_CALCULATORS } from '../../js/calculators/index.js';

const read = path => JSON.parse(readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8'));
const definition = read('content/calculators/calc-nihss.json');
const meta = read('content/meta.json');
const groups = definition.groups;
const byCode = Object.fromEntries(groups.map(g => [g.code, g]));
const scored = g => g.options.filter(o => !o.untestable);

test('NIHSS is a standalone calculator view with its interpret() registered', () => {
  assert.equal(meta['calc-nihss'].type, 'calculator');
  assert.equal(SCORED_CALCULATORS['calc-nihss'], interpret);
  assert.equal(definition.requireAll, true);
});

test('NIHSS has the 15 items, in exam order, all single choice', () => {
  assert.deepEqual(groups.map(g => g.code), ['1a', '1b', '1c', '2', '3', '4', '5a', '5b', '6a', '6b', '7', '8', '9', '10', '11']);
  for (const g of groups) assert.equal(g.type, 'single', g.code);
  assert.equal(new Set(groups.map(g => g.id)).size, groups.length);
});

// Each item scores 0, 1, 2… in order; the maxima add up to the scale's 42.
test('NIHSS item scores run 0..max in order and the maxima add up to 42', () => {
  const maxima = { '1a': 3, '1b': 2, '1c': 2, '2': 2, '3': 3, '4': 3, '5a': 4, '5b': 4, '6a': 4, '6b': 4, '7': 2, '8': 2, '9': 3, '10': 2, '11': 2 };
  for (const g of groups) {
    assert.deepEqual(scored(g).map(o => o.points), [...Array(maxima[g.code] + 1).keys()], g.code);
  }
  const total = groups.reduce((sum, g) => sum + Math.max(...scored(g).map(o => o.points)), 0);
  assert.equal(total, 42);
  assert.equal(definition.maxScore, 42);
});

// UN (untestable) exists only where the NINDS form has it, and adds 0.
test('NIHSS "untestable" only on 5a–6b (amputation/fusion), 7 and 10 (intubation), worth 0', () => {
  const withUn = groups.filter(g => g.options.some(o => o.untestable)).map(g => g.code);
  assert.deepEqual(withUn, ['5a', '5b', '6a', '6b', '7', '10']);
  for (const g of groups) {
    const un = g.options.filter(o => o.untestable);
    assert.ok(un.length <= 1, g.code);
    for (const o of un) assert.equal(o.points, 0, g.code);
  }
});

// The NINDS form numbers the left limbs first: 5a/6a left, 5b/6b right.
test('NIHSS 5a/6a are the left limbs and 5b/6b the right ones', () => {
  assert.match(byCode['5a'].label, /izquierdo/);
  assert.match(byCode['5b'].label, /derecho/);
  assert.match(byCode['6a'].label, /izquierda/);
  assert.match(byCode['6b'].label, /derecha/);
});

// Coma (1a = 3): 8 → 2 and 9 → 3 are automatic in the NINDS instructions;
// 1b → 2, 1c → 2 and 7 → 0 follow from them (does not comprehend, cannot obey,
// ataxia is absent in the patient who cannot understand).
test('NIHSS coma (1a = 3) fixes 1b=2, 1c=2, 7=0, 8=2, 9=3 and nothing else', () => {
  const coma = byCode['1a'].options.find(o => o.points === 3);
  const forced = Object.fromEntries(Object.entries(coma.forces).map(([id, index]) => {
    const g = groups.find(x => x.id === id);
    assert.ok(g, `forces an unknown group: ${id}`);
    assert.ok(g.options[index], `${g.code}: no option ${index}`);
    return [g.code, g.options[index].points];
  }));
  assert.deepEqual(forced, { '1b': 2, '1c': 2, '7': 0, '8': 2, '9': 3 });
  assert.ok(coma.forceNote);
  const others = groups.flatMap(g => g.options).filter(o => o !== coma && o.forces);
  assert.equal(others.length, 0);
  // Lowest possible total for a patient in coma: 3 + 2 + 2 + 0 + 2 + 3.
  assert.equal(interpret(12).severity, 'red');
});

test('NIHSS severity bands: 0 · 1–4 · 5–15 · 16–20 · ≥21', () => {
  assert.deepEqual([interpret(0).severity, interpret(0).label], ['green', 'Sin déficit en la escala']);
  for (const s of [1, 4]) assert.deepEqual([interpret(s).severity, interpret(s).label], ['amber', 'ACV menor'], `score ${s}`);
  for (const s of [5, 15]) assert.deepEqual([interpret(s).severity, interpret(s).label], ['red', 'ACV moderado'], `score ${s}`);
  for (const s of [16, 20]) assert.deepEqual([interpret(s).severity, interpret(s).label], ['red', 'ACV moderado a grave'], `score ${s}`);
  for (const s of [21, 42]) assert.deepEqual([interpret(s).severity, interpret(s).label], ['red', 'ACV grave'], `score ${s}`);
});

test('NIHSS clinical lines switch at ≤3, ≥6 and >25, as in the ACV module', () => {
  assert.match(interpret(3).detail, /clopidogrel/);
  assert.doesNotMatch(interpret(4).detail, /clopidogrel/);
  assert.match(interpret(4).detail, /discapacitante/);
  assert.doesNotMatch(interpret(5).detail, /gran vaso/);
  assert.match(interpret(6).detail, /gran vaso/);
  assert.doesNotMatch(interpret(25).detail, /hemorrágica/);
  assert.match(interpret(26).detail, /hemorrágica/);
  for (let s = 0; s <= 42; s++) assert.doesNotMatch(interpret(s).detail, /<|&gt;/, `score ${s}: markup in plain detail`);
});

test('NIHSS lists the items scored UN', () => {
  assert.doesNotMatch(interpret(8).detail, /UN/);
  assert.doesNotMatch(interpret(8, { untestable: [] }).detail, /UN/);
  assert.match(interpret(8, { untestable: ['5a', '10'] }).detail, /No evaluable \(UN\): 5a, 10/);
});
