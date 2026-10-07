// Search modal (Ctrl/Cmd+K). Same look as before; the matching now comes from
// js/search-engine.js — the same engine as the home search box and the sidebar
// filter — so it understands synonyms, abbreviations and typos.
import { search } from './search-engine.js';

const MAX_RESULTS = 12;

export function initSearch({ modal, input, results, openBtn, kbdHint, index, onNavigate }) {
  // With an empty box the modal lists every entry, in meta.json order.
  const allIds = Object.keys(index.meta).filter(id => id !== 'home');

  function open() {
    modal.classList.add('open');
    setTimeout(() => input.focus(), 50);
    render('');
  }
  function close() {
    modal.classList.remove('open');
    input.value = '';
  }
  function render(query) {
    const found = search(index, query);
    const ids = found ? found.map(r => r.id) : allIds;
    if (!ids.length) {
      results.innerHTML = `<div class="s-empty">Sin resultados para "${esc(query)}"</div>`;
      return;
    }
    results.innerHTML = ids.slice(0, MAX_RESULTS).map(id => {
      const m = index.meta[id];
      return `<div class="s-item" data-id="${id}">` +
        `<span class="s-item-ico">${m.icon}</span>` +
        `<div><div class="s-item-name">${m.title}</div><div class="s-item-cat">${m.category}</div></div>` +
        `<span class="s-item-arr">→</span>` +
        `</div>`;
    }).join('');
  }

  openBtn.addEventListener('click', open);
  if (kbdHint) kbdHint.addEventListener('click', open);
  modal.querySelector('.s-backdrop').addEventListener('click', close);
  modal.querySelector('.s-esc').addEventListener('click', close);
  input.addEventListener('input', () => render(input.value));
  results.addEventListener('click', e => {
    const item = e.target.closest('.s-item');
    if (!item) return;
    close();
    onNavigate(item.dataset.id);
  });
  document.addEventListener('keydown', e => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); open(); }
    if (e.key === 'Escape') close();
  });

  return { open, close };
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
