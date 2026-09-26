// Bridge for inline event handlers still present *inside extracted content*
// (content/modules/*.html). Those 52 files were migrated verbatim — including
// their onclick="switchTab(...)" / onclick="navId(...)" / onchange="calcEG()"
// attributes — specifically so clinical text could be verified word-for-word
// against the original rather than risk a mechanical markup rewrite. All NEW
// code in this app (router, search, calculators, drug reference) uses
// addEventListener instead; nothing here should be called from new code.
import { goTo } from './router.js';
import { compute as computeGestationalAge } from './calculators/gestational-age.js';

export function installLegacyBridge() {
  window.switchTab = switchTab;
  window.switchHZ = switchHZ;
  window.navId = goTo;
  window.navSb = goTo;
  window.calcEG = calcEG;
  window.showAAZone = showAAZone;
}

// Ported verbatim from legacy-index.html:1371-1386. Reads sibling tabs'
// onclick attribute text to find each one's pane id — unusual, but it's
// exactly what lets this keep working against unmodified extracted markup.
function switchTab(btn, grp, pane) {
  const isActive = btn.classList.contains('on');
  document.querySelectorAll(`[data-tab-grp="${grp}"]`).forEach(b => {
    b.classList.remove('on');
    const m = b.getAttribute('onclick')?.match(/,'([^']+)'\)$/);
    if (m) { const p = document.getElementById(m[1]); if (p) p.classList.remove('on'); }
  });
  if (!isActive) {
    btn.classList.add('on');
    const el = document.getElementById(pane);
    if (el) el.classList.add('on');
  }
}

// Ported verbatim from legacy-index.html:1387-1396 (herpes-zoster module's
// dedicated tab set).
function switchHZ(btn, pane) {
  document.querySelectorAll('#tabs-hz .tab').forEach(t => t.classList.remove('on'));
  btn.classList.add('on');
  ['hz-dx', 'hz-tto', 'hz-comp', 'hz-esp', 'hz-vac'].forEach(p => {
    const el = document.getElementById(p);
    if (el) el.classList.remove('on');
  });
  const target = document.getElementById(pane);
  if (target) target.classList.add('on');
}

// Ported from legacy-index.html:6212-6229 (calcEG), embedded in the
// ginecoobs module. Delegates the math to calculators/gestational-age.js.
function calcEG() {
  const fum = document.getElementById('fum-input');
  const resultEl = document.getElementById('eg-result');
  const trimEl = document.getElementById('eg-trimestre');
  if (!fum || !fum.value || !resultEl) return;
  const r = computeGestationalAge(fum.value);
  if (r.error) {
    resultEl.textContent = r.error;
    if (trimEl) trimEl.textContent = '';
    return;
  }
  resultEl.textContent = `${r.weeks} sem + ${r.days} días`;
  if (trimEl) trimEl.textContent = `${r.trimester} · ${r.half}`;
}
const AA_ZONES = ['hcd','epi','hci','fd','meso','fi','fid','hipo','fii'];
function showAAZone(id) {
  AA_ZONES.forEach(z => {
    const c = document.getElementById('q-'+z);
    const l = document.getElementById('ql-'+z);
    if (c) c.classList.remove('active');
    if (l) l.classList.remove('active');
  });
  const ac = document.getElementById('q-'+id);
  const al = document.getElementById('ql-'+id);
  if (ac) ac.classList.add('active');
  if (al) al.classList.add('active');
  const empty = document.getElementById('result-empty');
  if (empty) empty.style.display = 'none';
  document.querySelectorAll('.result-zone').forEach(z => z.classList.remove('on'));
  const zone = document.getElementById('rz-'+id);
  if (zone) zone.classList.add('on');
}
