/** @param {number} score @returns {{severity: 'red'|'amber'|'green', label: string, detail: string}} */
export function interpret(score) {
  if (score >= 3) return { severity: 'red', label: 'Neumonía grave', detail: 'Internación en UTI/AR. Mortalidad >20%.' };
  if (score === 2) return { severity: 'amber', label: 'Neumonía moderada', detail: 'Internación en sala general.' };
  return { severity: 'green', label: 'Neumonía leve', detail: 'Tratamiento ambulatorio posible.' };
}
