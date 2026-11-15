import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compute } from '../../js/calculators/calc-gases.js';

test('respiratory acidosis (pH ≤7.35 with PaCO2 >45) indicates NIV', () => {
  const r = compute({ ph: 7.30, pco2: 60 });
  assert.equal(r.kind, 'resp-acidosis');
  assert.equal(r.severity, 'red');
  assert.match(r.lines[0], /VNI indicada/);
});

test('pH under 7.25 is flagged as severe', () => {
  assert.equal(compute({ ph: 7.24, pco2: 70 }).kind, 'resp-acidosis-severe');
  assert.equal(compute({ ph: 7.25, pco2: 70 }).kind, 'resp-acidosis');
});

test('boundaries: pH 7.35 with PaCO2 >45 is respiratory acidosis; PaCO2 45 is not', () => {
  assert.equal(compute({ ph: 7.35, pco2: 60 }).kind, 'resp-acidosis');
  assert.equal(compute({ ph: 7.36, pco2: 60 }).kind, 'compensated-hypercapnia');
  assert.equal(compute({ ph: 7.30, pco2: 45 }).kind, 'metabolic-acidosis-resp');
  assert.equal(compute({ ph: 7.35, pco2: 40 }).kind, 'normal');
  assert.equal(compute({ ph: 7.40, pco2: 40 }).kind, 'normal');
});

test('bicarbonate separates acute, acute-on-chronic and an added metabolic acidosis', () => {
  // PaCO2 70: expected HCO3 27 if acute, ~34.5 if chronic
  assert.match(compute({ ph: 7.28, pco2: 70, hco3: 27 }).lines[1], /cuadro agudo/);
  assert.match(compute({ ph: 7.32, pco2: 70, hco3: 34 }).lines[1], /crónico agudizado/);
  // PaCO2 60: acute expected 26, so 18 is more than 3 below it
  assert.match(compute({ ph: 7.10, pco2: 60, hco3: 18 }).lines[1], /acidosis metabólica asociada/);
});

test('acidosis without hypercapnia: Winter separates adequate from insufficient compensation', () => {
  // Estimated HCO3 ~21 → expected PaCO2 ~40 ± 2: 45 is too high
  const tiring = compute({ ph: 7.30, pco2: 45 });
  assert.equal(tiring.kind, 'metabolic-acidosis-resp');
  assert.equal(tiring.severity, 'red');
  assert.match(tiring.lines[0], /HCO₃ estimado/);
  // Estimated HCO3 ~17 → expected ~33 ± 2
  assert.equal(compute({ ph: 7.20, pco2: 44 }).kind, 'metabolic-acidosis-resp');
  // Estimated HCO3 ~14 → expected ~29 ± 2: 30 is within range
  const compensated = compute({ ph: 7.30, pco2: 30 });
  assert.equal(compensated.kind, 'metabolic-acidosis');
  assert.equal(compensated.severity, 'amber');
  // A measured bicarbonate is used as given: 12 → expected 26 ± 2
  assert.equal(compute({ ph: 7.30, pco2: 27, hco3: 12 }).kind, 'metabolic-acidosis');
  const measured = compute({ ph: 7.30, pco2: 30, hco3: 12 });
  assert.equal(measured.kind, 'metabolic-acidosis-resp');
  assert.doesNotMatch(measured.lines[0], /estimado/);
});

test('compensated hypercapnia, alkalosis and hypoxaemia', () => {
  assert.equal(compute({ ph: 7.38, pco2: 55 }).kind, 'compensated-hypercapnia');
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

test('an HCO3 of 0 counts as not entered, in every branch', () => {
  assert.deepEqual(compute({ ph: 7.30, pco2: 60, hco3: 0 }).lines, compute({ ph: 7.30, pco2: 60 }).lines);
});
