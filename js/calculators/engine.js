// Generic renderer for the 9 interactive calculators, driven entirely by
// content/calculators/<id>.json. Replaces the old approach of hand-writing
// .calc-grid/.calc-opt markup once per calculator (calcToggle/calcCheck/
// evalCalc/renderCalcResult in legacy-index.html) with one implementation,
// using addEventListener + event delegation instead of inline onclick.

function escapeAttr(s) {
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

function calloutHtml(intro) {
  if (!intro) return '';
  const kindClass = `cl-${intro.kind || 'b'}`;
  return `<div class="cl ${kindClass} mb-12"><div class="cl-ico">${intro.icon || ''}</div><div class="cl-body"><span class="cl-title">${intro.title || ''}</span>${intro.text || ''}</div></div>`;
}

function optionHtml(groupId, groupType, opt, index) {
  const shape = groupType === 'multi' ? 'border-radius:3px' : '';
  const badge = opt.badge !== undefined ? opt.badge : opt.points;
  return `<div class="calc-opt" data-group="${escapeAttr(groupId)}" data-index="${index}" data-points="${opt.points}" role="button" tabindex="0">` +
    `<div class="calc-opt-chk" style="${shape}"></div>` +
    `<div class="calc-opt-lbl">${opt.label}</div>` +
    `<div class="calc-opt-pts">${badge}</div>` +
    `</div>`;
}

function groupHtml(group, groupIndex) {
  const gid = group.id ?? `g${groupIndex}`;
  const heading = group.label
    ? `<div class="sec-hd${groupIndex === 0 ? '' : ' mt-12'}"><div class="sec-hd-lbl">${group.label}</div><div class="sec-hd-line"></div></div>`
    : '';
  const options = group.options.map((o, i) => optionHtml(gid, group.type, o, i)).join('');
  return `${heading}<div class="calc-grid" data-group-type="${group.type}">${options}</div>`;
}

function resultHtml(result) {
  return `<div class="calc-result" data-result>` +
    `<div class="cr-score">${result.initialScore}</div>` +
    `<div class="cr-label">${result.initialLabel}</div>` +
    `<div class="cr-detail">${result.note}</div>` +
    `</div>`;
}

/**
 * Renders a scored (option-group) calculator into `container` and wires up
 * click handling. `interpret(score)` is one of js/calculators/calc-*.js.
 */
export function renderScoredCalculator(container, definition, interpret) {
  container.innerHTML =
    calloutHtml(definition.intro) +
    `<div class="card"><div class="card-body">` +
    definition.groups.map(groupHtml).join('') +
    resultHtml(definition.result) +
    `</div></div>`;

  const resultEl = container.querySelector('[data-result]');

  function recompute() {
    let score = 0;
    container.querySelectorAll('.calc-opt.sel').forEach(el => {
      score += parseFloat(el.dataset.points);
    });
    const r = interpret(score);
    const text = definition.results[r.resultId];
    resultEl.className = `calc-result show-${{ red: 'r', amber: 'a', green: 'g' }[r.severity]}`;
    resultEl.querySelector('.cr-score').textContent = score;
    resultEl.querySelector('.cr-label').textContent = text.label;
    resultEl.querySelector('.cr-detail').textContent = text.detail;
  }

  container.addEventListener('click', e => {
    const opt = e.target.closest('.calc-opt');
    if (!opt || !container.contains(opt)) return;
    const grid = opt.closest('.calc-grid');
    if (grid.dataset.groupType === 'single') {
      grid.querySelectorAll('.calc-opt.sel').forEach(el => el.classList.remove('sel'));
      opt.classList.add('sel');
    } else {
      opt.classList.toggle('sel');
    }
    recompute();
  });
}

/**
 * Renders a free-input calculator (currently only calc-sodio) into
 * `container`. `compute(input)` is js/calculators/calc-sodio.js's compute().
 */
export function renderInputCalculator(container, definition, compute) {
  const inputsHtml = definition.inputs.map(inp => {
    if (inp.type === 'select') {
      const options = inp.options.map(o => `<option value="${escapeAttr(o.value)}"${o.value === inp.default ? ' selected' : ''}>${o.label}</option>`).join('');
      return `<div class="calc-input-row"><label>${inp.label}</label><select id="${inp.id}">${options}</select></div>`;
    }
    return `<div class="calc-input-row"><label>${inp.label}</label><input type="${inp.type}" id="${inp.id}" value="${inp.default}" min="${inp.min}" max="${inp.max}"></div>`;
  }).join('');

  container.innerHTML =
    calloutHtml(definition.intro) +
    `<div class="card"><div class="card-body">` +
    `<div class="calc-inputs">${inputsHtml}</div>` +
    `<div data-sodio-out style="margin-top:14px;padding:12px;background:var(--bg3);border-radius:10px;border:1px solid var(--border);font-size:13px;color:var(--text2);line-height:1.8">${definition.placeholder}</div>` +
    `</div></div>`;

  const out = container.querySelector('[data-sodio-out]');
  const ids = definition.inputs.map(i => i.id);

  function recompute() {
    const values = {};
    for (const id of ids) values[id] = parseFloat(container.querySelector(`#${id}`).value);
    const r = compute({ actual: values['na-actual'], target: values['na-obj'], weightKg: values['na-peso'], sexFactor: values['na-sexo'] });
    if (!r) return;
    const o = definition.output;
    out.innerHTML =
      `<strong>${o.actLabel}</strong> ${r.act.toFixed(1)} ${o.actUnit}<br>` +
      `<strong>${o.deficitLabel}</strong> ${r.deficit} ${o.deficitUnit}<br>` +
      `<strong>${o.volumeLabel}</strong> ${r.volumeMl} ${o.volumeUnit}<br>` +
      `<strong>${o.rateLabel}</strong> ${r.rateMlPerHour} ${o.rateUnit}<br>` +
      `<span style="color:var(--red)">${o.warning}</span>`;
  }

  container.addEventListener('input', recompute);
  container.addEventListener('change', recompute);
}
