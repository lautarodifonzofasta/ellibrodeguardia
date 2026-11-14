import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compute } from '../../js/calculators/calc-gases.js';

test('respiratory acidosis (pH <7.35 with PaCO2 >45) indicates NIV', () => {
  const r = compute({ ph: 7.30, pco2: 60 });
  assert.equal(r.kind, 'resp-acidosis');
  assert.equal(r.severity, 'red');
  assert.match(r.lines[0], /VNI indicada/);
});

test('pH under 7.25 is flagged as severe', () => {
  assert.equal(compute({ ph: 7.24, pco2: 70 }).kind, 'resp-acidosis-severe');
  assert.equal(compute({ ph: 7.25, pco2: 70 }).kind, 'resp-acidosis');
});

test('boundaries: pH 7.35 or PaCO2 45 is not respiratory acidosis', () => {
  assert.equal(compute({ ph: 7.35, pco2: 60 }).kind, 'compensated-hypercapnia');
  assert.equal(compute({ ph: 7.30, pco2: 45 }).kind, 'non-resp-acidosis');
  assert.equal(compute({ ph: 7.40, pco2: 40 }).kind, 'normal');
});

test('bicarbonate separates acute from acute-on-chronic retention', () => {
  // PaCO2 70: expected HCO3 27 if acute, ~34.5 if chronic
  assert.match(compute({ ph: 7.28, pco2: 70, hco3: 27 }).lines[1], /cuadro agudo/);
  assert.match(compute({ ph: 7.32, pco2: 70, hco3: 34 }).lines[1], /crónico agudizado/);
});

test('alkalosis and hypoxaemia', () => {
  assert.equal(compute({ ph: 7.50, pco2: 28 }).kind, 'resp-alkalosis');
  assert.equal(compute({ ph: 7.50, pco2: 48 }).kind, 'metabolic-alkalosis');
  assert.match(compute({ ph: 7.40, pco2: 40, po2: 52 }).lines.at(-1), /hipoxemia/);
  assert.equal(compute({ ph: 7.40, pco2: 40, po2: 80 }).lines.length, 1);
});

test('incomplete or implausible values give no result', () => {
  assert.equal(compute({ ph: 7.3 }), null);
  assert.equal(compute({ pco2: 60 }), null);
  assert.equal(compute({ ph: 73, pco2: 60 }), null);
});
