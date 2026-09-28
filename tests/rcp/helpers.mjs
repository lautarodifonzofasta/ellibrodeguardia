// Shared test helpers (not a test file itself: no ".test." in the name).
// PROFILE is content/rcp/aha-2025-adulto.json exactly as the app loads it, so
// the real algorithm, doses and texts are what the tests exercise.
import { readFileSync } from 'node:fs';

export const PROFILE = JSON.parse(readFileSync(new URL('../../content/rcp/aha-2025-adulto.json', import.meta.url), 'utf8'));
export const cloneProfile = () => structuredClone(PROFILE);
/** The same profile with its signature replaced by an unresolved marker. */
export const unsignedProfile = () => ({ ...cloneProfile(), validatedBy: '[REVISAR: completar al validar]' });

export const T0 = Date.UTC(2026, 8, 27, 3, 0, 0); // arbitrary fixed origin
export const sec = n => T0 + n * 1000;

export class FakeStorage {
  constructor() { this.map = new Map(); }
  getItem(k) { return this.map.has(k) ? this.map.get(k) : null; }
  setItem(k, v) { this.map.set(k, String(v)); }
  removeItem(k) { this.map.delete(k); }
}

/** Rhythm check at t, rhythm chosen at t+2. */
export function check(rcp, s, rhythm, t) {
  return rcp.selectRhythm(rcp.beginRhythmCheck(s, sec(t)), rhythm, sec(t + 2));
}

/** Rhythm check at t, shockable at t+2, shock at t+4, compressions at t+6. */
export function shockCycle(rcp, s, t) {
  return rcp.resumeCpr(rcp.confirmShock(check(rcp, s, 'shockable', t), sec(t + 4)), sec(t + 6));
}

/** Rhythm check at t, non-shockable at t+2, compressions at t+6. */
export function nonShockCycle(rcp, s, t) {
  return rcp.resumeCpr(check(rcp, s, 'non_shockable', t), sec(t + 6));
}
