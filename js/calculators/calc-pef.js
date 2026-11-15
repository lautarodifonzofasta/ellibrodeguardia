// Peak expiratory flow as a percentage of the patient's personal best or, when
// that is unknown, of the predicted value (Nunn & Gregg, BMJ 1989: adults,
// height in cm, result in L/min). Nunn & Gregg measured with Wright meters;
// the meters in use now follow EN 13826 (the EU scale), which reads lower in
// the middle of the range, so the predicted value is converted to that scale
// before comparing (wrightToEu). The cut-offs are the GINA ones the Asma
// module uses, applied to the rounded percentage shown: at presentation ≤50% =
// severe, <25% = admit; one hour into treatment >60% discharge possible,
// 40–60% keep treating, <40% admit (and <25% at presentation admits anyway).

/**
 * Wright-scale PEF to the EN 13826 (EU) scale.
 * @param {number} w L/min on the Wright scale @returns {number} L/min on the EU scale
 */
export function wrightToEu(w) {
  return 50.356 + 0.4 * w + 8.814e-4 * w ** 2 - 1.116e-7 * w ** 3;
}

/**
 * @param {'m'|'f'} sex @param {number} age years (15–85) @param {number} heightCm
 * @returns {number} predicted PEF in L/min, EN 13826 scale
 */
export function predictedPef(sex, age, heightCm) {
  const ln = Math.log(age);
  const x = sex === 'f'
    ? 0.376 * ln - 0.012 * age - 58.8 / heightCm + 5.63
    : 0.544 * ln - 0.0151 * age - 74.7 / heightCm + 5.48;
  return wrightToEu(Math.exp(x));
}

const ADMIT_ANYWAY = 'Si el PEF al ingreso fue &lt;25%, internar igual (GINA).';

/**
 * @param {{pef?: number, best?: number, sex?: string, age?: number, height?: number, moment?: string}} v
 * @returns {{severity: string, score: string, label: string, lines: string[], percent: number, reference: number, source: 'best'|'predicted'} | null}
 */
export function compute({ pef, best, sex, age, height, moment }) {
  if (!(pef > 0)) return null;
  let reference;
  let source;
  if (best > 0) {
    reference = best;
    source = 'best';
  } else if ((sex === 'm' || sex === 'f') && age >= 15 && age <= 85 && height >= 120 && height <= 220) {
    reference = predictedPef(sex, age, height);
    source = 'predicted';
  } else {
    return null;
  }
  const percent = Math.round((pef / reference) * 100);
  const refLine = source === 'best'
    ? `Referencia: mejor valor personal, ${Math.round(reference)} L/min.`
    : `Referencia: predicho ${Math.round(reference)} L/min (Nunn y Gregg, escala EN 13826 de los medidores actuales). Si conoce su mejor valor personal, usar ese.`;

  let severity;
  let label;
  const lines = [];
  if (moment === 'hour') {
    if (percent > 60) {
      severity = 'green';
      label = 'A la hora: alta posible';
      lines.push('Con mejoría sostenida y SpO₂ >94% al aire. Dar el plan de alta completo.', ADMIT_ANYWAY);
    } else if (percent >= 40) {
      severity = 'amber';
      label = 'A la hora: respuesta incompleta';
      lines.push('Seguir tratando y observar. El alta depende de los factores de riesgo y del seguimiento.', ADMIT_ANYWAY);
    } else {
      severity = 'red';
      label = 'A la hora: internar';
      lines.push('Menos de 40% después del tratamiento inicial.');
    }
  } else if (percent > 50) {
    severity = 'amber';
    label = 'Al ingreso: leve a moderada';
    lines.push('Si el resto de los signos acompaña. Tratar y volver a medir a la hora.');
  } else {
    severity = 'red';
    label = 'Al ingreso: grave';
    lines.push(percent < 25
      ? 'Menos de 25% antes de tratar: internación recomendada.'
      : 'PEF ≤50%. Salbutamol + ipratropio + corticoide sin demora.');
  }
  lines.push(refLine);
  return { severity, score: `${percent}%`, label, lines, percent, reference, source };
}
