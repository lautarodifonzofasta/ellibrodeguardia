import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createSession, markDone, skip, unmark, status, clock, note } from '../../js/assist/timeline.js';

const dir = new URL('../../content/assist/', import.meta.url);
const asma = JSON.parse(readFileSync(new URL('asma-primera-hora.json', dir), 'utf8'));
const MIN = 60000;
const T0 = Date.UTC(2026, 10, 14, 12, 0, 0);
const state = (st, id) => st.steps.find(s => s.id === id).state;

test('every protocol file is well formed: unique ids, valid "after" references, a due rule per step', () => {
  for (const file of readdirSync(dir).filter(f => f.endsWith('.json'))) {
    const p = JSON.parse(readFileSync(new URL(file, dir), 'utf8'));
    assert.equal(`${p.id}.json`, file);
    assert.ok(p.title && p.steps.length > 0, file);
    const ids = p.steps.map(s => s.id);
    assert.equal(new Set(ids).size, ids.length, `${file}: repeated step id`);
    for (const s of p.steps) {
      assert.ok(s.label, `${file}/${s.id}: label`);
      if (s.after) {
        assert.ok(ids.indexOf(s.after) > -1 && ids.indexOf(s.after) < ids.indexOf(s.id), `${file}/${s.id}: "after" must name an earlier step`);
        assert.ok(s.afterMin >= 0, `${file}/${s.id}: afterMin`);
      } else {
        assert.ok(s.atMin >= 0, `${file}/${s.id}: atMin`);
      }
      if ('skippable' in s) assert.equal(typeof s.skippable, 'boolean', `${file}/${s.id}: skippable`);
    }
  }
});

test('at the start: first-round steps are due, later rounds wait, reassessment is upcoming', () => {
  const st = status(asma, createSession(asma, T0), T0);
  assert.equal(state(st, 'o2'), 'due');
  assert.equal(state(st, 'saba1'), 'due');
  assert.equal(state(st, 'ctc'), 'due');
  assert.equal(state(st, 'saba2'), 'waiting');
  assert.equal(state(st, 'saba3'), 'waiting');
  assert.equal(state(st, 'reeval'), 'upcoming');
  assert.equal(st.complete, false);
});

test('the second round is timed from when the first was actually given', () => {
  let s = createSession(asma, T0);
  s = markDone(asma, s, 'saba1', T0 + 4 * MIN); // given late, at minute 4
  let st = status(asma, s, T0 + 10 * MIN);
  assert.equal(state(st, 'saba2'), 'upcoming');
  assert.equal(Math.round(st.steps.find(x => x.id === 'saba2').inMin), 14); // due at minute 24
  st = status(asma, s, T0 + 24 * MIN);
  assert.equal(state(st, 'saba2'), 'due');
  st = status(asma, s, T0 + 30 * MIN); // 6 min late, grace is 5
  assert.equal(state(st, 'saba2'), 'overdue');
  assert.equal(Math.round(st.steps.find(x => x.id === 'saba2').lateMin), 6);
});

test('a step with its own grace period (corticoid within the hour) is not overdue before it', () => {
  const s = createSession(asma, T0);
  assert.equal(state(status(asma, s, T0 + 59 * MIN), 'ctc'), 'due');
  assert.equal(state(status(asma, s, T0 + 61 * MIN), 'ctc'), 'overdue');
  assert.equal(state(status(asma, s, T0 + 60 * MIN), 'reeval'), 'due');
});

test('markDone ignores unknown and repeated steps; unmark undoes a tap', () => {
  let s = createSession(asma, T0);
  assert.equal(markDone(asma, s, 'nope', T0), s);
  s = markDone(asma, s, 'o2', T0 + MIN);
  assert.equal(markDone(asma, s, 'o2', T0 + 9 * MIN).done.o2, T0 + MIN);
  assert.equal(state(status(asma, s, T0 + 2 * MIN), 'o2'), 'done');
  s = unmark(s, 'o2');
  assert.equal(state(status(asma, s, T0 + 2 * MIN), 'o2'), 'due');
});

test('complete when every step is done; the session object is never mutated', () => {
  const start = createSession(asma, T0);
  let s = start;
  asma.steps.forEach((step, i) => { s = markDone(asma, s, step.id, T0 + i * MIN); });
  assert.equal(status(asma, s, T0 + 70 * MIN).complete, true);
  assert.deepEqual(start.done, {});
});

test('clock formats minutes as mm:ss and never goes negative', () => {
  assert.equal(clock(0), '00:00');
  assert.equal(clock(1.5), '01:30');
  assert.equal(clock(61), '61:00');
  assert.equal(clock(-3), '00:00');
});

test('the note lists what was done in the order it happened, then what is pending', () => {
  let s = createSession(asma, T0);
  s = markDone(asma, s, 'ctc', T0 + 12 * MIN);
  s = markDone(asma, s, 'saba1', T0 + 2 * MIN);
  const text = note(asma, s, ms => `t+${Math.round((ms - T0) / MIN)}`);
  const lines = text.split('\n');
  assert.match(lines[0], /inicio t\+0/);
  assert.match(lines[1], /^t\+2 \(min 2\): Salbutamol, 1ª ronda/);
  assert.match(lines[2], /^t\+12 \(min 12\): Corticoide sistémico/);
  assert.match(lines.at(-1), /^Pendiente: .*Reevaluar/);
});

// A small protocol of its own, so these tests don't depend on which asthma
// steps the content marks as skippable.
const skipProto = {
  id: 'skip-test',
  title: 'Prueba',
  steps: [
    { id: 'a', atMin: 0, label: 'Paso A' },
    { id: 'b', atMin: 0, skippable: true, label: 'Paso B' },
    { id: 'c', after: 'b', afterMin: 10, label: 'Paso C' },
  ],
};

test('skip works only on an existing, skippable step that is not done', () => {
  const s = createSession(skipProto, T0);
  assert.equal(skip(skipProto, s, 'a', T0 + MIN), s, 'not skippable');
  assert.equal(skip(skipProto, s, 'nope', T0 + MIN), s, 'unknown step');
  const done = markDone(skipProto, s, 'b', T0 + MIN);
  assert.equal(skip(skipProto, done, 'b', T0 + 2 * MIN), done, 'already done');
  const skipped = skip(skipProto, s, 'b', T0 + 3 * MIN);
  assert.notEqual(skipped, s);
  assert.deepEqual(s.skipped, {}, 'the session object is never mutated');
  const st = status(skipProto, skipped, T0 + 5 * MIN);
  assert.equal(state(st, 'b'), 'skipped');
  assert.equal(Math.round(st.steps.find(x => x.id === 'b').skippedAtMin), 3);
  assert.equal(state(st, 'c'), 'waiting', 'a skipped prerequisite does not start the next step');
});

test('a skipped step counts as resolved for "complete"', () => {
  let s = createSession(skipProto, T0);
  s = markDone(skipProto, s, 'a', T0 + MIN);
  s = skip(skipProto, s, 'b', T0 + 2 * MIN);
  assert.equal(status(skipProto, s, T0 + 3 * MIN).complete, false, 'c is still open');
  s = markDone(skipProto, s, 'c', T0 + 4 * MIN);
  assert.equal(status(skipProto, s, T0 + 5 * MIN).complete, true);
});

test('the note lists skipped steps as "No indicado", never as pending', () => {
  let s = createSession(skipProto, T0);
  s = markDone(skipProto, s, 'a', T0 + MIN);
  s = skip(skipProto, s, 'b', T0 + 2 * MIN);
  const lines = note(skipProto, s, ms => `t+${Math.round((ms - T0) / MIN)}`).split('\n');
  assert.ok(lines.includes('No indicado: Paso B'));
  assert.equal(lines.at(-1), 'Pendiente: Paso C');
  assert.equal(lines.filter(l => l.includes('Paso B')).length, 1);
});

test('unmark clears a skip; markDone on a skipped step clears the skip and marks it done', () => {
  const skipped = skip(skipProto, createSession(skipProto, T0), 'b', T0 + MIN);
  const cleared = unmark(skipped, 'b');
  assert.equal(state(status(skipProto, cleared, T0 + 2 * MIN), 'b'), 'due');
  assert.deepEqual(cleared.skipped, {});
  const done = markDone(skipProto, skipped, 'b', T0 + 2 * MIN);
  assert.equal(state(status(skipProto, done, T0 + 3 * MIN), 'b'), 'done');
  assert.equal(done.skipped.b, undefined);
  assert.equal(done.done.b, T0 + 2 * MIN);
});

test('asthma clock: oxygen and corticoid can be marked as not indicated, salbutamol cannot', () => {
  let s = createSession(asma, T0);
  s = skip(asma, s, 'o2', T0 + MIN);
  s = skip(asma, s, 'ctc', T0 + MIN);
  s = skip(asma, s, 'saba1', T0 + MIN);
  const st = status(asma, s, T0 + 2 * MIN);
  assert.equal(state(st, 'o2'), 'skipped');
  assert.equal(state(st, 'ctc'), 'skipped');
  assert.equal(state(st, 'saba1'), 'due');
});

test('a session stored before "skipped" existed still works', () => {
  const old = { protocolId: skipProto.id, startedAt: T0, done: { a: T0 + MIN } };
  assert.equal(state(status(skipProto, old, T0 + 2 * MIN), 'b'), 'due');
  assert.equal(unmark(old, 'b'), old);
  assert.match(note(skipProto, old, () => 'hh:mm'), /Pendiente: Paso B; Paso C$/);
  const s = skip(skipProto, old, 'b', T0 + 2 * MIN);
  assert.equal(state(status(skipProto, s, T0 + 3 * MIN), 'b'), 'skipped');
  assert.equal(state(status(skipProto, unmark(old, 'a'), T0 + 3 * MIN), 'a'), 'due');
  assert.equal(state(status(skipProto, markDone(skipProto, old, 'b', T0 + 3 * MIN), T0 + 4 * MIN), 'b'), 'done');
});
