// NIHSS (NINDS scale). content/calculators/calc-nihss.json holds the 15 items
// (1a … 11) and sets "requireAll", so interpret() only runs once every item is
// answered. The engine passes the codes of the items scored UN (untestable),
// which add 0. Coma (1a = 3) fixes 1b, 1c, 7, 8 and 9 in the JSON ("forces").
// Severity bands: 0 · 1–4 · 5–15 · 16–20 · ≥21. The clinical lines repeat what
// the ACV module says (disabling deficit, NIHSS ≤3, ≥6, >25).

/** @typedef {{severity: 'red'|'amber'|'green', label: string, detail: string, detailHtml: string}} Interpretation */

const ACV_LINK = '<a class="xref" href="#acv" onclick="navId(\'acv\');return false">módulo ACV</a>';
const LYSIS = 'Trombólisis si el déficit es discapacitante y está en ventana, cualquiera sea el puntaje.';
const LOW = 'Un NIHSS bajo no descarta un ACV grave: la escala no evalúa la marcha y subestima la circulación posterior.';
const DAPT = `NIHSS ≤3 sin trombólisis: AAS + clopidogrel por 21 días (ver ${ACV_LINK}).`;
const REPERFUSION = `Reperfusión: ver criterios y ventanas en el ${ACV_LINK}.`;
const LVO = '<strong>≥6:</strong> pensar oclusión de gran vaso → angio-TC y evaluar trombectomía.';
const BLEED = '<strong>&gt;25:</strong> riesgo alto de transformación hemorrágica.';

const plain = lines => lines.join(' ').replace(/<[^>]+>/g, '').replace(/&gt;/g, '>');

/**
 * @param {number} score 0–42
 * @param {{untestable?: string[]}} [context] codes of the items scored UN
 * @returns {Interpretation}
 */
export function interpret(score, { untestable = [] } = {}) {
  let severity;
  let label;
  const lines = [];
  if (score === 0) {
    severity = 'green';
    label = 'Sin déficit en la escala';
    lines.push(LOW, LYSIS);
  } else if (score <= 4) {
    severity = 'amber';
    label = 'ACV menor';
    lines.push(LYSIS);
    if (score <= 3) lines.push(DAPT);
    lines.push(LOW);
  } else {
    severity = 'red';
    label = score <= 15 ? 'ACV moderado' : score <= 20 ? 'ACV moderado a grave' : 'ACV grave';
    lines.push(REPERFUSION);
    if (score >= 6) lines.push(LVO);
    if (score > 25) lines.push(BLEED);
  }
  if (untestable.length) {
    lines.push(`No evaluable (UN): ${untestable.join(', ')}. Suma 0; dejar asentado el motivo.`);
  }
  return { severity, label, detail: plain(lines), detailHtml: lines.join('<br>') };
}
