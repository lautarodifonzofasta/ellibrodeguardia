import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createEngine, isActive, TransitionError, STATES } from '../../js/rcp/engine.js';
import { PROFILE, T0, sec, check, shockCycle, nonShockCycle } from './helpers.mjs';

const rcp = createEngine(PROFILE);
const fresh = () => rcp.createSession({ id: 's1', now: T0 });
const started = () => rcp.startCpr(fresh(), sec(0));
const types = s => s.events.map(e => e.type);
const ADRENALINA = { drugId: 'adrenalina', name: 'Adrenalina', dose: '1 mg', route: 'IV/IO' };

test('inicio: IDLE with no events; startCpr logs CPR_STARTED at Box 1, cycle 1', () => {
  const s0 = fresh();
  assert.equal(s0.state, STATES.IDLE);
  assert.equal(s0.cycle, 0);
  assert.equal(s0.box, null);
  assert.deepEqual(s0.events, []);
  assert.equal(s0.mode, 'real');
  assert.deepEqual(s0.profile, { id: 'aha-2025-adulto', version: '2025', name: 'AHA Adulto' });

  const s1 = rcp.startCpr(s0, sec(0));
  assert.equal(s1.state, STATES.CPR_ACTIVE);
  assert.equal(s1.cycle, 1);
  assert.equal(s1.box, '1');
  assert.deepEqual(types(s1), ['CPR_STARTED']);
  assert.deepEqual([s1.events[0].at, s1.events[0].recordedAt, s1.events[0].cycle, s1.events[0].box], [sec(0), sec(0), 1, '1']);
  assert.equal(s0.state, STATES.IDLE, 'pure: the input session is untouched');
});

test('createSession rejects a bad mode or id; actions require a numeric now', () => {
  assert.throws(() => rcp.createSession({ id: 's', mode: 'demo', now: T0 }), TypeError);
  assert.throws(() => rcp.createSession({ id: ' ', now: T0 }), TypeError);
  assert.equal(rcp.createSession({ id: 's', mode: 'simulacion', now: T0 }).mode, 'simulacion');
  assert.throws(() => rcp.startCpr(fresh(), undefined), TypeError);
  assert.throws(() => rcp.startCpr(fresh(), NaN), TypeError);
});

test('evaluación de ritmo: the pause starts at "Evaluar ritmo"; RHYTHM_CHECK logs rhythm, time, cycle and Box', () => {
  let s = rcp.beginRhythmCheck(started(), sec(40));
  assert.equal(s.state, STATES.RHYTHM_CHECK);
  assert.equal(s.events.at(-1).type, 'CPR_PAUSED');
  s = rcp.selectRhythm(s, 'shockable', sec(42));
  const ev = s.events.at(-1);
  assert.equal(ev.type, 'RHYTHM_CHECK');
  assert.deepEqual(ev.data, { rhythm: 'shockable', fromBox: '1', via: '2' });
  assert.deepEqual([ev.at, ev.cycle], [sec(42), 1]);
  assert.throws(() => rcp.selectRhythm(rcp.beginRhythmCheck(started(), sec(1)), 'fv', sec(2)), TypeError);
});

test('rama desfibrilable: Box 1 → FV/TV (Box 2) → Descarga (Box 3) → RCP (Box 4), new cycle only after the shock', () => {
  let s = check(rcp, started(), 'shockable', 40);
  assert.deepEqual([s.state, s.box], [STATES.SHOCKABLE, '3']);
  s = rcp.confirmShock(s, sec(44));
  assert.deepEqual([s.state, s.box, s.cycle], [STATES.POST_SHOCK, '3', 1]);
  assert.equal(s.events.at(-1).type, 'SHOCK_DELIVERED');
  assert.throws(() => rcp.confirmShock(s, sec(45)), TransitionError, 'a double tap cannot log a second shock');
  s = rcp.resumeCpr(s, sec(46));
  assert.deepEqual([s.state, s.box, s.cycle], [STATES.CPR_ACTIVE, '4', 2]);
  assert.deepEqual(s.events.at(-1).data, { newCycle: true, fromBox: '3' });
});

test('descarga y reinicio: the shockable branch walks 4 → 5-6 → 7-8 → 5-6 (Box 8 exit as confirmed by the author)', () => {
  let s = shockCycle(rcp, started(), 40);                   // Box 3 → 4
  const boxes = [s.box];
  for (let i = 0; i < 4; i++) {
    s = check(rcp, s, 'shockable', 200 + i * 130);
    boxes.push(s.box);                                       // shock Box
    s = rcp.resumeCpr(rcp.confirmShock(s, sec(204 + i * 130)), sec(206 + i * 130));
    boxes.push(s.box);                                       // CPR Box
  }
  assert.deepEqual(boxes, ['4', '5', '6', '7', '8', '5', '6', '7', '8']);
  assert.equal(types(s).filter(t => t === 'SHOCK_DELIVERED').length, 5);
  assert.equal(s.cycle, 6);
});

test('no shock is logged unless confirmed: resuming from SHOCKABLE returns to the Box where the rhythm was checked', () => {
  let s = shockCycle(rcp, started(), 40);                    // Box 4
  s = check(rcp, s, 'shockable', 170);                       // Box 5 (shock)
  s = rcp.resumeCpr(s, sec(180));
  assert.deepEqual([s.state, s.box, s.cycle], [STATES.CPR_ACTIVE, '4', 3]);
  assert.deepEqual(s.events.at(-1).data, { newCycle: true, fromBox: '5', withoutShock: true });
  assert.equal(types(s).filter(t => t === 'SHOCK_DELIVERED').length, 1);
});

test('rama no desfibrilable: Box 1 → Asistolia/AESP (Box 9) → RCP (Box 10) → ND → Box 11', () => {
  let s = check(rcp, started(), 'non_shockable', 40);
  assert.deepEqual([s.state, s.box], [STATES.NON_SHOCKABLE, '9']);
  assert.throws(() => rcp.confirmShock(s, sec(43)), TransitionError);
  s = rcp.resumeCpr(s, sec(45));
  assert.deepEqual([s.state, s.box, s.cycle], [STATES.CPR_ACTIVE, '10', 2]);
  s = check(rcp, s, 'non_shockable', 170);
  assert.deepEqual([s.state, s.box], [STATES.NON_SHOCKABLE, '11']);
  s = rcp.resumeCpr(s, sec(175));
  assert.deepEqual([s.state, s.box, s.cycle], [STATES.CPR_ACTIVE, '11', 3]);
});

test('Box 12: "¿Signos de ROSC?" — "No" goes to Box 10 and is recorded; "Sí" is confirmRosc', () => {
  let s = shockCycle(rcp, started(), 40);                    // Box 4
  s = check(rcp, s, 'non_shockable', 170);
  assert.deepEqual([s.state, s.box], [STATES.NON_SHOCKABLE, '12']);
  const no = rcp.resumeCpr(s, sec(180));
  assert.deepEqual([no.state, no.box], [STATES.CPR_ACTIVE, '10']);
  assert.deepEqual(no.events.at(-1).data, { newCycle: true, fromBox: '12', roscSigns: false });
  assert.equal(rcp.confirmRosc(s, sec(180)).state, STATES.ROSC);
  // Box 11 → ND also reaches Box 12; Box 10 → D reaches Box 5
  let t = nonShockCycle(rcp, nonShockCycle(rcp, started(), 40), 170); // Box 10 → 11
  assert.equal(check(rcp, t, 'non_shockable', 300).box, '12');
  assert.equal(check(rcp, nonShockCycle(rcp, started(), 40), 'shockable', 170).box, '5');
});

test('cancelling a rhythm check resumes the same cycle and Box', () => {
  const s = rcp.cancelRhythmCheck(rcp.beginRhythmCheck(shockCycle(rcp, started(), 40), sec(100)), sec(103));
  assert.deepEqual([s.state, s.cycle, s.box], [STATES.CPR_ACTIVE, 2, '4']);
  assert.deepEqual(s.events.at(-1).data, { newCycle: false });
});

test('varios ciclos: cycle numbers advance only on confirmed resumes; passes are counted per Box', () => {
  let s = started();
  s = shockCycle(rcp, s, 40);                                // 3 → 4
  s = shockCycle(rcp, s, 170);                               // 5 → 6
  s = nonShockCycle(rcp, s, 300);                            // Box 6 → 12 → No → 10
  assert.equal(s.cycle, 4);
  assert.equal(s.box, '10');
  assert.deepEqual(s.boxPasses, { 1: 1, 3: 1, 4: 1, 5: 1, 6: 1, 12: 1, 10: 1 });
  assert.equal(s.events.at(-1).boxPass, 1);
  s = shockCycle(rcp, s, 430);                               // 10 → 5 → 6: second pass through 5 and 6
  assert.deepEqual([s.box, s.boxPasses['5'], s.boxPasses['6'], s.events.at(-1).boxPass], ['6', 2, 2, 2]);
});

test('resuming without a shock returns to the same pass of the Box (the algorithm does not advance)', () => {
  let s = shockCycle(rcp, shockCycle(rcp, shockCycle(rcp, started(), 40), 170), 300); // Box 8, pass 1
  const before = s.boxPasses;
  s = rcp.resumeCpr(check(rcp, s, 'shockable', 430), sec(440)); // → Box 5 → no shock → back to 8
  assert.deepEqual([s.box, s.boxPasses['8'], s.boxPasses['5']], ['8', before['8'], 2], 'Box 5 did get its 2nd pass; Box 8 did not');
  assert.equal(s.events.at(-1).boxPass, 1);
});

test('invalid transitions throw TransitionError', () => {
  const idle = fresh();
  for (const f of [s => rcp.beginRhythmCheck(s, sec(1)), s => rcp.giveMedication(s, ADRENALINA, sec(1)), s => rcp.confirmRosc(s, sec(1))]) {
    assert.throws(() => f(idle), TransitionError);
  }
  const s = started();
  assert.throws(() => rcp.startCpr(s, sec(1)), TransitionError);
  assert.throws(() => rcp.confirmShock(s, sec(1)), TransitionError);
  assert.throws(() => rcp.selectRhythm(s, 'shockable', sec(1)), TransitionError);
  assert.throws(() => rcp.resumeCpr(s, sec(1)), TransitionError);
  assert.throws(() => rcp.cancelRhythmCheck(s, sec(1)), TransitionError);
});

test('drogas: MEDICATION_GIVEN stores exactly what was confirmed, in any active state', () => {
  let s = rcp.giveMedication(started(), ADRENALINA, sec(30));
  assert.deepEqual(s.events.at(-1).data, ADRENALINA);
  s = rcp.beginRhythmCheck(s, sec(40));
  s = rcp.giveMedication(s, { drugId: 'otra', name: '  Bicarbonato   de sodio ', dose: '50 mEq', route: 'IV' }, sec(41));
  assert.equal(s.events.at(-1).data.name, 'Bicarbonato de sodio');
  assert.equal(s.state, STATES.RHYTHM_CHECK, 'giving a drug never changes the state');
  assert.throws(() => rcp.giveMedication(started(), { ...ADRENALINA, dose: '' }, sec(1)), TypeError);
  assert.throws(() => rcp.giveMedication(started(), { drugId: 'adrenalina' }, sec(1)), TypeError);
});

test('optional events: IV/IO access, airway, capnography, EtCO₂, reversible cause, other', () => {
  let s = started();
  s = rcp.recordVascularAccess(s, 'IO', sec(10));
  s = rcp.recordAirway(s, { device: 'Supraglótico' }, sec(11));
  s = rcp.recordCapnography(s, sec(12));
  s = rcp.recordEtco2(s, 18, sec(13));
  s = rcp.recordReversibleCause(s, 'neumotorax', sec(14));
  s = rcp.recordOther(s, '  Familia avisada ', sec(15));
  assert.deepEqual(types(s).slice(1), ['VASCULAR_ACCESS', 'AIRWAY_PLACED', 'CAPNOGRAPHY_STARTED', 'ETCO2_VALUE', 'REVERSIBLE_CAUSE_IDENTIFIED', 'OTHER']);
  assert.deepEqual(s.events.slice(1).map(e => e.data), [
    { route: 'IO' }, { device: 'Supraglótico' }, {}, { value: 18, unit: 'mmHg' },
    { causeId: 'neumotorax', label: 'Neumotórax a tensión' }, { text: 'Familia avisada' },
  ]);
  assert.equal(s.state, STATES.CPR_ACTIVE);
  assert.throws(() => rcp.recordVascularAccess(s, 'central', sec(16)), TypeError);
  assert.throws(() => rcp.recordReversibleCause(s, 'hipoglucemia', sec(16)), TypeError, 'only the profile\'s causes');
  assert.throws(() => rcp.recordEtco2(s, -1, sec(16)), TypeError);
  assert.throws(() => rcp.recordOther(s, '   ', sec(16)), TypeError);
  assert.throws(() => rcp.recordOther(s, 'x'.repeat(201), sec(16)), TypeError);
});

test('ROSC: available from every active state, closes the session', () => {
  const paths = [
    started(),
    rcp.beginRhythmCheck(started(), sec(40)),
    check(rcp, started(), 'shockable', 40),
    rcp.confirmShock(check(rcp, started(), 'shockable', 40), sec(44)),
    check(rcp, started(), 'non_shockable', 40),
  ];
  for (const s of paths) {
    assert.equal(isActive(s), true);
    const r = rcp.confirmRosc(s, sec(200));
    assert.equal(r.state, STATES.ROSC);
    assert.equal(r.events.at(-1).type, 'ROSC_CONFIRMED');
    assert.equal(isActive(r), false);
    assert.throws(() => rcp.giveMedication(r, ADRENALINA, sec(201)), TransitionError);
    assert.throws(() => rcp.stopCpr(r, 'otro', sec(201)), TransitionError);
  }
});

test('finalización con motivo: CPR_STOPPED with a known reason (+ optional detail) ends the session', () => {
  const s = rcp.stopCpr(started(), 'derivacion', sec(300), '  Hospital   X ');
  assert.equal(s.state, STATES.ENDED);
  assert.deepEqual(s.events.at(-1).data, { reason: 'derivacion', detail: 'Hospital X' });
  assert.deepEqual(rcp.stopCpr(started(), 'fallecimiento', sec(300)).events.at(-1).data, { reason: 'fallecimiento' });
  assert.throws(() => rcp.stopCpr(started(), 'cansancio', sec(300)), TypeError);
  assert.throws(() => rcp.resumeCpr(s, sec(301)), TransitionError);
});

test('edición de evento con historial: time and data corrections are kept, never silent', () => {
  let s = rcp.giveMedication(started(), ADRENALINA, sec(40));
  const id = s.events.at(-1).id;
  s = rcp.editEvent(s, id, { at: sec(35) }, sec(100));
  let ev = s.events.find(e => e.id === id);
  assert.equal(ev.at, sec(35));
  assert.equal(ev.recordedAt, sec(40), 'recordedAt never changes');
  assert.equal(ev.edited, true);
  assert.deepEqual(ev.edits, [{ editedAt: sec(100), previous: { at: sec(40) } }]);

  s = rcp.editEvent(s, id, { data: { dose: '2 mg', route: 'IV/IO' } }, sec(110));
  ev = s.events.find(e => e.id === id);
  assert.equal(ev.data.dose, '2 mg');
  assert.deepEqual(ev.edits[1], { editedAt: sec(110), previous: { data: { dose: '1 mg' } } }, 'only changed fields');

  assert.equal(rcp.editEvent(s, id, { at: sec(35), data: { route: 'IV/IO' } }, sec(120)), s, 'a no-op adds no history');
  assert.equal(rcp.editEvent(s, id, { data: { voided: false } }, sec(120)), s, 'un-voiding a live event is a no-op');
  assert.throws(() => rcp.editEvent(s, id, { at: sec(500) }, sec(120)), RangeError, 'no future times');
  assert.throws(() => rcp.editEvent(s, id, { data: { type: 'OTHER' } }, sec(120)), TypeError);
  assert.throws(() => rcp.editEvent(s, id, { data: { dose: '' } }, sec(120)), TypeError);
  assert.throws(() => rcp.editEvent(s, 'ev999', { at: sec(1) }, sec(120)), RangeError);
  for (const bad of [undefined, null, 'x', [], { data: null }, { data: 'dose' }]) {
    assert.throws(() => rcp.editEvent(s, id, bad, sec(120)), TypeError, JSON.stringify(bad));
  }
  assert.throws(() => rcp.editEvent(s, 'ev1', { data: { foo: 1 } }, sec(120)), TypeError, 'CPR_STARTED: only its time');
  assert.equal(rcp.editEvent(s, 'ev1', { at: sec(-60) }, sec(120)).events[0].at, sec(-60));
});

test('a field absent before an edit is recorded as null (or false for voided), so the history survives JSON', () => {
  let s = rcp.recordAirway(started(), undefined, sec(10));
  s = rcp.editEvent(s, 'ev2', { data: { device: 'Tubo endotraqueal' } }, sec(20));
  assert.deepEqual(s.events[1].edits[0].previous, { data: { device: null } });
  s = rcp.editEvent(s, 'ev2', { data: { voided: true } }, sec(30));
  assert.deepEqual(s.events[1].edits[1].previous, { data: { voided: false } });
  assert.deepEqual(JSON.parse(JSON.stringify(s)), s);
});

test('edits work after the session has ended, and never change its state, cycle or Box', () => {
  let s = rcp.confirmRosc(shockCycle(rcp, started(), 40), sec(200));
  const shockId = s.events.find(e => e.type === 'SHOCK_DELIVERED').id;
  const edited = rcp.editEvent(s, shockId, { data: { voided: true } }, sec(300));
  assert.deepEqual([edited.state, edited.cycle, edited.box], [STATES.ROSC, 2, '4']);
  assert.equal(edited.events.find(e => e.id === shockId).data.voided, true);
});
