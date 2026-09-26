/** @param {number} score @returns {{severity: 'red'|'amber'|'green', label: string, detail: string}} */
export function interpret(score) {
  if (score >= 4) return { severity: 'red', label: 'Riesgo muy alto', detail: 'Anticoagulación oral obligatoria (NACO preferido).' };
  if (score >= 2) return { severity: 'amber', label: 'Riesgo moderado', detail: 'Anticoagulación oral recomendada.' };
  return { severity: 'green', label: 'Riesgo bajo', detail: 'Sin anticoagulación necesaria (s=0) o evaluación (s=1).' };
}
