// Peak expiratory flow as a percentage of the patient's personal best or, when
// that is unknown, of the predicted value (Nunn & Gregg, BMJ 1989: adults,
// height in cm, result in L/min). The cut-offs are the GINA ones the Asma
// module uses: at presentation ≤50% = severe; one hour into treatment
// ≥60% discharge possible, 40–59% keep treating, <40% admit.

/**
 * @param {'m'|'f'} sex @param {number} age years (15–85) @param {number} heightCm
 * @returns {number} predicted PEF in L/min
 */
export function predictedPef(sex, age, heightCm) {
  const ln = Math.log(age);
  const x = sex === 'f'
    ? 0.376 * ln - 0.012 * age - 58.8 / heightCm + 5.63
    : 0.544 * ln - 0.0151 * age - 74.7 / heightCm + 5.48;
  return Math.exp(x);
}

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
    : `Referencia: predicho ${Math.round(reference)} L/min (Nunn y Gregg). Si conoce su mejor valor personal, usar ese.`;

  let severity;
  let label;
  let action;
  if (moment === 'hour') {
    if (percent >= 60) {
      severity = 'green';
      label = 'A la hora: alta posible';
      action = 'Con mejoría sostenida y SpO₂ >94% al aire. Dar el plan de alta completo.';
    } else if (percent >= 40) {
      severity = 'amber';
      label = 'A la hora: respuesta incompleta';
      action = 'Seguir tratando y observar. El alta depende de los factores de riesgo y del seguimiento.';
    } else {
      severity = 'red';
      label = 'A la hora: internar';
      action = 'Menos de 40% después del tratamiento inicial.';
    }
  } else if (percent > 50) {
    severity = 'amber';
    label = 'Al ingreso: leve a moderada';
    action = 'Si el resto de los signos acompaña. Tratar y volver a medir a la hora.';
  } else {
    severity = 'red';
    label = 'Al ingreso: grave';
    action = percent < 25
      ? 'Menos de 25% antes de tratar: internación recomendada.'
      : 'PEF ≤50%. Salbutamol + ipratropio + corticoide sin demora.';
  }
  return { severity, score: `${percent}%`, label, lines: [action, refLine], percent, reference, source };
}
