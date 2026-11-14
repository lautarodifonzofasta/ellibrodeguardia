// NEWS2 (Royal College of Physicians, 2017). content/calculators/calc-news2.json
// holds the seven parameters and sets "requireAll". The aggregate score decides
// the band, except that a single parameter scoring 3 raises a low aggregate
// (0–4) to an urgent review: the engine passes each selected option's points
// in context.points for that.
// Bands: 0 · 1–4 · any single 3 with aggregate ≤4 · 5–6 · ≥7.

const SEPSIS = 'Con infección sospechada, un NEWS2 ≥5 obliga a pensar en sepsis (<a class="xref" href="#sepsis" onclick="navId(\'sepsis\');return false">ver Sepsis</a>).';

/**
 * @param {number} score 0–20
 * @param {{points?: number[]}} [context] points of each selected option
 * @returns {{severity: 'red'|'amber'|'green', label: string, detail: string, detailHtml: string}}
 */
export function interpret(score, { points = [] } = {}) {
  const single3 = points.includes(3);
  let severity;
  let label;
  const lines = [];
  if (score >= 7) {
    severity = 'red';
    label = 'Riesgo alto';
    lines.push('Respuesta de emergencia: evaluación inmediata por el equipo con competencia en paciente crítico. Monitoreo continuo y considerar UCI.', SEPSIS);
  } else if (score >= 5) {
    severity = 'amber';
    label = 'Riesgo medio';
    lines.push('Respuesta urgente: evaluación médica sin demora. Controles al menos cada hora.', SEPSIS);
  } else if (single3) {
    severity = 'amber';
    label = 'Riesgo bajo-medio: un parámetro en 3';
    lines.push('Un solo parámetro extremo exige revisión médica urgente aunque el total sea bajo. Controles al menos cada hora.');
  } else if (score >= 1) {
    severity = 'green';
    label = 'Riesgo bajo';
    lines.push('Controles cada 4–6 h. Enfermería decide si aumenta la frecuencia o llama al médico.');
  } else {
    severity = 'green';
    label = 'Sin alteraciones';
    lines.push('Controles de rutina (mínimo cada 12 h).');
  }
  return { severity, label, detail: lines.join(' ').replace(/<[^>]+>/g, ''), detailHtml: lines.join('<br>') };
}
