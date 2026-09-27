// Clinical note built from the profile's template (noteTemplate) and the
// event log only — no AI, nothing that isn't recorded. Each template line is
// used only when its data exist; voided events are left out and edited times
// are used. Pure: no DOM, no clock (times are formatted from the events).
//
// Template conventions (from the author's source file, §10):
// - "Por cada droga:" means one sentence per drug; administrations with the
//   same drug, dose and route are grouped into one sentence.
// - "Cierre con ROSC:" / "Cierre sin ROSC:" label which closing sentence
//   applies; the label itself isn't written.
// - "{a | b}" chooses between alternatives; "{; …}" is an optional part.

import { summarize } from './status.js';

/** @typedef {import('./types.js').ResuscitationSession} ResuscitationSession */
/** @typedef {import('./types.js').GuidelineProfile} GuidelineProfile */

// Stop reasons as the request's flow names them (prompt-rcp.md §6).
export const STOP_REASON_LABELS = Object.freeze({
  decision_clinica: 'Decisión clínica',
  derivacion: 'Derivación',
  fallecimiento: 'Fallecimiento',
  otro: 'Otro',
});

const live = e => !e.data.voided;
const byTime = (a, b) => a.at - b.at || a.seq - b.seq;

/** "HH:MM" in the device's time zone (or the one given, for tests). */
export function formatClock(ms, timeZone) {
  return new Date(ms).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone });
}

/** "12 min 5 s" / "45 s". */
export function formatDuration(ms) {
  const total = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return m ? `${m} min ${s} s` : `${s} s`;
}

const stripLabel = (line, label) => (line.startsWith(label) ? line.slice(label.length) : line);
const fill = (line, values) => line.replace(/\{(hora_inicio|hora_rosc|hora_fin|hora|horas|n|droga|dosis|vía|lista|motivo|duración|texto \(hora\))\}/g, (_, k) => values[k]);

/**
 * @param {ResuscitationSession} session
 * @param {GuidelineProfile} profile
 * @param {{timeZone?: string}} [options]
 * @returns {string}
 */
export function buildNote(session, profile, { timeZone } = {}) {
  const L = profile.noteTemplate.lines;
  const clock = ms => formatClock(ms, timeZone);
  const events = session.events.filter(live).sort(byTime);
  const of = type => events.filter(e => e.type === type);
  const out = [];
  const start = of('CPR_STARTED')[0];
  if (!start) return '';
  const sum = summarize(session, profile, start.at);

  out.push(fill(L[0], { hora_inicio: clock(start.at) }));

  const firstRhythm = of('RHYTHM_CHECK')[0];
  if (firstRhythm) {
    out.push(L[1].replace(/\{([^{}]*\|[^{}]*)\}/, (_, alt) => {
      const [shockable, nonShockable] = alt.split('|').map(x => x.trim());
      return firstRhythm.data.rhythm === 'shockable' ? shockable : nonShockable;
    }));
  }

  const shocks = of('SHOCK_DELIVERED');
  if (shocks.length) out.push(fill(L[2], { n: shocks.length, horas: shocks.map(e => clock(e.at)).join(', ') }));

  const drugLine = stripLabel(L[3], 'Por cada droga: ');
  const groups = new Map();
  for (const e of of('MEDICATION_GIVEN')) {
    const key = [e.data.name.toLocaleLowerCase('es'), e.data.dose, e.data.route].join('\u0000');
    if (!groups.has(key)) groups.set(key, { ...e.data, times: [] });
    groups.get(key).times.push(e.at);
  }
  for (const g of groups.values()) {
    out.push(fill(drugLine, { droga: g.name, dosis: g.dose, 'vía': g.route, n: g.times.length, horas: g.times.map(clock).join(', ') }));
  }

  // "Se coloca vía aérea avanzada a las {hora}. Se monitorea con capnografía{; EtCO₂ …}."
  const [airwaySentence, capnoSentence] = L[4].split(/(?<=\.) (?=Se monitorea)/);
  const airway = of('AIRWAY_PLACED')[0];
  if (airway) out.push(fill(airwaySentence, { hora: clock(airway.at) }));
  if (of('CAPNOGRAPHY_STARTED').length) {
    const etco2 = of('ETCO2_VALUE');
    out.push(capnoSentence.replace(/\{([^{}]*)\}/, (_, optional) => {
      if (!etco2.length) return '';
      const values = etco2.map(e => `${e.data.value} ${e.data.unit} (${clock(e.at)})`).join(', ');
      return optional.replace('valor (hora)', values);
    }));
  }

  const causes = of('REVERSIBLE_CAUSE_IDENTIFIED');
  if (causes.length) out.push(fill(L[5], { lista: [...new Set(causes.map(e => e.data.label))].join(', ') }));

  const others = of('OTHER');
  if (others.length) out.push(fill(L[6], { 'texto (hora)': others.map(e => `${e.data.text} (${clock(e.at)})`).join('; ') }));

  if (sum.rosc.confirmed) {
    out.push(fill(stripLabel(L[7], 'Cierre con ROSC: '), { hora_rosc: clock(sum.rosc.at), 'duración': formatDuration(sum.durationMs), n: sum.cycles }));
  } else if (sum.stop) {
    const label = STOP_REASON_LABELS[sum.stop.reason].toLocaleLowerCase('es');
    const reason = sum.stop.reason === 'otro' && sum.stop.detail ? sum.stop.detail
      : sum.stop.detail ? `${label}: ${sum.stop.detail}` : label;
    out.push(fill(stripLabel(L[8], 'Cierre sin ROSC: '), { hora_fin: clock(sum.stop.at), motivo: reason, 'duración': formatDuration(sum.durationMs) }));
  }

  out.push(L[9]);
  return out.join('\n');
}
