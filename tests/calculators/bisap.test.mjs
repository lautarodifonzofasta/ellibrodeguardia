import { test, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { calcBISAP, copyBISAP, resetBISAP } from '../../js/calculators/bisap.js';

// A stand-in for the BISAP tab of content/modules/pancreatitis.html: just the
// ids and classes js/calculators/bisap.js reads and writes.
function fakeElement(props = {}) {
  const cls = new Set();
  return {
    value: '', checked: false, textContent: '', style: {},
    classList: {
      toggle(c, on) { if (on ?? !cls.has(c)) cls.add(c); else cls.delete(c); },
      contains: c => cls.has(c),
    },
    select() {},
    ...props,
  };
}

const IDS = ['bisap-score', 'bisap-bun-val', 'bisap-i', 'bisap-sirs-count', 'bisap-age', 'bisap-p',
  'bisap-pt-b', 'bisap-pt-i', 'bisap-pt-s', 'bisap-pt-a', 'bisap-pt-p', 'bisap-out', 'bisap-risk', 'bisap-line'];
let el, sirs, copied;
const realNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');

beforeEach(() => {
  el = Object.fromEntries(IDS.map(id => [id, fakeElement()]));
  el['bisap-bun-unit'] = fakeElement({ value: 'urea' });
  sirs = [0, 1, 2, 3].map(() => fakeElement());
  copied = [];
  globalThis.document = {
    getElementById: id => el[id] || null,
    querySelectorAll: sel => sel === '.bisap-sirs-c:checked' ? sirs.filter(c => c.checked) : sel === '.bisap-sirs-c' ? sirs : [],
    createElement: () => fakeElement(),
    body: { appendChild(ta) { copied.push(ta.value); }, removeChild() {} },
    execCommand: () => true,
  };
  Object.defineProperty(globalThis, 'navigator', { value: {}, configurable: true });
});

afterEach(() => {
  delete globalThis.document;
  delete globalThis.window;
  if (realNavigator) Object.defineProperty(globalThis, 'navigator', realNavigator);
});

const fill = ({ urea = '', unit = 'urea', mental = false, sirsN = 0, age = '', effusion = false } = {}) => {
  el['bisap-bun-val'].value = String(urea);
  el['bisap-bun-unit'].value = unit;
  el['bisap-i'].checked = mental;
  sirs.forEach((c, n) => { c.checked = n < sirsN; });
  el['bisap-age'].value = String(age);
  el['bisap-p'].checked = effusion;
  calcBISAP();
};
const points = () => ['b', 'i', 's', 'a', 'p'].filter(k => el[`bisap-pt-${k}`].classList.contains('on'));

test('BISAP: nothing entered → 0/5, low risk', () => {
  fill();
  assert.equal(el['bisap-score'].textContent, 0);
  assert.equal(el['bisap-risk'].textContent, 'Bajo riesgo · mortalidad <2%');
  assert.equal(el['bisap-line'].textContent, 'BISAP 0/5 — bajo riesgo (mortalidad <2%).');
  assert.equal(el['bisap-sirs-count'].textContent, '0 de 4 criterios');
  assert.ok(el['bisap-out'].classList.contains('lo') && !el['bisap-out'].classList.contains('hi'));
});

test('BISAP B: urea > 53.5 mg/dL (BUN > 25 × 2,14) or BUN > 25 mg/dL', () => {
  fill({ urea: 53 }); assert.deepEqual(points(), []);
  fill({ urea: 53.5 }); assert.deepEqual(points(), [], 'BUN exactly 25 is not > 25');
  fill({ urea: 54 }); assert.deepEqual(points(), ['b']);
  assert.equal(el['bisap-line'].textContent, 'BISAP 1/5 (urea 54 mg/dL) — bajo riesgo (mortalidad <2%).');
  fill({ urea: 25, unit: 'bun' }); assert.deepEqual(points(), []);
  fill({ urea: 26, unit: 'bun' }); assert.deepEqual(points(), ['b']);
  assert.equal(el['bisap-line'].textContent, 'BISAP 1/5 (BUN 26 mg/dL) — bajo riesgo (mortalidad <2%).');
  fill({ urea: '60,5' }); assert.deepEqual(points(), ['b'], 'decimal comma');
});

test('BISAP S: SIRS counts only with 2 of 4 criteria', () => {
  fill({ sirsN: 1 });
  assert.deepEqual(points(), []);
  assert.equal(el['bisap-sirs-count'].textContent, '1 de 4 criterios');
  fill({ sirsN: 2 });
  assert.deepEqual(points(), ['s']);
  assert.equal(el['bisap-sirs-count'].textContent, '2 de 4 criterios');
});

test('BISAP A: age > 60', () => {
  fill({ age: 60 }); assert.deepEqual(points(), []);
  fill({ age: 61 }); assert.deepEqual(points(), ['a']);
});

test('BISAP ≥ 3 → high risk, with the criteria in the line for the chart', () => {
  fill({ urea: 60, sirsN: 2, age: 70 });
  assert.equal(el['bisap-score'].textContent, 3);
  assert.equal(el['bisap-risk'].textContent, 'Alto riesgo · mortalidad >15%');
  assert.equal(el['bisap-line'].textContent, 'BISAP 3/5 (urea 60 mg/dL, SIRS 2/4, edad 70) — alto riesgo de mortalidad hospitalaria (>15%).');
  assert.ok(el['bisap-out'].classList.contains('hi') && !el['bisap-out'].classList.contains('lo'));
  fill({ urea: 30, unit: 'bun', mental: true, sirsN: 4, age: 80, effusion: true });
  assert.deepEqual(points(), ['b', 'i', 's', 'a', 'p']);
  assert.equal(el['bisap-line'].textContent, 'BISAP 5/5 (BUN 30 mg/dL, sensorio alterado, SIRS 4/4, edad 80, derrame pleural) — alto riesgo de mortalidad hospitalaria (>15%).');
});

test('BISAP: Limpiar clears every field and recalculates', () => {
  fill({ urea: 30, unit: 'bun', mental: true, sirsN: 4, age: 80, effusion: true });
  resetBISAP();
  assert.equal(el['bisap-bun-val'].value, '');
  assert.equal(el['bisap-age'].value, '');
  assert.ok(!el['bisap-i'].checked && !el['bisap-p'].checked && sirs.every(c => !c.checked));
  assert.deepEqual(points(), []);
  assert.equal(el['bisap-line'].textContent, 'BISAP 0/5 — bajo riesgo (mortalidad <2%).');
});

test('BISAP: Copiar copies the line and confirms on the button for 1.5 s', async () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    fill({ urea: 60, sirsN: 2, age: 70 });
    const btn = { textContent: 'Copiar para la evolución' };
    copyBISAP(btn);                                   // no clipboard API → textarea + execCommand
    assert.deepEqual(copied, ['BISAP 3/5 (urea 60 mg/dL, SIRS 2/4, edad 70) — alto riesgo de mortalidad hospitalaria (>15%).']);
    assert.equal(btn.textContent, 'Copiado');
    mock.timers.tick(1500);
    assert.equal(btn.textContent, 'Copiar para la evolución');

    const written = [];
    Object.defineProperty(globalThis, 'navigator', { value: { clipboard: { writeText: async t => { written.push(t); } } }, configurable: true });
    globalThis.window = { isSecureContext: true };
    copyBISAP(btn);
    await Promise.resolve(); await Promise.resolve();
    assert.deepEqual(written, [el['bisap-line'].textContent]);
    assert.equal(btn.textContent, 'Copiado');
  } finally {
    mock.timers.reset();
  }
});
