// Hash-based router — the one genuinely new capability versus the legacy
// nav()/navId() (which just swapped innerHTML with no URL/history at all):
// every view now has a real, deep-linkable, back-button-friendly URL.
import { renderScoredCalculator, renderInputCalculator } from './calculators/engine.js';
import { SCORED_CALCULATORS } from './calculators/index.js';
import { compute as computeSodio } from './calculators/calc-sodio.js';
import { renderDrugReference } from './drugs.js';
import { setActiveSidebarItem } from './sidebar.js';

const NOT_FOUND_HTML = `<div class="view active"><div style="padding:40px;text-align:center;color:var(--text3)"><div style="font-size:32px;margin-bottom:12px">🔧</div><div style="font-size:15px;font-weight:600;margin-bottom:6px">Módulo en construcción</div><div style="font-size:13px">Disponible en la próxima actualización.</div></div></div>`;

let meta = null;
let sidebarEl = null;
let screen = null;
let bcCur = null;
let bcSep = null;
let onNavigateCallback = null;
let drugsCache = null;
// A view's renderer may return a cleanup function (timers, listeners, wake
// lock); it runs before the next view renders. navToken identifies the latest
// navigation, so a render that finishes after the user already moved on is
// cleaned up immediately instead of being kept.
let viewCleanup = null;
let navToken = 0;

export function initRouter({ meta: metaData, sidebarEl: sb, screenEl, bcCurEl, bcSepEl, onNavigate }) {
  meta = metaData;
  sidebarEl = sb;
  screen = screenEl;
  bcCur = bcCurEl;
  bcSep = bcSepEl;
  onNavigateCallback = onNavigate;
  window.addEventListener('hashchange', () => navigate(currentId()));
  navigate(currentId());
}

export function currentId() {
  return location.hash.slice(1) || 'home';
}

export function goTo(id) {
  if (currentId() === id) {
    navigate(id);
  } else {
    location.hash = id;
  }
}

async function navigate(id) {
  const token = ++navToken;
  runViewCleanup();
  updateBreadcrumb(id);
  if (sidebarEl) setActiveSidebarItem(sidebarEl, id);

  const wrapper = document.createElement('div');
  wrapper.className = 'view active';
  screen.replaceChildren(wrapper);

  let cleanup;
  try {
    cleanup = await render(id, wrapper);
  } catch (err) {
    console.error(`Failed to render view "${id}":`, err);
    if (token !== navToken) return; // the user already moved on; leave their current view alone
    screen.innerHTML = NOT_FOUND_HTML;
  }
  if (token !== navToken) {
    if (typeof cleanup === 'function') {
      try { cleanup(); } catch (err) { console.error('View cleanup failed:', err); }
    }
    return;
  }
  if (typeof cleanup === 'function') viewCleanup = cleanup;
  screen.scrollTop = 0;
  if (onNavigateCallback) onNavigateCallback(id);
}

function runViewCleanup() {
  if (!viewCleanup) return;
  const cleanup = viewCleanup;
  viewCleanup = null;
  try {
    cleanup();
  } catch (err) {
    console.error('View cleanup failed:', err);
  }
}

function updateBreadcrumb(id) {
  if (id === 'home') {
    bcCur.textContent = '';
    bcSep.style.display = 'none';
    return;
  }
  const m = meta[id];
  bcCur.textContent = m ? m.title : id;
  bcSep.style.display = 'inline';
}

async function render(id, container) {
  if (id === 'home') {
    container.innerHTML = await fetchText('content/home.html');
    return;
  }
  const m = meta[id];
  if (m?.type === 'calculator') {
    const def = await fetchJson(`content/calculators/${id}.json`);
    if (def.groups) {
      renderScoredCalculator(container, def, SCORED_CALCULATORS[id]);
    } else {
      renderInputCalculator(container, def, computeSodio);
    }
    return;
  }
  if (m?.type === 'drugs') {
    if (!drugsCache) {
      const index = await fetchJson('content/drugs/index.json');
      const categories = await Promise.all(index.categories.map(c => fetchJson(`content/drugs/${c}.json`)));
      drugsCache = { index, categories };
    }
    renderDrugReference(container, drugsCache.index, drugsCache.categories);
    return;
  }
  // Plain content module.
  const res = await fetch(`content/modules/${id}.html`);
  if (!res.ok) {
    container.outerHTML = NOT_FOUND_HTML;
    return;
  }
  container.innerHTML = await res.text();
  await mountEmbeddedCalculators(container);
}

// A content module can embed a scored calculator with
// <div data-calculator="calc-id"></div>: it's rendered through the same
// JSON + interpret() path as a standalone calculator view. A slot that fails
// shows a short notice, so the rest of the module stays usable.
async function mountEmbeddedCalculators(container) {
  const slots = container.querySelectorAll('[data-calculator]');
  await Promise.all([...slots].map(async slot => {
    const id = slot.dataset.calculator;
    try {
      const interpret = SCORED_CALCULATORS[id];
      if (!interpret) throw new Error('not in SCORED_CALCULATORS');
      renderScoredCalculator(slot, await fetchJson(`content/calculators/${id}.json`), interpret);
    } catch (err) {
      console.error(`Failed to mount embedded calculator "${id}":`, err);
      slot.innerHTML = '<div class="cl cl-a"><div class="cl-ico">⚠️</div><div class="cl-body">No se pudo cargar el checklist. Recargá la página.</div></div>';
    }
  }));
}

async function fetchText(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`${path}: ${res.status}`);
  return res.text();
}
async function fetchJson(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`${path}: ${res.status}`);
  return res.json();
}
