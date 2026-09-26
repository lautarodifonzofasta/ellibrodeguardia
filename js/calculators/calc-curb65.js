/** @param {number} score @returns {{severity: 'red'|'amber'|'green', resultId: string}} */
export function interpret(score) {
  if (score >= 3) return { severity: 'red', resultId: 'severe' };
  if (score === 2) return { severity: 'amber', resultId: 'moderate' };
  return { severity: 'green', resultId: 'mild' };
}
