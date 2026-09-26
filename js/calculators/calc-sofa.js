/** @param {number} score @returns {{severity: 'red'|'amber'|'green', label: string, detail: string}} */
export function interpret(score) {
  if (score >= 11) return { severity: 'red', label: 'Falla orgánica grave', detail: 'Mortalidad >95%. UCI inmediata.' };
  if (score >= 7) return { severity: 'red', label: 'Falla orgánica grave', detail: 'Mortalidad 50-70%. UCI urgente.' };
  if (score >= 3) return { severity: 'amber', label: 'Disfunción orgánica', detail: 'Mortalidad 20-40%. Monitoreo estricto.' };
  return { severity: 'green', label: 'Sin disfunción significativa', detail: 'Mortalidad <10%.' };
}
