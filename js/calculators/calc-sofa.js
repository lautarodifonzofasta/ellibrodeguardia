// No mortality percentages: the ones shown before overstated the published
// figures, and a single SOFA value is not a prognosis.
/** @param {number} score @returns {{severity: 'red'|'amber'|'green', label: string, detail: string}} */
export function interpret(score) {
  if (score >= 11) return { severity: 'red', label: 'Falla orgánica grave', detail: 'Falla multiorgánica. UCI inmediata.' };
  if (score >= 7) return { severity: 'red', label: 'Falla orgánica grave', detail: 'UCI urgente.' };
  if (score >= 3) return { severity: 'amber', label: 'Disfunción orgánica', detail: 'Monitoreo estricto. Con infección, un aumento ≥2 sobre el basal define sepsis.' };
  return { severity: 'green', label: 'Sin disfunción significativa', detail: 'Con infección, un aumento ≥2 sobre el basal define sepsis.' };
}
