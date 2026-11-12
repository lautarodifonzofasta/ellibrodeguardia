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
// And for scores where every item must be answered (e.g. calc-qsofa, embedded
// in the Sepsis module):
//   "requireAll": true         no verdict until every group has an answer; until
//                              then the result shows "result" (initialScore,
//                              initialLabel, note), muted
//   "maxScore": n              show the score as "s / n"
// interpret() may also return severity 'neutral' (no red/amber/green tint), and
// "detailHtml" (trusted markup from js/calculators/, e.g. line breaks and bold)
// instead of the plain-text "detail".
//
// For long scales examined item by item (e.g. calc-nihss):
//   group "code": "1a"         short item code. When every group has one and
//                              "requireAll" is set, the pending result lists
//                              the codes still unanswered
//   group "hint": "…"          how to score the item (trusted markup), shown
//                              under its heading
//   option "untestable": true  an "UN" answer: adds its points (0) and its
//                              group's code is passed to interpret() in
//                              context.untestable; badge defaults to "UN"
//   option "forces": {"<group id>": <option index>, …} and "forceNote": "…"
//                              while this option is selected, those groups are
//                              set to that option and locked, with forceNote
//                              shown above them. Deselecting it gives them back
//                              the answer they had before. Not chained: an
//                              option chosen by a force does not force others
//   "resettable": true         a button that clears every answer (asks for a
//                              second tap first)
// interpret(score, context) always gets context = { untestable: [codes] };
// calculators that don't use it simply ignore the second argument.

const SEVERITY_CLASS = { red: 'show-r', amber: 'show-a', green: 'show-g', neutral: 'show-n' };
const RESET_LABEL = 'Borrar respuestas';
const RESET_CONFIRM = '¿Borrar todas las respuestas? Tocá de nuevo';

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
  const badge = opt.badge !== undefined ? opt.badge : (opt.untestable ? 'UN' : opt.points);
  return `<div class="calc-opt" data-group="${escapeAttr(groupId)}" data-index="${index}" data-points="${opt.points}" role="button" tabindex="0" aria-pressed="false">` +
    `<div class="calc-opt-chk" style="${shape}"></div>` +
    `<div class="calc-opt-lbl">${opt.label}</div>` +
    (hidePoints ? '' : `<div class="calc-opt-pts">${badge}</div>`) +
    `</div>`;
}

const groupIdOf = (group, groupIndex) => group.id ?? `g${groupIndex}`;

function groupHtml(group, groupIndex, hidePoints, lockable) {
  const gid = groupIdOf(group, groupIndex);
  const heading = group.label
    ? `<div class="sec-hd${groupIndex === 0 ? '' : ' mt-12'}"><div class="sec-hd-lbl">${group.label}</div><div class="sec-hd-line"></div></div>`
    : '';
  const hint = group.hint ? `<div class="calc-hint">${group.hint}</div>` : '';
  const lockNote = lockable ? `<div class="calc-lock-note" data-lock-for="${escapeAttr(gid)}" hidden></div>` : '';
  const code = group.code ? ` data-code="${escapeAttr(group.code)}"` : '';
  const options = group.options.map((o, i) => optionHtml(gid, group.type, o, i, hidePoints)).join('');
  return `${heading}${hint}${lockNote}<div class="calc-grid" data-group="${escapeAttr(gid)}" data-group-type="${group.type}"${code}>${options}</div>`;
}

function resultHtml(result = {}, hidePoints, requireAll) {
  return `<div class="calc-result${requireAll ? ' is-pending' : ''}" data-result aria-live="polite">` +
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
  const groupDefs = new Map(definition.groups.map((g, i) => [groupIdOf(g, i), g]));
  // Groups that some option can force (see "forces" above) get a lock note.
  const lockable = new Set();
  for (const g of definition.groups) {
    for (const o of g.options) Object.keys(o.forces || {}).forEach(id => lockable.add(id));
  }
  container.innerHTML =
    calloutHtml(definition.intro) +
    `<div class="card calc-card"><div class="card-body">` +
    definition.groups.map((g, i) => groupHtml(g, i, hidePoints, lockable.has(groupIdOf(g, i)))).join('') +
    resultHtml(definition.result, hidePoints, definition.requireAll === true) +
    (definition.resettable ? `<button type="button" class="calc-reset" data-reset>${RESET_LABEL}</button>` : '') +
    `</div></div>`;

  const resultEl = container.querySelector('[data-result]');
  const grids = [...container.querySelectorAll('.calc-grid')];
  const lockNotes = new Map([...container.querySelectorAll('[data-lock-for]')].map(el => [el.dataset.lockFor, el]));
  const optionDef = el => groupDefs.get(el.dataset.group).options[Number(el.dataset.index)];
  const selectedIndex = grid => {
    const sel = grid.querySelector('.calc-opt.sel');
    return sel ? Number(sel.dataset.index) : null;
  };
  // Selects option `index` of a single-choice grid (null clears it).
  function select(grid, index) {
    grid.querySelectorAll('.calc-opt').forEach(el => el.classList.toggle('sel', index !== null && Number(el.dataset.index) === index));
  }
  function syncAria(grid) {
    const locked = grid.hasAttribute('data-locked');
    grid.querySelectorAll('.calc-opt').forEach(el => {
      el.setAttribute('aria-pressed', el.classList.contains('sel'));
      if (locked) {
        el.setAttribute('aria-disabled', 'true');
        el.tabIndex = -1;
      } else {
        el.removeAttribute('aria-disabled');
        el.tabIndex = 0;
      }
    });
  }

  function recompute() {
    const scoreEl = resultEl.querySelector('.cr-score');
    const detailEl = resultEl.querySelector('.cr-detail');
    const missing = grids.filter(g => !g.querySelector('.calc-opt.sel'));
    if (definition.requireAll && missing.length) {
      const pending = definition.result || {};
      resultEl.className = 'calc-result is-pending';
      if (scoreEl) scoreEl.textContent = pending.initialScore ?? '';
      // Coded items, once the exam has started: say which ones are left.
      const listMissing = grids.every(g => g.dataset.code) && missing.length < grids.length;
      resultEl.querySelector('.cr-label').textContent = listMissing
        ? `${missing.length === 1 ? 'Falta' : 'Faltan'} ${missing.length} de ${grids.length} ítems`
        : pending.initialLabel ?? '';
      detailEl.textContent = listMissing ? missing.map(g => g.dataset.code).join(' · ') : pending.note ?? '';
      return;
    }
    let score = 0;
    const untestable = [];
    container.querySelectorAll('.calc-opt.sel').forEach(el => {
      score += parseFloat(el.dataset.points);
      if (optionDef(el).untestable) {
        const g = groupDefs.get(el.dataset.group);
        untestable.push(g.code ?? g.label ?? el.dataset.group);
      }
    });
    const r = interpret(score, { untestable });
    resultEl.className = `calc-result ${SEVERITY_CLASS[r.severity]}`;
    if (scoreEl) scoreEl.textContent = definition.maxScore ? `${score} / ${definition.maxScore}` : score;
    resultEl.querySelector('.cr-label').textContent = r.label;
    if (r.detailHtml !== undefined) detailEl.innerHTML = r.detailHtml;
    else detailEl.textContent = r.detail;
  }

  // Locks the groups forced by the selected options and frees the rest,
  // giving a freed group back the answer it had before it was locked.
  function applyForces() {
    if (!lockable.size) return;
    const forced = new Map();
    container.querySelectorAll('.calc-opt.sel').forEach(el => {
      const opt = optionDef(el);
      for (const [gid, index] of Object.entries(opt.forces || {})) forced.set(gid, { index, note: opt.forceNote || '' });
    });
    for (const grid of grids) {
      const gid = grid.dataset.group;
      if (!lockable.has(gid)) continue;
      const force = forced.get(gid);
      const note = lockNotes.get(gid);
      if (force) {
        if (!grid.hasAttribute('data-locked')) {
          grid.dataset.prev = selectedIndex(grid) ?? '';
          grid.setAttribute('data-locked', '');
        }
        select(grid, force.index);
        note.textContent = force.note;
        note.hidden = false;
      } else if (grid.hasAttribute('data-locked')) {
        grid.removeAttribute('data-locked');
        select(grid, grid.dataset.prev === '' ? null : Number(grid.dataset.prev));
        delete grid.dataset.prev;
        note.hidden = true;
      }
      syncAria(grid);
    }
  }

  function choose(opt) {
    const grid = opt.closest('.calc-grid');
    if (grid.hasAttribute('data-locked')) return;
    if (grid.dataset.groupType === 'single') {
      grid.querySelectorAll('.calc-opt.sel').forEach(el => el.classList.remove('sel'));
      opt.classList.add('sel');
    } else {
      opt.classList.toggle('sel');
    }
    syncAria(grid);
    applyForces();
    recompute();
  }

  const resetBtn = container.querySelector('[data-reset]');
  let disarm = null;
  function resetAll() {
    for (const grid of grids) {
      grid.removeAttribute('data-locked');
      delete grid.dataset.prev;
      select(grid, null);
      syncAria(grid);
    }
    lockNotes.forEach(note => { note.hidden = true; });
    recompute();
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    container.scrollIntoView({ block: 'start', behavior: reduceMotion ? 'auto' : 'smooth' });
  }
  // First tap arms the button, a second one within a few seconds clears: a
  // stray tap must not wipe a whole examination.
  function onReset() {
    if (!resetBtn.hasAttribute('data-armed')) {
      resetBtn.setAttribute('data-armed', '');
      resetBtn.textContent = RESET_CONFIRM;
      disarm = setTimeout(disarmReset, 4000);
      return;
    }
    disarmReset();
    resetAll();
  }
  function disarmReset() {
    clearTimeout(disarm);
    resetBtn.removeAttribute('data-armed');
    resetBtn.textContent = RESET_LABEL;
  }

  container.addEventListener('click', e => {
    if (resetBtn && e.target.closest('[data-reset]') === resetBtn) {
      onReset();
      return;
    }
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
    `<div class="card calc-card"><div class="card-body">` +
    `<div class="calc-inputs">${inputsHtml}</div>` +
    `<div data-sodio-out style="margin-top:14px;padding:12px;background:var(--bg3);border-radius:10px;border:1px solid var(--border);font-size:13px;color:var(--text2);line-height:1.8">${definition.placeholder}</div>` +
    `</div></div>`;

  const out = container.querySelector('[data-sodio-out]');
  const ids = definition.inputs.map(i => i.id);

  function recompute() {
    const values = {};
    for (const id of ids) values[id] = parseFloat(container.querySelector(`#${id}`).value);
    const r = compute({ actual: values['na-actual'], target: values['na-obj'], weightKg: values['na-peso'], sexFactor: values['na-sexo'] });
    if (!r) {
      // Incomplete input, or a target at/below the current value: show the
      // placeholder instead of leaving a stale result on screen.
      out.innerHTML = definition.placeholder;
      return;
    }
    out.innerHTML =
      (r.capped
        ? `<span style="color:var(--red)"><strong>Objetivo limitado a ${r.targetUsed} mEq/L:</strong> no corregir más de +10 mEq/L en 24 h.</span><br>`
        : '') +
      `<strong>ACT estimada:</strong> ${r.act.toFixed(1)} L<br>` +
      `<strong>Déficit de Na⁺:</strong> ${r.deficit} mEq<br>` +
      `<strong>Volumen SF 3%:</strong> ${r.volumeMl} ml totales<br>` +
      `<strong>Velocidad:</strong> ${r.rateMlPerHour} ml/h × 24h<br>` +
      `<span style="color:var(--red)">⚠ Controlar Na⁺ cada 4–6h. No superar +10 mEq/L en 24h (+8 si alcoholismo, desnutrición, hipopotasemia o hepatopatía).</span>`;
  }

  container.addEventListener('input', recompute);
  container.addEventListener('change', recompute);
}
