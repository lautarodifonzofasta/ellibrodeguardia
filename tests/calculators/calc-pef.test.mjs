import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compute, predictedPef } from '../../js/calculators/calc-pef.js';

test('predicted PEF (Nunn & Gregg) lands in the expected adult range', () => {
  const man = predictedPef('m', 40, 175);
  const woman = predictedPef('f', 40, 162);
  assert.ok(man > 600 && man < 660, `man 40y 175cm: ${man}`);
  assert.ok(woman > 450 && woman < 500, `woman 40y 162cm: ${woman}`);
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

test('at one hour: 60% discharge, 40–59% keep treating, under 40% admit', () => {
  assert.equal(compute({ pef: 240, best: 400, moment: 'hour' }).severity, 'green'); // 60%
  assert.equal(compute({ pef: 236, best: 400, moment: 'hour' }).severity, 'amber'); // 59%
  assert.equal(compute({ pef: 160, best: 400, moment: 'hour' }).severity, 'amber'); // 40%
  assert.equal(compute({ pef: 156, best: 400, moment: 'hour' }).severity, 'red'); // 39%
});

test('falls back to the predicted value, and gives nothing without a reference', () => {
  const r = compute({ pef: 320, sex: 'm', age: 40, height: 175, moment: 'arrival' });
  assert.equal(r.source, 'predicted');
  assert.ok(r.percent >= 48 && r.percent <= 53);
  assert.equal(compute({ pef: 320, sex: 'm', moment: 'arrival' }), null);
  assert.equal(compute({ best: 400, moment: 'arrival' }), null);
  assert.equal(compute({ pef: 320, sex: 'm', age: 10, height: 140 }), null); // outside the adult formula
});
