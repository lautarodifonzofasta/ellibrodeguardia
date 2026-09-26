// Theme toggle. Small deliberate improvement over the legacy version: it
// persists the choice in localStorage (the original always reset to dark
// data-theme="dark" on reload, matching neither the saved choice nor the OS
// preference) and falls back to prefers-color-scheme on first visit.
const STORAGE_KEY = 'elg-theme';

export function initTheme(themeBtn) {
  const saved = safeGet();
  const theme = saved || (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
  applyTheme(theme, themeBtn);

  themeBtn.addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    applyTheme(next, themeBtn);
    safeSet(next);
  });
}

function applyTheme(theme, themeBtn) {
  document.documentElement.dataset.theme = theme;
  themeBtn.textContent = theme === 'dark' ? '🌙' : '☀️';
}

function safeGet() {
  try { return localStorage.getItem(STORAGE_KEY); } catch { return null; }
}
function safeSet(value) {
  try { localStorage.setItem(STORAGE_KEY, value); } catch { /* private mode / storage disabled: theme just won't persist */ }
}
