// Screens of the resuscitation assistant (view type "rcp"). Only presents
// what engine.js / status.js compute and records what the user confirms:
// every clinical rule and text comes from the profile through the engine.
// The clock is repainted from timestamps (setInterval only repaints); the
// session is saved on every recorded event, so a reload loses nothing.

import { createEngine, isActive, STATES, EDITABLE_DATA } from './engine.js';
import { getStatus, summarize, chronology } from './status.js';
import { saveSession, loadSession, archiveSession, loadArchivedSession } from './storage.js';
import { buildNote, STOP_REASON_LABELS } from './note.js';
import { profileLabel } from './profile.js';

const PROFILE_URL = 'content/rcp/aha-2025-adulto.json';
const MODE = 'real';
const TICK_MS = 250;
const S = STATES;

const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = n => String(n).padStart(2, '0');
function mmss(ms) {
  const t = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(t / 3600);
  return h ? `${h}:${pad(Math.floor(t / 60) % 60)}:${pad(t % 60)}` : `${pad(Math.floor(t / 60))}:${pad(t % 60)}`;
}
const clock = ms => new Date(ms).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
const decimal = n => String(n).replace('.', ',');

// Prompt colour by meaning (visual only; texts come from the profile).
const PROMPT_TONE = {
  start: 'blue', preAlert: 'amber', checkRhythm: 'red', shockable: 'red',
  postShock: 'green', nonShockable: 'blue', roscCheck: 'amber', roscConfirmed: 'green',
};

/**
 * Renders the assistant into `container`. Returns the cleanup the router
 * calls when the user leaves the view (the session itself stays saved).
 * @param {HTMLElement} container
 */
export async function renderRcp(container) {
  container.innerHTML = '<div class="rcp"><div class="rcp-main"></div><div class="rcp-sheet-host"></div></div>';
  const main = container.querySelector('.rcp-main');
  const host = container.querySelector('.rcp-sheet-host');

  let profile = null;
  let rcp = null;
  let loadError = null;
  try {
    const res = await fetch(PROFILE_URL);
    if (!res.ok) throw new Error(`No se pudo cargar el perfil (${res.status}).`);
    profile = await res.json();
    rcp = createEngine(profile);
  } catch (err) {
    loadError = err.message;
  }

  let session = loadSession(MODE);
  let resumed = false;          // an active session found on open waits for "Continuar"
  let showSummary = !!session && !isActive(session);
  let sheet = null;             // { type, ... } — the open panel, if any
  let saveFailed = false;
  let note = null;              // { sessionId, text } — the editable note
  let lastKey = '';
  let flash = '';

  if (session && profile && (session.profile.id !== profile.id || session.profile.version !== profile.version)) {
    loadError = `La RCP guardada se inició con ${profileLabel(session.profile)}; este dispositivo tiene ${profileLabel(profile)}. No se puede continuar con otro perfil.`;
  }

  const status = () => getStatus(session, profile, Date.now());

  function commit(next) {
    if (!next || next === session) return;
    session = next;
    saveFailed = !saveSession(session);
    if (!isActive(session)) showSummary = true;
    renderMain(true);
  }

  /** Runs an engine action; a stale tap (e.g. a double tap) is ignored. */
  function act(fn) {
    try {
      commit(fn());
      return true;
    } catch (err) {
      console.warn('RCP:', err.message);
      if (err.name !== 'TransitionError') { flash = err.message; renderMain(true); }
      return false;
    }
  }

  // ─── Main area ─────────────────────────────────────────────────────────
  function renderMain(force = false) {
    const now = Date.now();
    const st = session && profile && !loadError ? getStatus(session, profile, now) : null;
    const screen = loadError ? 'error'
      : !session || (!isActive(session) && !showSummary) ? 'start'
      : isActive(session) && !resumed ? 'continue'
      : isActive(session) ? 'active' : 'summary';
    const key = [screen, st?.state, st?.algorithm?.box, st?.alert?.kind, st?.prompt?.key,
      st?.indications.map(i => i.drugId || i.groupId + i.doseNumber).join(','),
      st?.medications.inProfile.map(m => m.windowState).join(','), saveFailed, flash].join('|');
    if (!force && key === lastKey) { updateLive(st, now); return; }
    lastKey = key;
    main.innerHTML =
      (screen === 'error' ? errorHtml()
        : screen === 'start' ? startHtml()
          : screen === 'continue' ? continueHtml(st)
            : screen === 'active' ? activeHtml(st) : summaryHtml()) +
      (saveFailed ? '<p class="rcp-warn">No se pudo guardar en este dispositivo: si se recarga la página, se pierde lo último.</p>' : '') +
      (flash ? `<p class="rcp-warn">${esc(flash)}</p>` : '');
    flash = '';
    updateLive(st, now);
  }

  /** Repaints only the running clocks (no re-render, so taps aren't lost). */
  function updateLive(st, now) {
    if (!st) return;
    const set = (sel, text) => main.querySelectorAll(sel).forEach(el => { el.textContent = text; });
    set('[data-live="total"]', mmss(st.totalMs));
    if (st.cycle) set('[data-live="cycle"]', mmss(st.cycle.elapsedMs));
    if (st.nextEvent) set('[data-live="next"]', st.nextEvent.inMs > 0 ? mmss(st.nextEvent.inMs) : `+${mmss(-st.nextEvent.inMs)}`);
    set('[data-live="pause"]', st.pauses.current ? mmss(st.pauses.current.ms) : '');
    for (const m of st.medications.inProfile) {
      set(`[data-live="window-${m.drugId}"]`, windowLabel(m, now));
      set(`[data-live="since-${m.drugId}"]`, m.sinceLastMs == null ? '' : mmss(m.sinceLastMs));
    }
  }

  function windowLabel(m, now) {
    if (!m.windowText) return '';
    return m.windowText.replace('{mm:ss}', mmss(m.window.fromAt - now));
  }

  const badge = () => `<span class="rcp-profile">${esc(profileLabel(profile))}</span>`;

  function errorHtml() {
    return `<div class="cl cl-r"><div class="cl-ico">⛔</div><div class="cl-body"><span class="cl-title">El asistente no se puede usar</span>${esc(loadError)}</div></div>`;
  }

  function startHtml() {
    const previous = session && !isActive(session) ? session : loadArchivedSession(MODE);
    return `
      <div class="rcp-start">
        <h1 class="rcp-title">Paro cardiorrespiratorio · Adulto · AHA 2025</h1>
        ${badge()}
        <button class="rcp-btn rcp-huge rcp-danger" data-act="start">INICIAR RCP</button>
        <p class="rcp-disclaimer">Herramienta de apoyo cognitivo. No reemplaza entrenamiento ni criterio clínico.</p>
        ${previous ? `<button class="rcp-link" data-act="show-previous">Ver la RCP anterior (${esc(clock(previous.createdAt))})</button>` : ''}
      </div>`;
  }

  function continueHtml(st) {
    return `
      <div class="rcp-start">
        <h1 class="rcp-title">RCP en curso · ¿Continuar?</h1>
        ${badge()}
        <p class="rcp-resume-info">Tiempo total <b data-live="total">${mmss(st.totalMs)}</b> · Ciclo ${st.cycle ? st.cycle.number : '-'} · Box ${esc(st.algorithm?.box ?? '-')}</p>
        <button class="rcp-btn rcp-huge rcp-primary" data-act="resume-view">Continuar</button>
      </div>`;
  }

  function activeHtml(st) {
    const shocks = st.shocks.length;
    const cyc = st.cycle;
    const cycleLine = cyc ? `Ciclo ${cyc.number} · <span data-live="cycle">${mmss(cyc.elapsedMs)}</span>${cyc.durationMs ? ` / ${mmss(cyc.durationMs)}` : ''}` : '';
    const prompt = st.prompt ? `<div class="rcp-prompt is-${PROMPT_TONE[st.prompt.key] || 'blue'}" role="status">${esc(st.prompt.screen)}</div>` : '';
    const next = st.nextEvent ? `<p class="rcp-next">Evaluar ritmo en <b data-live="next"></b></p>` : '';
    const boxNote = st.algorithm?.note && st.state === S.CPR_ACTIVE && !cyc?.durationMs ? `<p class="rcp-sub">${esc(st.algorithm.note)}</p>` : '';
    const inds = st.indications.map(i => `
      <div class="rcp-ind">
        <span class="rcp-ind-text">${esc(i.message.screen)}</span>
        ${i.kind === 'group' && i.options.length > 1
          ? '<button class="rcp-btn rcp-small" data-act="meds">Registrar</button>'
          : `<button class="rcp-btn rcp-small" data-act="med-open" data-arg="${esc(i.drugId || i.options[0].drugId)}">Registrar</button>`}
      </div>`).join('');
    const windows = st.medications.inProfile.filter(m => m.windowText).map(m =>
      `<p class="rcp-window">${esc(m.name)}: <b data-live="window-${esc(m.drugId)}"></b></p>`).join('');
    const reminders = st.algorithm?.actions.length
      ? `<p class="rcp-reminders"><span class="rcp-box">Box ${esc(st.algorithm.box)}</span> ${st.algorithm.actions.map(esc).join(' · ')}</p>` : '';
    const doses = st.medications.inProfile.filter(m => m.count).map(m => `${esc(m.name)} ×${m.count}`)
      .concat(st.medications.others.map(m => `${esc(m.name)} ×${m.count}`));
    const metrics = [`Ciclo ${cyc ? cyc.number : '-'}`, `Descargas ${shocks}`, ...doses];
    if (st.pauses.current) metrics.push('Pausa actual <b data-live="pause"></b>');

    return `
      <div class="rcp-top">${badge()}
        <span class="rcp-top-actions">
          <button class="rcp-btn rcp-small rcp-ok" data-act="rosc-ask">ROSC</button>
          <button class="rcp-btn rcp-small rcp-ghost" data-act="stop-ask">Finalizar</button>
        </span>
      </div>
      <div class="rcp-clock" data-live="total">${mmss(st.totalMs)}</div>
      <p class="rcp-cycle">${cycleLine}</p>
      ${prompt}${next}${boxNote}${inds}${windows}${reminders}
      <p class="rcp-sub">Ventilación: ${esc(st.ventilation.text)}</p>
      ${stateActionsHtml(st)}
      <p class="rcp-metrics">${metrics.join(' · ')}</p>`;
  }

  function stateActionsHtml(st) {
    const secondary = `
      <div class="rcp-grid">
        <button class="rcp-btn" data-act="meds">Administrar droga</button>
        <button class="rcp-btn" data-act="shocks">Descarga</button>
        <button class="rcp-btn" data-act="other">Otro evento</button>
      </div>`;
    switch (st.state) {
      case S.CPR_ACTIVE:
        return `<div class="rcp-grid">
            <button class="rcp-btn rcp-big rcp-primary rcp-span" data-act="check">Evaluar ritmo</button>
            <button class="rcp-btn rcp-big" data-act="meds">Administrar droga</button>
            <button class="rcp-btn rcp-big" data-act="shocks">Descarga</button>
            <button class="rcp-btn rcp-big rcp-span" data-act="other">Otro evento</button>
          </div>`;
      case S.RHYTHM_CHECK:
        return `<div class="rcp-stack">
            <button class="rcp-btn rcp-huge rcp-danger" data-act="rhythm" data-arg="shockable">${esc(profile.rhythms.shockable)}</button>
            <button class="rcp-btn rcp-huge rcp-info" data-act="rhythm" data-arg="non_shockable">${esc(profile.rhythms.non_shockable)}</button>
            <button class="rcp-btn rcp-ghost" data-act="cancel-check">Cancelar (reanudar compresiones)</button>
          </div>${secondary}`;
      case S.SHOCKABLE:
        return `<div class="rcp-stack">
            <button class="rcp-btn rcp-huge rcp-danger" data-act="shock">DESCARGA REALIZADA</button>
            <ul class="rcp-ref">${profile.reference.shock.map(t => `<li>${esc(t)}</li>`).join('')}</ul>
            <button class="rcp-btn rcp-ghost" data-act="no-shock-ask">Reanudar sin descarga</button>
          </div>${secondary}`;
      case S.POST_SHOCK:
        return `<div class="rcp-stack"><button class="rcp-btn rcp-huge rcp-ok" data-act="resume">Reiniciar compresiones</button></div>${secondary}`;
      case S.NON_SHOCKABLE:
        if (st.algorithm.kind === 'rosc_check') {
          return `<div class="rcp-stack">
              <button class="rcp-btn rcp-huge rcp-ok" data-act="rosc-ask">${esc(st.algorithm.yesLabel)}</button>
              <button class="rcp-btn rcp-huge rcp-info" data-act="resume">${esc(st.algorithm.noLabel)}</button>
            </div>${secondary}`;
        }
        return `<div class="rcp-stack"><button class="rcp-btn rcp-huge rcp-info" data-act="resume">Continuar RCP</button></div>${secondary}`;
      default:
        return '';
    }
  }

  function summaryHtml() {
    const sum = summarize(session, profile, Date.now());
    const rows = [
      ['Duración total', mmss(sum.durationMs)],
      ['Ciclos', sum.cycles],
      ['Descargas', sum.shocks],
      ...sum.medications.map(m => [`Dosis de ${m.name}`, m.count]),
      ['ROSC', sum.rosc.confirmed ? `Sí · ${clock(sum.rosc.at)}` : 'No'],
    ];
    if (sum.stop) rows.push(['Finalización', `${STOP_REASON_LABELS[sum.stop.reason]}${sum.stop.detail ? ` · ${sum.stop.detail}` : ''} · ${clock(sum.stop.at)}`]);
    if (!note || note.sessionId !== session.id) note = { sessionId: session.id, text: buildNote(session, profile) };
    const title = sum.rosc.confirmed ? profile.messages.roscConfirmed.screen : 'RCP finalizada';
    const events = chronology(session);
    return `
      <div class="rcp-top">${badge()}</div>
      <h1 class="rcp-title">${esc(title)}</h1>
      <h2 class="rcp-h2">Resumen</h2>
      <dl class="rcp-summary">${rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>
      ${sum.rosc.confirmed ? `
        <div class="rcp-reserved">
          <h2 class="rcp-h2">Cuidados post-ROSC</h2>
          <p>Espacio reservado para una versión futura. Todavía no tiene contenido clínico.</p>
        </div>` : ''}
      <h2 class="rcp-h2">Cronología</h2>
      <ol class="rcp-chrono">${events.map(e => `
        <li class="${e.data.voided ? 'is-voided' : ''}">
          <span class="rcp-chrono-time">${clock(e.at)}</span>
          <span class="rcp-chrono-off">+${mmss(e.offsetMs)}</span>
          <span class="rcp-chrono-text">${esc(eventLabel(e))}${e.edited ? ' <em class="rcp-edited">editado</em>' : ''}${e.data.voided ? ' <em class="rcp-edited">anulado</em>' : ''}</span>
          <button class="rcp-btn rcp-small rcp-ghost" data-act="edit" data-arg="${esc(e.id)}">Editar</button>
        </li>`).join('')}</ol>
      <h2 class="rcp-h2">Nota clínica</h2>
      <textarea class="rcp-note" data-field="note" rows="10">${esc(note.text)}</textarea>
      <div class="rcp-grid">
        <button class="rcp-btn rcp-primary" data-act="copy-note">Copiar</button>
        <button class="rcp-btn" data-act="rebuild-note">Rehacer desde el registro</button>
      </div>
      <div class="rcp-stack"><button class="rcp-btn rcp-big" data-act="new">Nueva RCP</button></div>`;
  }

  function eventLabel(e) {
    const d = e.data;
    switch (e.type) {
      case 'CPR_STARTED': return 'Inicio de RCP';
      case 'CPR_PAUSED': return 'Pausa: evaluación del ritmo';
      case 'CPR_RESUMED': return `Reinicio de compresiones${d.withoutShock ? ' (sin descarga)' : ''}${d.roscSigns === false ? ' (sin signos de ROSC)' : ''}${d.newCycle ? ` · ciclo ${e.cycle}` : ''}`;
      case 'RHYTHM_CHECK': return `Ritmo: ${profile.rhythms[d.rhythm] || d.rhythm}`;
      case 'SHOCK_DELIVERED': return 'Descarga';
      case 'MEDICATION_GIVEN': return `${d.name} ${d.dose} ${d.route}`;
      case 'VASCULAR_ACCESS': return `Acceso vascular ${d.route}`;
      case 'AIRWAY_PLACED': return `Vía aérea avanzada${d.device ? ` (${d.device})` : ''}`;
      case 'CAPNOGRAPHY_STARTED': return 'Capnografía';
      case 'ETCO2_VALUE': return `EtCO₂ ${d.value} ${d.unit}`;
      case 'REVERSIBLE_CAUSE_IDENTIFIED': return `Causa reversible: ${d.label}`;
      case 'ROSC_CONFIRMED': return 'ROSC confirmado';
      case 'CPR_STOPPED': return `RCP finalizada: ${STOP_REASON_LABELS[d.reason]}${d.detail ? ` · ${d.detail}` : ''}`;
      case 'OTHER': return d.text;
      default: return e.type;
    }
  }

  // ─── Sheets (panels over the main area) ────────────────────────────────
  function openSheet(s) { sheet = s; renderSheet(); }
  function closeSheet() { sheet = null; renderSheet(); }

  function renderSheet() {
    if (!sheet) { host.innerHTML = ''; return; }
    const st = session && isActive(session) ? status() : null;
    let body = '';
    switch (sheet.type) {
      case 'meds': body = medsSheet(st); break;
      case 'med': body = medFormSheet(st); break;
      case 'shocks': body = shocksSheet(st); break;
      case 'other': body = otherSheet(); break;
      case 'rosc': body = confirmSheet('Confirmar retorno de circulación espontánea', 'rosc-confirm', 'Confirmar'); break;
      case 'no-shock': body = confirmSheet('¿Reanudar compresiones sin descarga?', 'no-shock-confirm', 'Reanudar sin descarga'); break;
      case 'stop': body = stopSheet(); break;
      case 'stop-death': body = confirmSheet('Confirmar fallecimiento', 'stop-death-confirm', 'Confirmar'); break;
      case 'edit': body = editSheet(); break;
      default: body = '';
    }
    host.innerHTML = `<div class="rcp-sheet" role="dialog" aria-modal="true"><div class="rcp-sheet-panel">${body}
      ${sheet.error ? `<p class="rcp-warn">${esc(sheet.error)}</p>` : ''}
      <button class="rcp-btn rcp-ghost rcp-close" data-act="close">Cerrar</button></div></div>`;
  }

  function confirmSheet(title, action, label) {
    return `<h2 class="rcp-h2">${esc(title)}</h2>
      <div class="rcp-grid"><button class="rcp-btn rcp-big rcp-ghost" data-act="close">Cancelar</button>
      <button class="rcp-btn rcp-big rcp-primary" data-act="${action}">${esc(label)}</button></div>`;
  }

  function medsSheet(st) {
    const rows = st.medications.inProfile.map(m => `
      <li class="rcp-med">
        <div class="rcp-med-head"><b>${esc(m.name)}</b>
          <button class="rcp-btn rcp-small rcp-primary" data-act="med-open" data-arg="${esc(m.drugId)}">Registrar</button></div>
        <div class="rcp-med-info">${m.count ? `${m.count} dosis: ${m.doses.map(d => `${esc(d.dose)} (${clock(d.at)})`).join(', ')} · última hace ${mmss(m.sinceLastMs)}` : 'Sin dosis registradas'}
          ${m.windowText ? ` · ${esc(windowLabel(m, Date.now()))}` : ''}${m.groupExhausted ? ' · grupo completo' : ''}</div>
      </li>`).join('');
    const others = st.medications.others.map(m => `<li class="rcp-med"><b>${esc(m.name)}</b><div class="rcp-med-info">${m.count} dosis: ${m.doses.map(d => `${esc(d.dose)} (${clock(d.at)})`).join(', ')}</div></li>`).join('');
    return `<h2 class="rcp-h2">Administrar droga</h2><ul class="rcp-list">${rows}${others}
      <li class="rcp-med"><div class="rcp-med-head"><b>Otra</b><button class="rcp-btn rcp-small" data-act="med-open" data-arg="otra">Registrar</button></div></li></ul>`;
  }

  function medFormSheet(st) {
    const isOther = sheet.drugId === 'otra';
    const m = isOther ? null : st.medications.inProfile.find(x => x.drugId === sheet.drugId);
    const def = isOther ? null : profile.medications.find(x => x.id === sheet.drugId);
    const step = m ? (m.nextDose || def.doses[Math.min(m.nextDoseNumber, def.doses.length) - 1]) : null;
    const perKg = step && step.perKg;
    const doseValue = perKg ? '' : (step ? step.amount : '');
    return `<h2 class="rcp-h2">${isOther ? 'Otra droga' : `${esc(m.name)} · dosis ${m.nextDoseNumber}`}</h2>
      <form class="rcp-form" data-form="med">
        ${isOther ? '<label>Droga <input name="name" required autocomplete="off"></label>' : ''}
        ${perKg ? `<p class="rcp-sub">${esc(step.amount)} ${esc(step.route)} · ${esc(def.doseEntry || '')}</p>
          <label>Peso estimado (kg, opcional) <input name="weight" inputmode="decimal" autocomplete="off"></label>
          <p class="rcp-sub" data-out="range"></p>
          <label>Dosis administrada (${esc(perKg.unit)}) <input name="dose" inputmode="decimal" required autocomplete="off"></label>`
          : `<label>Dosis <input name="dose" value="${esc(doseValue)}" required autocomplete="off"></label>`}
        <label>Vía <input name="route" value="${esc(step ? step.route : '')}" required autocomplete="off"></label>
        <button class="rcp-btn rcp-big rcp-primary" type="submit">Administrada</button>
      </form>`;
  }

  function shocksSheet(st) {
    const list = st.shocks.length
      ? `<ol class="rcp-list">${st.shocks.map(s => `<li>Descarga ${s.number} · ${clock(s.at)} · Box ${esc(s.box)}</li>`).join('')}</ol>`
      : '<p class="rcp-sub">Sin descargas registradas. Se registran desde "Evaluar ritmo" → desfibrilable → "DESCARGA REALIZADA".</p>';
    return `<h2 class="rcp-h2">Descargas</h2>${list}
      <ul class="rcp-ref">${profile.reference.shock.map(t => `<li>${esc(t)}</li>`).join('')}</ul>`;
  }

  function otherSheet() {
    return `<h2 class="rcp-h2">Otro evento</h2>
      <p class="rcp-sub">Acceso vascular</p>
      <div class="rcp-grid">${profile.vascularAccess.routes.map(r => `<button class="rcp-btn rcp-big" data-act="access" data-arg="${esc(r)}">${esc(r)}</button>`).join('')}</div>
      <form class="rcp-form" data-form="other">
        <label>Otro (texto breve) <input name="text" maxlength="200" required autocomplete="off"></label>
        <button class="rcp-btn rcp-primary" type="submit">Registrar</button>
      </form>`;
  }

  function stopSheet() {
    return `<h2 class="rcp-h2">Finalizar sin ROSC</h2>
      <form class="rcp-form" data-form="stop">
        ${Object.entries(STOP_REASON_LABELS).map(([k, v]) => `<label class="rcp-radio"><input type="radio" name="reason" value="${k}" required> ${esc(v)}</label>`).join('')}
        <label>Detalle (opcional) <input name="detail" maxlength="200" autocomplete="off"></label>
        <button class="rcp-btn rcp-big rcp-danger" type="submit">Finalizar RCP</button>
      </form>`;
  }

  function editSheet() {
    const e = session.events.find(x => x.id === sheet.eventId);
    const fields = EDITABLE_DATA[e.type].filter(f => f !== 'voided');
    const input = f => {
      if (f === 'rhythm') return `<label>Ritmo <select name="rhythm">${Object.entries(profile.rhythms).map(([k, v]) => `<option value="${k}"${e.data.rhythm === k ? ' selected' : ''}>${esc(v)}</option>`).join('')}</select></label>`;
      if (f === 'reason') return `<label>Motivo <select name="reason">${Object.entries(STOP_REASON_LABELS).map(([k, v]) => `<option value="${k}"${e.data.reason === k ? ' selected' : ''}>${esc(v)}</option>`).join('')}</select></label>`;
      if (f === 'route' && e.type === 'VASCULAR_ACCESS') return `<label>Vía <select name="route">${profile.vascularAccess.routes.map(r => `<option${e.data.route === r ? ' selected' : ''}>${esc(r)}</option>`).join('')}</select></label>`;
      if (f === 'drugId' || f === 'causeId' || f === 'label') return '';
      const names = { name: 'Droga', dose: 'Dosis', route: 'Vía', device: 'Dispositivo', value: 'Valor', text: 'Texto', detail: 'Detalle' };
      return `<label>${names[f] || f} <input name="${f}" value="${esc(e.data[f] ?? '')}"${f === 'value' ? ' inputmode="decimal"' : ''} autocomplete="off"></label>`;
    };
    const d = new Date(e.at);
    return `<h2 class="rcp-h2">Editar: ${esc(eventLabel(e))}</h2>
      <p class="rcp-sub">La corrección queda registrada con la hora del cambio y el valor anterior.</p>
      <form class="rcp-form" data-form="edit">
        <label>Hora <input name="time" type="time" step="1" value="${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}" required></label>
        ${fields.map(input).join('')}
        ${EDITABLE_DATA[e.type].includes('voided') ? `<label class="rcp-radio"><input type="checkbox" name="voided"${e.data.voided ? ' checked' : ''}> Anular este evento</label>` : ''}
        <button class="rcp-btn rcp-big rcp-primary" type="submit">Guardar corrección</button>
      </form>
      ${e.edits?.length ? `<p class="rcp-sub">Correcciones anteriores: ${e.edits.map(x => clock(x.editedAt)).join(', ')}</p>` : ''}`;
  }

  // ─── Events ─────────────────────────────────────────────────────────────
  function newSessionId() {
    return `rcp-${Date.now().toString(36)}`;
  }

  function onClick(ev) {
    const el = ev.target.closest('[data-act]');
    if (!el || !container.contains(el)) return;
    const arg = el.dataset.arg;
    const now = Date.now();
    switch (el.dataset.act) {
      case 'start':
        if (session && !isActive(session)) archiveSession(session);
        resumed = true; showSummary = false; note = null;
        act(() => rcp.startCpr(rcp.createSession({ id: newSessionId(), mode: MODE, now }), now));
        break;
      case 'resume-view': resumed = true; renderMain(true); break;
      case 'show-previous': {
        if (!session || isActive(session)) {
          const prev = loadArchivedSession(MODE);
          if (prev) { session = prev; }
        }
        showSummary = true; renderMain(true);
        break;
      }
      case 'new': showSummary = false; renderMain(true); break;
      case 'check': act(() => rcp.beginRhythmCheck(session, now)); break;
      case 'rhythm': act(() => rcp.selectRhythm(session, arg, now)); break;
      case 'cancel-check': act(() => rcp.cancelRhythmCheck(session, now)); break;
      case 'shock': act(() => rcp.confirmShock(session, now)); break;
      case 'resume': act(() => rcp.resumeCpr(session, now)); break;
      case 'no-shock-ask': openSheet({ type: 'no-shock' }); break;
      case 'no-shock-confirm': closeSheet(); act(() => rcp.resumeCpr(session, now)); break;
      case 'rosc-ask': openSheet({ type: 'rosc' }); break;
      case 'rosc-confirm': closeSheet(); act(() => rcp.confirmRosc(session, now)); break;
      case 'stop-ask': openSheet({ type: 'stop' }); break;
      case 'stop-death-confirm': {
        const { detail } = sheet;
        closeSheet();
        act(() => rcp.stopCpr(session, 'fallecimiento', now, detail));
        break;
      }
      case 'meds': openSheet({ type: 'meds' }); break;
      case 'med-open': openSheet({ type: 'med', drugId: arg }); break;
      case 'shocks': openSheet({ type: 'shocks' }); break;
      case 'other': openSheet({ type: 'other' }); break;
      case 'access': closeSheet(); act(() => rcp.recordVascularAccess(session, arg, now)); break;
      case 'edit': openSheet({ type: 'edit', eventId: arg }); break;
      case 'close': closeSheet(); break;
      case 'copy-note': copyNote(el); break;
      case 'rebuild-note': note = { sessionId: session.id, text: buildNote(session, profile) }; renderMain(true); break;
      default: break;
    }
  }

  function onSubmit(ev) {
    const form = ev.target.closest('form[data-form]');
    if (!form) return;
    ev.preventDefault();
    const data = Object.fromEntries(new FormData(form));
    const now = Date.now();
    const fail = msg => { sheet.error = msg; renderSheet(); };
    try {
      switch (form.dataset.form) {
        case 'med': {
          const isOther = sheet.drugId === 'otra';
          const def = isOther ? null : profile.medications.find(x => x.id === sheet.drugId);
          const step = def && def.doses.find(d => d.perKg);
          const dose = step && def.doseEntry ? `${String(data.dose).trim()} ${step.perKg.unit}` : data.dose;
          const next = rcp.giveMedication(session, { drugId: sheet.drugId, name: isOther ? data.name : def.name, dose, route: data.route }, now);
          closeSheet(); commit(next);
          break;
        }
        case 'other': { const next = rcp.recordOther(session, data.text, now); closeSheet(); commit(next); break; }
        case 'stop':
          if (data.reason === 'fallecimiento') { sheet = { type: 'stop-death', detail: data.detail }; renderSheet(); return; }
          { const next = rcp.stopCpr(session, data.reason, now, data.detail); closeSheet(); commit(next); }
          break;
        case 'edit': {
          const e = session.events.find(x => x.id === sheet.eventId);
          const patch = { at: timeOnSameDay(e.at, data.time), data: {} };
          for (const f of EDITABLE_DATA[e.type]) {
            if (f === 'voided') patch.data.voided = data.voided === 'on';
            else if (f in data) patch.data[f] = f === 'value' ? Number(String(data[f]).replace(',', '.')) : data[f];
          }
          if (patch.data.detail === '') patch.data.detail = null;
          const next = rcp.editEvent(session, e.id, patch, now);
          closeSheet(); commit(next);
          if (note && note.sessionId === session.id) note = null; // rebuilt from the corrected log
          renderMain(true);
          break;
        }
        default: break;
      }
    } catch (err) {
      fail(err.message);
    }
  }

  function onInput(ev) {
    if (ev.target.matches('[data-field="note"]') && note) note.text = ev.target.value;
    // Lidocaine-style weight range: direct multiplication, no rounding.
    if (ev.target.name === 'weight' && sheet?.type === 'med') {
      const def = profile.medications.find(x => x.id === sheet.drugId);
      const m = status().medications.inProfile.find(x => x.drugId === sheet.drugId);
      const step = def.doses[Math.min(m.nextDoseNumber, def.doses.length) - 1];
      const kg = Number(String(ev.target.value).replace(',', '.'));
      const out = host.querySelector('[data-out="range"]');
      if (out) out.textContent = step.perKg && kg > 0 ? `Rango para ${decimal(kg)} kg: ${decimal(step.perKg.min * kg)}–${decimal(step.perKg.max * kg)} ${step.perKg.unit}` : '';
    }
  }

  /** "HH:MM:SS" on the event's own day (nearest day if it crosses midnight). */
  function timeOnSameDay(original, hms) {
    const [h, m, s = '0'] = String(hms).split(':');
    const d = new Date(original);
    d.setHours(Number(h), Number(m), Number(s), 0);
    let t = d.getTime();
    if (t - original > 12 * 3600e3) t -= 24 * 3600e3;
    if (original - t > 12 * 3600e3) t += 24 * 3600e3;
    return t;
  }

  async function copyNote(btn) {
    const area = main.querySelector('[data-field="note"]');
    const text = area ? area.value : '';
    let ok = false;
    try { await navigator.clipboard.writeText(text); ok = true; } catch { /* fall back below */ }
    if (!ok && area) {
      area.select();
      try { ok = document.execCommand('copy'); } catch { ok = false; }
    }
    btn.textContent = ok ? 'Copiado' : 'No se pudo copiar: seleccioná el texto';
  }

  const onVisible = () => { if (document.visibilityState === 'visible') renderMain(true); };

  container.addEventListener('click', onClick);
  container.addEventListener('submit', onSubmit);
  container.addEventListener('input', onInput);
  document.addEventListener('visibilitychange', onVisible);
  renderMain(true);
  const timer = setInterval(() => renderMain(false), TICK_MS);

  return () => {
    clearInterval(timer);
    document.removeEventListener('visibilitychange', onVisible);
  };
}
