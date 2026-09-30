import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createEngine } from '../../js/rcp/engine.js';
import { getStatus } from '../../js/rcp/status.js';
import { cuesFor } from '../../js/rcp/cues.js';
import { loadSettings, saveSettings } from '../../js/rcp/settings.js';
import { PROFILE, T0, sec, check, shockCycle, FakeStorage } from './helpers.mjs';

const rcp = createEngine(PROFILE);
const started = () => rcp.startCpr(rcp.createSession({ id: 's1', now: T0 }), sec(0));
const st = (s, t) => getStatus(s, PROFILE, sec(t));

test('each cue is announced once, never in a loop', () => {
  const announced = new Set();
  const s = started();
  const first = cuesFor(st(s, 1), announced);
  assert.deepEqual(first.map(c => c.voice), ['Iniciar compresiones. Conectar el monitor.']);
  // repainted 4 times a second for 5 min: the pre-alert and the alert once each
  const later = [];
  for (let t = 1.25; t < 300; t += 0.25) later.push(...cuesFor(st(s, t), announced).map(c => `${t}s ${c.voice}`));
  assert.deepEqual(later, ['105s Prepararse para evaluar ritmo.', '120s Detener compresiones. Evaluar ritmo.']);
});

test('end of cycle: pre-alert (1 beep) then alert (3 beeps + vibration), once per cycle', () => {
  const announced = new Set();
  let s = shockCycle(rcp, started(), 40);                       // cycle 2 from 46 s
  cuesFor(st(s, 50), announced);
  const pre = cuesFor(st(s, 46 + 106), announced);
  assert.deepEqual(pre.map(c => [c.voice, c.beep, c.vibrate]), [['Prepararse para evaluar ritmo.', 1, [200]]]);
  const due = cuesFor(st(s, 46 + 120), announced);
  assert.deepEqual(due.map(c => [c.voice, c.beep]), [['Detener compresiones. Evaluar ritmo.', 3]]);
  assert.deepEqual(due[0].vibrate, [300, 150, 300, 150, 300]);
  assert.deepEqual(cuesFor(st(s, 46 + 180), announced), [], 'overdue: no repeat');
  // the next cycle gets its own cues
  s = shockCycle(rcp, s, 46 + 181);                             // cycle 3 from 233 s
  cuesFor(st(s, 234), announced);
  assert.equal(cuesFor(st(s, 233 + 106), announced).length, 1);
});

test('an early rhythm check that is cancelled does not mute the 2:00 alert', () => {
  const announced = new Set();
  let s = shockCycle(rcp, started(), 40);                       // cycle 2 from 46 s
  cuesFor(st(s, 50), announced);
  s = rcp.beginRhythmCheck(s, sec(46 + 60));
  assert.deepEqual(cuesFor(st(s, 46 + 61), announced).map(c => [c.voice, c.beep]), [['Detener compresiones. Evaluar ritmo.', 0]]);
  s = rcp.cancelRhythmCheck(s, sec(46 + 64));
  assert.deepEqual(cuesFor(st(s, 46 + 65), announced), [], 'back to compressions: nothing new');
  // a cancelled check doesn't pause the cycle clock: same 1:45 and 2:00
  assert.deepEqual(cuesFor(st(s, 46 + 104.75), announced), []);
  assert.deepEqual(cuesFor(st(s, 46 + 105), announced).map(c => [c.voice, c.beep]), [['Prepararse para evaluar ritmo.', 1]]);
  assert.deepEqual(cuesFor(st(s, 46 + 119.75), announced), []);
  const due = cuesFor(st(s, 46 + 120), announced);
  assert.deepEqual(due.map(c => [c.voice, c.beep]), [['Detener compresiones. Evaluar ritmo.', 3]]);
});

test('after the 2:00 alert, tapping "Evaluar ritmo" does not repeat the voice', () => {
  const announced = new Set();
  let s = started();
  for (let t = 1; t <= 125; t += 0.25) cuesFor(st(s, t), announced);   // start, pre-alert, alert
  s = rcp.beginRhythmCheck(s, sec(126));
  assert.deepEqual(cuesFor(st(s, 126.25), announced), []);
  s = rcp.selectRhythm(s, 'shockable', sec(128));
  assert.deepEqual(cuesFor(st(s, 128.25), announced).map(c => c.voice), ['Ritmo desfibrilable. Preparar descarga.']);
});

test('transition voices come from the profile; a user-started rhythm check is voice only', () => {
  const announced = new Set();
  let s = started();
  cuesFor(st(s, 1), announced);
  s = rcp.beginRhythmCheck(s, sec(30));                         // before any alert
  const c = cuesFor(st(s, 31), announced);
  assert.deepEqual(c.map(x => [x.voice, x.beep, x.vibrate]), [['Detener compresiones. Evaluar ritmo.', 0, null]]);
  s = rcp.selectRhythm(s, 'shockable', sec(32));
  assert.deepEqual(cuesFor(st(s, 33), announced).map(x => x.voice), ['Ritmo desfibrilable. Preparar descarga.']);
  s = rcp.confirmShock(s, sec(34));
  assert.deepEqual(cuesFor(st(s, 35), announced).map(x => x.voice), ['Reiniciar compresiones.']);
});

test('a drug indication is announced once per dose; a snapshot after a long gap only gives the current moment', () => {
  const announced = new Set();
  let s = check(rcp, started(), 'non_shockable', 40);           // Box 9: adrenalina lo antes posible
  const c = cuesFor(st(s, 43), announced);
  assert.deepEqual(c.map(x => x.voice), ['Ritmo no desfibrilable. Reiniciar compresiones.', 'Corresponde adrenalina.']);
  s = rcp.giveMedication(rcp.resumeCpr(s, sec(45)), { drugId: 'adrenalina', name: 'Adrenalina', dose: '1 mg', route: 'IV/IO' }, sec(50));
  cuesFor(st(s, 60), announced);
  // screen locked for 10 min: on return, only what applies now (alert due + window late)
  const back = cuesFor(st(s, 650), announced);
  assert.deepEqual(back.map(x => x.voice), ['Detener compresiones. Evaluar ritmo.', 'Corresponde adrenalina.']);
});

test('ajustes: defaults, saved values, invalid metronome rate ignored, storage failures tolerated', () => {
  const storage = new FakeStorage();
  assert.deepEqual(loadSettings(PROFILE, storage), { audio: true, vibration: true, metronome: false, metronomeBpm: 110 });
  assert.equal(saveSettings({ audio: false, vibration: true, metronome: true, metronomeBpm: 120 }, storage), true);
  assert.deepEqual(loadSettings(PROFILE, storage), { audio: false, vibration: true, metronome: true, metronomeBpm: 120 });
  storage.setItem('elg-rcp-settings', JSON.stringify({ metronomeBpm: 999, audio: 'yes' }));
  assert.deepEqual(loadSettings(PROFILE, storage), { audio: true, vibration: true, metronome: false, metronomeBpm: 110 });
  storage.setItem('elg-rcp-settings', '{broken');
  assert.equal(loadSettings(PROFILE, storage).audio, true);
  const broken = { getItem() { throw new Error('x'); }, setItem() { throw new Error('x'); } };
  assert.equal(loadSettings(PROFILE, broken).vibration, true);
  assert.equal(saveSettings({}, broken), false);
});
