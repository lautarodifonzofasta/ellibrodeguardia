// Renders the sidebar from content/meta.json instead of ~400 lines of
// hand-duplicated markup — this is also what fixes the pre-existing bug
// where 8 modules were only in the sidebar HTML and not in the old META
// object (invisible to search): now there's exactly one source of truth.
import { search } from './search-engine.js';

const BADGE_LABEL = { crit: 'CRIT', calc: 'CALC', ref: 'REF' };

export function renderSidebar(container, meta) {
  let html = '';
  let lastCategory = null;
  for (const [id, m] of Object.entries(meta)) {
    if (m.category !== lastCategory) {
      if (lastCategory !== null) html += '</div><div class="sb-div"></div>';
      html += `<div class="sb-section"><div class="sb-section-lbl">${m.category}</div>`;
      lastCategory = m.category;
    }
    const badge = m.badge ? `<span class="sb-badge b-${m.badge}">${BADGE_LABEL[m.badge] || m.badge.toUpperCase()}</span>` : '';
    const sub = m.sub ? `<div class="sb-item-sub">${m.sub}</div>` : '';
    html += `<div class="sb-item" data-view="${id}">` +
      `<span class="sb-item-ico">${m.icon}</span>` +
      `<div class="sb-item-txt"><div class="sb-item-name">${m.title}</div>${sub}</div>` +
      badge +
      `</div>`;
  }
  html += '</div>';
  container.innerHTML = html;
}

export function setActiveSidebarItem(container, id) {
  container.querySelectorAll('.sb-item').forEach(el => el.classList.toggle('active', el.dataset.view === id));
}

// Same engine as the home and the search modal (synonyms, typos); the plain
// text match is kept on top, so nothing that matched before disappears.
// Category labels stay visible, as before.
export function filterSidebar(container, query, index) {
  const q = query.trim().toLowerCase();
  const hits = q && index ? new Set((search(index, query) ?? []).map(r => r.id)) : null;
  container.querySelectorAll('.sb-item').forEach(el => {
    el.style.display = !q || hits?.has(el.dataset.view) || el.textContent.toLowerCase().includes(q) ? '' : 'none';
  });
}
