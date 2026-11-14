// Timed-protocol engine: pure functions, no DOM and no clock of its own (every
// call receives "now" in ms). A protocol (content/assist/<id>.json) is a list
// of steps; each one becomes due either at a fixed minute from the start
// ("atMin") or a number of minutes after another step was done ("after" +
// "afterMin"). js/assist/view.js draws it. The RCP assistant (js/rcp/) is a
// separate, richer engine; this one is for simple "do X, then Y at 20 min"
// protocols embedded in a content module.
//
// Step fields: id, label, detail?, atMin? | (after, afterMin), graceMin?
//   graceMin: minutes past the due time before the step counts as overdue
//             (default: protocol.graceMin, else 5)

/** @returns {{protocolId: string, startedAt: number, done: Record<string, number>}} */
export function createSession(protocol, nowMs) {
  return { protocolId: protocol.id, startedAt: nowMs, done: {} };
}

/** Marks a step as done at `nowMs`; returns a new session. Unknown or already-done steps are ignored. */
export function markDone(protocol, session, stepId, nowMs) {
  if (!protocol.steps.some(s => s.id === stepId) || session.done[stepId] !== undefined) return session;
  return { ...session, done: { ...session.done, [stepId]: nowMs } };
}

/** Undoes a step (a mis-tap); returns a new session. */
export function unmark(session, stepId) {
  if (session.done[stepId] === undefined) return session;
  const done = { ...session.done };
  delete done[stepId];
  return { ...session, done };
}

const minutes = ms => ms / 60000;

/**
 * State of every step at `nowMs`:
 *   done     marked; doneAtMin = minute it was marked
 *   waiting  depends on a step that isn't done yet (no due time)
 *   upcoming due in the future; inMin = minutes left
 *   due      due now (within its grace period)
 *   overdue  past its grace period; lateMin = minutes past the due time
 */
export function status(protocol, session, nowMs) {
  const elapsedMin = minutes(nowMs - session.startedAt);
  const steps = protocol.steps.map(step => {
    const base = { id: step.id, label: step.label, detail: step.detail || '' };
    if (session.done[step.id] !== undefined) {
      return { ...base, state: 'done', doneAtMin: minutes(session.done[step.id] - session.startedAt) };
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
  return { elapsedMin, steps, complete: steps.every(s => s.state === 'done') };
}

/** mm:ss for a number of minutes (may be fractional). */
export function clock(min) {
  const total = Math.max(0, Math.floor(min * 60));
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

/**
 * Plain-text record for the clinical note: start time, then each done step in
 * the order it happened, with the minute from the start.
 * @param {(ms: number) => string} formatTime wall-clock formatter (HH:MM)
 */
export function note(protocol, session, formatTime) {
  const lines = [`${protocol.title} — inicio ${formatTime(session.startedAt)}`];
  const done = protocol.steps
    .filter(s => session.done[s.id] !== undefined)
    .sort((a, b) => session.done[a.id] - session.done[b.id]);
  for (const s of done) {
    const min = Math.round(minutes(session.done[s.id] - session.startedAt));
    lines.push(`${formatTime(session.done[s.id])} (min ${min}): ${s.noteText || s.label}`);
  }
  const pending = protocol.steps.filter(s => session.done[s.id] === undefined).map(s => s.label);
  if (pending.length) lines.push(`Pendiente: ${pending.join('; ')}`);
  return lines.join('\n');
}
