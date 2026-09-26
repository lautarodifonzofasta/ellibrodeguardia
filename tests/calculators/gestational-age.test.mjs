import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compute } from '../../js/calculators/gestational-age.js';

test('computes weeks/days from FUM, same as legacy calcEG()', () => {
  const now = new Date('2026-06-15');
  const fum = '2026-01-01'; // 165 days before "now"
  const r = compute(fum, now);
  assert.equal(r.weeks, 23);
  assert.equal(r.days, 4);
  assert.equal(r.trimester, 2);
  assert.equal(r.half, 2);
});

test('rejects a future FUM and one further back than a full-term pregnancy', () => {
  const now = new Date('2026-06-15');
  assert.deepEqual(compute('2026-07-01', now), { error: 'invalid' }); // future
  assert.deepEqual(compute('2020-01-01', now), { error: 'invalid' }); // >294 days
});

test('empty input asks for FUM instead of computing', () => {
  assert.deepEqual(compute(''), { error: 'empty' });
});

test('trimester and half-of-pregnancy boundaries', () => {
  const now = new Date('2026-01-01');
  const daysAgo = n => new Date(now.getTime() - n * 86400000).toISOString().slice(0, 10);
  assert.equal(compute(daysAgo(13 * 7 + 6), now).trimester, 1);
  assert.equal(compute(daysAgo(14 * 7), now).trimester, 2);
  assert.equal(compute(daysAgo(27 * 7 + 6), now).trimester, 2);
  assert.equal(compute(daysAgo(28 * 7), now).trimester, 3);
  assert.equal(compute(daysAgo(19 * 7 + 6), now).half, 1);
  assert.equal(compute(daysAgo(20 * 7), now).half, 2);
});
