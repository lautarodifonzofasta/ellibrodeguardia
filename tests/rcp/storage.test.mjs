import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createEngine } from '../../js/rcp/engine.js';
import { getStatus } from '../../js/rcp/status.js';
import { serializeSession, deserializeSession, saveSession, loadSession, clearSession, storageKey } from '../../js/rcp/storage.js';
import { PROFILE, T0, sec, shockCycle, FakeStorage } from './helpers.mjs';

const rcp = createEngine(PROFILE);

function midResuscitation(mode = 'real') {
  let s = rcp.startCpr(rcp.createSession({ id: 's1', mode, now: T0 }), sec(0));
  s = shockCycle(rcp, s, 40);
  s = rcp.giveMedication(s, { drugId: 'adrenalina', name: 'Adrenalina', dose: '1 mg', route: 'IV/IO' }, sec(60));
  s = rcp.recordAirway(s, undefined, sec(70));
  s = rcp.editEvent(s, 'ev6', { at: sec(58) }, sec(80));                           // time edit
  s = rcp.editEvent(s, 'ev7', { data: { device: 'Supraglótico' } }, sec(81));     // field absent before
  return rcp.editEvent(s, 'ev4', { data: { voided: true } }, sec(82));            // void the shock
}

test('restauración de la sesión: serialize → deserialize is identical, including the edit history', () => {
  const s = midResuscitation();
  const restored = deserializeSession(serializeSession(s));
  assert.deepEqual(restored, s);
  assert.deepEqual(restored.events.find(e => e.id === 'ev7').edits[0].previous, { data: { device: null } });
  assert.deepEqual(restored.events.find(e => e.id === 'ev4').edits[0].previous, { data: { voided: false } });
  assert.deepEqual(getStatus(restored, PROFILE, sec(900)), getStatus(s, PROFILE, sec(900)), 'same status at the same instant');
  const next = rcp.beginRhythmCheck(restored, sec(166));
  assert.equal(next.state, 'RHYTHM_CHECK');
  assert.equal(next.events.at(-1).id, 'ev8', 'the machine continues where it was');
});

test('save/load round-trip, one key per mode (real and simulación never mix)', () => {
  const storage = new FakeStorage();
  const real = midResuscitation('real');
  const sim = rcp.startCpr(rcp.createSession({ id: 's2', mode: 'simulacion', now: T0 }), sec(5));
  assert.equal(saveSession(real, storage), true);
  assert.equal(saveSession(sim, storage), true);
  assert.deepEqual([...storage.map.keys()].sort(), [storageKey('real'), storageKey('simulacion')]);
  assert.deepEqual(loadSession('real', storage), real);
  assert.deepEqual(loadSession('simulacion', storage), sim);
  clearSession('real', storage);
  assert.equal(loadSession('real', storage), null);
  assert.deepEqual(loadSession('simulacion', storage), sim);
});

test('unreadable sessions are moved aside without overwriting earlier copies', () => {
  const storage = new FakeStorage();
  storage.setItem(storageKey('real'), '{"broken 1');
  assert.equal(loadSession('real', storage), null);
  storage.setItem(storageKey('real'), '{"broken 2');
  assert.equal(loadSession('real', storage), null);
  assert.equal(storage.getItem(storageKey('real')), null);
  assert.equal(storage.getItem(`${storageKey('real')}-corrupta`), '{"broken 1');
  assert.equal(storage.getItem(`${storageKey('real')}-corrupta-2`), '{"broken 2');
});

test('sessions that would break the screen are rejected on load', () => {
  const good = midResuscitation();
  const variants = {
    'old schema': s => { s.schemaVersion = 1; },
    'no profile name': s => { delete s.profile.name; },
    'duplicate id': s => { s.events[2].id = s.events[1].id; },
    'seq out of order': s => { s.events[2].seq = 1; },
    'nextSeq behind': s => { s.nextSeq = 3; },
    'unknown event type': s => { s.events[1].type = 'NOPE'; },
    'drug without name': s => { delete s.events.find(e => e.type === 'MEDICATION_GIVEN').data.name; },
    'bad rhythm': s => { s.events.find(e => e.type === 'RHYTHM_CHECK').data.rhythm = 'fv'; },
    'event without Box': s => { delete s.events[0].box; },
  };
  for (const [name, mutate] of Object.entries(variants)) {
    const s = structuredClone(good);
    mutate(s);
    assert.throws(() => deserializeSession(JSON.stringify(s)), TypeError, name);
  }
});

test('storage failures never throw (private mode, full quota, no storage)', () => {
  const broken = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('quota'); }, removeItem() { throw new Error('denied'); } };
  const s = midResuscitation();
  assert.equal(saveSession(s, broken), false);
  assert.equal(loadSession('real', broken), null);
  assert.doesNotThrow(() => clearSession('real', broken));
  assert.equal(saveSession(s, null), false);
  assert.equal(loadSession('real', null), null);
});
