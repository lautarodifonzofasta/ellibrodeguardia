/** @param {number} score @returns {{severity: 'red'|'amber'|'green', resultId: string}} */
export function interpret(score) {
  if (score === 0) return { severity: 'green', resultId: 'zero' };
  if (score <= 6) return { severity: 'amber', resultId: 'lowModerate' };
  return { severity: 'red', resultId: 'high' };
}
