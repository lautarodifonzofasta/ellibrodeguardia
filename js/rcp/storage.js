// Session persistence in localStorage, one key per mode ("real" and
// "simulacion" never share storage). Every access is wrapped in try/catch:
// private mode, a full quota or disabled storage must never break the
// assistant mid-resuscitation — the session just stops persisting.

import { SCHEMA_VERSION, STATES, EVENT_TYPES, MODES, RHYTHMS, STOP_REASONS } from './constants.js';

/** @typedef {import('./types.js').ResuscitationSession} ResuscitationSession */

const KEY_PREFIX = 'elg-rcp-session-';
const MAX_CORRUPT_COPIES = 5;

export const storageKey = mode => `${KEY_PREFIX}${mode}`;
const corruptKey = (mode, n) => `${KEY_PREFIX}${mode}-corrupta${n > 1 ? `-${n}` : ''}`;

function defaultStorage() {
  try { return globalThis.localStorage ?? null; } catch { return null; }
}

/** @param {ResuscitationSession} session */
export function serializeSession(session) {
  return JSON.stringify(session);
}

const isText = v => typeof v === 'string' && v.trim() !== '';

// Fields status.js and the note read, per event type.
const DATA_CHECKS = {
  RHYTHM_CHECK: d => RHYTHMS.includes(d.rhythm),
  MEDICATION_GIVEN: d => isText(d.drugId) && isText(d.name) && isText(d.dose) && isText(d.route),
  VASCULAR_ACCESS: d => isText(d.route),
  ETCO2_VALUE: d => Number.isFinite(d.value),
  REVERSIBLE_CAUSE_IDENTIFIED: d => isText(d.causeId) && isText(d.label),
  CPR_STOPPED: d => STOP_REASONS.includes(d.reason),
  OTHER: d => isText(d.text),
};

/**
 * Parses and validates a stored session. Throws if it isn't a session this
 * version can safely show and continue.
 * @param {string} text
 * @returns {ResuscitationSession}
 */
export function deserializeSession(text) {
  const s = JSON.parse(text);
  if (!s || typeof s !== 'object') throw new TypeError('La sesión guardada no es un objeto.');
  if (s.schemaVersion !== SCHEMA_VERSION) throw new TypeError(`Versión de sesión no soportada: ${s.schemaVersion}.`);
  if (!MODES.includes(s.mode)) throw new TypeError('Modo de sesión inválido.');
  if (!Object.values(STATES).includes(s.state)) throw new TypeError('Estado de sesión inválido.');
  if (!s.profile || !isText(s.profile.id) || !isText(s.profile.version) || !isText(s.profile.name)) {
    throw new TypeError('La sesión no indica su perfil.');
  }
  if (!Number.isInteger(s.cycle) || !Number.isInteger(s.nextSeq) || !Array.isArray(s.events) ||
      !s.boxPasses || typeof s.boxPasses !== 'object' || !Object.values(s.boxPasses).every(n => Number.isInteger(n) && n > 0)) {
    throw new TypeError('Sesión incompleta.');
  }
  if (s.state !== STATES.IDLE && !isText(s.box)) throw new TypeError('La sesión no indica su Box.');
  const ids = new Set();
  let lastSeq = 0;
  for (const e of s.events) {
    if (!e || typeof e.id !== 'string' || ids.has(e.id) || !Number.isInteger(e.seq) || e.seq <= lastSeq ||
        !EVENT_TYPES.includes(e.type) || !Number.isFinite(e.at) || !Number.isFinite(e.recordedAt) ||
        !Number.isInteger(e.cycle) || !isText(e.box) || !Number.isInteger(e.boxPass) || e.boxPass < 1 ||
        !e.data || typeof e.data !== 'object' || (DATA_CHECKS[e.type] && !DATA_CHECKS[e.type](e.data))) {
      throw new TypeError('Evento inválido en la sesión guardada.');
    }
    ids.add(e.id);
    lastSeq = e.seq;
  }
  if (s.nextSeq !== lastSeq + 1) throw new TypeError('Secuencia de eventos inconsistente.');
  return s;
}

/**
 * Saves the session under its mode's key. Returns false (never throws) if
 * storage is unavailable or full.
 * @param {ResuscitationSession} session
 */
export function saveSession(session, storage = defaultStorage()) {
  if (!storage) return false;
  try {
    storage.setItem(storageKey(session.mode), serializeSession(session));
    return true;
  } catch {
    return false;
  }
}

/**
 * Loads the stored session for `mode`, or null. A stored session that can't
 * be read is moved aside to the first free "-corrupta" slot (never
 * overwriting an earlier copy) so it can still be inspected.
 * @param {'real'|'simulacion'} mode
 * @returns {ResuscitationSession|null}
 */
export function loadSession(mode, storage = defaultStorage()) {
  if (!storage) return null;
  let text;
  try {
    text = storage.getItem(storageKey(mode));
  } catch {
    return null;
  }
  if (!text) return null;
  try {
    return deserializeSession(text);
  } catch {
    try {
      for (let n = 1; n <= MAX_CORRUPT_COPIES; n++) {
        if (storage.getItem(corruptKey(mode, n)) === null) {
          storage.setItem(corruptKey(mode, n), text);
          break;
        }
      }
      storage.removeItem(storageKey(mode));
    } catch { /* storage unavailable: leave it as it was */ }
    return null;
  }
}

const archiveKey = mode => `${KEY_PREFIX}${mode}-anterior`;

/**
 * Keeps a finished session as "la RCP anterior" (one slot per mode) before a
 * new one takes its place, so starting a new resuscitation never silently
 * discards the previous record. Returns false if it couldn't be saved.
 * @param {ResuscitationSession} session
 */
export function archiveSession(session, storage = defaultStorage()) {
  if (!storage) return false;
  try {
    storage.setItem(archiveKey(session.mode), serializeSession(session));
    return true;
  } catch {
    return false;
  }
}

/** @param {'real'|'simulacion'} mode */
export function loadArchivedSession(mode, storage = defaultStorage()) {
  if (!storage) return null;
  try {
    const text = storage.getItem(archiveKey(mode));
    return text ? deserializeSession(text) : null;
  } catch {
    return null;
  }
}

/** @param {'real'|'simulacion'} mode */
export function clearSession(mode, storage = defaultStorage()) {
  if (!storage) return;
  try { storage.removeItem(storageKey(mode)); } catch { /* nothing to do */ }
}
