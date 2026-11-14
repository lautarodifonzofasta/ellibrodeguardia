// DOM for a timed protocol (see timeline.js). Mounted by js/router.js into a
// <div data-assist="id"> inside a content module. The session lives in
// sessionStorage, so leaving the module and coming back keeps the clock
// running; it is per tab and disappears when the tab closes.
import { createSession, markDone, unmark, status, clock, note } from './timeline.js';

const STATE_LABEL = { done: 'Hecho', waiting: 'Después del anterior', upcoming: 'Falta', due: 'Ahora', overdue: 'Atrasado' };
const hhmm = ms => new Date(ms).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false });

function load(key) {
  try { return JSON.parse(sessionStorage.getItem(key)); } catch { return null; }
}
function save(key, session) {
  try {
    if (session) sessionStorage.setItem(key, JSON.stringify(session));
    else sessionStorage.removeItem(key);
  } catch { /* storage unavailable: the session just won't survive navigation */ }
}

/** @returns {() => void} cleanup that stops the timer */
export function mountAssist(container, protocol) {
  const key = `elg-assist-${protocol.id}`;
  let session = load(key);
  if (session && session.protocolId !== protocol.id) session = null;
  let timer = null;
  let armedReset = false;

  function stepHtml(s) {
    const when =
      s.state === 'done' ? `min ${Math.round(s.doneAtMin)}` :
      s.state === 'upcoming' ? `en ${clock(s.inMin)}` :
      s.state === 'overdue' ? `+${Math.round(s.lateMin)} min` : '';
    const button = s.state === 'done'
      ? `<button type="button" class="as-btn as-undo" data-undo="${s.id}">Deshacer</button>`
      : `<button type="button" class="as-btn" data-done="${s.id}">Hecho</button>`;
    return `<li class="as-step as-${s.state}">` +
      `<div class="as-main"><div class="as-label">${s.label}</div>${s.detail ? `<div class="as-detail">${s.detail}</div>` : ''}</div>` +
      `<div class="as-side"><span class="as-state">${STATE_LABEL[s.state]}${when ? ` · ${when}` : ''}</span>${button}</div></li>`;
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
      `<div class="as-clock" aria-live="off">${clock(st.elapsedMin)}</div></div>` +
      `<ol class="as-steps">${st.steps.map(stepHtml).join('')}</ol>` +
      `<div class="as-foot"><button type="button" class="as-btn" data-copy>Copiar para la evolución</button>` +
      `<button type="button" class="as-btn as-undo" data-reset>${armedReset ? 'Tocar de nuevo para borrar' : 'Reiniciar'}</button></div>` +
      `<p class="as-intro" data-copied hidden>Copiado.</p></div>`;
  }

  function tick() {
    if (!session) return;
    // Redraw only what changes every second, so buttons keep focus between taps.
    const st = status(protocol, session, Date.now());
    const clockEl = container.querySelector('.as-clock');
    if (clockEl) clockEl.textContent = clock(st.elapsedMin);
    const items = container.querySelectorAll('.as-step');
    st.steps.forEach((s, i) => {
      const li = items[i];
      if (!li) return;
      if (!li.classList.contains(`as-${s.state}`)) { draw(); return; }
      if (s.state === 'upcoming' || s.state === 'overdue') {
        const when = s.state === 'upcoming' ? `en ${clock(s.inMin)}` : `+${Math.round(s.lateMin)} min`;
        li.querySelector('.as-state').textContent = `${STATE_LABEL[s.state]} · ${when}`;
      }
    });
  }

  function startTimer() {
    if (!timer) timer = setInterval(tick, 1000);
  }

  container.addEventListener('click', async e => {
    const t = e.target.closest('button');
    if (!t || !container.contains(t)) return;
    if (!('reset' in t.dataset)) armedReset = false;
    if ('start' in t.dataset) {
      session = createSession(protocol, Date.now());
      startTimer();
    } else if (t.dataset.done) {
      session = markDone(protocol, session, t.dataset.done, Date.now());
    } else if (t.dataset.undo) {
      session = unmark(session, t.dataset.undo);
    } else if ('reset' in t.dataset) {
      if (!armedReset) { armedReset = true; draw(); return; }
      armedReset = false;
      session = null;
      clearInterval(timer);
      timer = null;
    } else if ('copy' in t.dataset) {
      const text = note(protocol, session, hhmm);
      try { await navigator.clipboard.writeText(text); } catch { /* clipboard blocked: nothing to do */ }
      const msg = container.querySelector('[data-copied]');
      if (msg) msg.hidden = false;
      return;
    }
    save(key, session);
    draw();
  });

  draw();
  if (session) startTimer();
  return () => { clearInterval(timer); timer = null; };
}
