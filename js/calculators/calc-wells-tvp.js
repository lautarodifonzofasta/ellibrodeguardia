/** @param {number} score @returns {{severity: 'red'|'amber'|'green', resultId: string}} */
export function interpret(score) {
  if (score <= 1) return { severity: 'green', resultId: 'low' };
  if (score <= 6) return { severity: 'amber', resultId: 'moderate' };
  return { severity: 'red', resultId: 'high' };
}
