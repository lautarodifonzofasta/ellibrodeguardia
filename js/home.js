// Home: the central «¿Qué tiene el paciente?» search box. Shows clinical
// modules only (no calculators or drugs); when the query is a chief complaint,
// the first module carries the «No te olvides» line.
// Results are plain #id links: the router navigates on hashchange.
import { search, categoryName } from './search-engine.js';

const MAX_RESULTS = 8;

export function mountHome(container, index) {
  const input = container.querySelector('#home-q');
  const results = container.querySelector('#home-results');
  const clear = container.querySelector('#home-clear');
  if (!input || !results || !clear || !index) return;

  let timer = null;
  const render = () => {
    const query = input.value;
    clear.hidden = !query;
    const found = search(index, query, { kinds: ['mod'] });
    if (!found) {
      results.innerHTML = '';
    } else if (!found.length) {
      results.innerHTML = `<div class="home-empty">Sin resultados para «${esc(query.trim())}». Probá con el síntoma o con otra palabra.</div>`;
    } else {
      results.innerHTML = `<div class="home-list">${found.slice(0, MAX_RESULTS).map(r => resultHtml(r, index.meta)).join('')}</div>`;
    }
  };

  input.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(render, 60);
  });
  // On phones, Enter («Buscar») closes the keyboard so the results show.
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') input.blur();
  });
  clear.addEventListener('click', () => {
    input.value = '';
    render();
    input.focus();
  });

  return () => clearTimeout(timer);
}

function resultHtml(r, meta) {
  const m = meta[r.id];
  const via = r.via ? ` · <span class="home-why">por «${esc(r.via)}»</span>` : '';
  const crit = m.badge === 'crit' ? '<span class="sb-badge b-crit">CRIT</span>' : '';
  const dontMiss = r.dontMiss?.length
    ? `<div class="home-nt"><b>No te olvides:</b>${r.dontMiss.map(d =>
        d.module && d.module !== r.id ? `<a href="#${d.module}">${esc(d.label)}</a>` : esc(d.label)
      ).join('<span class="home-sep"> · </span>')}</div>`
    : '';
  return `<div class="home-item"><a class="home-row" href="#${r.id}">` +
    `<span class="home-ico" aria-hidden="true">${m.icon}</span>` +
    `<span class="home-txt"><span class="home-name">${esc(m.title)}</span>` +
    `<span class="home-cat">${esc(categoryName(m.category))}${via}</span></span>` +
    `${crit}<span class="home-arr" aria-hidden="true">→</span></a>${dontMiss}</div>`;
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
