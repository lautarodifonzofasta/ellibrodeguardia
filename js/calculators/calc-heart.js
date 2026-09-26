/** @param {number} score @returns {{severity: 'red'|'amber'|'green', label: string, detail: string}} */
export function interpret(score) {
  if (score >= 7) return { severity: 'red', label: 'Alto riesgo', detail: 'MACE >65%. Internación + cardiología urgente.' };
  if (score >= 4) return { severity: 'amber', label: 'Riesgo moderado', detail: 'MACE 12-65%. Internación + estudio.' };
  return { severity: 'green', label: 'Bajo riesgo', detail: 'MACE <2%. Puede considerarse alta precoz.' };
}
