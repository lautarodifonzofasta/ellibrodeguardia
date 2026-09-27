// JSDoc type definitions for the resuscitation assistant (no runtime code).
// Layers: GuidelineProfile (clinical data, content/rcp/*.json, transcribed
// from borradores/*.md) → engine.js (state machine) → ResuscitationSession
// (event log) → storage.js → UI. All times are epoch milliseconds; elapsed
// time is always now − event time.

/**
 * @typedef {'IDLE'|'CPR_ACTIVE'|'RHYTHM_CHECK'|'SHOCKABLE'|'POST_SHOCK'|'NON_SHOCKABLE'|'ROSC'|'ENDED'} ResuscitationState
 */

/**
 * @typedef {'CPR_STARTED'|'CPR_PAUSED'|'CPR_RESUMED'|'RHYTHM_CHECK'|'SHOCK_DELIVERED'|'MEDICATION_GIVEN'
 *   |'VASCULAR_ACCESS'|'AIRWAY_PLACED'|'CAPNOGRAPHY_STARTED'|'ETCO2_VALUE'|'REVERSIBLE_CAUSE_IDENTIFIED'
 *   |'ROSC_CONFIRMED'|'CPR_STOPPED'|'OTHER'} ResuscitationEventType
 */

/**
 * One previous version of an edited event, kept so no correction is silent.
 * A field that didn't exist before the edit is recorded as null (false for
 * "voided"), so the record survives JSON.
 * @typedef {object} EventEdit
 * @property {number} editedAt
 * @property {{at?: number, data?: object}} previous  Only the fields that changed, with their old values.
 */

/**
 * @typedef {object} ResuscitationEvent
 * @property {string} id         Stable id ("ev1", "ev2", …).
 * @property {number} seq        Recording order; tie-breaker when two events share a time.
 * @property {ResuscitationEventType} type
 * @property {number} at         When it happened (editable).
 * @property {number} recordedAt When it was recorded (never edited).
 * @property {number} cycle      CPR cycle in force after the action.
 * @property {string} box        Algorithm Box in force after the action.
 * @property {number} boxPass    Which pass through its Box this is (1 = first time the algorithm reached it).
 * @property {object} data       Type-specific payload (see RhythmCheck, ShockEvent, MedicationAdministration).
 * @property {boolean} [edited]
 * @property {EventEdit[]} [edits]
 */

/**
 * RHYTHM_CHECK payload.
 * @typedef {object} RhythmCheck
 * @property {'shockable'|'non_shockable'} rhythm
 * @property {string} fromBox  Box where the rhythm was checked.
 * @property {string} [via]    Rhythm Box passed through on the way to a shock Box.
 */

/**
 * SHOCK_DELIVERED payload (the Box is on the event). The shock number is
 * derived from the log (chronological order of non-voided shocks).
 * @typedef {object} ShockEvent
 * @property {boolean} [voided]  Set only through an audited edit.
 */

/**
 * MEDICATION_GIVEN payload: exactly what the user confirmed. The dose number
 * is derived from the log (chronological order per drug).
 * @typedef {object} MedicationAdministration
 * @property {string} drugId   A profile medication id, or "otra".
 * @property {string} name
 * @property {string} dose
 * @property {string} route
 * @property {boolean} [voided]
 */

/**
 * @typedef {object} ResuscitationSession
 * @property {number} schemaVersion
 * @property {string} id
 * @property {'real'|'simulacion'} mode  Stored under a separate key per mode.
 * @property {{id: string, version: string, name: string}} profile  The profile this session runs with; never mixed.
 * @property {number} createdAt
 * @property {ResuscitationState} state
 * @property {number} cycle      Current cycle number (0 before starting).
 * @property {string|null} box   Current algorithm Box (null before starting).
 * @property {Object<string, number>} boxPasses  Passes per Box so far; only advances when the algorithm moves into a Box.
 * @property {number} nextSeq
 * @property {ResuscitationEvent[]} events  Append-only log (edits are recorded on the event).
 */

/**
 * One dose step. Dose k uses doses[min(k, doses.length) − 1].
 * @typedef {object} MedicationDose
 * @property {string} amount
 * @property {string} route
 * @property {{min: number, max: number, unit: string}} [perKg]  Weight-based range, for the dose calculator.
 */

/**
 * @typedef {object} MedicationDefinition
 * @property {string} id
 * @property {string} name
 * @property {MedicationDose[]} doses
 * @property {number|null} maxDoses  Required; null = no limit.
 * @property {{min: number, max: number}} [intervalSec]  Repeat window after the previous dose.
 * @property {{before: string, open: string, late: string}} [windowTexts]  Required with intervalSec.
 * @property {{afterVisiting: string[]}} [firstDose]  First dose indicated once any of these Boxes was reached.
 * @property {{screen: string, voice: string}} [message]  Required with firstDose.
 * @property {string} [group]  Medication group id (e.g. antiarrhythmic).
 */

/**
 * Drugs that are alternatives to each other (e.g. amiodarona o lidocaína).
 * @typedef {object} MedicationGroup
 * @property {string} id
 * @property {string} label
 * @property {string[]} drugs
 * @property {number} maxDoses
 * @property {{atBox: string[]}} firstDose
 * @property {{atBox: string[], laterPass: boolean}} [nextDose]
 * @property {boolean} [preferChosen]  After the first dose, suggest the same drug.
 * @property {{screen: string, voice: string}} message
 */

/**
 * @typedef {object} AlgorithmBox
 * @property {'cpr'|'rhythm'|'shock'|'rosc_check'} kind
 * @property {{text: string, doneWhen?: ResuscitationEventType[]}[]} actions  Reminders; "doneWhen" hides one once registered.
 * @property {boolean} [timed]  cpr: whether the cycle has an end-of-cycle alert.
 * @property {{shockable: string, non_shockable: string}} [onRhythm]  cpr: next Box after a rhythm check.
 * @property {string} [next]    rhythm / shock: next Box.
 * @property {string} [noRosc]  rosc_check: Box when there are no signs of ROSC.
 */

/**
 * @typedef {object} GuidelineProfile
 * @property {string} id
 * @property {string} name        Shown on screen, e.g. "AHA Adulto".
 * @property {string} version     Shown on screen, e.g. "2025".
 * @property {string} source
 * @property {string} validatedBy
 * @property {{durationSec: number, preAlertSec: number}} cycle
 * @property {{shockable: string, non_shockable: string}} rhythms
 * @property {{start: string, boxes: Object<string, AlgorithmBox>}} algorithm
 * @property {{withoutAirway: string, withAirway: string}} ventilation
 * @property {{routes: string[], note?: string}} vascularAccess
 * @property {MedicationDefinition[]} medications
 * @property {MedicationGroup[]} medicationGroups
 * @property {{id: string, label: string}[]} reversibleCauses
 * @property {Object<string, {screen: string, voice: string}>} messages  Every on-screen or spoken text that indicates a conduct.
 */

export {};
