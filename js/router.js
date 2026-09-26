// Hash-based router — the one genuinely new capability versus the legacy
// nav()/navId() (which just swapped innerHTML with no URL/history at all):
// every view now has a real, deep-linkable, back-button-friendly URL.
import { renderScoredCalculator, renderInputCalculator } from './calculators/engine.js';
import { SCORED_CALCULATORS } from './calculators/index.js';
import { compute as computeSodio } from './calculators/calc-sodio.js';
import { renderDrugReference } from './drugs.js';
import { setActiveSidebarItem } from './sidebar.js';
import { fetchLocalizedJson, fetchLocalizedText, t } from './i18n.js';

let lang = 'es';
let strings = {};
let meta = null;
let sidebarEl = null;
let screen = null;
let bcCur = null;
let bcSep = null;
let onNavigateCallback = null;
let drugsCache = null;

function notFoundHtml() {
  return `<div class="view active"><div style="padding:40px;text-align:center;color:var(--text3)"><div style="font-size:32px;margin-bottom:12px">🔧</div><div style="font-size:15px;font-weight:600;margin-bottom:6px">${t(strings, 'notFound.title')}</div><div style="font-size:13px">${t(strings, 'notFound.detail')}</div></div></div>`;
}
function fallbackNoticeHtml() {
  return `<div class="cl cl-gray mb-12">${t(strings, 'notTranslated.notice')}</div>`;
}

export function initRouter(opts) {
  lang = opts.lang;
  strings = opts.strings;
  meta = opts.meta;
  sidebarEl = opts.sidebarEl;
  screen = opts.screenEl;
  bcCur = opts.bcCurEl;
  bcSep = opts.bcSepEl;
  onNavigateCallback = opts.onNavigate;
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
  updateBreadcrumb(id);
  if (sidebarEl) setActiveSidebarItem(sidebarEl, id);

  const wrapper = document.createElement('div');
  wrapper.className = 'view active';
  screen.replaceChildren(wrapper);

  try {
    await render(id, wrapper);
  } catch (err) {
    console.error(`Failed to render view "${id}":`, err);
    screen.innerHTML = notFoundHtml();
  }
  screen.scrollTop = 0;
  if (onNavigateCallback) onNavigateCallback(id);
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
    const { data, usedFallback } = await fetchLocalizedText('content/home.html', lang);
    container.innerHTML = (usedFallback ? fallbackNoticeHtml() : '') + data;
    return;
  }
  const m = meta[id];
  if (m?.type === 'calculator') {
    const { data: def, usedFallback } = await fetchLocalizedJson(`content/calculators/${id}.json`, lang);
    if (usedFallback) container.insertAdjacentHTML('beforeend', fallbackNoticeHtml());
    const target = document.createElement('div');
    container.appendChild(target);
    if (def.groups) {
      renderScoredCalculator(target, def, SCORED_CALCULATORS[id]);
    } else {
      renderInputCalculator(target, def, computeSodio);
    }
    return;
  }
  if (m?.type === 'drugs') {
    if (!drugsCache) {
      const { data: index, usedFallback: indexFallback } = await fetchLocalizedJson('content/drugs/index.json', lang);
      const catResults = await Promise.all(index.categories.map(c => fetchLocalizedJson(`content/drugs/${c}.json`, lang)));
      drugsCache = {
        index,
        categories: catResults.map(r => r.data),
        usedFallback: indexFallback || catResults.some(r => r.usedFallback),
      };
    }
    if (drugsCache.usedFallback) container.insertAdjacentHTML('beforeend', fallbackNoticeHtml());
    const target = document.createElement('div');
    container.appendChild(target);
    renderDrugReference(target, drugsCache.index, drugsCache.categories);
    return;
  }
  // Plain content module.
  try {
    const { data, usedFallback } = await fetchLocalizedText(`content/modules/${id}.html`, lang);
    container.innerHTML = (usedFallback ? fallbackNoticeHtml() : '') + data;
  } catch {
    container.outerHTML = notFoundHtml();
  }
}
