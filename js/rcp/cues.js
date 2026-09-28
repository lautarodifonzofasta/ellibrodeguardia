// Which audio/vibration cues a status snapshot deserves. Pure: the caller
// keeps the `announced` Set between calls. Every cue has an id tied to the
// moment it belongs to (prompt + cycle + Box, or indication + dose), so each
// is announced at most once — never in a loop, however often the screen is
// repainted. Texts come from the profile (status.prompt.voice, messages).

// End-of-cycle cues also beep and vibrate (request §6: visual + sound, voice
// and vibration); the other transitions are voice only.
const STRONG = {
  pre_alert: { beep: 1, vibrate: [200] },
  check_rhythm: { beep: 3, vibrate: [300, 150, 300, 150, 300] },
};

/**
 * @param {ReturnType<import('./status.js').getStatus>|null} status
 * @param {Set<string>} announced  Ids already announced; updated in place.
 * @returns {{id: string, voice: string, beep: number, vibrate: number[]|null}[]}
 */
export function cuesFor(status, announced) {
  const out = [];
  if (!status) return out;
  const moment = `${status.cycle ? status.cycle.number : 0}:${status.algorithm ? status.algorithm.box : ''}`;
  const add = (id, voice, strong) => {
    if (announced.has(id)) return;
    announced.add(id);
    out.push({ id, voice, beep: strong ? strong.beep : 0, vibrate: strong ? strong.vibrate : null });
  };
  if (status.prompt) {
    const strong = status.state === 'CPR_ACTIVE' && status.alert ? STRONG[status.alert.kind] : null;
    add(`prompt:${status.prompt.key}:${moment}`, status.prompt.voice, strong);
  }
  for (const i of status.indications || []) {
    add(`ind:${i.drugId || i.groupId}:${i.reason || ''}:${i.doseNumber}`, i.message.voice, null);
  }
  return out;
}
