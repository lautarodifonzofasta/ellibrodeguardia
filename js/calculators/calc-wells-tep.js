/** @param {number} score @returns {{severity: 'red'|'amber'|'green', label: string, detail: string}} */
export function interpret(score) {
  if (score > 6) return { severity: 'red', label: 'Alta probabilidad TEP', detail: 'TC-AP directa o trombolisis si inestable.' };
  if (score >= 2) return { severity: 'amber', label: 'Probabilidad moderada', detail: 'D-dímero o TC-AP según disponibilidad.' };
  return { severity: 'green', label: 'Probabilidad baja', detail: 'D-dímero. Si negativo: descarta TEP.' };
}
