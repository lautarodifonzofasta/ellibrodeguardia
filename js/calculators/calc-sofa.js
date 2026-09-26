/** @param {number} score @returns {{severity: 'red'|'amber'|'green', resultId: string}} */
export function interpret(score) {
  if (score >= 11) return { severity: 'red', resultId: 'critical' };
  if (score >= 7) return { severity: 'red', resultId: 'severe' };
  if (score >= 3) return { severity: 'amber', resultId: 'dysfunction' };
  return { severity: 'green', resultId: 'none' };
}
