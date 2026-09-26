/**
 * Sodium correction — free-input calculator, ported verbatim from
 * legacy-index.html's runCalcSodio() (line ~1404).
 * @param {{ actual: number, target: number, weightKg: number, sexFactor: number }} input
 * @returns {{ act: number, deficit: number, volumeMl: number, rateMlPerHour: number } | null}
 */
export function compute({ actual, target, weightKg, sexFactor }) {
  if ([actual, target, weightKg, sexFactor].some(n => typeof n !== 'number' || Number.isNaN(n))) return null;
  const act = weightKg * sexFactor;
  const deficit = act * (target - actual);
  const volumeMl = Math.round((deficit / 513) * 1000);
  const rateMlPerHour = Math.round(volumeMl / 24);
  return { act, deficit: Math.round(deficit), volumeMl, rateMlPerHour };
}
