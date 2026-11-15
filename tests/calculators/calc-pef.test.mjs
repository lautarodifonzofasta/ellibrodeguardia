import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compute, predictedPef, wrightToEu } from '../../js/calculators/calc-pef.js';

test('Wright to EN 13826 (EU) scale conversion', () => {
  assert.ok(Math.abs(wrightToEu(480) - 433) <= 3, `480 Wright: ${wrightToEu(480)}`);
  assert.ok(wrightToEu(300) < 300 && wrightToEu(600) < 600, 'the EU scale reads lower in the usual range');
});

test('predicted PEF (Nunn & Gregg, EU scale) lands in the expected adult range', () => {
  const man = predictedPef('m', 40, 175);
  const woman = predictedPef('f', 40, 162);
  assert.ok(man > 600 && man < 660, `man 40y 175cm: ${man}`);
  assert.ok(woman > 410 && woman < 460, `woman 40y 162cm: ${woman}`);
  assert.ok(predictedPef('m', 75, 175) < man, 'falls with age');
  assert.ok(predictedPef('m', 40, 190) > man, 'rises with height');
});

test('personal best wins over the predicted value', () => {
  const r = compute({ pef: 200, best: 400, sex: 'm', age: 40, height: 175, moment: 'arrival' });
  assert.equal(r.source, 'best');
  assert.equal(r.percent, 50);
  assert.equal(r.score, '50%');
});

test('at presentation: more than 50% is mild-moderate, 50% or less is severe', () => {
  assert.equal(compute({ pef: 204, best: 400, moment: 'arrival' }).severity, 'amber'); // 51%
  assert.equal(compute({ pef: 200, best: 400, moment: 'arrival' }).severity, 'red'); // 50%
  assert.match(compute({ pef: 90, best: 400, moment: 'arrival' }).lines[0], /25%/); // 23%
});

test('at one hour (GINA): over 60% discharge, 40–60% keep treating, under 40% admit', () => {
  assert.equal(compute({ pef: 244, best: 400, moment: 'hour' }).severity, 'green'); // 61%
  assert.equal(compute({ pef: 240, best: 400, moment: 'hour' }).severity, 'amber'); // 60%
  assert.equal(compute({ pef: 160, best: 400, moment: 'hour' }).severity, 'amber'); // 40%
  assert.equal(compute({ pef: 156, best: 400, moment: 'hour' }).severity, 'red'); // 39%
});

test('at one hour, discharge and incomplete response still remind that <25% at presentation admits', () => {
  const admitAnyway = /Si el PEF al ingreso fue &lt;25%, internar igual/;
  assert.ok(compute({ pef: 244, best: 400, moment: 'hour' }).lines.some(l => admitAnyway.test(l)), 'green');
  assert.ok(compute({ pef: 200, best: 400, moment: 'hour' }).lines.some(l => admitAnyway.test(l)), 'amber');
  assert.ok(!compute({ pef: 156, best: 400, moment: 'hour' }).lines.some(l => admitAnyway.test(l)), 'red');
});

test('falls back to the predicted value, and gives nothing without a reference', () => {
  const r = compute({ pef: 320, sex: 'm', age: 40, height: 175, moment: 'arrival' });
  assert.equal(r.source, 'predicted');
  assert.ok(r.percent >= 48 && r.percent <= 53);
  assert.match(r.lines.at(-1), /EN 13826/);
  assert.equal(compute({ pef: 320, sex: 'm', moment: 'arrival' }), null);
  assert.equal(compute({ best: 400, moment: 'arrival' }), null);
  assert.equal(compute({ pef: 320, sex: 'm', age: 10, height: 140 }), null); // outside the adult formula
});
