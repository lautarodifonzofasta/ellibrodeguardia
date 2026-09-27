import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { interpret } from '../../js/calculators/calc-tac-craneo.js';

const definition = JSON.parse(readFileSync(new URL('../../content/calculators/calc-tac-craneo.json', import.meta.url), 'utf8'));

// The author's spec (Regla Canadiense de TAC de cráneo), verbatim: which
// logic group each criterion belongs to, in evaluation order.
const SPEC_GROUPS = [
  ['excluye', [
    'Anticoagulado o con trastorno de la coagulación',
    'Convulsión después del trauma',
    'GCS <13 en cualquier momento',
  ]],
  ['pediatrico', [
    'Menor de 16 años',
  ]],
  ['alto', [
    'GCS <15 a las 2 h del trauma',
    'Sospecha de fractura de cráneo abierta o con hundimiento',
    'Signos de fractura de base de cráneo (hemotímpano, ojos de mapache, signo de Battle, otorraquia/rinorraquia)',
    'Vómitos: 2 o más episodios',
    'Edad ≥65 años',
  ]],
  ['medio', [
    'Amnesia retrógrada ≥30 minutos antes del impacto',
    'Mecanismo peligroso: peatón atropellado, eyección del vehículo o caída de >1 m o 5 escalones',
  ]],
];
const ORDER = SPEC_GROUPS.map(([g]) => g);
const GROUP_OF = new Map(SPEC_GROUPS.flatMap(([g, labels]) => labels.map(l => [l, g])));

// Result table from the spec, verbatim ("Rojo/Ámbar/Neutro" → severity).
const EXPECTED = {
  excluye: { severity: 'red', label: 'La regla no aplica → TAC indicada', detail: 'Anticoagulación, convulsión post-trauma o GCS <13 excluyen la regla canadiense. Estos pacientes requieren TAC.' },
  pediatrico: { severity: 'amber', label: 'La regla no aplica en menores de 16 años', detail: 'Usá los criterios PECARN para decidir la TAC en pediatría.' },
  alto: { severity: 'red', label: 'TAC indicada: alto riesgo', detail: 'Riesgo de requerir intervención neuroquirúrgica. TAC de cerebro sin contraste.' },
  medio: { severity: 'amber', label: 'TAC indicada: riesgo medio', detail: 'Riesgo de lesión cerebral visible en la TAC. TAC de cerebro sin contraste.' },
  ninguno: { severity: 'neutral', label: 'Sin criterios marcados', detail: 'Si realmente no hay ninguno, la regla indica que no requiere TAC. Confirmá que el paciente cumple las condiciones de aplicación.' },
};

const options = definition.groups.flatMap(g => g.options);

test('JSON: headings, labels and order match the spec verbatim', () => {
  assert.deepEqual(definition.groups.map(g => g.label), [
    'Primero: ¿se puede usar la regla?',
    'Alto riesgo: intervención neuroquirúrgica',
    'Riesgo medio: lesión visible en TAC',
  ]);
  assert.deepEqual(options.map(o => o.label), SPEC_GROUPS.flatMap(([, labels]) => labels));
  assert.ok(definition.groups.every(g => g.type === 'multi'), 'every group is a multi-select checklist');
});

test('JSON: points and score are hidden, initial state is the "ninguno" result', () => {
  assert.equal(definition.hidePoints, true);
  assert.equal(definition.showInitialResult, true);
  assert.ok(options.every(o => o.badge === undefined), 'no badges to show');
  assert.deepEqual(interpret(0), EXPECTED.ninguno);
});

test('points tiers never overflow into the next group', () => {
  const pointsOf = g => options.filter(o => GROUP_OF.get(o.label) === g).map(o => o.points);
  for (let i = 0; i < ORDER.length; i++) {
    const lowerMax = ORDER.slice(i + 1).flatMap(pointsOf).reduce((a, b) => a + b, 0);
    const tierMin = Math.min(...pointsOf(ORDER[i]));
    assert.ok(tierMin > lowerMax, `${ORDER[i]}: one criterion (${tierMin}) must outweigh every lower criterion together (${lowerMax})`);
    assert.ok(pointsOf(ORDER[i]).every(p => Number.isInteger(p) && p > 0));
  }
  assert.deepEqual(ORDER.map(g => pointsOf(g)[0]), [1000, 100, 10, 1]);
});

test('every one of the 2^11 combinations shows the first matching group, in spec order', () => {
  assert.equal(options.length, 11);
  for (let mask = 0; mask < 2 ** options.length; mask++) {
    const marked = options.filter((_, i) => mask & (1 << i));
    const score = marked.reduce((sum, o) => sum + o.points, 0);
    const groups = new Set(marked.map(o => GROUP_OF.get(o.label)));
    const expected = ORDER.find(g => groups.has(g)) ?? 'ninguno';
    assert.deepEqual(interpret(score), EXPECTED[expected], `marked: ${marked.map(o => o.label).join(' | ') || '(nada)'}`);
  }
});

test('result texts are exact, one per group', () => {
  assert.deepEqual(interpret(1000), EXPECTED.excluye);
  assert.deepEqual(interpret(100), EXPECTED.pediatrico);
  assert.deepEqual(interpret(10), EXPECTED.alto);
  assert.deepEqual(interpret(1), EXPECTED.medio);
  assert.deepEqual(interpret(0), EXPECTED.ninguno);
});
