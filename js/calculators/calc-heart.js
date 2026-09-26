/** @param {number} score @returns {{severity: 'red'|'amber'|'green', resultId: string}} */
export function interpret(score) {
  if (score >= 7) return { severity: 'red', resultId: 'high' };
  if (score >= 4) return { severity: 'amber', resultId: 'moderate' };
  return { severity: 'green', resultId: 'low' };
}
