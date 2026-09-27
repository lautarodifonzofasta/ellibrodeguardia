import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createEngine } from '../../js/rcp/engine.js';
import { buildNote, formatDuration } from '../../js/rcp/note.js';
import { assertProfileUsable, ProfileError } from '../../js/rcp/profile.js';
import { PROFILE, cloneProfile, T0, sec, check, shockCycle } from './helpers.mjs';

const rcp = createEngine(PROFILE);
const started = () => rcp.startCpr(rcp.createSession({ id: 's1', now: T0 }), sec(0)); // T0 = 03:00:00 UTC
const note = s => buildNote(s, PROFILE, { timeZone: 'UTC' }).split('\n');
const give = (s, drugId, name, dose, t) => rcp.giveMedication(s, { drugId, name, dose, route: 'IV/IO' }, sec(t));

test('nota: full shockable case with ROSC, only recorded data, template wording', () => {
  let s = shockCycle(rcp, started(), 40);                      // shock 03:00:44
  s = shockCycle(rcp, s, 170);                                 // shock 03:02:54
  s = give(s, 'adrenalina', 'Adrenalina', '1 mg', 180);        // 03:03
  s = shockCycle(rcp, s, 300);                                 // shock 03:05:04 → Box 8
  s = give(s, 'amiodarona', 'Amiodarona', '300 mg en bolo', 310);
  s = give(s, 'adrenalina', 'Adrenalina', '1 mg', 400);        // 03:06
  s = rcp.recordOther(s, 'Familia avisada', sec(420));
  s = rcp.confirmRosc(s, sec(725));                            // 03:12:05, 12 min 5 s
  assert.deepEqual(note(s), [
    'Paciente adulto en paro cardiorrespiratorio. Se inicia RCP a las 03:00.',
    'Ritmo inicial: desfibrilable (FV/TV sin pulso).',
    'Se realizan 3 descargas (03:00, 03:02, 03:05).',
    'Se administra Adrenalina 1 mg IV/IO en 2 dosis (03:03, 03:06).',
    'Se administra Amiodarona 300 mg en bolo IV/IO en 1 dosis (03:05).',
    'Otros eventos: Familia avisada (03:07).',
    'Se obtiene ROSC a las 03:12, tras 12 min 5 s de RCP (4 ciclos).',
    'Algoritmo de referencia: AHA 2025, paro cardíaco del adulto.',
  ]);
});

test('nota: non-shockable case stopped without ROSC; airway, capnography with EtCO₂, causes', () => {
  let s = check(rcp, started(), 'non_shockable', 30);
  s = rcp.resumeCpr(s, sec(35));
  s = rcp.recordAirway(s, { device: 'Tubo endotraqueal' }, sec(120));
  s = rcp.recordCapnography(s, sec(130));
  s = rcp.recordEtco2(s, 12, sec(200));
  s = rcp.recordEtco2(s, 18, sec(320));
  s = rcp.recordReversibleCause(s, 'hipoxia', sec(60));
  s = rcp.recordReversibleCause(s, 'hipovolemia', sec(90));
  s = rcp.recordReversibleCause(s, 'hipoxia', sec(95));        // repeated: listed once
  s = rcp.stopCpr(s, 'derivacion', sec(1500), 'Hospital X');
  assert.deepEqual(note(s), [
    'Paciente adulto en paro cardiorrespiratorio. Se inicia RCP a las 03:00.',
    'Ritmo inicial: no desfibrilable (AESP/asistolia).',
    'Se coloca vía aérea avanzada a las 03:02.',
    'Se monitorea con capnografía; EtCO₂ registradas: 12 mmHg (03:03), 18 mmHg (03:05).',
    'Causas reversibles consideradas: Hipoxia, Hipovolemia.',
    'Se finaliza la RCP a las 03:25 (derivación: Hospital X), tras 25 min 0 s de reanimación.',
    'Algoritmo de referencia: AHA 2025, paro cardíaco del adulto.',
  ]);
});

test('nota: lines without data are left out; voided and edited events are respected', () => {
  let s = shockCycle(rcp, started(), 40);
  s = give(s, 'adrenalina', 'Adrenalina', '1 mg', 60);
  s = rcp.editEvent(s, s.events.find(e => e.type === 'SHOCK_DELIVERED').id, { data: { voided: true } }, sec(70));
  s = rcp.editEvent(s, s.events.find(e => e.type === 'MEDICATION_GIVEN').id, { at: sec(125) }, sec(130));
  s = rcp.recordCapnography(s, sec(140));                      // capnography without airway or EtCO₂
  s = rcp.stopCpr(s, 'fallecimiento', sec(600));
  assert.deepEqual(note(s), [
    'Paciente adulto en paro cardiorrespiratorio. Se inicia RCP a las 03:00.',
    'Ritmo inicial: desfibrilable (FV/TV sin pulso).',
    'Se administra Adrenalina 1 mg IV/IO en 1 dosis (03:02).',
    'Se monitorea con capnografía.',
    'Se finaliza la RCP a las 03:10 (fallecimiento), tras 10 min 0 s de reanimación.',
    'Algoritmo de referencia: AHA 2025, paro cardíaco del adulto.',
  ]);
  assert.equal(buildNote(rcp.createSession({ id: 'x', now: T0 }), PROFILE), '', 'nothing recorded, no note');
});

test('nota: "Otro" stop reason uses the typed detail; duration format', () => {
  const s = rcp.stopCpr(started(), 'otro', sec(45), 'Pedido de la familia');
  assert.equal(note(s).at(-2), 'Se finaliza la RCP a las 03:00 (Pedido de la familia), tras 45 s de reanimación.');
  assert.equal(formatDuration(3_725_000), '62 min 5 s');
});

test('a profile whose note template lost a placeholder is refused', () => {
  const p = cloneProfile();
  p.noteTemplate.lines[2] = 'Se realizan descargas.';
  assert.throws(() => assertProfileUsable(p), ProfileError);
  const q = cloneProfile();
  q.noteTemplate.lines.pop();
  assert.throws(() => assertProfileUsable(q), ProfileError);
});
