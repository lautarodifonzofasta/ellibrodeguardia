// Two-tier Wells DVT model (unlikely <=1 / likely >=2), with >=3 flagged as
// high probability. The previous cut-offs (<=1 / 2-6 / >6) were the Wells PE
// ones and never fit this score, whose range is -2 to 9.
/** @param {number} score @returns {{severity: 'red'|'amber'|'green', label: string, detail: string}} */
export function interpret(score) {
  if (score <= 1) return { severity: 'green', label: 'TVP improbable', detail: 'D-dímero. Si negativo: descarta TVP. Si positivo: eco Doppler.' };
  if (score === 2) return { severity: 'amber', label: 'TVP probable', detail: 'Eco Doppler directo.' };
  return { severity: 'red', label: 'Probabilidad alta', detail: 'Eco Doppler directo. Anticoagular mientras se espera.' };
}
