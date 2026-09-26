/**
 * @typedef {{severity: 'red'|'amber'|'green', resultId: string}} Interpretation
 * resultId keys into content/calculators/calc-gcs*.json's "results" map,
 * which carries the actual (per-language) label/detail text — keeping the
 * scoring thresholds here language-neutral and single-sourced.
 */

/** @param {number} score @returns {Interpretation} */
export function interpret(score) {
  if (score <= 8) return { severity: 'red', resultId: 'severe' };
  if (score <= 12) return { severity: 'amber', resultId: 'moderate' };
  return { severity: 'green', resultId: 'normal' };
}
