/**
 * Gestational age by last menstrual period (FUM) — ported verbatim from
 * legacy-index.html's calcEG() (line ~6212). Embedded inside the ginecoobs
 * module content (not a standalone calculator view), so this is wired up by
 * js/scripts... see js/main.js's legacy inline-handler bridge.
 * @param {string} fumDateStr - an <input type="date"> value (YYYY-MM-DD)
 * @param {Date} [now] - injectable for testing
 * @returns {{ weeks: number, days: number, trimester: string, half: string } | { error: string }}
 */
export function compute(fumDateStr, now = new Date()) {
  if (!fumDateStr) return { error: 'Ingresá la FUM' };
  const fumDate = new Date(fumDateStr);
  const diffDays = Math.floor((now - fumDate) / (1000 * 60 * 60 * 24));
  if (diffDays < 0 || diffDays > 294) return { error: 'Fecha inválida' };
  const weeks = Math.floor(diffDays / 7);
  const days = diffDays % 7;
  const trimester = weeks < 14 ? '1er trimestre' : weeks < 28 ? '2do trimestre' : '3er trimestre';
  const half = weeks < 20 ? '→ Primera mitad del embarazo' : '→ Segunda mitad del embarazo';
  return { weeks, days, trimester, half };
}
