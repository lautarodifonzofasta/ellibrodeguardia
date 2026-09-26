/** @typedef {{severity: 'red'|'amber'|'green', label: string, detail: string}} Interpretation */

/** @param {number} score @returns {Interpretation} */
export function interpret(score) {
  if (score <= 8) return { severity: 'red', label: 'Coma severo', detail: 'IOT inmediata. GCS ≤ 8 = vía aérea comprometida.' };
  if (score <= 12) return { severity: 'amber', label: 'Coma moderado', detail: 'Vigilancia estrecha. Considerar IOT si deterioro.' };
  return { severity: 'green', label: 'Normal o leve', detail: 'GCS 15 = normal. Reevaluar si contexto clínico cambia.' };
}
