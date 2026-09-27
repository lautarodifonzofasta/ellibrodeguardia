// Resuscitation state machine. Pure: no DOM, no timers, no Date.now() —
// every action receives `now` (epoch ms) and returns a NEW session; the
// input session is never mutated. The engine only records what the user
// confirmed; it never advances a cycle, gives a drug or delivers a shock on
// its own.
//
// Two layers of state: the engine state (CPR_ACTIVE, RHYTHM_CHECK…) says what
// the user can do next; the profile's algorithm Box says where the case is in
// the guideline (which Box, which reminders). Box transitions are read from
// the profile, so no clinical sequence is hard-coded here.

import { SCHEMA_VERSION, STATES, ACTIVE_STATES, RHYTHMS, STOP_REASONS, MODES } from './constants.js';
import { assertProfileUsable, assertSameProfile } from './profile.js';

export { SCHEMA_VERSION, STATES, ACTIVE_STATES, EVENT_TYPES, RHYTHMS, STOP_REASONS, MODES } from './constants.js';

/** @typedef {import('./types.js').ResuscitationSession} ResuscitationSession */
/** @typedef {import('./types.js').ResuscitationEvent} ResuscitationEvent */
/** @typedef {import('./types.js').GuidelineProfile} GuidelineProfile */

const S = STATES;
const OTHER_TEXT_MAX = 200;

// Which data fields an audited edit may change, per event type. The type,
// id, seq, recordedAt, cycle and Box of an event are never editable.
const EDITABLE_DATA = Object.freeze({
  CPR_STARTED: [],
  CPR_PAUSED: [],
  CPR_RESUMED: [],
  RHYTHM_CHECK: ['rhythm'],
  SHOCK_DELIVERED: ['voided'],
  MEDICATION_GIVEN: ['drugId', 'name', 'dose', 'route', 'voided'],
  VASCULAR_ACCESS: ['route', 'voided'],
  AIRWAY_PLACED: ['device', 'voided'],
  CAPNOGRAPHY_STARTED: ['voided'],
  ETCO2_VALUE: ['value', 'voided'],
  REVERSIBLE_CAUSE_IDENTIFIED: ['causeId', 'label', 'voided'],
  ROSC_CONFIRMED: [],
  CPR_STOPPED: ['reason', 'detail'],
  OTHER: ['text', 'voided'],
});

export class TransitionError extends Error {
  constructor(action, state) {
    super(`"${action}" no está permitido en el estado ${state}.`);
    this.name = 'TransitionError';
    this.action = action;
    this.state = state;
  }
}

export const isActive = session => ACTIVE_STATES.includes(session.state);

/** Collapses whitespace and Unicode forms so "Lido  caína" and "Lidocaína" (pasted) match. */
export const normalizeName = text => String(text).normalize('NFC').replace(/\s+/g, ' ').trim();

function requireState(session, action, allowed) {
  if (!allowed.includes(session.state)) throw new TransitionError(action, session.state);
}

function requireNow(now) {
  if (!Number.isFinite(now)) throw new TypeError('"now" debe ser un timestamp en milisegundos.');
}

function requireText(value, what) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`Falta ${what}.`);
  return normalizeName(value);
}

/**
 * Appends one event. `changes` are session fields that change with it
 * (state, cycle, box…); the event records the cycle and Box in force after
 * the action.
 */
function append(session, type, now, data = {}, changes = {}) {
  const seq = session.nextSeq;
  const next = { ...session, ...changes };
  /** @type {ResuscitationEvent} */
  const event = { id: `ev${seq}`, seq, type, at: now, recordedAt: now, cycle: next.cycle, box: next.box, boxPass: next.boxPasses[next.box], data };
  return { ...next, nextSeq: seq + 1, events: [...session.events, event] };
}

/**
 * Moving to a Box through the algorithm starts a new pass through it; the
 * pass count per Box is what "on the next pass through Box 8" is measured
 * against.
 */
const enterBox = (session, box) => ({ box, boxPasses: { ...session.boxPasses, [box]: (session.boxPasses[box] || 0) + 1 } });

/**
 * Binds the engine to one validated profile. Every action checks that the
 * session was created with this exact profile (id and version).
 * @param {GuidelineProfile} profile
 */
export function createEngine(profile) {
  assertProfileUsable(profile);
  const { boxes } = profile.algorithm;
  const guard = session => assertSameProfile(session, profile);

  /** @returns {ResuscitationSession} */
  function createSession({ id, mode = 'real', now }) {
    requireNow(now);
    if (!MODES.includes(mode)) throw new TypeError(`Modo desconocido: "${mode}".`);
    return {
      schemaVersion: SCHEMA_VERSION,
      id: requireText(id, 'el id de la sesión'),
      mode,
      profile: { id: profile.id, version: profile.version, name: profile.name },
      createdAt: now,
      state: S.IDLE,
      cycle: 0,
      box: null,
      boxPasses: {},
      nextSeq: 1,
      events: [],
    };
  }

  /** IDLE → CPR_ACTIVE at the algorithm's first Box; starts the total clock and cycle 1. */
  function startCpr(session, now) {
    guard(session); requireNow(now);
    requireState(session, 'startCpr', [S.IDLE]);
    return append(session, 'CPR_STARTED', now, {}, { state: S.CPR_ACTIVE, cycle: 1, ...enterBox(session, profile.algorithm.start) });
  }

  /** CPR_ACTIVE → RHYTHM_CHECK; compressions stop, a pause starts. */
  function beginRhythmCheck(session, now) {
    guard(session); requireNow(now);
    requireState(session, 'beginRhythmCheck', [S.CPR_ACTIVE]);
    return append(session, 'CPR_PAUSED', now, { reason: 'rhythm_check' }, { state: S.RHYTHM_CHECK });
  }

  /**
   * RHYTHM_CHECK → SHOCKABLE | NON_SHOCKABLE, as the user chose; the next Box
   * comes from the current Box's "onRhythm". A shockable rhythm Box (e.g.
   * "FV / TV sin pulso") leads straight to its shock Box.
   */
  function selectRhythm(session, rhythm, now) {
    guard(session); requireNow(now);
    requireState(session, 'selectRhythm', [S.RHYTHM_CHECK]);
    if (!RHYTHMS.includes(rhythm)) throw new TypeError(`Ritmo desconocido: "${rhythm}".`);
    const fromBox = session.box;
    let target = boxes[fromBox].onRhythm[rhythm];
    const data = { rhythm, fromBox };
    if (rhythm === 'shockable' && boxes[target].kind === 'rhythm') {
      data.via = target;
      target = boxes[target].next;
    }
    const state = rhythm === 'shockable' ? S.SHOCKABLE : S.NON_SHOCKABLE;
    return append(session, 'RHYTHM_CHECK', now, data, { state, ...enterBox(session, target) });
  }

  /** RHYTHM_CHECK → CPR_ACTIVE without a rhythm: same cycle and Box; the pause ends. */
  function cancelRhythmCheck(session, now) {
    guard(session); requireNow(now);
    requireState(session, 'cancelRhythmCheck', [S.RHYTHM_CHECK]);
    return append(session, 'CPR_RESUMED', now, { newCycle: false }, { state: S.CPR_ACTIVE });
  }

  /** SHOCKABLE → POST_SHOCK. Only called when the user taps "Descarga realizada". */
  function confirmShock(session, now) {
    guard(session); requireNow(now);
    requireState(session, 'confirmShock', [S.SHOCKABLE]);
    return append(session, 'SHOCK_DELIVERED', now, {}, { state: S.POST_SHOCK });
  }

  /**
   * Back to compressions with a new cycle; the pause ends. The Box comes
   * from the profile:
   * - POST_SHOCK: the shock Box's "next".
   * - NON_SHOCKABLE on a rhythm Box: its "next"; on a RCP Box: that Box; on
   *   the ROSC question: its "noRosc" Box (the user answered "no").
   * - SHOCKABLE without a shock (e.g. the defibrillator wasn't ready): the
   *   Box where the rhythm was checked — the algorithm doesn't advance
   *   without a confirmed shock. Recorded as withoutShock.
   */
  function resumeCpr(session, now) {
    guard(session); requireNow(now);
    requireState(session, 'resumeCpr', [S.POST_SHOCK, S.NON_SHOCKABLE, S.SHOCKABLE]);
    const current = boxes[session.box];
    const data = { newCycle: true, fromBox: session.box };
    let target;
    if (session.state === S.POST_SHOCK) {
      target = current.next;
    } else if (session.state === S.SHOCKABLE) {
      // Back to the same pass of the Box where the rhythm was checked: without
      // a confirmed shock the algorithm doesn't advance.
      data.withoutShock = true;
      target = lastEvent(session, 'RHYTHM_CHECK').data.fromBox;
      return append(session, 'CPR_RESUMED', now, data, { state: S.CPR_ACTIVE, cycle: session.cycle + 1, box: target });
    } else if (current.kind === 'rhythm') {
      target = current.next;
    } else if (current.kind === 'rosc_check') {
      data.roscSigns = false;
      target = current.noRosc;
    } else {
      target = session.box;
    }
    const boxChange = target === session.box ? {} : enterBox(session, target);
    return append(session, 'CPR_RESUMED', now, data, { state: S.CPR_ACTIVE, cycle: session.cycle + 1, ...boxChange });
  }

  /**
   * Records a confirmed administration: exactly what the user confirmed.
   * Dose numbers are derived from the log in status.js.
   * @param {{drugId: string, name: string, dose: string, route: string}} med
   */
  function giveMedication(session, med, now) {
    guard(session); requireNow(now);
    requireState(session, 'giveMedication', ACTIVE_STATES);
    const data = {
      drugId: requireText(med?.drugId, 'la droga'),
      name: requireText(med?.name, 'el nombre de la droga'),
      dose: requireText(med?.dose, 'la dosis'),
      route: requireText(med?.route, 'la vía'),
    };
    return append(session, 'MEDICATION_GIVEN', now, data);
  }

  /** @param {string} route One of the profile's vascular access routes (IV, IO). */
  function recordVascularAccess(session, route, now) {
    guard(session); requireNow(now);
    requireState(session, 'recordVascularAccess', ACTIVE_STATES);
    if (!profile.vascularAccess.routes.includes(route)) throw new TypeError(`Vía desconocida: "${route}".`);
    return append(session, 'VASCULAR_ACCESS', now, { route });
  }

  /** @param {{device?: string}} [details] */
  function recordAirway(session, details, now) {
    guard(session); requireNow(now);
    requireState(session, 'recordAirway', ACTIVE_STATES);
    const data = {};
    if (details?.device != null) data.device = requireText(details.device, 'el dispositivo');
    return append(session, 'AIRWAY_PLACED', now, data);
  }

  function recordCapnography(session, now) {
    guard(session); requireNow(now);
    requireState(session, 'recordCapnography', ACTIVE_STATES);
    return append(session, 'CAPNOGRAPHY_STARTED', now);
  }

  /** @param {number} value EtCO₂ in mmHg, as read by the user. No automatic interpretation. */
  function recordEtco2(session, value, now) {
    guard(session); requireNow(now);
    requireState(session, 'recordEtco2', ACTIVE_STATES);
    if (!Number.isFinite(value) || value < 0) throw new TypeError('El valor de EtCO₂ debe ser un número ≥ 0.');
    return append(session, 'ETCO2_VALUE', now, { value, unit: 'mmHg' });
  }

  /** @param {string} causeId One of the profile's reversible causes. */
  function recordReversibleCause(session, causeId, now) {
    guard(session); requireNow(now);
    requireState(session, 'recordReversibleCause', ACTIVE_STATES);
    const cause = profile.reversibleCauses.find(c => c.id === causeId);
    if (!cause) throw new TypeError(`Causa desconocida: "${causeId}".`);
    return append(session, 'REVERSIBLE_CAUSE_IDENTIFIED', now, { causeId: cause.id, label: cause.label });
  }

  function recordOther(session, text, now) {
    guard(session); requireNow(now);
    requireState(session, 'recordOther', ACTIVE_STATES);
    const clean = requireText(text, 'el texto');
    if (clean.length > OTHER_TEXT_MAX) throw new TypeError(`El texto no puede superar ${OTHER_TEXT_MAX} caracteres.`);
    return append(session, 'OTHER', now, { text: clean });
  }

  /** Any active state → ROSC; stops the total clock. */
  function confirmRosc(session, now) {
    guard(session); requireNow(now);
    requireState(session, 'confirmRosc', ACTIVE_STATES);
    return append(session, 'ROSC_CONFIRMED', now, {}, { state: S.ROSC });
  }

  /**
   * Any active state → ENDED, with the reason the user chose. The UI asks for
   * an extra confirmation before "fallecimiento".
   * @param {'decision_clinica'|'derivacion'|'fallecimiento'|'otro'} reason
   * @param {string} [detail]
   */
  function stopCpr(session, reason, now, detail) {
    guard(session); requireNow(now);
    requireState(session, 'stopCpr', ACTIVE_STATES);
    if (!STOP_REASONS.includes(reason)) throw new TypeError(`Motivo desconocido: "${reason}".`);
    const data = { reason };
    if (detail != null && String(detail).trim() !== '') data.detail = normalizeName(detail);
    return append(session, 'CPR_STOPPED', now, data, { state: S.ENDED });
  }

  /**
   * Audited correction of an event's time and/or data. The previous values
   * are kept in `edits` with `editedAt` (an absent field is recorded as null,
   * so the record survives JSON), and the event is flagged `edited`. A patch
   * that changes nothing returns the session unchanged. Editing never
   * changes the state machine's history (state, cycle, Box).
   * @param {string} eventId
   * @param {{at?: number, data?: object}} patch
   */
  function editEvent(session, eventId, patch, now) {
    guard(session); requireNow(now);
    if (!patch || typeof patch !== 'object' || Array.isArray(patch)) throw new TypeError('La corrección debe ser un objeto.');
    if (patch.data !== undefined && (!patch.data || typeof patch.data !== 'object' || Array.isArray(patch.data))) {
      throw new TypeError('Los datos corregidos deben ser un objeto.');
    }
    const index = session.events.findIndex(e => e.id === eventId);
    if (index === -1) throw new RangeError(`No existe el evento "${eventId}".`);
    const event = session.events[index];
    const previous = {};
    const next = { ...event, data: { ...event.data } };

    if (patch.at !== undefined) {
      if (!Number.isFinite(patch.at)) throw new TypeError('La hora corregida debe ser un timestamp.');
      if (patch.at > now) throw new RangeError('La hora corregida no puede ser posterior a este momento.');
      if (patch.at !== event.at) {
        previous.at = event.at;
        next.at = patch.at;
      }
    }

    if (patch.data !== undefined) {
      const allowed = EDITABLE_DATA[event.type];
      const prevData = {};
      for (const [key, value] of Object.entries(patch.data)) {
        if (!allowed.includes(key)) throw new TypeError(`"${key}" no se puede editar en ${event.type}.`);
        const clean = normalizeEditedField(key, value);
        const before = key in event.data ? event.data[key] : (key === 'voided' ? false : null);
        if (before !== clean) {
          prevData[key] = before;
          next.data[key] = clean;
        }
      }
      if (Object.keys(prevData).length) previous.data = prevData;
    }

    if (!Object.keys(previous).length) return session;
    next.edited = true;
    next.edits = [...(event.edits || []), { editedAt: now, previous }];
    const events = session.events.slice();
    events[index] = next;
    return { ...session, events };
  }

  /** Validates an edited data field and returns the value to store. */
  function normalizeEditedField(key, value) {
    switch (key) {
      case 'voided':
        if (typeof value !== 'boolean') throw new TypeError('"voided" debe ser true o false.');
        return value;
      case 'rhythm':
        if (!RHYTHMS.includes(value)) throw new TypeError(`Ritmo desconocido: "${value}".`);
        return value;
      case 'reason':
        if (!STOP_REASONS.includes(value)) throw new TypeError(`Motivo desconocido: "${value}".`);
        return value;
      case 'route':
        return requireText(value, 'la vía');
      case 'value':
        if (!Number.isFinite(value) || value < 0) throw new TypeError('El valor de EtCO₂ debe ser un número ≥ 0.');
        return value;
      case 'detail':
        return value == null || String(value).trim() === '' ? null : normalizeName(value);
      case 'text': {
        const clean = requireText(value, 'el texto');
        if (clean.length > OTHER_TEXT_MAX) throw new TypeError(`El texto no puede superar ${OTHER_TEXT_MAX} caracteres.`);
        return clean;
      }
      default:
        return requireText(value, `"${key}"`);
    }
  }

  return Object.freeze({
    profile,
    createSession, startCpr, beginRhythmCheck, selectRhythm, cancelRhythmCheck, confirmShock, resumeCpr,
    giveMedication, recordVascularAccess, recordAirway, recordCapnography, recordEtco2, recordReversibleCause,
    recordOther, confirmRosc, stopCpr, editEvent,
  });
}

function lastEvent(session, type) {
  for (let i = session.events.length - 1; i >= 0; i--) if (session.events[i].type === type) return session.events[i];
  return null;
}
