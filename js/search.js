// Search modal — same Ctrl/Cmd+K substring-match UX as the legacy doSearch(),
// but built from meta.json so it covers every module (fixing the 8-module
// gap) instead of the old hand-maintained META object.

export function buildSearchIndex(meta) {
  return Object.entries(meta)
    .filter(([id]) => id !== 'home')
    .map(([id, m]) => ({ id, title: m.title, category: m.category, icon: m.icon }));
}

export function initSearch({ modal, input, results, openBtn, kbdHint, index, onNavigate }) {
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
    const q = query.toLowerCase();
    const items = q
      ? index.filter(m => m.title.toLowerCase().includes(q) || m.category.toLowerCase().includes(q) || m.id.toLowerCase().includes(q))
      : index;
    if (!items.length) {
      results.innerHTML = `<div class="s-empty">Sin resultados para "${query}"</div>`;
      return;
    }
    results.innerHTML = items.slice(0, 12).map(m =>
      `<div class="s-item" data-id="${m.id}">` +
      `<span class="s-item-ico">${m.icon}</span>` +
      `<div><div class="s-item-name">${m.title}</div><div class="s-item-cat">${m.category}</div></div>` +
      `<span class="s-item-arr">→</span>` +
      `</div>`
    ).join('');
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
