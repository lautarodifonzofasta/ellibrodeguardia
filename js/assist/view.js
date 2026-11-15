// DOM for a timed protocol (see timeline.js). Mounted by js/router.js into a
// <div data-assist="id"> inside a content module. The session lives in
// sessionStorage, so leaving the module and coming back keeps the clock
// running; it is per tab and disappears when the tab closes.
import { createSession, markDone, skip, unmark, status, clock, note } from './timeline.js';

const STATE_LABEL = { done: 'Hecho', skipped: 'No indicado', waiting: 'Después del anterior', upcoming: 'Falta', due: 'Ahora', overdue: 'Atrasado' };
const hhmm = ms => new Date(ms).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false });
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function load(key) {
  try { return JSON.parse(sessionStorage.getItem(key)); } catch { return null; }
}
function save(key, session) {
  try {
    if (session) sessionStorage.setItem(key, JSON.stringify(session));
    else sessionStorage.removeItem(key);
  } catch { /* storage unavailable: the session just won't survive navigation */ }
}

/**
 * Copies `text`: Clipboard API when there is one (secure context only);
 * otherwise, or if it is refused, a temporary off-screen textarea and
 * execCommand('copy'). Resolves true only if the copy really happened.
 */
async function copyText(text) {
  if (navigator.clipboard && window.isSecureContext) {
    try { await navigator.clipboard.writeText(text); return true; } catch { /* fall back below */ }
  }
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  Object.assign(ta.style, { position: 'fixed', top: '0', left: '-9999px', opacity: '0', fontSize: '12pt' });
  document.body.appendChild(ta);
  let ok = false;
  try {
    ta.select();
    ta.setSelectionRange(0, text.length);
    ok = document.execCommand('copy');
  } catch { ok = false; }
  ta.remove();
  return ok;
}

/** @returns {() => void} cleanup that stops the timer */
export function mountAssist(container, protocol) {
  const key = `elg-assist-${protocol.id}`;
  let session = load(key);
  if (session && session.protocolId !== protocol.id) session = null;
  let timer = null;
  let armedReset = false;
  // Result of the last "Copiar": null or { ok, text }. Shown under the buttons
  // until another button is tapped.
  let copied = null;

  function stepHtml(s) {
    const when =
      s.state === 'done' ? `min ${Math.round(s.doneAtMin)}` :
      s.state === 'upcoming' ? `en ${clock(s.inMin)}` :
      s.state === 'overdue' ? `+${Math.round(s.lateMin)} min` : '';
    const buttons = s.state === 'done' || s.state === 'skipped'
      ? `<button type="button" class="as-btn as-undo" data-undo="${s.id}">Deshacer</button>`
      : `<button type="button" class="as-btn" data-done="${s.id}">Hecho</button>` +
        (s.skippable ? `<button type="button" class="as-btn as-undo" data-skip="${s.id}">No corresponde</button>` : '');
    return `<li class="as-step as-${s.state}" data-step="${s.id}">` +
      `<div class="as-main"><div class="as-label">${s.label}</div>${s.detail ? `<div class="as-detail">${s.detail}</div>` : ''}</div>` +
      `<div class="as-side"><span class="as-state">${STATE_LABEL[s.state]}${when ? ` · ${when}` : ''}</span>${buttons}</div></li>`;
  }

  function copiedHtml() {
    if (!copied) return '';
    if (copied.ok) return '<p class="as-intro" data-copied role="status">Copiado.</p>';
    return '<p class="as-intro" data-copied role="status">No se pudo copiar: seleccioná el texto.</p>' +
      `<textarea class="as-note" data-note readonly rows="6" aria-label="Registro para la evolución">${esc(copied.text)}</textarea>`;
  }

  function draw() {
    if (!session) {
      container.innerHTML =
        `<div class="as-box"><div class="as-title">${protocol.title}</div>` +
        `<p class="as-intro">${protocol.intro || ''}</p>` +
        `<button type="button" class="as-btn as-start" data-start>Iniciar reloj</button></div>`;
      return;
    }
    const st = status(protocol, session, Date.now());
    container.innerHTML =
      `<div class="as-box"><div class="as-head"><div class="as-title">${protocol.title}</div>` +
      `<div class="as-clock" aria-live="off" tabindex="-1">${clock(st.elapsedMin)}</div></div>` +
      `<ol class="as-steps">${st.steps.map(stepHtml).join('')}</ol>` +
      `<div class="as-foot"><button type="button" class="as-btn" data-copy>Copiar para la evolución</button>` +
      `<button type="button" class="as-btn as-undo" data-reset>${armedReset ? 'Tocar de nuevo para borrar' : 'Reiniciar'}</button></div>` +
      `${copiedHtml()}</div>`;
  }

  // draw() rebuilds the whole box, which drops keyboard focus. focusSpot()
  // remembers which control had it; refocus() puts focus on its counterpart in
  // the new DOM: the same control, or the first button of the same step when
  // that step's buttons changed (Hecho becomes Deshacer).
  const KINDS = ['done', 'undo', 'skip', 'copy', 'reset', 'start', 'note'];
  function focusSpot(el) {
    if (!el || !container.contains(el)) return null;
    const li = el.closest('[data-step]');
    const spot = { step: li ? li.dataset.step : null, kind: KINDS.find(k => k in el.dataset) };
    if (el.tagName === 'TEXTAREA') Object.assign(spot, { from: el.selectionStart, to: el.selectionEnd, scroll: el.scrollTop });
    return spot;
  }
  function refocus(spot) {
    if (!spot) return;
    let el = null;
    if (spot.step) {
      const li = [...container.querySelectorAll('[data-step]')].find(x => x.dataset.step === spot.step);
      if (li) el = (spot.kind && li.querySelector(`[data-${spot.kind}]`)) || li.querySelector('button');
    } else if (spot.kind === 'start') {
      // Right after "Iniciar reloj", focus the clock, not the first "Hecho":
      // a second Enter must not mark the oxygen step as done.
      el = container.querySelector('.as-clock');
    } else if (spot.kind) {
      el = container.querySelector(`[data-${spot.kind}]`);
    }
    el = el || container.querySelector('button');
    if (!el) return;
    el.focus({ preventScroll: true });
    if (spot.from !== undefined && el.tagName === 'TEXTAREA') {
      el.setSelectionRange(spot.from, spot.to);
      el.scrollTop = spot.scroll;
    }
  }

  function tick() {
    if (!session) return;
    // Update in place only what changes every second, so buttons keep focus
    // between taps. A step that changed state needs one full redraw, after
    // which focus goes back to where it was.
    const st = status(protocol, session, Date.now());
    const clockEl = container.querySelector('.as-clock');
    if (clockEl) clockEl.textContent = clock(st.elapsedMin);
    const items = container.querySelectorAll('.as-step');
    let changed = false;
    st.steps.forEach((s, i) => {
      const li = items[i];
      if (!li) return;
      if (!li.classList.contains(`as-${s.state}`)) { changed = true; return; }
      if (s.state === 'upcoming' || s.state === 'overdue') {
        const when = s.state === 'upcoming' ? `en ${clock(s.inMin)}` : `+${Math.round(s.lateMin)} min`;
        li.querySelector('.as-state').textContent = `${STATE_LABEL[s.state]} · ${when}`;
      }
    });
    if (changed) {
      const spot = focusSpot(document.activeElement);
      draw();
      refocus(spot);
    }
  }

  function startTimer() {
    if (!timer) timer = setInterval(tick, 1000);
  }

  container.addEventListener('click', async e => {
    const t = e.target.closest('button');
    if (!t || !container.contains(t)) return;
    const spot = focusSpot(t);
    if (!('reset' in t.dataset) && armedReset) {
      // Any other button disarms "Reiniciar" at once, before an async copy ends.
      armedReset = false;
      const resetBtn = container.querySelector('[data-reset]');
      if (resetBtn) resetBtn.textContent = 'Reiniciar';
    }
    if (!('copy' in t.dataset)) copied = null;
    if ('start' in t.dataset) {
      session = createSession(protocol, Date.now());
      startTimer();
    } else if (t.dataset.done) {
      session = markDone(protocol, session, t.dataset.done, Date.now());
    } else if (t.dataset.skip) {
      session = skip(protocol, session, t.dataset.skip, Date.now());
    } else if (t.dataset.undo) {
      session = unmark(session, t.dataset.undo);
    } else if ('reset' in t.dataset) {
      if (!armedReset) { armedReset = true; draw(); refocus(spot); return; }
      armedReset = false;
      session = null;
      clearInterval(timer);
      timer = null;
    } else if ('copy' in t.dataset) {
      const before = session;
      const text = note(protocol, session, hhmm);
      const ok = await copyText(text);
      if (session !== before) return; // another button changed the session meanwhile
      copied = { ok, text };
      draw();
      const area = container.querySelector('[data-note]');
      if (area) { area.focus(); area.select(); } else refocus(spot);
      return;
    }
    save(key, session);
    draw();
    refocus(spot);
  });

  draw();
  if (session) startTimer();
  return () => { clearInterval(timer); timer = null; };
}
