// Screens of the resuscitation assistant (view type "rcp"). Only presents
// what engine.js / status.js compute and records what the user confirms:
// every clinical rule and text comes from the profile through the engine.
// The clock is repainted from timestamps (setInterval only repaints); the
// session is saved on every recorded event, so a reload loses nothing.

import { createEngine, isActive, STATES, EDITABLE_DATA } from './engine.js';
import { getStatus, summarize, chronology } from './status.js';
import { saveSession, loadSession, archiveSession, loadArchivedSession, clearSession, clearArchivedSession } from './storage.js';
import { buildNote, STOP_REASON_LABELS } from './note.js';
import { profileLabel } from './profile.js';
import { createAssist } from './assist.js';
import { cuesFor } from './cues.js';
import { loadSettings, saveSettings } from './settings.js';

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
// Events that don't change the screen on their own: a toast confirms them.
const QUIET_EVENTS = ['MEDICATION_GIVEN', 'VASCULAR_ACCESS', 'AIRWAY_PLACED', 'CAPNOGRAPHY_STARTED', 'ETCO2_VALUE', 'REVERSIBLE_CAUSE_IDENTIFIED', 'OTHER'];
const RECENT_EVENTS = 4;

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
  let source = 'current';       // stored slot the shown session belongs to: 'current' or 'archive'
  let sheet = null;             // { type, ... } — the open panel, if any
  let saveFailed = false;
  let note = null;              // { sessionId, text } — the editable note
  let lastKey = '';
  let flash = '';
  const assist = createAssist();
  let settings = profile ? loadSettings(profile) : null;
  const announced = new Set();  // cue ids already played (cues.js)
  let cuesReady = false;        // until the first status is seen, so reopening doesn't replay the past
  let pendingCues = [];         // alerts found while waiting for the first tap ("Continuar")

  if (session && profile && (session.profile.id !== profile.id || session.profile.version !== profile.version)) {
    loadError = `La RCP guardada se inició con ${profileLabel(session.profile)}; este dispositivo tiene ${profileLabel(profile)}. No se puede continuar con otro perfil.`;
  }

  const status = () => getStatus(session, profile, Date.now());

  function commit(next) {
    if (!next || next === session) return;
    const prevCount = session ? session.events.length : 0;
    const corrected = !!session && next.events.length === prevCount;
    session = next;
    saveFailed = !(source === 'archive' ? archiveSession(session) : saveSession(session));
    if (!isActive(session)) showSummary = true;
    renderMain(true);
    const added = session.events.length > prevCount ? session.events[session.events.length - 1] : null;
    if (added && QUIET_EVENTS.includes(added.type)) toast(`✓ Registrado: ${eventLabel(added)} · ${clock(added.at)}`);
    else if (corrected) toast('✓ Corrección guardada');
  }

  let toastTimer = null;
  /** Short confirmation at the bottom of the screen (announced to screen readers). */
  function toast(text) {
    let el = container.querySelector('.rcp-toast');
    if (!el) {
      el = document.createElement('div');
      el.className = 'rcp-toast';
      el.setAttribute('role', 'status');
      container.querySelector('.rcp').appendChild(el);
    }
    el.textContent = text;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, 3000);
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
    assistance(st, screen);
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

  /** Voice/beep/vibration for new moments, the metronome and the screen wake lock. */
  function assistance(st, screen) {
    const active = !!st && isActive(session);
    assist.keepAwake(active);
    assist.metronome(screen === 'active' && active && settings.metronome && st.state === S.CPR_ACTIVE, settings.metronomeBpm);
    if (!st || screen === 'start' || screen === 'error') return;
    const cues = cuesFor(st, announced);
    if (!cuesReady) {                // opened mid-case: keep only the alert that is due now
      cuesReady = true;
      pendingCues = cues.filter(c => c.beep > 0);
      return;
    }
    if (screen !== 'continue' && assist.unlocked) assist.play(cues, settings);
    else pendingCues.push(...cues);
  }

  const pausesText = st => `pausas ${st.pauses.count} · máx ${mmss(st.pauses.maxMs)} · total ${mmss(st.pauses.totalMs)}`;

  /** Repaints only the running clocks and rings (no re-render, so taps aren't lost). */
  function updateLive(st, now) {
    if (!st) return;
    const set = (sel, text) => main.querySelectorAll(sel).forEach(el => { el.textContent = text; });
    set('[data-live="total"]', mmss(st.totalMs));
    const ring = cycleRing(st);
    set('[data-live="cycle-big"]', ring.big);
    set('[data-live="cycle-sub"]', ring.sub);
    set('[data-live="cycle-extra"]', ring.extra);
    set('[data-live="pauses"]', pausesText(st));
    main.querySelectorAll('[data-ring="cycle"]').forEach(el => el.setAttribute('stroke-dashoffset', ringOffset(ring.progress)));
    const drug = ringDrug(st);
    if (drug) {
      const d = drugRing(drug, now);
      set('[data-live="drug-big"]', d.big);
      set('[data-live="drug-sub"]', d.sub);
      main.querySelectorAll('[data-ring="drug"]').forEach(el => el.setAttribute('stroke-dashoffset', ringOffset(d.progress)));
    }
  }

  function windowLabel(m, now) {
    if (!m.windowText) return '';
    return m.windowText.replace('{mm:ss}', mmss(m.window.fromAt - now));
  }

  // ─── Ring clocks ────────────────────────────────────────────────────────
  // Two ring clocks: compressions (the current cycle) and the drug that has a
  // repeat interval in the profile (adrenalina). SVG draws only the ring; the
  // numbers are HTML on top, so they stay readable and accessible.
  const RING_R = 52;
  const RING_C = 2 * Math.PI * RING_R;
  const ringOffset = p => (RING_C * (1 - Math.min(1, Math.max(0, p)))).toFixed(2);

  function ringSvg(name, progress, tickAt) {
    let tick = '';
    if (tickAt != null) {
      const a = tickAt * 2 * Math.PI - Math.PI / 2;
      const pt = r => `${(60 + r * Math.cos(a)).toFixed(2)} ${(60 + r * Math.sin(a)).toFixed(2)}`;
      const [x1, y1] = pt(RING_R - 8).split(' ');
      const [x2, y2] = pt(RING_R + 8).split(' ');
      tick = `<line class="rcp-ring-tick" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`;
    }
    return `<svg class="rcp-ring-svg" viewBox="0 0 120 120" aria-hidden="true" focusable="false">
      <circle class="rcp-ring-track" cx="60" cy="60" r="${RING_R}"/>
      <circle class="rcp-ring-bar" data-ring="${name}" cx="60" cy="60" r="${RING_R}"
        stroke-dasharray="${RING_C.toFixed(2)}" stroke-dashoffset="${ringOffset(progress)}" transform="rotate(-90 60 60)"/>
      ${tick}</svg>`;
  }

  /** What the compressions ring shows right now, with the compression fraction. */
  function cycleRing(st) {
    const f = st.compressionFraction;
    return { ...cycleRingBase(st), extra: f == null ? '' : `fracción ${Math.round(f * 100)} %` };
  }

  function cycleRingBase(st) {
    const cyc = st.cycle;
    if (!cyc) return { label: 'compresiones', big: '--:--', sub: '', progress: 0, tone: 'blue', tick: null };
    if (st.pauses.current) {
      return { label: 'pausa', big: mmss(st.pauses.current.ms), sub: `Ciclo ${cyc.number} · ${mmss(cyc.elapsedMs)}`, progress: cyc.durationMs ? cyc.elapsedMs / cyc.durationMs : 0, tone: 'amber', tick: null };
    }
    if (!cyc.durationMs) return { label: 'compresiones', big: mmss(cyc.elapsedMs), sub: `Ciclo ${cyc.number}`, progress: 0, tone: 'blue', tick: null };
    const tick = (cyc.durationMs - profile.cycle.preAlertSec * 1000) / cyc.durationMs;
    if (cyc.overdueMs > 0) return { label: 'compresiones', big: `+${mmss(cyc.overdueMs)}`, sub: `Ciclo ${cyc.number} · ${mmss(cyc.durationMs)}`, progress: 1, tone: 'red', tick };
    const tone = st.alert?.kind === 'check_rhythm' ? 'red' : st.alert?.kind === 'pre_alert' ? 'amber' : 'blue';
    return { label: 'compresiones', big: mmss(cyc.elapsedMs), sub: `/ ${mmss(cyc.durationMs)} · Ciclo ${cyc.number}`, progress: cyc.elapsedMs / cyc.durationMs, tone, tick };
  }

  /** The profile drug that gets the second ring: the first one with a repeat interval. */
  const ringDrug = st => st.medications.inProfile.find(m => profile.medications.find(d => d.id === m.drugId).intervalSec) || null;

  function drugRing(m, now) {
    const def = profile.medications.find(d => d.id === m.drugId);
    const maxMs = def.intervalSec.max * 1000;
    if (!m.count) return { label: m.name.toLocaleLowerCase('es'), big: '--:--', sub: 'sin dosis', progress: 0, tone: 'none', tick: def.intervalSec.min / def.intervalSec.max };
    const tone = { before: 'blue', open: 'green', late: 'red' }[m.windowState] || 'none';
    return {
      label: `última ${m.name.toLocaleLowerCase('es')}`,
      big: mmss(m.sinceLastMs),
      sub: windowLabel(m, now),
      progress: m.sinceLastMs / maxMs,
      tone,
      tick: def.intervalSec.min / def.intervalSec.max,
    };
  }

  function ringHtml(name, r) {
    return `<div class="rcp-ring is-${r.tone}">
        ${ringSvg(name, r.progress, r.tick)}
        <div class="rcp-ring-center">
          <span class="rcp-ring-label">${esc(r.label)}</span>
          <span class="rcp-ring-big" data-live="${name}-big">${esc(r.big)}</span>
          <span class="rcp-ring-sub" data-live="${name}-sub">${esc(r.sub)}</span>
          ${r.extra != null ? `<span class="rcp-ring-extra" data-live="${name}-extra">${esc(r.extra)}</span>` : ''}
        </div>
      </div>`;
  }

  function activeHtml(st) {
    const now = Date.now();
    const drug = ringDrug(st);
    const prompt = st.prompt ? `<div class="rcp-prompt is-${PROMPT_TONE[st.prompt.key] || 'blue'}" role="status">${esc(st.prompt.screen)}</div>` : '';
    const boxNote = st.algorithm?.note && st.state === S.CPR_ACTIVE && !st.cycle?.durationMs ? `<p class="rcp-sub">${esc(st.algorithm.note)}</p>` : '';
    const drugInd = drug ? st.indications.find(i => i.drugId === drug.drugId) : null;
    const otherInds = st.indications.filter(i => i !== drugInd).map(i => `
      <div class="rcp-ind">
        <span class="rcp-ind-text">${esc(i.message.screen)}</span>
        ${i.kind === 'group' && i.options.length > 1
          ? '<button class="rcp-btn rcp-small" data-act="meds">Registrar</button>'
          : `<button class="rcp-btn rcp-small" data-act="med-open" data-arg="${esc(i.drugId || i.options[0].drugId)}">Registrar</button>`}
      </div>`).join('');
    const reminders = st.algorithm?.actions.length
      ? `<p class="rcp-reminders"><span class="rcp-box">Box ${esc(st.algorithm.box)}</span> ${st.algorithm.actions.map(esc).join(' · ')}</p>` : '';
    const others = st.medications.inProfile.filter(m => m.count && m !== drug).map(m => `${esc(m.name)} ×${m.count}`)
      .concat(st.medications.others.map(m => `${esc(m.name)} ×${m.count}`));

    return `
      <div class="rcp-topcard">
        <div class="rcp-total"><span class="rcp-total-label">duración total</span><span class="rcp-total-time" data-live="total">${mmss(st.totalMs)}</span></div>
        <span class="rcp-top-actions">
          <button class="rcp-btn rcp-small rcp-ok" data-act="rosc-ask">RCE</button>
          <button class="rcp-btn rcp-small rcp-ghost" data-act="stop-ask">Finalizar</button>
          <button class="rcp-btn rcp-small rcp-ghost" data-act="settings" aria-label="Ajustes de asistencia">${settings.audio ? '🔊' : '🔇'}</button>
        </span>
      </div>
      ${badge()}
      ${prompt}${boxNote}
      ${stateActionsHtml(st)}
      <section class="rcp-ringcard" aria-label="Compresiones">
        ${ringHtml('cycle', cycleRing(st))}
        <div class="rcp-ringside">
          ${st.state === S.CPR_ACTIVE ? '<button class="rcp-btn rcp-primary" data-act="check">Evaluar ritmo</button>' : ''}
          <button class="rcp-btn" data-act="shocks">Descarga</button>
          <div class="rcp-counters"><span><small>ciclos</small><b>${st.cycle ? st.cycle.number : 0}</b></span><span><small>descargas</small><b>${st.shocks.length}</b></span></div>
          <p class="rcp-pauses" data-live="pauses">${pausesText(st)}</p>
        </div>
      </section>
      ${drug ? `
      <section class="rcp-ringcard" aria-label="${esc(drug.name)}">
        ${ringHtml('drug', drugRing(drug, now))}
        <div class="rcp-ringside">
          <button class="rcp-btn ${drugInd ? 'rcp-warn-btn' : 'rcp-primary'}" data-act="med-open" data-arg="${esc(drug.drugId)}">${esc(drug.name)}</button>
          <button class="rcp-btn" data-act="meds">Otras drogas</button>
          <div class="rcp-counters"><span><small>dosis</small><b>${drug.count}</b></span></div>
        </div>
        ${drugInd ? `<p class="rcp-ring-ind">${esc(drugInd.message.screen)}</p>` : ''}
      </section>` : ''}
      ${otherInds}
      <button class="rcp-btn rcp-huge rcp-ok rcp-rce" data-act="rosc-ask">RCE<small>Retorno de la circulación espontánea</small></button>
      <div class="rcp-events">
        ${panelBtn(st, 'access', 'Acceso IV/IO')}
        ${panelBtn(st, 'airway', 'Vía aérea / CO₂')}
        ${panelBtn(st, 'causes', 'Causas reversibles')}
        <button class="rcp-btn" data-act="note">Nota</button>
      </div>
      ${recentHtml()}
      ${reminders}
      <p class="rcp-sub">Ventilación: ${esc(st.ventilation.text)}${others.length ? ` · ${others.join(' · ')}` : ''}</p>`;
  }

  /** The last few recorded events, newest first, with a link to the full log. */
  function recentHtml() {
    const events = chronology(session);
    const last = events.slice(-RECENT_EVENTS).reverse();
    return `<section class="rcp-recent" aria-label="Registro">
        <h2 class="rcp-h2">Registro</h2>
        <ol class="rcp-recent-list">${last.map(e => `<li class="${e.data.voided ? 'is-voided' : ''}"><span class="rcp-chrono-time">${clock(e.at)}</span> ${esc(eventLabel(e))}</li>`).join('')}</ol>
        <button class="rcp-link" data-act="log">Ver registro completo (${events.length})</button>
      </section>`;
  }

  /** Event button; highlighted when a visible Box reminder points to its panel. */
  function panelBtn(st, panel, label) {
    const hint = st.algorithm && st.algorithm.panels.includes(panel);
    return `<button class="rcp-btn${hint ? ' rcp-hint' : ''}" data-act="panel" data-arg="${panel}">${label}</button>`;
  }

  /** The big decision buttons of the states that need one (above the rings). */
  function stateActionsHtml(st) {
    switch (st.state) {
      case S.RHYTHM_CHECK:
        return `<div class="rcp-stack">
            <button class="rcp-btn rcp-huge rcp-danger" data-act="rhythm" data-arg="shockable">${esc(profile.rhythms.shockable)}</button>
            <button class="rcp-btn rcp-huge rcp-info" data-act="rhythm" data-arg="non_shockable">${esc(profile.rhythms.non_shockable)}</button>
            <button class="rcp-btn rcp-ghost" data-act="cancel-check">Cancelar (reanudar compresiones)</button>
          </div>`;
      case S.SHOCKABLE:
        return `<div class="rcp-stack">
            <button class="rcp-btn rcp-huge rcp-danger" data-act="shock">DESCARGA REALIZADA</button>
            <ul class="rcp-ref">${profile.reference.shock.map(t => `<li>${esc(t)}</li>`).join('')}</ul>
            <button class="rcp-btn rcp-ghost" data-act="no-shock-ask">Reanudar sin descarga</button>
          </div>`;
      case S.POST_SHOCK:
        return '<div class="rcp-stack"><button class="rcp-btn rcp-huge rcp-ok" data-act="resume">Reiniciar compresiones</button></div>';
      case S.NON_SHOCKABLE:
        if (st.algorithm.kind === 'rosc_check') {
          return `<div class="rcp-stack">
              <button class="rcp-btn rcp-huge rcp-ok" data-act="rosc-ask">${esc(st.algorithm.yesLabel)}</button>
              <button class="rcp-btn rcp-huge rcp-info" data-act="resume">${esc(st.algorithm.noLabel)}</button>
            </div>`;
        }
        return '<div class="rcp-stack"><button class="rcp-btn rcp-huge rcp-info" data-act="resume">Continuar RCP</button></div>';
      default:
        return '';
    }
  }

  const badge = () => `<span class="rcp-profile">${esc(profileLabel(profile))}</span>`;

  function errorHtml() {
    return `<div class="cl cl-r"><div class="cl-ico">⛔</div><div class="cl-body"><span class="cl-title">El asistente no se puede usar</span>${esc(loadError)}</div></div>`;
  }

  /** Opens straight on the ring clocks at zero; CPR starts with "Iniciar compresiones". */
  function startHtml() {
    const previous = session && !isActive(session) ? session : loadArchivedSession(MODE);
    const def = profile.medications.find(m => m.intervalSec);
    return `
      <div class="rcp-start rcp-idle">
        <div class="rcp-topcard">
          <div class="rcp-total"><span class="rcp-total-label">duración total</span><span class="rcp-total-time">00:00</span></div>
          <span class="rcp-top-actions">
            <button class="rcp-btn rcp-small rcp-ghost" data-act="settings" aria-label="Ajustes de asistencia">${settings.audio ? '🔊' : '🔇'}</button>
          </span>
        </div>
        ${badge()}
        <div class="rcp-prompt is-blue">${esc(profile.startHint)}</div>
        <button class="rcp-btn rcp-huge rcp-danger" data-act="start">Iniciar compresiones</button>
        <section class="rcp-ringcard" aria-label="Compresiones">
          ${ringHtml('cycle', { label: 'compresiones', big: '00:00', sub: 'sin iniciar', progress: 0, tone: 'none', tick: null })}
          <div class="rcp-ringside">
            <div class="rcp-counters"><span><small>ciclos</small><b>0</b></span><span><small>descargas</small><b>0</b></span></div>
          </div>
        </section>
        ${def ? `<section class="rcp-ringcard" aria-label="${esc(def.name)}">
          ${ringHtml('drug', { label: def.name.toLocaleLowerCase('es'), big: '--:--', sub: 'sin dosis', progress: 0, tone: 'none', tick: def.intervalSec.min / def.intervalSec.max })}
          <div class="rcp-ringside"><div class="rcp-counters"><span><small>dosis</small><b>0</b></span></div></div>
        </section>` : ''}
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
        <button class="rcp-link rcp-link-danger" data-act="discard-ask">Descartar esta RCP</button>
      </div>`;
  }

  function summaryHtml() {
    const sum = summarize(session, profile, Date.now());
    const rows = [
      ['Duración total', mmss(sum.durationMs)],
      ['Ciclos', sum.cycles],
      ['Descargas', sum.shocks],
      ...sum.medications.map(m => [`Dosis de ${m.name}`, m.count]),
      ['RCE', sum.rosc.confirmed ? `Sí · ${clock(sum.rosc.at)}` : 'No'],
      ['Pausas', sum.pauses.count
        ? `${sum.pauses.count} (${sum.pauses.list.filter(p => p.endedBy === 'CPR_RESUMED').map(p => mmss(p.ms)).join(', ')}) · máx ${mmss(sum.pauses.maxMs)} · total ${mmss(sum.pauses.totalMs)}`
        : '0'],
      ['Fracción de compresiones', sum.compressionFraction == null ? '—' : `${Math.round(sum.compressionFraction * 100)} %`],
    ];
    if (sum.stop) rows.push(['Finalización', `${STOP_REASON_LABELS[sum.stop.reason]}${sum.stop.detail ? ` · ${sum.stop.detail}` : ''} · ${clock(sum.stop.at)}`]);
    if (!note || note.sessionId !== session.id) note = { sessionId: session.id, text: buildNote(session, profile) };
    const title = sum.rosc.confirmed ? profile.messages.roscConfirmed.screen : 'RCP finalizada';
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
      ${chronoHtml()}
      <h2 class="rcp-h2">Nota clínica</h2>
      <textarea class="rcp-note" data-field="note" rows="10">${esc(note.text)}</textarea>
      <div class="rcp-grid">
        <button class="rcp-btn rcp-primary" data-act="copy-note">Copiar</button>
        <button class="rcp-btn" data-act="rebuild-note">Rehacer desde el registro</button>
      </div>
      <div class="rcp-stack"><button class="rcp-btn rcp-big" data-act="new">Nueva RCP</button>
        <button class="rcp-link rcp-link-danger" data-act="delete-ask">Borrar esta RCP del dispositivo</button></div>`;
  }

  function chronoHtml() {
    return `<ol class="rcp-chrono">${chronology(session).map(e => `
        <li class="${e.data.voided ? 'is-voided' : ''}">
          <span class="rcp-chrono-time">${clock(e.at)}</span>
          <span class="rcp-chrono-off">+${mmss(e.offsetMs)}</span>
          <span class="rcp-chrono-text">${esc(eventLabel(e))}${e.edited ? ' <em class="rcp-edited">editado</em>' : ''}${e.data.voided ? ' <em class="rcp-edited">anulado</em>' : ''}</span>
          <button class="rcp-btn rcp-small rcp-ghost" data-act="edit" data-arg="${esc(e.id)}">Editar</button>
        </li>`).join('')}</ol>`;
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
      case 'ROSC_CONFIRMED': return 'RCE confirmado';
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
      case 'access': body = accessSheet(); break;
      case 'airway': body = airwaySheet(); break;
      case 'causes': body = causesSheet(); break;
      case 'note': body = noteSheet(); break;
      case 'log': body = logSheet(); break;
      case 'settings': body = settingsSheet(); break;
      case 'rosc': body = confirmSheet('Confirmar retorno de circulación espontánea', 'rosc-confirm', 'Confirmar'); break;
      case 'no-shock': body = confirmSheet('¿Reanudar compresiones sin descarga?', 'no-shock-confirm', 'Reanudar sin descarga'); break;
      case 'stop': body = stopSheet(); break;
      case 'stop-death': body = confirmSheet('Confirmar fallecimiento', 'stop-death-confirm', 'Confirmar'); break;
      case 'delete': body = confirmSheet('¿Borrar esta RCP de este dispositivo?', 'delete-confirm', 'Borrar', 'rcp-danger',
        'No se puede deshacer. Si la vas a necesitar, copiá la nota antes.'); break;
      case 'discard': body = confirmSheet('¿Descartar la RCP en curso?', 'discard-confirm', 'Descartar', 'rcp-danger',
        'Se borra de este dispositivo y no se puede deshacer.'); break;
      case 'edit': body = editSheet(); break;
      default: body = '';
    }
    host.innerHTML = `<div class="rcp-sheet" role="dialog" aria-modal="true"><div class="rcp-sheet-panel">${body}
      ${sheet.error ? `<p class="rcp-warn">${esc(sheet.error)}</p>` : ''}
      <button class="rcp-btn rcp-ghost rcp-close" data-act="close">Cerrar</button></div></div>`;
  }

  function confirmSheet(title, action, label, tone = 'rcp-primary', detail = '') {
    return `<h2 class="rcp-h2">${esc(title)}</h2>${detail ? `<p class="rcp-sub">${esc(detail)}</p>` : ''}
      <div class="rcp-grid"><button class="rcp-btn rcp-big rcp-ghost" data-act="close">Cancelar</button>
      <button class="rcp-btn rcp-big ${tone}" data-act="${action}">${esc(label)}</button></div>`;
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

  const liveEvents = type => session.events.filter(e => e.type === type && !e.data.voided);

  function accessSheet() {
    const done = liveEvents('VASCULAR_ACCESS');
    return `<h2 class="rcp-h2">Acceso vascular</h2>
      <p class="rcp-sub">${esc(profile.vascularAccess.note)}</p>
      ${done.length ? `<p class="rcp-done">✓ ${done.map(e => `${esc(e.data.route)} · ${clock(e.at)}`).join(' · ')}</p>` : ''}
      <div class="rcp-grid">${profile.vascularAccess.routes.map(r => `<button class="rcp-btn rcp-big" data-act="access" data-arg="${esc(r)}">${esc(r)}</button>`).join('')}</div>`;
  }

  function airwaySheet() {
    const airway = liveEvents('AIRWAY_PLACED');
    const capno = liveEvents('CAPNOGRAPHY_STARTED');
    const etco2 = liveEvents('ETCO2_VALUE');
    return `<h2 class="rcp-h2">Vía aérea avanzada y capnografía</h2>
      <p class="rcp-sub">Ventilación: ${esc(status().ventilation.text)}</p>
      ${airway.length
        ? `<p class="rcp-done">✓ Vía aérea avanzada · ${clock(airway[0].at)}${airway[0].data.device ? ` · ${esc(airway[0].data.device)}` : ''}</p>`
        : `<div class="rcp-stack">${profile.airwayDevices.map(d => `<button class="rcp-btn rcp-big" data-act="airway-device" data-arg="${esc(d)}">${esc(d)}</button>`).join('')}</div>`}
      ${capno.length ? `<p class="rcp-done">✓ Capnografía · ${clock(capno[0].at)}</p>` : '<div class="rcp-stack"><button class="rcp-btn rcp-big" data-act="capno">Capnografía iniciada</button></div>'}
      <form class="rcp-form" data-form="etco2">
        <label>EtCO₂ (mmHg) <input name="value" inputmode="decimal" required autocomplete="off"></label>
        <button class="rcp-btn rcp-primary" type="submit">Registrar EtCO₂</button>
      </form>
      ${etco2.length ? `<p class="rcp-sub">Registradas: ${etco2.map(e => `${esc(e.data.value)} mmHg (${clock(e.at)})`).join(', ')}</p>` : ''}
      <h2 class="rcp-h2">Referencia</h2>
      <ul class="rcp-ref">${profile.reference.airway.map(t => `<li>${esc(t)}</li>`).join('')}
        <li>EtCO₂ (solo informativo, sin alertas automáticas): ${esc(profile.reference.etco2)}</li></ul>`;
  }

  function causesSheet() {
    const found = new Map(liveEvents('REVERSIBLE_CAUSE_IDENTIFIED').map(e => [e.data.causeId, e.at]));
    return `<h2 class="rcp-h2">Causas reversibles</h2>
      <p class="rcp-sub">Marcá las que consideraste. No bloquea el flujo; para corregir, usá "Editar" en la cronología.</p>
      <div class="rcp-causes">${profile.reversibleCauses.map(c => found.has(c.id)
        ? `<button class="rcp-btn rcp-check is-on" disabled aria-pressed="true">✓ ${esc(c.label)} <small>${clock(found.get(c.id))}</small></button>`
        : `<button class="rcp-btn rcp-check" data-act="cause" data-arg="${esc(c.id)}" aria-pressed="false">${esc(c.label)}</button>`).join('')}</div>`;
  }

  function logSheet() {
    return `<h2 class="rcp-h2">Registro</h2>
      <p class="rcp-sub">Hora real y tiempo desde el inicio. Tocá "Editar" para corregir un evento: la corrección queda registrada.</p>
      ${chronoHtml()}`;
  }

  function noteSheet() {
    return `<h2 class="rcp-h2">Nota</h2>
      <form class="rcp-form" data-form="note">
        <label>Texto breve (queda registrado con la hora) <input name="text" maxlength="200" required autocomplete="off"></label>
        <button class="rcp-btn rcp-primary" type="submit">Registrar</button>
      </form>`;
  }

  function settingsSheet() {
    const row = (key, label) => `<button class="rcp-btn rcp-toggle" role="switch" aria-checked="${settings[key]}" data-act="toggle" data-arg="${key}">
      <span class="rcp-toggle-label">${label}</span>
      <span class="rcp-toggle-state">${settings[key] ? 'Activado' : 'Desactivado'}</span>
      <span class="rcp-switch" aria-hidden="true"><span class="rcp-switch-knob"></span></span></button>`;
    const mt = profile.metronome;
    return `<h2 class="rcp-h2">Asistencia</h2>
      <div class="rcp-stack">${row('audio', 'Audio de asistencia')}${row('vibration', 'Vibración de asistencia')}${mt ? row('metronome', 'Metrónomo') : ''}</div>
      ${mt ? `<p class="rcp-sub">Ritmo del metrónomo</p>
        <div class="rcp-grid rcp-grid-3">${mt.bpmOptions.map(b => `<button class="rcp-btn${settings.metronomeBpm === b ? ' rcp-primary' : ''}" data-act="bpm" data-arg="${b}" aria-pressed="${settings.metronomeBpm === b}">${b}/min</button>`).join('')}</div>
        <p class="rcp-sub">${esc(mt.note)}</p>` : ''}
      <p class="rcp-sub">El sonido se activa al tocar la pantalla (necesario en iPhone). La vibración no está disponible en todos los teléfonos.</p>`;
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
    assist.unlock();
    switch (el.dataset.act) {
      case 'start':
        if (session && !isActive(session)) archiveSession(session);
        resumed = true; showSummary = false; note = null; cuesReady = true; announced.clear(); pendingCues = []; source = 'current';
        act(() => rcp.startCpr(rcp.createSession({ id: newSessionId(), mode: MODE, now }), now));
        break;
      case 'resume-view': resumed = true; assist.play(pendingCues, settings); pendingCues = []; renderMain(true); break;
      case 'show-previous': {
        if (!session || isActive(session)) {
          const prev = loadArchivedSession(MODE);
          if (prev) { session = prev; source = 'archive'; }
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
      case 'delete-ask': openSheet({ type: 'delete' }); break;
      case 'delete-confirm':
        closeSheet();
        if (source === 'archive') clearArchivedSession(MODE); else clearSession(MODE);
        session = loadSession(MODE); source = 'current'; showSummary = false; note = null;
        renderMain(true);
        break;
      case 'discard-ask': openSheet({ type: 'discard' }); break;
      case 'discard-confirm':
        closeSheet();
        clearSession(MODE);
        session = null; resumed = false; showSummary = false; pendingCues = [];
        renderMain(true);
        break;
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
      case 'panel': openSheet({ type: arg }); break;
      case 'note': openSheet({ type: 'note' }); break;
      case 'log': openSheet({ type: 'log' }); break;
      case 'settings': openSheet({ type: 'settings' }); break;
      case 'access': closeSheet(); act(() => rcp.recordVascularAccess(session, arg, now)); break;
      case 'airway-device': if (act(() => rcp.recordAirway(session, { device: arg }, now))) renderSheet(); break;
      case 'capno': if (act(() => rcp.recordCapnography(session, now))) renderSheet(); break;
      case 'cause': if (act(() => rcp.recordReversibleCause(session, arg, now))) renderSheet(); break;
      case 'toggle':
        settings = { ...settings, [arg]: !settings[arg] };
        saveSettings(settings); renderSheet(); renderMain(true);
        break;
      case 'bpm':
        settings = { ...settings, metronomeBpm: Number(arg) };
        saveSettings(settings); renderSheet(); renderMain(true);
        break;
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
        case 'note': { const next = rcp.recordOther(session, data.text, now); closeSheet(); commit(next); break; }
        case 'etco2': {
          const next = rcp.recordEtco2(session, Number(String(data.value).replace(',', '.')), now);
          commit(next); renderSheet();
          break;
        }
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

  // Back from background or a locked screen: re-request the wake lock and recompute; any alert that came due plays once.
  const onVisible = () => { if (document.visibilityState === 'visible') { assist.requestWakeLock(); renderMain(true); } };

  container.addEventListener('click', onClick);
  container.addEventListener('submit', onSubmit);
  container.addEventListener('input', onInput);
  document.addEventListener('visibilitychange', onVisible);
  renderMain(true);
  const timer = setInterval(() => renderMain(false), TICK_MS);

  return () => {
    clearInterval(timer);
    document.removeEventListener('visibilitychange', onVisible);
    assist.dispose();
  };
}
