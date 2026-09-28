// Engine vocabulary shared by engine.js, status.js, profile.js and
// storage.js. Nothing clinical here: states, event types and rhythm
// categories come from the author's request (sections 4, 6 and 7).

export const SCHEMA_VERSION = 2;

export const STATES = Object.freeze({
  IDLE: 'IDLE',
  CPR_ACTIVE: 'CPR_ACTIVE',
  RHYTHM_CHECK: 'RHYTHM_CHECK',
  SHOCKABLE: 'SHOCKABLE',
  // Added: the shock is recorded but compressions haven't resumed yet. Keeps
  // a double tap from logging two shocks and keeps the pause open until
  // compressions actually restart.
  POST_SHOCK: 'POST_SHOCK',
  NON_SHOCKABLE: 'NON_SHOCKABLE',
  ROSC: 'ROSC',
  ENDED: 'ENDED',
});

export const ACTIVE_STATES = Object.freeze([
  STATES.CPR_ACTIVE, STATES.RHYTHM_CHECK, STATES.SHOCKABLE, STATES.POST_SHOCK, STATES.NON_SHOCKABLE,
]);

// Section 7's list, plus VASCULAR_ACCESS (added with the author's OK so the
// "Acceso IV/IO" reminder can be marked as done).
export const EVENT_TYPES = Object.freeze([
  'CPR_STARTED', 'CPR_PAUSED', 'CPR_RESUMED', 'RHYTHM_CHECK', 'SHOCK_DELIVERED', 'MEDICATION_GIVEN',
  'VASCULAR_ACCESS', 'AIRWAY_PLACED', 'CAPNOGRAPHY_STARTED', 'ETCO2_VALUE', 'REVERSIBLE_CAUSE_IDENTIFIED',
  'ROSC_CONFIRMED', 'CPR_STOPPED', 'OTHER',
]);

export const RHYTHMS = Object.freeze(['shockable', 'non_shockable']);
export const STOP_REASONS = Object.freeze(['decision_clinica', 'derivacion', 'fallecimiento', 'otro']);
export const MODES = Object.freeze(['real', 'simulacion']);
export const BOX_KINDS = Object.freeze(['cpr', 'rhythm', 'shock', 'rosc_check']);
