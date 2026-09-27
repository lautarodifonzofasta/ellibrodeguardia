import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createEngine } from '../../js/rcp/engine.js';
import { getStatus, summarize, chronology, pauseStats } from '../../js/rcp/status.js';
import { ProfileError } from '../../js/rcp/profile.js';
import { PROFILE, cloneProfile, unsignedProfile, T0, sec, check, shockCycle, nonShockCycle } from './helpers.mjs';

const rcp = createEngine(PROFILE);
const started = () => rcp.startCpr(rcp.createSession({ id: 's1', now: T0 }), sec(0));
const st = (s, t) => getStatus(s, PROFILE, sec(t));
const med = (status, id) => status.medications.inProfile.find(m => m.drugId === id);
const ind = (status, id) => status.indications.find(i => i.drugId === id || i.groupId === id) || null;
const give = (s, drugId, dose, t) => {
  const def = PROFILE.medications.find(m => m.drugId === drugId || m.id === drugId);
  return rcp.giveMedication(s, { drugId, name: def.name, dose, route: 'IV/IO' }, sec(t));
};

test('Box 1: no 2-minute countdown (first rhythm check as soon as the monitor is connected)', () => {
  const status = st(started(), 300);
  assert.equal(status.alert, null);
  assert.equal(status.nextEvent, null);
  assert.equal(status.cycle.durationMs, null);
  assert.deepEqual(status.prompt, { key: 'start', screen: 'INICIAR COMPRESIONES · Conectar monitor/desfibrilador', voice: 'Iniciar compresiones. Conectar el monitor.' });
  assert.deepEqual(status.algorithm.actions, ['Iniciar RCP', 'Ventilación con bolsa-máscara y O₂', 'Conectar monitor/desfibrilador']);
  assert.equal(status.algorithm.note, 'Primer control de ritmo: apenas está conectado el monitor/desfibrilador; no espera 2 min');
  // the first cycle stays untimed after leaving Box 1 for the shock
  const shock = st(check(rcp, started(), 'shockable', 40), 43);
  assert.deepEqual([shock.cycle.number, shock.cycle.durationMs, shock.cycle.elapsedMs], [1, null, 40000]);
});

test('reminders show while a Box is worked, not after its shock or once CPR has ended', () => {
  let s = check(rcp, started(), 'shockable', 40);
  assert.deepEqual(st(s, 43).algorithm.actions, ['FV / TV sin pulso', 'Descarga'], 'Box 2 is shown on the way to Box 3');
  assert.deepEqual(st(check(rcp, shockCycle(rcp, started(), 40), 'shockable', 170), 173).algorithm.actions, ['Descarga'], 'Box 4 → Box 5 directly');
  s = rcp.confirmShock(s, sec(44));
  assert.deepEqual(st(s, 45).algorithm.actions, []);
  s = rcp.resumeCpr(s, sec(46));
  assert.deepEqual(st(s, 47).algorithm.actions, ['RCP 2 min', 'Acceso IV/IO']);
  assert.deepEqual(st(rcp.confirmRosc(s, sec(50)), 51).algorithm.actions, []);
  assert.deepEqual(st(rcp.stopCpr(s, 'derivacion', sec(50)), 51).algorithm.actions, []);
});

test('fin de ciclo y aviso: in a timed Box, pre-alert 15 s before 2 min, then "evaluar ritmo", then overdue', () => {
  const s = shockCycle(rcp, started(), 40);                  // Box 4, cycle starts at 46
  assert.equal(st(s, 46 + 104).alert, null);
  assert.deepEqual(st(s, 46 + 104).nextEvent, { kind: 'check_rhythm', inMs: 16000 });
  assert.deepEqual(st(s, 46 + 105).alert, { kind: 'pre_alert', inMs: 15000 });
  assert.equal(st(s, 46 + 105).prompt.screen, 'PREPARARSE PARA EVALUAR RITMO');
  assert.deepEqual(st(s, 46 + 120).alert, { kind: 'check_rhythm', overdueMs: 0 });
  assert.deepEqual(st(s, 46 + 120).prompt, { key: 'checkRhythm', screen: 'DETENER COMPRESIONES · EVALUAR RITMO · Cambiar compresor', voice: 'Detener compresiones. Evaluar ritmo.' });
  assert.equal(st(s, 46 + 150).cycle.overdueMs, 30000);
  assert.equal(st(s, 46 + 150).cycle.number, 2, 'the cycle never advances on its own');
});

test('prompts follow the profile\'s texts at every step', () => {
  let s = check(rcp, started(), 'shockable', 40);
  assert.equal(st(s, 43).prompt.screen, '⚡ RITMO DESFIBRILABLE · PREPARAR DESCARGA');
  s = rcp.confirmShock(s, sec(44));
  assert.deepEqual(st(s, 45).prompt, { key: 'postShock', screen: 'REINICIAR COMPRESIONES', voice: 'Reiniciar compresiones.' });
  s = check(rcp, rcp.resumeCpr(s, sec(46)), 'non_shockable', 170); // Box 4 → 12
  assert.deepEqual(st(s, 173).prompt, { key: 'roscCheck', screen: '¿SIGNOS DE ROSC?', voice: 'Evaluar signos de circulación espontánea.' });
  assert.deepEqual([st(s, 173).algorithm.yesLabel, st(s, 173).algorithm.noLabel], ['Sí → Confirmar ROSC', 'No → Box 10']);
  const nd = check(rcp, started(), 'non_shockable', 40);        // Box 9
  assert.equal(st(nd, 43).prompt.screen, '🔵 RITMO NO DESFIBRILABLE · CONTINUAR RCP');
  assert.equal(st(nd, 43).prompt.voice, 'Ritmo no desfibrilable. Reiniciar compresiones.');
  assert.deepEqual(st(rcp.confirmRosc(s, sec(180)), 181).prompt, { key: 'roscConfirmed', screen: '✅ ROSC', voice: 'Retorno de circulación espontánea confirmado.' });
});

test('Box reminders: "Acceso IV/IO" and "vía aérea y capnografía" disappear once registered', () => {
  let s = nonShockCycle(rcp, started(), 40);                 // Box 10
  assert.deepEqual(st(s, 50).algorithm.actions, ['RCP 2 min', 'Acceso IV/IO', 'Adrenalina cada 3–5 min', 'Considerar vía aérea avanzada y capnografía']);
  s = rcp.recordVascularAccess(s, 'IV', sec(60));
  s = rcp.recordAirway(s, undefined, sec(70));
  assert.deepEqual(st(s, 71).algorithm.actions, ['RCP 2 min', 'Adrenalina cada 3–5 min', 'Considerar vía aérea avanzada y capnografía'], 'airway alone is not enough');
  s = rcp.recordCapnography(s, sec(80));
  assert.deepEqual(st(s, 81).algorithm.actions, ['RCP 2 min', 'Adrenalina cada 3–5 min']);
  // a voided registration brings the reminder back
  s = rcp.editEvent(s, s.events.find(e => e.type === 'VASCULAR_ACCESS').id, { data: { voided: true } }, sec(90));
  assert.ok(st(s, 91).algorithm.actions.includes('Acceso IV/IO'));
});

test('ventilación: 30:2 until an advanced airway is registered, then 1 every 6 s', () => {
  let s = started();
  assert.deepEqual(st(s, 5).ventilation, { advancedAirway: false, text: '30:2' });
  s = rcp.recordAirway(s, { device: 'Tubo endotraqueal' }, sec(10));
  assert.deepEqual(st(s, 11).ventilation, { advancedAirway: true, text: 'Compresiones continuas con 1 ventilación cada 6 s (10/min)' });
});

test('adrenalina, rama desfibrilable: not indicated before Box 6; indicated from Box 6 on', () => {
  let s = shockCycle(rcp, started(), 40);                    // Box 4
  assert.equal(ind(st(s, 50), 'adrenalina'), null);
  s = check(rcp, s, 'shockable', 170);                       // Box 5 (shock)
  assert.equal(ind(st(s, 173), 'adrenalina'), null);
  s = rcp.resumeCpr(rcp.confirmShock(s, sec(174)), sec(176)); // Box 6
  const i = ind(st(s, 180), 'adrenalina');
  assert.deepEqual([i.reason, i.doseNumber, i.dose], ['first', 1, { amount: '1 mg', route: 'IV/IO' }]);
  assert.deepEqual(i.message, { screen: 'ADRENALINA 1 mg IV/IO', voice: 'Corresponde adrenalina.' });
  // still indicated later if never given
  s = shockCycle(rcp, s, 300);                               // Box 8
  assert.equal(ind(st(s, 310), 'adrenalina').reason, 'first');
});

test('adrenalina, rama no desfibrilable: lo antes posible (Box 9), then every 3–5 min with the window texts', () => {
  let s = check(rcp, started(), 'non_shockable', 40);        // Box 9
  assert.equal(ind(st(s, 43), 'adrenalina').reason, 'first');
  s = give(rcp.resumeCpr(s, sec(45)), 'adrenalina', '1 mg', 50);
  let a = med(st(s, 100), 'adrenalina');
  assert.deepEqual(a.window, { fromAt: sec(230), toAt: sec(350) });
  assert.deepEqual([a.windowState, a.windowText], ['before', 'Próxima en {mm:ss}']);
  assert.equal(ind(st(s, 100), 'adrenalina'), null);
  assert.deepEqual([med(st(s, 230), 'adrenalina').windowText, ind(st(s, 230), 'adrenalina').reason], ['Ventana abierta', 'open']);
  assert.deepEqual([med(st(s, 351), 'adrenalina').windowText, ind(st(s, 351), 'adrenalina').reason], ['Ventana superada', 'late']);
  assert.equal(ind(st(s, 351), 'adrenalina').doseNumber, 2);
});

test('adrenalina: entering the non-shockable branch without a prior dose (Box 12 → Box 10) is "lo antes posible"', () => {
  let s = shockCycle(rcp, started(), 40);                    // Box 4
  s = check(rcp, s, 'non_shockable', 170);                   // Box 12
  assert.equal(ind(st(s, 173), 'adrenalina'), null, 'not yet: Box 12 is the ROSC question');
  s = rcp.resumeCpr(s, sec(175));                            // "No" → Box 10
  assert.equal(ind(st(s, 176), 'adrenalina').reason, 'first');
});

test('adrenalina: changing branch keeps counting from the last dose (the interval is not reset)', () => {
  let s = check(rcp, started(), 'non_shockable', 40);
  s = give(rcp.resumeCpr(s, sec(45)), 'adrenalina', '1 mg', 50); // Box 10
  s = check(rcp, s, 'shockable', 170);                       // → Box 5
  s = rcp.resumeCpr(rcp.confirmShock(s, sec(174)), sec(176)); // Box 6
  const a = med(st(s, 200), 'adrenalina');
  assert.deepEqual(a.window, { fromAt: sec(230), toAt: sec(350) });
  assert.equal(ind(st(s, 200), 'adrenalina'), null, 'Box 6 does not re-trigger a "first" dose');
  assert.equal(ind(st(s, 240), 'adrenalina').reason, 'open');
});

test('antiarrítmico: first dose at Box 8; the second only on a later pass through Box 8, same drug; none after two', () => {
  let s = shockCycle(rcp, started(), 40);                    // 4
  s = shockCycle(rcp, s, 170);                               // 6
  assert.equal(ind(st(s, 180), 'antiarritmico'), null);
  s = shockCycle(rcp, s, 300);                               // 8
  let g = ind(st(s, 310), 'antiarritmico');
  assert.deepEqual(g.message, { screen: 'AMIODARONA o LIDOCAÍNA', voice: 'Considerar amiodarona o lidocaína.' });
  assert.deepEqual(g.options.map(o => [o.drugId, o.dose.amount]), [['amiodarona', '300 mg en bolo'], ['lidocaina', '1–1,5 mg/kg']]);
  s = give(s, 'lidocaina', '100 mg', 320);
  assert.equal(ind(st(s, 330), 'antiarritmico'), null, 'not again in the same pass');
  s = shockCycle(rcp, s, 430);                               // 5 → 6
  assert.equal(ind(st(s, 440), 'antiarritmico'), null, 'only at Box 8');
  s = shockCycle(rcp, s, 560);                               // 7 → 8 (later pass)
  g = ind(st(s, 570), 'antiarritmico');
  assert.equal(g.doseNumber, 2);
  assert.deepEqual(g.options.map(o => [o.drugId, o.dose.amount]), [['lidocaina', '0,5–0,75 mg/kg']], 'suggests the drug already chosen');
  assert.deepEqual(g.options[0].dose.perKg, { min: 0.5, max: 0.75, unit: 'mg' });
  assert.deepEqual(g.message, { screen: 'LIDOCAÍNA 0,5–0,75 mg/kg IV/IO', voice: 'Considerar segunda dosis de lidocaína.' }, 'text for the chosen drug');
  assert.ok(st(s, 570).algorithm.actions.includes('Amiodarona o lidocaína'), 'reminder still shown before the 2nd dose');
  s = give(s, 'amiodarona', '150 mg', 575);                  // registering the other one is not blocked
  assert.deepEqual(st(s, 576).algorithm.actions, ['RCP 2 min', 'Tratar causas reversibles'], 'reminder hidden once the group is complete');
  s = shockCycle(rcp, shockCycle(rcp, s, 690), 820);         // back to Box 8 again
  assert.equal(s.box, '8');
  assert.equal(ind(st(s, 830), 'antiarritmico'), null, 'no suggestions after the second dose');
  assert.deepEqual(st(s, 830).algorithm.actions, ['RCP 2 min', 'Tratar causas reversibles']);
});

test('antiarrítmico: the 2nd-dose text names amiodarona when it was the one chosen', () => {
  let s = shockCycle(rcp, shockCycle(rcp, shockCycle(rcp, started(), 40), 170), 300);
  s = give(s, 'amiodarona', '300 mg en bolo', 310);
  s = shockCycle(rcp, shockCycle(rcp, s, 430), 560);
  const g = ind(st(s, 570), 'antiarritmico');
  assert.deepEqual(g.options.map(o => [o.drugId, o.dose.amount]), [['amiodarona', '150 mg']]);
  assert.deepEqual(g.message, { screen: 'AMIODARONA 150 mg IV/IO', voice: 'Considerar segunda dosis de amiodarona.' });
});

test('antiarrítmico: returning to Box 8 without a shock is not a new pass (no early 2nd dose)', () => {
  let s = shockCycle(rcp, shockCycle(rcp, shockCycle(rcp, started(), 40), 170), 300); // Box 8
  s = give(s, 'amiodarona', '300 mg en bolo', 310);
  s = rcp.resumeCpr(check(rcp, s, 'shockable', 430), sec(440));  // D, defibrillator not ready → Box 8 again
  assert.equal(s.box, '8');
  assert.equal(ind(st(s, 450), 'antiarritmico'), null);
  s = shockCycle(rcp, shockCycle(rcp, s, 560), 690);          // 5 → 6, 7 → 8: the real next pass
  assert.equal(ind(st(s, 700), 'antiarritmico').doseNumber, 2);
});

test('antiarrítmico given before reaching Box 8 belongs to the next Box 8 pass; the 2nd waits one more pass', () => {
  let s = shockCycle(rcp, shockCycle(rcp, started(), 40), 170); // Box 6
  s = check(rcp, s, 'shockable', 300);                          // Box 7 (shock)
  s = give(s, 'amiodarona', '300 mg en bolo', 303);             // off-schedule, before Box 8
  s = rcp.resumeCpr(rcp.confirmShock(s, sec(304)), sec(306));  // Box 8, pass 1
  assert.equal(ind(st(s, 310), 'antiarritmico'), null);
  s = shockCycle(rcp, shockCycle(rcp, s, 430), 560);            // Box 8, pass 2
  assert.equal(ind(st(s, 570), 'antiarritmico').doseNumber, 2);
});

test('antiarrítmico: after two doses of the group, both drugs are marked groupExhausted (registering stays possible)', () => {
  let s = shockCycle(rcp, shockCycle(rcp, shockCycle(rcp, started(), 40), 170), 300);
  s = give(s, 'amiodarona', '300 mg en bolo', 310);
  let status = st(s, 311);
  assert.deepEqual([med(status, 'amiodarona').groupExhausted, med(status, 'lidocaina').groupExhausted], [false, false]);
  s = give(s, 'amiodarona', '150 mg', 320);
  status = st(s, 321);
  assert.deepEqual([med(status, 'amiodarona').groupExhausted, med(status, 'lidocaina').groupExhausted], [true, true]);
  assert.equal(med(status, 'adrenalina').groupExhausted, false);
  s = give(s, 'lidocaina', '100 mg', 330);
  assert.equal(med(st(s, 331), 'lidocaina').count, 1);
});

test('indications only while CPR is active', () => {
  const s = rcp.confirmRosc(check(rcp, started(), 'non_shockable', 40), sec(50));
  assert.deepEqual(st(s, 60).indications, []);
});

test('pausas: each pause, the longest and the total; the ongoing one counts live', () => {
  let s = shockCycle(rcp, started(), 40);                    // pause 40 → 46 (6 s)
  s = nonShockCycle(rcp, s, 170);                            // pause 170 → 176 (6 s)
  s = rcp.cancelRhythmCheck(rcp.beginRhythmCheck(s, sec(300)), sec(310)); // 10 s, same cycle
  s = rcp.beginRhythmCheck(s, sec(400));
  const p = pauseStats(s, sec(403));
  assert.deepEqual(p.list.map(x => x.ms), [6000, 6000, 10000]);
  assert.deepEqual(p.current, { startAt: sec(400), cycle: 3, ms: 3000 });
  assert.deepEqual([p.count, p.maxMs, p.totalMs], [4, 10000, 25000]);
  assert.equal(st(s, 403).pauses.current.ms, 3000);
  const ended = pauseStats(rcp.confirmRosc(s, sec(405)), sec(999));
  assert.equal(ended.list.at(-1).endedBy, 'ROSC_CONFIRMED');
  assert.equal(ended.count, 3, 'a pause ended by ROSC is not counted');
});

test('descargas: numbered in chronological order with their Box; voided shocks excluded', () => {
  let s = shockCycle(rcp, shockCycle(rcp, shockCycle(rcp, started(), 40), 170), 300);
  let shocks = st(s, 310).shocks;
  assert.deepEqual(shocks.map(x => [x.number, x.at, x.box]), [[1, sec(44), '3'], [2, sec(174), '5'], [3, sec(304), '7']]);
  s = rcp.editEvent(s, shocks[1].eventId, { data: { voided: true } }, sec(311));
  shocks = st(s, 312).shocks;
  assert.deepEqual(shocks.map(x => [x.number, x.at]), [[1, sec(44)], [2, sec(304)]]);
});

test('drogas: voided doses renumber the rest; "Otra" drugs group by normalized name', () => {
  let s = give(started(), 'adrenalina', '1 mg', 10);
  s = give(s, 'adrenalina', '1 mg', 200);
  for (const [name, t] of [['Bicarbonato', 210], [' bicarbonato', 220], ['BICARBONATO', 230], ['Bicarbonato'.normalize('NFD'), 240]]) {
    s = rcp.giveMedication(s, { drugId: 'otra', name, dose: '50 mEq', route: 'IV' }, sec(t));
  }
  s = rcp.editEvent(s, s.events.find(e => e.type === 'MEDICATION_GIVEN').id, { data: { voided: true } }, sec(250));
  const status = st(s, 260);
  assert.deepEqual(med(status, 'adrenalina').doses.map(d => [d.number, d.at]), [[1, sec(200)]]);
  assert.equal(status.medications.others.length, 1);
  assert.equal(status.medications.others[0].count, 4);
});

test('ROSC: the total clock stops; drug timers are measured to ROSC and never go negative', () => {
  let s = give(started(), 'adrenalina', '1 mg', 100);
  s = rcp.confirmRosc(s, sec(250));
  const later = st(s, 9999);
  assert.deepEqual([later.totalMs, later.endedAt, later.alert], [250000, sec(250), null]);
  assert.deepEqual(later.medications, st(s, 250).medications);
  // a dose edited to after the ROSC time: time since last dose clamps to 0
  s = rcp.editEvent(s, 'ev2', { at: sec(260) }, sec(300));
  assert.equal(med(st(s, 300), 'adrenalina').sinceLastMs, 0);
});

test('resumen: duration, cycles, shocks, doses per drug, initial rhythm, ROSC and time', () => {
  let s = shockCycle(rcp, started(), 40);
  s = shockCycle(rcp, s, 170);
  s = give(s, 'adrenalina', '1 mg', 180);
  s = rcp.confirmRosc(s, sec(300));
  const sum = summarize(s, PROFILE, sec(5000));
  assert.equal(sum.profileLabel, 'AHA Adulto · 2025');
  assert.deepEqual([sum.durationMs, sum.cycles, sum.shocks, sum.initialRhythm], [300000, 3, 2, 'shockable']);
  assert.deepEqual(sum.medications, [{ name: 'Adrenalina', count: 1 }]);
  assert.deepEqual(sum.rosc, { confirmed: true, at: sec(300) });
  assert.equal(sum.stop, null);
  assert.deepEqual(sum.pauses, { count: 2, maxMs: 6000, totalMs: 12000 });
  const stopped = summarize(rcp.stopCpr(started(), 'otro', sec(600), 'Motivo X'), PROFILE, sec(700));
  assert.deepEqual([stopped.rosc.confirmed, stopped.stop, stopped.durationMs], [false, { reason: 'otro', detail: 'Motivo X', at: sec(600) }, 600000]);
});

test('orden cronológico: sorted by (edited) time with offsets from the start; ties keep recording order', () => {
  let s = shockCycle(rcp, started(), 40);                    // shock at 44
  s = give(s, 'adrenalina', '1 mg', 60);
  const medId = s.events.at(-1).id;
  s = rcp.recordReversibleCause(s, 'hipoxia', sec(60));      // same time as the drug
  s = rcp.editEvent(s, medId, { at: sec(30) }, sec(70));     // actually given before the rhythm check
  const chrono = chronology(s);
  assert.deepEqual(chrono.map(e => e.type), [
    'CPR_STARTED', 'MEDICATION_GIVEN', 'CPR_PAUSED', 'RHYTHM_CHECK', 'SHOCK_DELIVERED', 'CPR_RESUMED', 'REVERSIBLE_CAUSE_IDENTIFIED',
  ]);
  assert.deepEqual(chrono.map(e => e.offsetMs / 1000), [0, 30, 40, 42, 44, 46, 60]);
  assert.equal(chrono[1].edited, true);
  s = rcp.editEvent(s, 'ev1', { at: sec(-30) }, sec(80));  // the arrest started earlier
  assert.equal(chronology(s)[1].offsetMs, 60000);
  assert.equal(st(s, 80).totalMs, 110000);
});

test('status refuses another profile or version, and a profile with [REVISAR]', () => {
  const s = started();
  assert.throws(() => getStatus(s, { ...cloneProfile(), version: '2025-b' }, sec(1)), ProfileError);
  assert.throws(() => getStatus(s, unsignedProfile(), sec(1)), /REVISAR/);
});
