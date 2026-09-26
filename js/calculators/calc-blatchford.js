/** @param {number} score @returns {{severity: 'red'|'amber'|'green', label: string, detail: string}} */
export function interpret(score) {
  if (score === 0) return { severity: 'green', label: 'Score 0 — bajo riesgo', detail: 'Puede considerarse manejo ambulatorio.' };
  if (score <= 6) return { severity: 'amber', label: 'Score bajo-moderado', detail: 'Internar para observación y endoscopía programada.' };
  return { severity: 'red', label: 'Score alto', detail: 'Internación urgente. Endoscopía en <12–24h.' };
}
