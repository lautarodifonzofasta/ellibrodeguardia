/** @param {number} score @returns {{severity: 'red'|'amber'|'green', label: string, detail: string}} */
export function interpret(score) {
  if (score <= 1) return { severity: 'green', label: 'Probabilidad baja', detail: 'D-dímero. Si negativo: descarta TVP.' };
  if (score <= 6) return { severity: 'amber', label: 'Probabilidad moderada', detail: 'D-dímero + eco Doppler.' };
  return { severity: 'red', label: 'Probabilidad alta', detail: 'Eco Doppler directo. Anticoagular mientras se espera.' };
}
