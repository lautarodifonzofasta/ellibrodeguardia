// Regla Canadiense de TAC de cráneo (checklist embedded in the TEC module).
// The points in content/calculators/calc-tac-craneo.json only encode which
// criteria group is marked, one tier per group, so the sum identifies the
// first group that applies in the spec's evaluation order:
//   excluye 1000 each · pediátrico 100 · alto 10 each (max 50) · medio 1 each (max 2)
// No tier's maximum reaches the next tier's minimum, so a lower group can
// never add up to a higher one.

/** @typedef {{severity: 'red'|'amber'|'green'|'neutral', label: string, detail: string}} Interpretation */

/** @param {number} score @returns {Interpretation} */
export function interpret(score) {
  if (score >= 1000) return { severity: 'red', label: 'La regla no aplica → TAC indicada', detail: 'Anticoagulación, convulsión post-trauma o GCS <13 excluyen la regla canadiense. Estos pacientes requieren TAC.' };
  if (score >= 100) return { severity: 'amber', label: 'La regla no aplica en menores de 16 años', detail: 'Usá los criterios PECARN para decidir la TAC en pediatría.' };
  if (score >= 10) return { severity: 'red', label: 'TAC indicada: alto riesgo', detail: 'Riesgo de requerir intervención neuroquirúrgica. TAC de cerebro sin contraste.' };
  if (score >= 1) return { severity: 'amber', label: 'TAC indicada: riesgo medio', detail: 'Riesgo de lesión cerebral visible en la TAC. TAC de cerebro sin contraste.' };
  return { severity: 'neutral', label: 'Sin criterios marcados', detail: 'Si realmente no hay ninguno, la regla indica que no requiere TAC. Confirmá que el paciente cumple las condiciones de aplicación.' };
}
