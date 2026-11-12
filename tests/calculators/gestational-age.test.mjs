import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compute } from '../../js/calculators/gestational-age.js';

// "now" is built with the local-time constructor on purpose: compute() takes
// today's date from the local calendar, so these tests give the same result in
// any time zone (new Date('2026-06-15') would be June 14 in Argentina).
const pad = n => String(n).padStart(2, '0');
const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const daysBefore = (now, n) => ymd(new Date(now.getFullYear(), now.getMonth(), now.getDate() - n));

test('computes weeks/days from FUM, same as legacy calcEG()', () => {
  const now = new Date(2026, 5, 15, 12);
  const fum = '2026-01-01'; // 165 days before "now"
  const r = compute(fum, now);
  assert.equal(r.weeks, 23);
  assert.equal(r.days, 4);
  assert.equal(r.trimester, '2do trimestre');
  assert.equal(r.half, '→ Segunda mitad del embarazo');
});

test('rejects a future FUM and one further back than a full-term pregnancy', () => {
  const now = new Date(2026, 5, 15, 12);
  assert.deepEqual(compute('2026-07-01', now), { error: 'Fecha inválida' }); // future
  assert.deepEqual(compute('2020-01-01', now), { error: 'Fecha inválida' }); // >294 days
});

test('empty input asks for FUM instead of computing', () => {
  assert.deepEqual(compute(''), { error: 'Ingresá la FUM' });
});

test('trimester and half-of-pregnancy boundaries', () => {
  const now = new Date(2026, 0, 1, 12);
  const daysAgo = n => daysBefore(now, n);
  assert.equal(compute(daysAgo(13 * 7 + 6), now).trimester, '1er trimestre');
  assert.equal(compute(daysAgo(14 * 7), now).trimester, '2do trimestre');
  assert.equal(compute(daysAgo(27 * 7 + 6), now).trimester, '2do trimestre');
  assert.equal(compute(daysAgo(28 * 7), now).trimester, '3er trimestre');
  assert.equal(compute(daysAgo(19 * 7 + 6), now).half, '→ Primera mitad del embarazo');
  assert.equal(compute(daysAgo(20 * 7), now).half, '→ Segunda mitad del embarazo');
});

// Regression: the FUM used to be parsed as UTC midnight and compared with the
// local clock, so west of Greenwich the result gained a day late in the evening.
test('the result does not change with the time of day', () => {
  const fum = '2026-09-01'; // 70 days before 2026-11-10
  for (const hour of [0, 10, 20, 21, 22, 23]) {
    const r = compute(fum, new Date(2026, 10, 10, hour, 30));
    assert.deepEqual([r.weeks, r.days], [10, 0], `hour ${hour}`);
  }
});
