// Guideline profile checks. A profile is clinical data transcribed from the
// author's source file (content/rcp/*.json ← borradores/*.md). The engine
// refuses a profile that is incomplete, inconsistent or still carries a
// "[REVISAR]" marker, so an unresolved item can never reach a screen. Missing
// data is an error, never a default.

import { EVENT_TYPES, RHYTHMS, BOX_KINDS } from './constants.js';

/** @typedef {import('./types.js').GuidelineProfile} GuidelineProfile */

export class ProfileError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ProfileError';
  }
}

const REQUIRED_MESSAGES = ['start', 'preAlert', 'checkRhythm', 'shockable', 'postShock', 'nonShockable', 'roscCheck', 'roscConfirmed'];
const usable = new WeakSet();

const isObject = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const isText = v => typeof v === 'string' && v.trim() !== '';
const isSeconds = v => Number.isFinite(v) && v >= 0;
const fail = message => { throw new ProfileError(message); };

function checkMessage(msg, where) {
  if (!isObject(msg) || !isText(msg.screen) || !isText(msg.voice)) fail(`Perfil incompleto: falta el texto de pantalla y voz de ${where}.`);
}

function checkBoxList(list, boxes, where) {
  if (!Array.isArray(list) || list.length === 0 || !list.every(id => isText(id) && boxes[id])) {
    fail(`${where}: lista de Box inválida.`);
  }
}

function checkAlgorithm(algorithm) {
  if (!isObject(algorithm) || !isObject(algorithm.boxes)) fail('Perfil incompleto: falta el algoritmo.');
  const { boxes } = algorithm;
  const kindOf = id => (boxes[id] ? boxes[id].kind : null);
  if (kindOf(algorithm.start) !== 'cpr') fail('El algoritmo debe empezar en un Box de RCP.');

  for (const [id, box] of Object.entries(boxes)) {
    const where = `Box ${id}`;
    if (!isObject(box) || !BOX_KINDS.includes(box.kind)) fail(`${where}: tipo desconocido.`);
    if (!Array.isArray(box.actions) || box.actions.length === 0) fail(`${where}: sin acciones.`);
    for (const a of box.actions) {
      if (!isObject(a) || !isText(a.text)) fail(`${where}: acción sin texto.`);
      if (a.doneWhen !== undefined &&
          (!Array.isArray(a.doneWhen) || a.doneWhen.length === 0 || !a.doneWhen.every(t => EVENT_TYPES.includes(t)))) {
        fail(`${where}: "doneWhen" inválido en "${a.text}".`);
      }
    }
    if (box.kind === 'cpr') {
      if (typeof box.timed !== 'boolean') fail(`${where}: falta indicar si el ciclo es cronometrado.`);
      if (!isObject(box.onRhythm)) fail(`${where}: falta adónde sigue después de evaluar el ritmo.`);
      // Desfibrilable → a shock Box, directly or through one rhythm Box.
      let d = box.onRhythm.shockable;
      if (kindOf(d) === 'rhythm') d = boxes[d].next;
      if (kindOf(d) !== 'shock') fail(`${where}: la salida desfibrilable no llega a un Box de descarga.`);
      // No desfibrilable → a rhythm Box, a RCP Box or the ROSC question.
      const nd = box.onRhythm.non_shockable;
      if (!['rhythm', 'cpr', 'rosc_check'].includes(kindOf(nd))) fail(`${where}: salida no desfibrilable inválida.`);
      if (kindOf(nd) === 'rhythm' && kindOf(boxes[nd].next) !== 'cpr') fail(`Box ${nd}: debe seguir a un Box de RCP.`);
    }
    if (box.kind === 'rhythm' && !['shock', 'cpr'].includes(kindOf(box.next))) fail(`${where}: "next" inválido.`);
    if (box.kind === 'shock' && kindOf(box.next) !== 'cpr') fail(`${where}: después de la descarga debe seguir un Box de RCP.`);
    if (box.kind === 'rosc_check') {
      if (kindOf(box.noRosc) !== 'cpr') fail(`${where}: "sin ROSC" debe llevar a un Box de RCP.`);
      if (!isText(box.yesLabel) || !isText(box.noLabel)) fail(`${where}: faltan los textos de los botones.`);
    }
  }
}

function checkMedications(profile) {
  const { boxes } = profile.algorithm;
  if (!Array.isArray(profile.medications) || profile.medications.length === 0) fail('Perfil incompleto: falta la lista de drogas.');
  const groups = Array.isArray(profile.medicationGroups) ? profile.medicationGroups : fail('Perfil incompleto: falta "medicationGroups" (puede ser una lista vacía).');
  const groupIds = new Set(groups.map(g => g && g.id));
  const ids = new Set();

  for (const med of profile.medications) {
    if (!isObject(med) || !isText(med.id) || !isText(med.name)) fail('Perfil incompleto: una droga no tiene id o nombre.');
    const where = `"${med.name}"`;
    if (med.id === 'otra') fail('"otra" está reservado para drogas fuera del perfil.');
    if (ids.has(med.id)) fail(`Droga repetida en el perfil: "${med.id}".`);
    ids.add(med.id);
    if (!Array.isArray(med.doses) || med.doses.length === 0) fail(`Perfil incompleto: ${where} no tiene dosis.`);
    for (const d of med.doses) {
      if (!isObject(d) || !isText(d.amount) || !isText(d.route)) fail(`Perfil incompleto: ${where} tiene una dosis sin cantidad o vía.`);
      if (d.perKg !== undefined && (!isObject(d.perKg) || !isSeconds(d.perKg.min) || !isSeconds(d.perKg.max) ||
          d.perKg.min > d.perKg.max || !isText(d.perKg.unit))) {
        fail(`${where}: dosis por kg inválida.`);
      }
    }
    if (!('maxDoses' in med)) fail(`${where}: falta "maxDoses" (usar null si no tiene límite).`);
    if (med.maxDoses !== null && !(Number.isInteger(med.maxDoses) && med.maxDoses > 0)) fail(`${where}: maxDoses debe ser un entero positivo o null.`);
    if (med.intervalSec !== undefined) {
      const iv = med.intervalSec;
      if (!isObject(iv) || !isSeconds(iv.min) || !isSeconds(iv.max) || iv.min > iv.max) fail(`${where}: intervalo inválido.`);
      const w = med.windowTexts;
      if (!isObject(w) || !isText(w.before) || !isText(w.open) || !isText(w.late)) fail(`${where}: faltan los textos de la ventana.`);
    }
    if (med.firstDose !== undefined) {
      if (!isObject(med.firstDose) || Object.keys(med.firstDose).some(k => k !== 'afterVisiting')) fail(`${where}: "firstDose" inválido.`);
      checkBoxList(med.firstDose.afterVisiting, boxes, `${where} firstDose.afterVisiting`);
      checkMessage(med.message, where);
    }
    if (med.group !== undefined && !groupIds.has(med.group)) fail(`${where}: grupo desconocido "${med.group}".`);
  }

  for (const g of groups) {
    if (!isObject(g) || !isText(g.id) || !isText(g.label)) fail('Perfil incompleto: un grupo de drogas no tiene id o nombre.');
    const where = `Grupo "${g.label}"`;
    if (!Array.isArray(g.drugs) || g.drugs.length === 0 ||
        !g.drugs.every(id => profile.medications.some(m => m.id === id && m.group === g.id))) {
      fail(`${where}: sus drogas deben existir y declarar el grupo.`);
    }
    if (!(Number.isInteger(g.maxDoses) && g.maxDoses > 0)) fail(`${where}: maxDoses debe ser un entero positivo.`);
    if (!isObject(g.firstDose) || Object.keys(g.firstDose).some(k => k !== 'atBox')) fail(`${where}: "firstDose" inválido.`);
    checkBoxList(g.firstDose.atBox, boxes, `${where} firstDose.atBox`);
    if (g.nextDose !== undefined) {
      if (!isObject(g.nextDose) || Object.keys(g.nextDose).some(k => !['atBox', 'laterPass'].includes(k)) ||
          typeof g.nextDose.laterPass !== 'boolean') {
        fail(`${where}: "nextDose" inválido.`);
      }
      checkBoxList(g.nextDose.atBox, boxes, `${where} nextDose.atBox`);
    }
    if (g.preferChosen !== undefined && typeof g.preferChosen !== 'boolean') fail(`${where}: "preferChosen" debe ser true o false.`);
    checkMessage(g.message, where);
    // With preferChosen, the next dose names the chosen drug: each drug needs its own text.
    if (g.preferChosen || g.chosenMessages !== undefined) {
      if (!isObject(g.chosenMessages)) fail(`${where}: faltan los textos para la droga elegida.`);
      for (const id of g.drugs) checkMessage(g.chosenMessages[id], `${where} (${id} elegida)`);
      if (Object.keys(g.chosenMessages).some(id => !g.drugs.includes(id))) fail(`${where}: texto para una droga que no es del grupo.`);
    }
  }

  for (const [id, box] of Object.entries(boxes)) {
    for (const a of box.actions) {
      if (a.hideWhenGroupExhausted !== undefined && !groupIds.has(a.hideWhenGroupExhausted)) {
        fail(`Box ${id}: "hideWhenGroupExhausted" apunta a un grupo que no existe.`);
      }
    }
  }
}

/**
 * Throws ProfileError unless `profile` is complete, consistent and has no
 * "[REVISAR]" marker. Results are cached per profile object.
 * @param {GuidelineProfile} profile
 */
export function assertProfileUsable(profile) {
  if (usable.has(profile)) return;
  if (!isObject(profile)) fail('Falta el perfil clínico.');
  if (/\[\s*revisar/i.test(JSON.stringify(profile))) {
    fail('El perfil contiene [REVISAR]: no se puede usar hasta que el autor lo resuelva.');
  }
  for (const key of ['id', 'name', 'version', 'source', 'validatedBy']) {
    if (!isText(profile[key])) fail(`Perfil incompleto: falta "${key}".`);
  }
  const { cycle } = profile;
  if (!isObject(cycle) || !isSeconds(cycle.durationSec) || cycle.durationSec <= 0) fail('Perfil incompleto: falta la duración del ciclo.');
  if (!isSeconds(cycle.preAlertSec) || cycle.preAlertSec >= cycle.durationSec) {
    fail('Perfil incompleto: el preaviso debe ser menor que la duración del ciclo.');
  }
  if (!isObject(profile.rhythms) || !RHYTHMS.every(r => isText(profile.rhythms[r]))) fail('Perfil incompleto: faltan los nombres de los ritmos.');

  checkAlgorithm(profile.algorithm);
  checkMedications(profile);

  const v = profile.ventilation;
  if (!isObject(v) || !isText(v.withoutAirway) || !isText(v.withAirway)) fail('Perfil incompleto: faltan los textos de ventilación.');
  const va = profile.vascularAccess;
  if (!isObject(va) || !Array.isArray(va.routes) || va.routes.length === 0 || !va.routes.every(isText)) {
    fail('Perfil incompleto: faltan las vías de acceso vascular.');
  }
  if (!Array.isArray(profile.reversibleCauses) || profile.reversibleCauses.length === 0 ||
      !profile.reversibleCauses.every(c => isObject(c) && isText(c.id) && isText(c.label))) {
    fail('Perfil incompleto: falta la lista de causas reversibles.');
  }
  if (!isObject(profile.messages)) fail('Perfil incompleto: faltan los textos de pantalla y voz.');
  for (const key of REQUIRED_MESSAGES) checkMessage(profile.messages[key], `"${key}"`);

  usable.add(profile);
}

/**
 * "AHA Adulto · 2025" — always shown on screen.
 * @param {{name: string, version: string}} profile
 */
export function profileLabel(profile) {
  return `${profile.name} · ${profile.version}`;
}

/**
 * Throws unless `profile` is the exact profile (id and version) the session
 * was run with. Sessions are never continued with a different profile.
 * @param {import('./types.js').ResuscitationSession} session
 * @param {GuidelineProfile} profile
 */
export function assertSameProfile(session, profile) {
  if (session.profile.id !== profile.id || session.profile.version !== profile.version) {
    fail(`La sesión se inició con ${profileLabel(session.profile)} y no puede continuar con ${profileLabel(profile)}.`);
  }
}
