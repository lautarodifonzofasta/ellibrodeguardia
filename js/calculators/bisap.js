// ══════════════════════════════════════════════
//  BISAP — Pancreatitis aguda (Wu et al., Gut 2008)
//  Funciones globales: calcBISAP, copyBISAP, resetBISAP
// ══════════════════════════════════════════════
// The author's script, unchanged except that the three functions are exported
// and registered as globals by js/legacy-bridge.js (content/modules/
// pancreatitis.html calls them from inline handlers, like its siblings).

const UREA_PER_BUN = 2.14; // urea (mg/dL) = BUN (mg/dL) × 2,14

function $(id) { return document.getElementById(id); }

function setPt(id, on) {
  const el = $(id);
  if (el) el.classList.toggle('on', !!on);
}

export function calcBISAP() {
  if (!$('bisap-score')) return;
  const found = [];

  // B — urea/BUN
  const raw = parseFloat(($('bisap-bun-val').value || '').replace(',', '.'));
  const unit = $('bisap-bun-unit').value;
  const bun = isNaN(raw) ? null : (unit === 'urea' ? raw / UREA_PER_BUN : raw);
  const b = bun !== null && bun > 25;
  if (b) found.push(unit === 'urea' ? 'urea ' + raw + ' mg/dL' : 'BUN ' + raw + ' mg/dL');

  // I — sensorio
  const i = $('bisap-i').checked;
  if (i) found.push('sensorio alterado');

  // S — SIRS
  const sirsN = document.querySelectorAll('.bisap-sirs-c:checked').length;
  const s = sirsN >= 2;
  $('bisap-sirs-count').textContent = sirsN + ' de 4 criterios';
  if (s) found.push('SIRS ' + sirsN + '/4');

  // A — edad
  const age = parseInt($('bisap-age').value, 10);
  const a = !isNaN(age) && age > 60;
  if (a) found.push('edad ' + age);

  // P — derrame
  const p = $('bisap-p').checked;
  if (p) found.push('derrame pleural');

  setPt('bisap-pt-b', b); setPt('bisap-pt-i', i); setPt('bisap-pt-s', s);
  setPt('bisap-pt-a', a); setPt('bisap-pt-p', p);

  const score = [b, i, s, a, p].filter(Boolean).length;
  const hi = score >= 3;
  $('bisap-score').textContent = score;
  $('bisap-risk').textContent = hi
    ? 'Alto riesgo · mortalidad >15%'
    : 'Bajo riesgo · mortalidad <2%';
  const out = $('bisap-out');
  out.classList.toggle('hi', hi);
  out.classList.toggle('lo', !hi && score >= 0);

  const detail = found.length ? ' (' + found.join(', ') + ')' : '';
  $('bisap-line').textContent = 'BISAP ' + score + '/5' + detail + ' — ' +
    (hi ? 'alto riesgo de mortalidad hospitalaria (>15%).'
        : 'bajo riesgo (mortalidad <2%).');
}

export function copyBISAP(btn) {
  const txt = $('bisap-line').textContent;
  const done = () => {
    const old = btn.textContent;
    btn.textContent = 'Copiado';
    setTimeout(() => { btn.textContent = old; }, 1500);
  };
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(txt).then(done).catch(fallback);
  } else { fallback(); }
  function fallback() {
    const ta = document.createElement('textarea');
    ta.value = txt; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); done(); } catch (e) {}
    document.body.removeChild(ta);
  }
}

export function resetBISAP() {
  $('bisap-bun-val').value = '';
  $('bisap-age').value = '';
  $('bisap-i').checked = false;
  $('bisap-p').checked = false;
  document.querySelectorAll('.bisap-sirs-c').forEach(c => { c.checked = false; });
  calcBISAP();
}
