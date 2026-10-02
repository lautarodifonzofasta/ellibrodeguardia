import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { interpret } from '../../js/calculators/calc-qsofa.js';
import { SCORED_CALCULATORS } from '../../js/calculators/index.js';

const definition = JSON.parse(readFileSync(new URL('../../content/calculators/calc-qsofa.json', import.meta.url), 'utf8'));

test('qSOFA: the 3 Sepsis-3 criteria, each answered No (0) or Sí (+1)', () => {
  assert.equal(definition.id, 'calc-qsofa');
  assert.deepEqual(definition.groups.map(g => g.label), ['FR ≥ 22/min', 'Sensorio alterado (Glasgow &lt; 15)', 'PAS ≤ 100 mmHg']);
  for (const g of definition.groups) {
    assert.equal(g.type, 'single');
    assert.deepEqual(g.options, [{ label: 'No', points: 0 }, { label: 'Sí', points: 1, badge: '+1' }]);
  }
});

test('qSOFA: no verdict until the 3 criteria are answered; score shown out of 3', () => {
  assert.equal(definition.requireAll, true);
  assert.equal(definition.maxScore, 3);
  assert.deepEqual(definition.result, { initialScore: '—', initialLabel: 'Completá los 3 criterios' });
});

test('qSOFA ≥ 2: positive, high risk of a poor outcome (red)', () => {
  for (const score of [2, 3]) {
    const r = interpret(score);
    assert.equal(r.severity, 'red');
    assert.equal(r.label, 'qSOFA positivo: alto riesgo de mala evolución');
    assert.equal(r.detailHtml,
      'La mortalidad intrahospitalaria es 3 a 14 veces mayor que con qSOFA &lt; 2.<br>' +
      'Buscar disfunción orgánica: <strong>SOFA y lactato</strong>.<br>' +
      'Si hay hipoperfusión, iniciar los 3 pilares sin esperar resultados: fluidos, ATB en la 1.ª hora y control del foco.');
    assert.equal(r.detail,
      'La mortalidad intrahospitalaria es 3 a 14 veces mayor que con qSOFA < 2. ' +
      'Buscar disfunción orgánica: SOFA y lactato. ' +
      'Si hay hipoperfusión, iniciar los 3 pilares sin esperar resultados: fluidos, ATB en la 1.ª hora y control del foco.');
  }
});

test('qSOFA < 2: negative, does not rule out sepsis (amber)', () => {
  for (const score of [0, 1]) {
    const r = interpret(score);
    assert.equal(r.severity, 'amber');
    assert.equal(r.label, 'qSOFA negativo: no descarta sepsis');
    assert.equal(r.detailHtml,
      'Es poco sensible. Si la sospecha clínica persiste, calcular SOFA, pedir lactato y reevaluar.<br>' +
      'No demorar ATB en un paciente con sospecha de sepsis por un qSOFA bajo.');
  }
});

test('qSOFA is registered for embedding (no meta.json entry: it lives inside Sepsis)', () => {
  assert.equal(SCORED_CALCULATORS['calc-qsofa'], interpret);
  const meta = JSON.parse(readFileSync(new URL('../../content/meta.json', import.meta.url), 'utf8'));
  assert.equal(meta['calc-qsofa'], undefined);
  const sepsis = readFileSync(new URL('../../content/modules/sepsis.html', import.meta.url), 'utf8');
  assert.match(sepsis, /data-calculator="calc-qsofa"/);
});
