// App entry point: wires together the sidebar, search, theme, router, and
// PWA install prompt. Everything here uses addEventListener + data attributes
// (no inline onclick) — see legacy-bridge.js for the one place old-style
// handlers are still needed, scoped to unmodified extracted content.
import { installLegacyBridge } from './legacy-bridge.js';
import { renderSidebar, filterSidebar } from './sidebar.js';
import { buildSearchIndex, initSearch } from './search.js';
import { initTheme } from './theme.js';
import { initRouter, goTo } from './router.js';
import { getLang, setLang, LANGUAGES, fetchLocalizedJson, applyStringsToDom } from './i18n.js';

const lang = getLang();
document.documentElement.lang = lang;

const sidebarEl = document.getElementById('sidebar');
const sbScroll = document.getElementById('sb-scroll');
const screen = document.getElementById('screen');
const bcCur = document.getElementById('bc-cur');
const bcSep = document.getElementById('bc-sep');

async function boot() {
  const { data: strings } = await fetchLocalizedJson('content/strings.json', lang);
  applyStringsToDom(strings);
  initLangToggle();
  installLegacyBridge(lang, strings);

  const { data: meta } = await fetchLocalizedJson('content/meta.json', lang);

  renderSidebar(sbScroll, meta);
  sbScroll.addEventListener('click', e => {
    const item = e.target.closest('.sb-item');
    if (item) goTo(item.dataset.view);
  });

  document.getElementById('sb-filter-inp').addEventListener('input', e => filterSidebar(sbScroll, e.target.value));
  document.getElementById('bc-root').addEventListener('click', () => goTo('home'));

  initTheme(document.getElementById('theme-btn'));

  const searchIndex = buildSearchIndex(meta);
  initSearch({
    modal: document.getElementById('search-modal'),
    input: document.getElementById('s-inp'),
    results: document.getElementById('s-results'),
    openBtn: document.getElementById('tb-search-btn'),
    kbdHint: document.getElementById('tb-kbd-hint'),
    index: searchIndex,
    strings,
    onNavigate: goTo,
  });

  initSidebarToggle();
  initInstallPrompt();
  initScrollFab();
  registerServiceWorker();

  if (window.innerWidth > 768) {
    document.getElementById('tb-kbd-hint').style.display = 'inline';
  }

  initRouter({
    lang,
    strings,
    meta,
    sidebarEl: sbScroll,
    screenEl: screen,
    bcCurEl: bcCur,
    bcSepEl: bcSep,
    onNavigate: () => {
      if (window.innerWidth <= 768) closeSidebar();
    },
  });
}

function initLangToggle() {
  const btn = document.getElementById('lang-btn');
  const menu = document.getElementById('lang-menu');
  const current = LANGUAGES.find(l => l.code === lang) || LANGUAGES[0];
  btn.innerHTML = current.flagSvg;

  menu.innerHTML = LANGUAGES.map(l => `
    <div class="lang-menu-item${l.code === lang ? ' active' : ''}" data-lang="${l.code}">
      <span class="lang-menu-flag">${l.flagSvg}</span>
      <span>${l.name}</span>
      ${l.code === lang ? '<span class="lang-menu-check">✓</span>' : ''}
    </div>
  `).join('');

  const closeMenu = () => {
    menu.hidden = true;
    btn.setAttribute('aria-expanded', 'false');
  };
  const openMenu = () => {
    menu.hidden = false;
    btn.setAttribute('aria-expanded', 'true');
  };

  btn.addEventListener('click', e => {
    e.stopPropagation();
    if (menu.hidden) openMenu(); else closeMenu();
  });
  menu.addEventListener('click', e => {
    const item = e.target.closest('.lang-menu-item');
    if (item && item.dataset.lang !== lang) setLang(item.dataset.lang);
  });
  document.addEventListener('click', e => {
    if (!menu.hidden && !e.target.closest('#lang-switch')) closeMenu();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !menu.hidden) closeMenu();
  });
}

function initSidebarToggle() {
  const openBtn = document.getElementById('ham-btn');
  const overlay = document.getElementById('sb-overlay');
  openBtn.addEventListener('click', () => {
    sidebarEl.classList.add('open');
    overlay.classList.add('open');
  });
  overlay.addEventListener('click', closeSidebar);
}
function closeSidebar() {
  sidebarEl.classList.remove('open');
  document.getElementById('sb-overlay').classList.remove('open');
}

function initScrollFab() {
  const fab = document.getElementById('fab-top');
  screen.addEventListener('scroll', () => {
    fab.classList.toggle('visible', screen.scrollTop > 300);
  });
  fab.addEventListener('click', () => screen.scrollTo({ top: 0, behavior: 'smooth' }));
}

function initInstallPrompt() {
  let deferredPrompt = null;
  const btn = document.getElementById('btn-install');
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferredPrompt = e;
    btn.classList.add('visible');
  });
  window.addEventListener('appinstalled', () => {
    btn.classList.remove('visible');
    deferredPrompt = null;
  });
  btn.addEventListener('click', () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then(() => { deferredPrompt = null; });
  });
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('sw.js')
    .then(() => console.log('SW: El Libro de Guardia registrado'))
    .catch(e => console.warn('SW no disponible:', e.message));
}

boot();
