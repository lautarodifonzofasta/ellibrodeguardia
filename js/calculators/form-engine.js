// Generic renderer for free-input calculators: number/select fields in, one
// verdict out. Driven by content/calculators/<id>.json ("form": true) plus a
// pure compute(values) from js/calculators/, registered in FORM_CALCULATORS
// (index.js). calc-sodio predates this and keeps its own renderer in engine.js.
//
// Definition:
//   "inputs": [{ "id", "label", "type": "number" | "select", "unit"?, "min"?,
//                "max"?, "step"?, "placeholder"?, "default"?, "options"? }]
//   "placeholder": text shown until compute() has enough to work with
// compute(values) gets every field by id — numbers as Number (an empty or
// invalid field is undefined), selects as their string value — and returns
// null (not enough data) or
//   { severity: 'red'|'amber'|'green'|'neutral', score?, label, lines: [html] }
// "lines" is trusted markup written in js/calculators/, never user input.

const SEVERITY_CLASS = { red: 'show-r', amber: 'show-a', green: 'show-g', neutral: 'show-n' };

function escapeAttr(s) {
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

function attr(name, value) {
  return value === undefined ? '' : ` ${name}="${escapeAttr(value)}"`;
}

function fieldHtml(inp) {
  const label = `<label for="${escapeAttr(inp.id)}">${inp.label}${inp.unit ? ` (${inp.unit})` : ''}</label>`;
  if (inp.type === 'select') {
    const options = inp.options
      .map(o => `<option value="${escapeAttr(o.value)}"${o.value === inp.default ? ' selected' : ''}>${o.label}</option>`)
      .join('');
    return `<div class="calc-input-row">${label}<select id="${escapeAttr(inp.id)}" data-field="${escapeAttr(inp.id)}">${options}</select></div>`;
  }
  return `<div class="calc-input-row">${label}<input type="number" inputmode="decimal" id="${escapeAttr(inp.id)}" data-field="${escapeAttr(inp.id)}"` +
    attr('value', inp.default) + attr('min', inp.min) + attr('max', inp.max) + attr('step', inp.step) + attr('placeholder', inp.placeholder) + `></div>`;
}

/** Reads the form into the object compute() receives. Exported for tests. */
export function readValues(definition, getRaw) {
  const values = {};
  for (const inp of definition.inputs) {
    const raw = getRaw(inp.id);
    if (inp.type === 'select') {
      values[inp.id] = raw;
    } else {
      const n = raw === '' || raw === null || raw === undefined ? NaN : Number(String(raw).replace(',', '.'));
      values[inp.id] = Number.isFinite(n) ? n : undefined;
    }
  }
  return values;
}

export function renderFormCalculator(container, definition, compute) {
  const intro = definition.intro
    ? `<div class="cl cl-${definition.intro.kind || 'b'} mb-12"><div class="cl-ico">${definition.intro.icon || ''}</div><div class="cl-body"><span class="cl-title">${definition.intro.title || ''}</span>${definition.intro.text || ''}</div></div>`
    : '';
  container.innerHTML =
    intro +
    `<div class="card calc-card"><div class="card-body">` +
    `<div class="calc-inputs">${definition.inputs.map(fieldHtml).join('')}</div>` +
    `<div class="calc-result is-pending" data-result aria-live="polite">` +
    `<div class="cr-score"></div><div class="cr-label"></div><div class="cr-detail"></div></div>` +
    `</div></div>`;

  const resultEl = container.querySelector('[data-result]');
  const scoreEl = resultEl.querySelector('.cr-score');
  const labelEl = resultEl.querySelector('.cr-label');
  const detailEl = resultEl.querySelector('.cr-detail');

  function recompute() {
    const values = readValues(definition, id => container.querySelector(`[data-field="${id}"]`).value);
    const r = compute(values);
    if (!r) {
      resultEl.className = 'calc-result is-pending';
      scoreEl.textContent = '';
      labelEl.textContent = '';
      detailEl.textContent = definition.placeholder || '';
      return;
    }
    resultEl.className = `calc-result ${SEVERITY_CLASS[r.severity] || SEVERITY_CLASS.neutral}`;
    scoreEl.textContent = r.score ?? '';
    labelEl.textContent = r.label;
    detailEl.innerHTML = (r.lines || []).join('<br>');
  }

  container.addEventListener('input', recompute);
  container.addEventListener('change', recompute);
  recompute();
}
