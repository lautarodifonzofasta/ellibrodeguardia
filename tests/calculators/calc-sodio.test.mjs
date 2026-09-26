import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compute } from '../../js/calculators/calc-sodio.js';

test('sodium correction matches the legacy formula for the default form values', () => {
  // Defaults from content/calculators/calc-sodio.json: 120 -> 130, 70kg, male (0.6)
  const r = compute({ actual: 120, target: 130, weightKg: 70, sexFactor: 0.6 });
  assert.equal(r.act, 42); // 70 * 0.6
  assert.equal(r.deficit, 420); // 42 * (130-120)
  assert.equal(r.volumeMl, Math.round((420 / 513) * 1000));
  assert.equal(r.rateMlPerHour, Math.round(r.volumeMl / 24));
});

test('returns null on incomplete input, same guard as the legacy isNaN check', () => {
  assert.equal(compute({ actual: NaN, target: 130, weightKg: 70, sexFactor: 0.6 }), null);
  assert.equal(compute({ actual: 120, target: 130, weightKg: undefined, sexFactor: 0.6 }), null);
});
