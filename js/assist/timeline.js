// Timed-protocol engine: pure functions, no DOM and no clock of its own (every
// call receives "now" in ms). A protocol (content/assist/<id>.json) is a list
// of steps; each one becomes due either at a fixed minute from the start
// ("atMin") or a number of minutes after another step was done ("after" +
// "afterMin"). js/assist/view.js draws it. The RCP assistant (js/rcp/) is a
// separate, richer engine; this one is for simple "do X, then Y at 20 min"
// protocols embedded in a content module.
//
// Step fields: id, label, detail?, noteText?, atMin? | (after, afterMin),
//              graceMin?, skippable?
//   graceMin:  minutes past the due time before the step counts as overdue
//              (default: protocol.graceMin, else 5)
//   skippable: the step may be marked "not indicated" for this patient
//              (skip()); it then counts as resolved and goes to its own line
//              in the note, never under "Pendiente"

/** @returns {{protocolId: string, startedAt: number, done: Record<string, number>, skipped: Record<string, number>}} */
export function createSession(protocol, nowMs) {
  return { protocolId: protocol.id, startedAt: nowMs, done: {}, skipped: {} };
}

// Sessions stored before skip() existed have no "skipped" field.
const skippedOf = session => session.skipped || {};

function without(record, key) {
  if (record[key] === undefined) return record;
  const copy = { ...record };
  delete copy[key];
  return copy;
}

/**
 * Marks a step as done at `nowMs`; returns a new session. Unknown or
 * already-done steps are ignored. A skipped step stops being skipped.
 */
export function markDone(protocol, session, stepId, nowMs) {
  if (!protocol.steps.some(s => s.id === stepId) || session.done[stepId] !== undefined) return session;
  return { ...session, done: { ...session.done, [stepId]: nowMs }, skipped: without(skippedOf(session), stepId) };
}

/**
 * Marks a step as not indicated at `nowMs`; returns a new session. Only for
 * an existing step with "skippable": true that is neither done nor skipped.
 */
export function skip(protocol, session, stepId, nowMs) {
  const step = protocol.steps.find(s => s.id === stepId);
  const skipped = skippedOf(session);
  if (!step || !step.skippable || session.done[stepId] !== undefined || skipped[stepId] !== undefined) return session;
  return { ...session, skipped: { ...skipped, [stepId]: nowMs } };
}

/** Undoes a step, done or skipped (a mis-tap); returns a new session. */
export function unmark(session, stepId) {
  const skipped = skippedOf(session);
  if (session.done[stepId] === undefined && skipped[stepId] === undefined) return session;
  return { ...session, done: without(session.done, stepId), skipped: without(skipped, stepId) };
}

const minutes = ms => ms / 60000;

/**
 * State of every step at `nowMs`:
 *   done     marked; doneAtMin = minute it was marked
 *   skipped  marked as not indicated; skippedAtMin = minute it was marked
 *   waiting  depends on a step that isn't done yet (no due time); a skipped
 *            prerequisite doesn't start the clock either
 *   upcoming due in the future; inMin = minutes left
 *   due      due now (within its grace period)
 *   overdue  past its grace period; lateMin = minutes past the due time
 * complete: every step is done or skipped.
 */
export function status(protocol, session, nowMs) {
  const elapsedMin = minutes(nowMs - session.startedAt);
  const skipped = skippedOf(session);
  const steps = protocol.steps.map(step => {
    const base = { id: step.id, label: step.label, detail: step.detail || '', skippable: Boolean(step.skippable) };
    if (session.done[step.id] !== undefined) {
      return { ...base, state: 'done', doneAtMin: minutes(session.done[step.id] - session.startedAt) };
    }
    if (skipped[step.id] !== undefined) {
      return { ...base, state: 'skipped', skippedAtMin: minutes(skipped[step.id] - session.startedAt) };
    }
    let dueAtMin;
    if (step.after) {
      const prev = session.done[step.after];
      if (prev === undefined) return { ...base, state: 'waiting' };
      dueAtMin = minutes(prev - session.startedAt) + (step.afterMin || 0);
    } else {
      dueAtMin = step.atMin || 0;
    }
    const grace = step.graceMin ?? protocol.graceMin ?? 5;
    if (elapsedMin < dueAtMin) return { ...base, state: 'upcoming', dueAtMin, inMin: dueAtMin - elapsedMin };
    if (elapsedMin <= dueAtMin + grace) return { ...base, state: 'due', dueAtMin };
    return { ...base, state: 'overdue', dueAtMin, lateMin: elapsedMin - dueAtMin };
  });
  return { elapsedMin, steps, complete: steps.every(s => s.state === 'done' || s.state === 'skipped') };
}

/** mm:ss for a number of minutes (may be fractional). */
export function clock(min) {
  const total = Math.max(0, Math.floor(min * 60));
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

/**
 * Plain-text record for the clinical note: start time, then each done step in
 * the order it happened, with the minute from the start; then the steps marked
 * as not indicated ("No indicado") and what is still pending.
 * @param {(ms: number) => string} formatTime wall-clock formatter (HH:MM)
 */
export function note(protocol, session, formatTime) {
  const skipped = skippedOf(session);
  const lines = [`${protocol.title} — inicio ${formatTime(session.startedAt)}`];
  const done = protocol.steps
    .filter(s => session.done[s.id] !== undefined)
    .sort((a, b) => session.done[a.id] - session.done[b.id]);
  for (const s of done) {
    const min = Math.round(minutes(session.done[s.id] - session.startedAt));
    lines.push(`${formatTime(session.done[s.id])} (min ${min}): ${s.noteText || s.label}`);
  }
  const open = protocol.steps.filter(s => session.done[s.id] === undefined);
  const notIndicated = open.filter(s => skipped[s.id] !== undefined).map(s => s.label);
  if (notIndicated.length) lines.push(`No indicado: ${notIndicated.join('; ')}`);
  const pending = open.filter(s => skipped[s.id] === undefined).map(s => s.label);
  if (pending.length) lines.push(`Pendiente: ${pending.join('; ')}`);
  return lines.join('\n');
}
