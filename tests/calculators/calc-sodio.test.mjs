import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compute, MAX_DELTA_24H } from '../../js/calculators/calc-sodio.js';

test('sodium correction matches the legacy formula for the default form values', () => {
  // Defaults from content/calculators/calc-sodio.json: 120 -> 130, 70kg, male (0.6)
  const r = compute({ actual: 120, target: 130, weightKg: 70, sexFactor: 0.6 });
  assert.equal(r.act, 42); // 70 * 0.6
  assert.equal(r.deficit, 420); // 42 * (130-120)
  assert.equal(r.volumeMl, Math.round((420 / 513) * 1000));
  assert.equal(r.rateMlPerHour, Math.round(r.volumeMl / 24));
  assert.equal(r.capped, false);
  assert.equal(r.targetUsed, 130);
});

test('returns null on incomplete input, same guard as the legacy isNaN check', () => {
  assert.equal(compute({ actual: NaN, target: 130, weightKg: 70, sexFactor: 0.6 }), null);
  assert.equal(compute({ actual: 120, target: 130, weightKg: undefined, sexFactor: 0.6 }), null);
});

// The result is expressed as a 24 h infusion, so a target more than 10 mEq/L
// above the current value must never be turned into a rate.
test('caps the correction at +10 mEq/L per 24 h', () => {
  const asked = compute({ actual: 108, target: 135, weightKg: 70, sexFactor: 0.6 });
  const limit = compute({ actual: 108, target: 118, weightKg: 70, sexFactor: 0.6 });
  assert.equal(MAX_DELTA_24H, 10);
  assert.equal(asked.capped, true);
  assert.equal(asked.targetUsed, 118);
  assert.equal(asked.volumeMl, limit.volumeMl);
  assert.equal(asked.rateMlPerHour, limit.rateMlPerHour);
  assert.equal(limit.capped, false);
});

test('no result when the target is not above the current value', () => {
  assert.equal(compute({ actual: 130, target: 130, weightKg: 70, sexFactor: 0.6 }), null);
  assert.equal(compute({ actual: 130, target: 125, weightKg: 70, sexFactor: 0.6 }), null);
});
