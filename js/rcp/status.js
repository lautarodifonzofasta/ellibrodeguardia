// Everything time-dependent, derived from the event log and `now` (epoch ms).
// Nothing here is stored: clocks, alerts, pauses, shock and dose numbers,
// medication windows, the current Box's reminders and the profile's
// indications are recomputed on every call, so a reload, a locked screen or
// an edited event can never leave them stale. Pure, no DOM.
//
// Indications only reflect the profile's rules ("corresponde adrenalina");
// they never record or imply that anything was done.

import { STATES, ACTIVE_STATES } from './constants.js';
import { assertProfileUsable, assertSameProfile, profileLabel } from './profile.js';
import { normalizeName } from './engine.js';

/** @typedef {import('./types.js').ResuscitationSession} ResuscitationSession */
/** @typedef {import('./types.js').GuidelineProfile} GuidelineProfile */

const S = STATES;
const REMINDER_STATES = [S.CPR_ACTIVE, S.RHYTHM_CHECK, S.SHOCKABLE, S.NON_SHOCKABLE];

const byTime = (a, b) => a.at - b.at || a.seq - b.seq;
const live = e => !e.data.voided;
const ofType = (session, type) => session.events.filter(e => e.type === type);
const lastBySeq = events => events.reduce((last, e) => (!last || e.seq > last.seq ? e : last), null);

function startEvent(session) {
  return ofType(session, 'CPR_STARTED')[0] || null;
}

function endEvent(session) {
  return session.events.find(e => e.type === 'ROSC_CONFIRMED' || e.type === 'CPR_STOPPED') || null;
}

/**
 * Every event in chronological order (by `at`, then recording order), with
 * its offset from CPR_STARTED.
 * @param {ResuscitationSession} session
 */
export function chronology(session) {
  const start = startEvent(session);
  return [...session.events].sort(byTime).map(e => ({ ...e, offsetMs: start ? e.at - start.at : null }));
}

/**
 * Pauses in compressions: each CPR_PAUSED is closed by the next event (in
 * recording order) that resumes or ends CPR. Only pauses closed by resuming
 * count toward max/total — a pause ended by ROSC or by stopping CPR is not a
 * gap in compressions. The ongoing pause, if any, counts while it lasts.
 * @param {ResuscitationSession} session
 * @param {number} now
 */
export function pauseStats(session, now) {
  const list = [];
  let open = null;
  for (const e of [...session.events].sort((a, b) => a.seq - b.seq)) {
    if (e.type === 'CPR_PAUSED' && !open) {
      open = { startAt: e.at, cycle: e.cycle };
    } else if (open && (e.type === 'CPR_RESUMED' || e.type === 'ROSC_CONFIRMED' || e.type === 'CPR_STOPPED')) {
      list.push({ ...open, endAt: e.at, ms: Math.max(0, e.at - open.startAt), endedBy: e.type });
      open = null;
    }
  }
  const current = open ? { ...open, ms: Math.max(0, now - open.startAt) } : null;
  const counted = list.filter(p => p.endedBy === 'CPR_RESUMED').map(p => p.ms);
  if (current) counted.push(current.ms);
  return {
    list,
    current,
    count: counted.length,
    maxMs: counted.length ? Math.max(...counted) : 0,
    totalMs: counted.reduce((sum, ms) => sum + ms, 0),
  };
}

/**
 * When the current cycle's clock stops: at the first pause after the cycle
 * started that wasn't cancelled back into the same cycle, else at `clockAt`.
 */
function cycleStopAt(session, cycleStart, clockAt) {
  let pausedAt = null;
  for (const e of session.events.filter(e => e.seq > cycleStart.seq).sort((a, b) => a.seq - b.seq)) {
    if (e.type === 'CPR_PAUSED') pausedAt = e.at;
    else if (e.type === 'CPR_RESUMED' && !e.data.newCycle) pausedAt = null;
  }
  return pausedAt ?? clockAt;
}

function doseList(events) {
  return events.map((e, i) => ({
    number: i + 1, at: e.at, cycle: e.cycle, box: e.box, boxPass: e.boxPass,
    dose: e.data.dose, route: e.data.route, drugId: e.data.drugId, eventId: e.id, edited: !!e.edited,
  }));
}

/** Drug windows and next doses; off-profile ("otra") drugs grouped by normalized name. */
function medicationStatus(session, profile, clockAt) {
  const given = ofType(session, 'MEDICATION_GIVEN').filter(live).sort(byTime);
  const profileIds = new Set(profile.medications.map(m => m.id));

  const inProfile = profile.medications.map(def => {
    const doses = doseList(given.filter(e => e.data.drugId === def.id));
    const last = doses[doses.length - 1] || null;
    const exhausted = def.maxDoses != null && doses.length >= def.maxDoses;
    // The group's own limit (e.g. two antiarrhythmic doses in total): nothing
    // more is suggested, but registering is never blocked.
    const group = def.group ? profile.medicationGroups.find(g => g.id === def.group) : null;
    const groupExhausted = !!group && given.filter(e => group.drugs.includes(e.data.drugId)).length >= group.maxDoses;
    const nextDoseNumber = doses.length + 1;
    let window = null;
    let windowState = 'none';
    if (last && def.intervalSec && !exhausted) {
      window = { fromAt: last.at + def.intervalSec.min * 1000, toAt: last.at + def.intervalSec.max * 1000 };
      windowState = clockAt < window.fromAt ? 'before' : clockAt <= window.toAt ? 'open' : 'late';
    }
    return {
      drugId: def.id,
      name: def.name,
      group: def.group || null,
      doses,
      count: doses.length,
      lastAt: last ? last.at : null,
      sinceLastMs: last ? Math.max(0, clockAt - last.at) : null,
      nextDoseNumber,
      nextDose: exhausted ? null : def.doses[Math.min(nextDoseNumber, def.doses.length) - 1],
      window,
      windowState,
      windowText: windowState === 'none' ? null : def.windowTexts[windowState],
      exhausted,
      groupExhausted,
    };
  });

  const groups = new Map();
  for (const e of given.filter(e => !profileIds.has(e.data.drugId))) {
    const key = normalizeName(e.data.name).toLocaleLowerCase('es');
    if (!groups.has(key)) groups.set(key, { name: normalizeName(e.data.name), events: [] });
    groups.get(key).events.push(e);
  }
  const others = [...groups.values()].map(g => {
    const doses = doseList(g.events);
    const last = doses[doses.length - 1];
    return { name: g.name, doses, count: doses.length, lastAt: last.at, sinceLastMs: Math.max(0, clockAt - last.at) };
  });

  return { inProfile, others, given };
}

/**
 * The profile's indications right now (only while CPR is active):
 * - a drug with "firstDose.afterVisiting": its first dose once any listed
 *   Box has been reached; after that, whenever its repeat window is open or
 *   past.
 * - a drug group (e.g. amiodarona o lidocaína): its first dose at a listed
 *   Box; later doses at a listed Box on a later pass than the previous dose;
 *   none after the group's maximum. Once one drug was chosen, it is the one
 *   suggested next ("preferChosen").
 */
function indications(session, profile, meds, visited) {
  if (!ACTIVE_STATES.includes(session.state)) return [];
  const out = [];
  for (const def of profile.medications) {
    if (!def.firstDose) continue;
    const m = meds.inProfile.find(x => x.drugId === def.id);
    if (m.exhausted) continue;
    if (m.count === 0 && def.firstDose.afterVisiting.some(b => visited.has(b))) {
      out.push({ kind: 'drug', drugId: def.id, reason: 'first', doseNumber: 1, dose: m.nextDose, message: def.message });
    } else if (m.count > 0 && (m.windowState === 'open' || m.windowState === 'late')) {
      out.push({ kind: 'drug', drugId: def.id, reason: m.windowState, doseNumber: m.nextDoseNumber, dose: m.nextDose, message: def.message });
    }
  }
  for (const g of profile.medicationGroups) {
    const doses = meds.given.filter(e => g.drugs.includes(e.data.drugId));
    if (doses.length >= g.maxDoses) continue;
    let due = false;
    if (doses.length === 0) {
      due = g.firstDose.atBox.includes(session.box);
    } else if (g.nextDose && g.nextDose.atBox.includes(session.box)) {
      // "On a later pass": a dose given in this Box belongs to that pass; a
      // dose given before reaching it (off-schedule) belongs to the next pass
      // of this Box. The next dose waits for a pass after that one.
      const last = doses[doses.length - 1];
      const passNow = session.boxPasses[session.box] || 0;
      const passAtDose = passesOf(session, session.box, last.seq);
      due = !g.nextDose.laterPass || passNow >= passAtDose + (last.box === session.box ? 1 : 2);
    }
    if (!due) continue;
    const chosen = g.preferChosen && doses.length ? doses[0].data.drugId : null;
    const options = (chosen ? [chosen] : g.drugs).map(id => {
      const m = meds.inProfile.find(x => x.drugId === id);
      return { drugId: id, name: m.name, doseNumber: m.nextDoseNumber, dose: m.nextDose };
    }).filter(o => o.dose);
    const message = chosen ? g.chosenMessages[chosen] : g.message;
    if (options.length) out.push({ kind: 'group', groupId: g.id, label: g.label, doseNumber: doses.length + 1, options, message });
  }
  return out;
}

/** How many passes through `boxId` had started by event `seq`. */
function passesOf(session, boxId, seq) {
  let n = 0;
  for (const e of session.events) if (e.seq <= seq && e.box === boxId && e.boxPass > n) n = e.boxPass;
  return n;
}

/** The main screen/voice text for this moment, taken from the profile. */
function currentPrompt(session, profile, box, alert) {
  const msg = profile.messages;
  switch (session.state) {
    case S.CPR_ACTIVE:
      if (alert) return { key: alert.kind === 'pre_alert' ? 'preAlert' : 'checkRhythm', ...msg[alert.kind === 'pre_alert' ? 'preAlert' : 'checkRhythm'] };
      if (session.box === profile.algorithm.start && session.cycle === 1) return { key: 'start', ...msg.start };
      return null;
    case S.RHYTHM_CHECK: return { key: 'checkRhythm', ...msg.checkRhythm };
    case S.SHOCKABLE: return { key: 'shockable', ...msg.shockable };
    case S.POST_SHOCK: return { key: 'postShock', ...msg.postShock };
    case S.NON_SHOCKABLE:
      return box.kind === 'rosc_check' ? { key: 'roscCheck', ...msg.roscCheck } : { key: 'nonShockable', ...msg.nonShockable };
    case S.ROSC: return { key: 'roscConfirmed', ...msg.roscConfirmed };
    default: return null;
  }
}

/**
 * Snapshot of everything the screen shows, computed from the log and `now`.
 * Refuses a profile that isn't the session's own, or isn't usable.
 * @param {ResuscitationSession} session
 * @param {GuidelineProfile} profile
 * @param {number} now
 */
export function getStatus(session, profile, now) {
  assertProfileUsable(profile);
  assertSameProfile(session, profile);
  const start = startEvent(session);
  const end = endEvent(session);
  const clockAt = end ? end.at : now;

  // Boxes reached so far, including a rhythm Box passed through on the way
  // to a shock ("via").
  const visited = new Set();
  for (const e of session.events) {
    if (e.box) visited.add(e.box);
    if (e.data.via) visited.add(e.data.via);
  }

  const shocks = ofType(session, 'SHOCK_DELIVERED').filter(live).sort(byTime)
    .map((e, i) => ({ number: i + 1, at: e.at, cycle: e.cycle, box: e.box, eventId: e.id, edited: !!e.edited }));
  const rhythmChecks = ofType(session, 'RHYTHM_CHECK').filter(live).sort(byTime)
    .map((e, i) => ({ number: i + 1, at: e.at, cycle: e.cycle, rhythm: e.data.rhythm, fromBox: e.data.fromBox, eventId: e.id, edited: !!e.edited }));
  const lastRhythm = rhythmChecks.length ? rhythmChecks[rhythmChecks.length - 1].rhythm : null;
  const pauses = pauseStats(session, clockAt);
  const done = type => session.events.some(e => e.type === type && live(e));
  const groupExhausted = groupId => {
    const g = profile.medicationGroups.find(x => x.id === groupId);
    return ofType(session, 'MEDICATION_GIVEN').filter(e => live(e) && g.drugs.includes(e.data.drugId)).length >= g.maxDoses;
  };

  const box = session.box ? profile.algorithm.boxes[session.box] : null;
  const lastCheck = lastBySeq(ofType(session, 'RHYTHM_CHECK'));
  const via = lastCheck ? lastCheck.data.via : null;
  const algorithm = box ? {
    box: session.box,
    kind: box.kind,
    timed: box.kind === 'cpr' ? box.timed : null,
    // Reminders to show while the Box is being worked (not once its shock is
    // done or CPR has ended). An action with "doneWhen" disappears once every
    // listed event has been registered, and one with "hideWhenGroupExhausted"
    // once that drug group reached its maximum (profile rules).
    // On the way to a shock, the rhythm Box passed through (e.g. "FV / TV sin
    // pulso") is shown with the shock Box.
    actions: REMINDER_STATES.includes(session.state)
      ? [...(session.state === S.SHOCKABLE && via ? profile.algorithm.boxes[via].actions : []), ...box.actions]
        .filter(a => !(a.doneWhen && a.doneWhen.every(done)) && !(a.hideWhenGroupExhausted && groupExhausted(a.hideWhenGroupExhausted)))
        .map(a => a.text)
      : [],
    // Panels the visible reminders link to (e.g. "Tratar causas reversibles" → causes).
    panels: REMINDER_STATES.includes(session.state)
      ? box.actions.filter(a => a.panel && !(a.doneWhen && a.doneWhen.every(done)) &&
          !(a.hideWhenGroupExhausted && groupExhausted(a.hideWhenGroupExhausted))).map(a => a.panel)
      : [],
    note: box.note || null,
    yesLabel: box.yesLabel || null,
    noLabel: box.noLabel || null,
  } : null;

  // Cycle clock: starts at CPR_STARTED or at a resume that opened a new
  // cycle; it stops (for display) while compressions are paused or once CPR
  // has ended. It never advances the cycle by itself, and a Box that isn't
  // timed (first rhythm check as soon as the monitor is connected) has no
  // end-of-cycle alert.
  const cycleStart = lastBySeq(session.events.filter(e =>
    e.type === 'CPR_STARTED' || (e.type === 'CPR_RESUMED' && e.data.newCycle)));
  const durationMs = profile.cycle.durationSec * 1000;
  const preAlertMs = profile.cycle.preAlertSec * 1000;
  let cycle = null;
  let alert = null;
  let nextEvent = null;
  if (cycleStart) {
    const elapsedMs = Math.max(0, cycleStopAt(session, cycleStart, clockAt) - cycleStart.at);
    const remainingMs = durationMs - elapsedMs;
    // Whether this cycle is timed depends on the Box it started in (e.g. the
    // first cycle in Box 1 isn't), not on where the case is now.
    const timed = profile.algorithm.boxes[cycleStart.box].timed !== false;
    cycle = {
      number: session.cycle,
      startAt: cycleStart.at,
      elapsedMs,
      durationMs: timed ? durationMs : null,
      remainingMs: timed ? remainingMs : null,
      overdueMs: timed ? Math.max(0, -remainingMs) : 0,
    };
    if (session.state === S.CPR_ACTIVE && timed) {
      if (remainingMs <= 0) alert = { kind: 'check_rhythm', overdueMs: cycle.overdueMs };
      else if (remainingMs <= preAlertMs) alert = { kind: 'pre_alert', inMs: remainingMs };
      nextEvent = { kind: 'check_rhythm', inMs: remainingMs };
    }
  }

  const meds = medicationStatus(session, profile, clockAt);
  const advancedAirway = done('AIRWAY_PLACED');

  return {
    state: session.state,
    mode: session.mode,
    profileLabel: profileLabel(session.profile),
    startedAt: start ? start.at : null,
    endedAt: end ? end.at : null,
    totalMs: start ? Math.max(0, clockAt - start.at) : 0,
    // Share of the resuscitation with compressions running: 1 − counted pauses / total.
    compressionFraction: start && clockAt > start.at ? Math.max(0, Math.min(1, 1 - pauses.totalMs / (clockAt - start.at))) : null,
    algorithm,
    prompt: currentPrompt(session, profile, box, alert),
    cycle,
    alert,
    nextEvent,
    pauses,
    shocks,
    rhythmChecks,
    lastRhythm,
    ventilation: { advancedAirway, text: advancedAirway ? profile.ventilation.withAirway : profile.ventilation.withoutAirway },
    medications: { inProfile: meds.inProfile, others: meds.others },
    indications: indications(session, profile, meds, visited),
    vascularAccess: ofType(session, 'VASCULAR_ACCESS').filter(live).sort(byTime).map(e => ({ route: e.data.route, at: e.at, eventId: e.id })),
    reversibleCauses: ofType(session, 'REVERSIBLE_CAUSE_IDENTIFIED').filter(live).sort(byTime)
      .map(e => ({ causeId: e.data.causeId, label: e.data.label, at: e.at, eventId: e.id })),
  };
}

/**
 * End-of-case summary: total duration, cycles, shocks, doses per drug,
 * ROSC yes/no and its time, stop reason, pause metrics.
 * @param {ResuscitationSession} session
 * @param {GuidelineProfile} profile
 * @param {number} now
 */
export function summarize(session, profile, now) {
  const st = getStatus(session, profile, now);
  const rosc = session.events.find(e => e.type === 'ROSC_CONFIRMED') || null;
  const stop = session.events.find(e => e.type === 'CPR_STOPPED') || null;
  return {
    profileLabel: st.profileLabel,
    mode: st.mode,
    startedAt: st.startedAt,
    endedAt: st.endedAt,
    durationMs: st.totalMs,
    cycles: session.cycle,
    shocks: st.shocks.length,
    initialRhythm: st.rhythmChecks.length ? st.rhythmChecks[0].rhythm : null,
    medications: [
      ...st.medications.inProfile.filter(m => m.count).map(m => ({ name: m.name, count: m.count })),
      ...st.medications.others.map(m => ({ name: m.name, count: m.count })),
    ],
    rosc: { confirmed: !!rosc, at: rosc ? rosc.at : null },
    stop: stop ? { reason: stop.data.reason, detail: stop.data.detail || null, at: stop.at } : null,
    pauses: { count: st.pauses.count, maxMs: st.pauses.maxMs, totalMs: st.pauses.totalMs, list: st.pauses.list },
    compressionFraction: st.compressionFraction,
  };
}
