// Renders the drug reference (content/drugs/index.json + one JSON per
// category) into a tabbed table view. One generic renderer replaces the 5
// hand-written <table> blocks the legacy VIEWS['drogas'] entry contained.

function calloutHtml(intro) {
  return `<div class="cl cl-${intro.kind || 'b'}"><div class="cl-ico">${intro.icon || ''}</div><div class="cl-body"><span class="cl-title">${intro.title || ''}</span>${intro.text || ''}</div></div>`;
}

function tableHtml(category) {
  const headRow = category.columns.map(c => `<th>${c}</th>`).join('');
  const bodyRows = category.drugs.map(d => {
    const cells = [`<td class="tbl-name">${d.name}</td>`, `<td>${d.indication}</td>`, `<td>${d.dose}</td>`];
    if (d.caution !== undefined) cells.push(`<td>${d.caution}</td>`);
    return `<tr>${cells.join('')}</tr>`;
  }).join('');
  return `<div class="tbl-wrap"><table class="tbl"><thead><tr>${headRow}</tr></thead><tbody>${bodyRows}</tbody></table></div>`;
}

/**
 * @param {HTMLElement} container
 * @param {{intro: object}} indexData - content/drugs/index.json
 * @param {Array<object>} categories - the category JSON files, in tab order
 */
export function renderDrugReference(container, indexData, categories) {
  const tabs = categories.map((c, i) =>
    `<div class="tab${i === 0 ? ' on' : ''}" data-cat="${c.id}">${c.label}</div>`
  ).join('');
  const panes = categories.map((c, i) =>
    `<div id="dr-${c.id}" class="tab-pane${i === 0 ? ' on' : ''}">${tableHtml(c)}</div>`
  ).join('');

  container.innerHTML =
    calloutHtml(indexData.intro) +
    `<div class="tabs" style="flex-wrap:wrap">${tabs}</div>` +
    panes;

  container.addEventListener('click', e => {
    const tab = e.target.closest('.tab');
    if (!tab || !container.contains(tab)) return;
    container.querySelectorAll('.tabs .tab').forEach(t => t.classList.toggle('on', t === tab));
    container.querySelectorAll('.tab-pane').forEach(p => p.classList.toggle('on', p.id === `dr-${tab.dataset.cat}`));
  });
}
