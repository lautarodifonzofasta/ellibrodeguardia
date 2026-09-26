/**
 * Gestational age by last menstrual period (FUM) — math ported verbatim from
 * legacy-index.html's calcEG() (line ~6212). Embedded inside the ginecoobs
 * module content (not a standalone calculator view) — wired up by
 * js/legacy-bridge.js. Returns language-neutral values (trimester as 1|2|3,
 * half as 1|2, error as a stable code) — legacy-bridge.js maps these to
 * display text via content/strings*.json so this stays usable in any language.
 * @param {string} fumDateStr - an <input type="date"> value (YYYY-MM-DD)
 * @param {Date} [now] - injectable for testing
 * @returns {{ weeks: number, days: number, trimester: 1|2|3, half: 1|2 } | { error: 'empty'|'invalid' }}
 */
export function compute(fumDateStr, now = new Date()) {
  if (!fumDateStr) return { error: 'empty' };
  const fumDate = new Date(fumDateStr);
  const diffDays = Math.floor((now - fumDate) / (1000 * 60 * 60 * 24));
  if (diffDays < 0 || diffDays > 294) return { error: 'invalid' };
  const weeks = Math.floor(diffDays / 7);
  const days = diffDays % 7;
  const trimester = weeks < 14 ? 1 : weeks < 28 ? 2 : 3;
  const half = weeks < 20 ? 1 : 2;
  return { weeks, days, trimester, half };
}
