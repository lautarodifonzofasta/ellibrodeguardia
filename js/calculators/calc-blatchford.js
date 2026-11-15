// Glasgow-Blatchford bands as ESGE and ACG use them, and as the Hemorragia
// digestiva module says: 0–1 → discharge with outpatient endoscopy,
// 2 or more → admit; 7 or more flagged as high risk.

/** @param {number} score @returns {{severity: 'red'|'amber'|'green', label: string, detail: string}} */
export function interpret(score) {
  if (score <= 1) return { severity: 'green', label: 'Score 0–1 — muy bajo riesgo', detail: 'Alta con endoscopía ambulatoria si no hay comorbilidad grave (ESGE, ACG).' };
  if (score <= 6) return { severity: 'amber', label: 'Internar', detail: 'Internación, IBP y endoscopía dentro de las 24 h.' };
  return { severity: 'red', label: 'Score alto', detail: 'Internación. Endoscopía dentro de las 24 h; antes si sigue inestable pese a la reanimación.' };
}
