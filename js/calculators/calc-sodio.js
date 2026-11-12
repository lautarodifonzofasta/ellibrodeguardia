/**
 * Sodium correction — free-input calculator, ported from legacy-index.html's
 * runCalcSodio() (line ~1404), plus a safety cap the legacy version lacked:
 * the target is limited to MAX_DELTA_24H above the current value, because the
 * result is given as a 24 h infusion and a larger rise risks osmotic
 * demyelination. `capped` tells the UI the requested target was reduced.
 * @param {{ actual: number, target: number, weightKg: number, sexFactor: number }} input
 * @returns {{ act: number, deficit: number, volumeMl: number, rateMlPerHour: number, targetUsed: number, capped: boolean } | null}
 */
export const MAX_DELTA_24H = 10;

export function compute({ actual, target, weightKg, sexFactor }) {
  if ([actual, target, weightKg, sexFactor].some(n => typeof n !== 'number' || Number.isNaN(n))) return null;
  if (target <= actual) return null; // nothing to correct upwards
  const targetUsed = Math.min(target, actual + MAX_DELTA_24H);
  const act = weightKg * sexFactor;
  const deficit = act * (targetUsed - actual);
  const volumeMl = Math.round((deficit / 513) * 1000);
  const rateMlPerHour = Math.round(volumeMl / 24);
  return { act, deficit: Math.round(deficit), volumeMl, rateMlPerHour, targetUsed, capped: targetUsed < target };
}
