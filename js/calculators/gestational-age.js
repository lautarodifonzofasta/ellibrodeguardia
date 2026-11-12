/**
 * Gestational age by last menstrual period (FUM) — ported from
 * legacy-index.html's calcEG() (line ~6212). Embedded inside the ginecoobs
 * module content (not a standalone calculator view), so this is wired up by
 * js/legacy-bridge.js.
 *
 * Both dates are reduced to calendar days before subtracting. The legacy code
 * parsed the FUM as UTC midnight and compared it with the local clock, so in
 * Argentina (UTC−3) the result gained a day every evening after 21:00.
 * @param {string} fumDateStr - an <input type="date"> value (YYYY-MM-DD)
 * @param {Date} [now] - injectable for testing; its local calendar date is "today"
 * @returns {{ weeks: number, days: number, trimester: string, half: string } | { error: string }}
 */
export function compute(fumDateStr, now = new Date()) {
  if (!fumDateStr) return { error: 'Ingresá la FUM' };
  const [y, m, d] = fumDateStr.split('-').map(Number);
  const fumDay = Date.UTC(y, m - 1, d);
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const diffDays = Math.round((today - fumDay) / (1000 * 60 * 60 * 24));
  if (Number.isNaN(diffDays) || diffDays < 0 || diffDays > 294) return { error: 'Fecha inválida' };
  const weeks = Math.floor(diffDays / 7);
  const days = diffDays % 7;
  const trimester = weeks < 14 ? '1er trimestre' : weeks < 28 ? '2do trimestre' : '3er trimestre';
  const half = weeks < 20 ? '→ Primera mitad del embarazo' : '→ Segunda mitad del embarazo';
  return { weeks, days, trimester, half };
}
