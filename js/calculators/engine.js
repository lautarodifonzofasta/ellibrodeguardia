// Generic renderer for the interactive calculators, driven entirely by
// content/calculators/<id>.json. Replaces the old approach of hand-writing
// .calc-grid/.calc-opt markup once per calculator (calcToggle/calcCheck/
// evalCalc/renderCalcResult in legacy-index.html) with one implementation,
// using addEventListener + event delegation instead of inline onclick.
//
// Optional definition flags, for checklists whose points only encode which
// result applies (e.g. calc-tac-craneo, embedded in the TEC module):
//   "hidePoints": true         no per-option point badges and no numeric score
//   "showInitialResult": true  show interpret(0) — the "nothing marked" result —
//                              from the start; "result" can then be omitted
// interpret() may also return severity 'neutral' (no red/amber/green tint).

const SEVERITY_CLASS = { red: 'show-r', amber: 'show-a', green: 'show-g', neutral: 'show-n' };

function escapeAttr(s) {
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

function calloutHtml(intro) {
  if (!intro) return '';
  const kindClass = `cl-${intro.kind || 'b'}`;
  return `<div class="cl ${kindClass} mb-12"><div class="cl-ico">${intro.icon || ''}</div><div class="cl-body"><span class="cl-title">${intro.title || ''}</span>${intro.text || ''}</div></div>`;
}

function optionHtml(groupId, groupType, opt, index, hidePoints) {
  const shape = groupType === 'multi' ? 'border-radius:3px' : '';
  const badge = opt.badge !== undefined ? opt.badge : opt.points;
  return `<div class="calc-opt" data-group="${escapeAttr(groupId)}" data-index="${index}" data-points="${opt.points}" role="button" tabindex="0" aria-pressed="false">` +
    `<div class="calc-opt-chk" style="${shape}"></div>` +
    `<div class="calc-opt-lbl">${opt.label}</div>` +
    (hidePoints ? '' : `<div class="calc-opt-pts">${badge}</div>`) +
    `</div>`;
}

function groupHtml(group, groupIndex, hidePoints) {
  const gid = group.id ?? `g${groupIndex}`;
  const heading = group.label
    ? `<div class="sec-hd${groupIndex === 0 ? '' : ' mt-12'}"><div class="sec-hd-lbl">${group.label}</div><div class="sec-hd-line"></div></div>`
    : '';
  const options = group.options.map((o, i) => optionHtml(gid, group.type, o, i, hidePoints)).join('');
  return `${heading}<div class="calc-grid" data-group-type="${group.type}">${options}</div>`;
}

function resultHtml(result = {}, hidePoints) {
  return `<div class="calc-result" data-result aria-live="polite">` +
    (hidePoints ? '' : `<div class="cr-score">${result.initialScore ?? ''}</div>`) +
    `<div class="cr-label">${result.initialLabel ?? ''}</div>` +
    `<div class="cr-detail">${result.note ?? ''}</div>` +
    `</div>`;
}

/**
 * Renders a scored (option-group) calculator into `container` and wires up
 * click and keyboard (Enter/Space) handling. `interpret(score)` is one of
 * js/calculators/calc-*.js.
 */
export function renderScoredCalculator(container, definition, interpret) {
  const hidePoints = definition.hidePoints === true;
  container.innerHTML =
    calloutHtml(definition.intro) +
    `<div class="card"><div class="card-body">` +
    definition.groups.map((g, i) => groupHtml(g, i, hidePoints)).join('') +
    resultHtml(definition.result, hidePoints) +
    `</div></div>`;

  const resultEl = container.querySelector('[data-result]');

  function recompute() {
    let score = 0;
    container.querySelectorAll('.calc-opt.sel').forEach(el => {
      score += parseFloat(el.dataset.points);
    });
    const r = interpret(score);
    resultEl.className = `calc-result ${SEVERITY_CLASS[r.severity]}`;
    const scoreEl = resultEl.querySelector('.cr-score');
    if (scoreEl) scoreEl.textContent = score;
    resultEl.querySelector('.cr-label').textContent = r.label;
    resultEl.querySelector('.cr-detail').textContent = r.detail;
  }

  function choose(opt) {
    const grid = opt.closest('.calc-grid');
    if (grid.dataset.groupType === 'single') {
      grid.querySelectorAll('.calc-opt.sel').forEach(el => el.classList.remove('sel'));
      opt.classList.add('sel');
    } else {
      opt.classList.toggle('sel');
    }
    grid.querySelectorAll('.calc-opt').forEach(el => el.setAttribute('aria-pressed', el.classList.contains('sel')));
    recompute();
  }

  container.addEventListener('click', e => {
    const opt = e.target.closest('.calc-opt');
    if (!opt || !container.contains(opt)) return;
    choose(opt);
  });
  // The options are role="button" divs, so Enter/Space must be wired by hand.
  container.addEventListener('keydown', e => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const opt = e.target.closest('.calc-opt');
    if (!opt || !container.contains(opt)) return;
    e.preventDefault(); // Space would otherwise scroll the page, even on key repeat
    if (!e.repeat) choose(opt);
  });

  if (definition.showInitialResult) recompute();
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
    out.innerHTML =
      `<strong>ACT estimada:</strong> ${r.act.toFixed(1)} L<br>` +
      `<strong>Déficit de Na⁺:</strong> ${r.deficit} mEq<br>` +
      `<strong>Volumen SF 3%:</strong> ${r.volumeMl} ml totales<br>` +
      `<strong>Velocidad:</strong> ${r.rateMlPerHour} ml/h × 24h<br>` +
      `<span style="color:var(--red)">⚠ Controlar Na⁺ cada 4–6h. No superar +10 mEq/L en 24h.</span>`;
  }

  container.addEventListener('input', recompute);
  container.addEventListener('change', recompute);
}
