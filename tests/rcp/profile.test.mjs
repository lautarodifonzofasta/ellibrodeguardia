import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertProfileUsable, assertSameProfile, profileLabel, ProfileError } from '../../js/rcp/profile.js';
import { createEngine } from '../../js/rcp/engine.js';
import { PROFILE, cloneProfile, unsignedProfile, T0 } from './helpers.mjs';

test('the shipped AHA profile is signed by the author; without the signature it is blocked', () => {
  assert.equal(PROFILE.validatedBy, 'Lautaro Di Fonzo (autor), 2026-09-27');
  assert.throws(() => assertProfileUsable(unsignedProfile()), /REVISAR/);
  assert.throws(() => createEngine(unsignedProfile()), ProfileError);
});

test('the AHA profile is complete and consistent', () => {
  assert.doesNotThrow(() => assertProfileUsable(PROFILE));
  assert.equal(profileLabel(PROFILE), 'AHA Adulto · 2025');
  assert.equal(PROFILE.id, 'aha-2025-adulto');
  assert.equal(PROFILE.cycle.durationSec, 120);
  assert.equal(PROFILE.cycle.preAlertSec, 15);
});

test('the transcription keeps the source file\'s algorithm (Box table 3.1)', () => {
  const b = PROFILE.algorithm.boxes;
  const exits = Object.fromEntries(Object.entries(b).map(([id, box]) => [id, box.onRhythm || box.next || box.noRosc]));
  assert.deepEqual(exits, {
    1: { shockable: '2', non_shockable: '9' }, 2: '3', 3: '4',
    4: { shockable: '5', non_shockable: '12' }, 5: '6',
    6: { shockable: '7', non_shockable: '12' }, 7: '8',
    8: { shockable: '5', non_shockable: '12' }, 9: '10',
    10: { shockable: '5', non_shockable: '11' },
    11: { shockable: '5', non_shockable: '12' }, 12: '10',
  });
  // Box 1 too: a 2-min safety net if the monitor is late (author, 2026-09-30)
  for (const id of ['1', '4', '6', '8', '10', '11']) assert.equal(b[id].timed, true);
});

test('any [REVISAR] marker, in any case, blocks the profile', () => {
  for (const marker of ['[REVISAR]', '[revisar: x]', '[ Revisar ]']) {
    const p = cloneProfile();
    p.medications[0].doses[0].amount = `1 mg ${marker}`;
    assert.throws(() => assertProfileUsable(p), /REVISAR/, marker);
  }
});

test('incomplete or inconsistent profiles are refused instead of filled in', () => {
  const cases = {
    'no cycle': p => { delete p.cycle; },
    'pre-alert ≥ cycle': p => { p.cycle.preAlertSec = 120; },
    'no validatedBy': p => { p.validatedBy = ''; },
    'no rhythm names': p => { delete p.rhythms.shockable; },
    'start not a CPR Box': p => { p.algorithm.start = '3'; },
    'unknown Box kind': p => { p.algorithm.boxes['4'].kind = 'rcp'; },
    'Box without actions': p => { p.algorithm.boxes['4'].actions = []; },
    'untimed flag missing': p => { delete p.algorithm.boxes['4'].timed; },
    'shockable exit not a shock': p => { p.algorithm.boxes['4'].onRhythm.shockable = '6'; },
    'exit to a missing Box': p => { p.algorithm.boxes['4'].onRhythm.non_shockable = '99'; },
    'shock not followed by CPR': p => { p.algorithm.boxes['3'].next = '5'; },
    'ROSC question without labels': p => { delete p.algorithm.boxes['12'].noLabel; },
    'unknown doneWhen event': p => { p.algorithm.boxes['4'].actions[1].doneWhen = ['IV_ACCESS']; },
    'no medications': p => { p.medications = []; },
    'dose without route': p => { p.medications[0].doses[0].route = ''; },
    'maxDoses omitted': p => { delete p.medications[0].maxDoses; },
    'maxDoses zero': p => { p.medications[1].maxDoses = 0; },
    'bad interval': p => { p.medications[0].intervalSec = { min: 300, max: 180 }; },
    'window texts missing': p => { delete p.medications[0].windowTexts.late; },
    'firstDose typo': p => { p.medications[0].firstDose = { afterVisting: ['6'] }; },
    'firstDose unknown Box': p => { p.medications[0].firstDose.afterVisiting = ['66']; },
    'firstDose empty': p => { p.medications[0].firstDose.afterVisiting = []; },
    'firstDose without message': p => { delete p.medications[0].message; },
    'bad perKg': p => { p.medications[2].doses[0].perKg = { min: 1.5, max: 1, unit: 'mg' }; },
    'unknown group': p => { p.medications[1].group = 'x'; },
    'group drug missing': p => { p.medicationGroups[0].drugs.push('procainamida'); },
    'group nextDose typo': p => { p.medicationGroups[0].nextDose = { atBox: ['8'], laterpass: true }; },
    'group without message': p => { delete p.medicationGroups[0].message; },
    'preferChosen without chosen texts': p => { delete p.medicationGroups[0].chosenMessages; },
    'chosen text missing for one drug': p => { delete p.medicationGroups[0].chosenMessages.lidocaina; },
    'chosen text for a foreign drug': p => { p.medicationGroups[0].chosenMessages.adrenalina = { screen: 'x', voice: 'y' }; },
    'hide rule for an unknown group': p => { p.algorithm.boxes['8'].actions[1].hideWhenGroupExhausted = 'antiarritmicos'; },
    'unknown reminder panel': p => { p.algorithm.boxes['8'].actions[2].panel = 'hts'; },
    'metronome default outside its options': p => { p.metronome.defaultBpm = 130; },
    'metronome without options': p => { p.metronome.bpmOptions = []; },
    'reserved id "otra"': p => { p.medications[0].id = 'otra'; },
    'duplicate drug': p => { p.medications[1].id = 'adrenalina'; },
    'no reversible causes': p => { p.reversibleCauses = []; },
    'no vascular routes': p => { p.vascularAccess.routes = []; },
    'no ventilation texts': p => { delete p.ventilation.withAirway; },
    'message without voice': p => { delete p.messages.postShock.voice; },
    'no pre-start text': p => { delete p.startHint; },
  };
  for (const [name, mutate] of Object.entries(cases)) {
    const p = cloneProfile();
    mutate(p);
    assert.throws(() => assertProfileUsable(p), ProfileError, name);
  }
});

test('a session never continues with a different profile or version', () => {
  const rcp = createEngine(PROFILE);
  const s = rcp.createSession({ id: 's', now: T0 });
  assert.doesNotThrow(() => assertSameProfile(s, PROFILE));
  assert.throws(() => assertSameProfile(s, { ...PROFILE, version: '2025-b' }), ProfileError);
  const other = createEngine({ ...cloneProfile(), version: '2025-b' });
  assert.throws(() => other.startCpr(s, T0), ProfileError);
});
