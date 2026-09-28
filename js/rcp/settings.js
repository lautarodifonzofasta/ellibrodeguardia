// Assistance settings (audio, vibration, metronome), saved per device.
// Every access is wrapped in try/catch: without storage the defaults apply.

const KEY = 'elg-rcp-settings';

function defaultStorage() {
  try { return globalThis.localStorage ?? null; } catch { return null; }
}

/**
 * @param {import('./types.js').GuidelineProfile} profile  Supplies the metronome options.
 * @returns {{audio: boolean, vibration: boolean, metronome: boolean, metronomeBpm: number}}
 */
export function loadSettings(profile, storage = defaultStorage()) {
  const options = profile.metronome ? profile.metronome.bpmOptions : [];
  const defaults = { audio: true, vibration: true, metronome: false, metronomeBpm: profile.metronome ? profile.metronome.defaultBpm : null };
  let stored = {};
  try {
    const text = storage && storage.getItem(KEY);
    if (text) stored = JSON.parse(text) || {};
  } catch { stored = {}; }
  const bool = (v, d) => (typeof v === 'boolean' ? v : d);
  return {
    audio: bool(stored.audio, defaults.audio),
    vibration: bool(stored.vibration, defaults.vibration),
    metronome: bool(stored.metronome, defaults.metronome) && options.length > 0,
    metronomeBpm: options.includes(stored.metronomeBpm) ? stored.metronomeBpm : defaults.metronomeBpm,
  };
}

/** Returns false (never throws) if the settings couldn't be saved. */
export function saveSettings(settings, storage = defaultStorage()) {
  if (!storage) return false;
  try {
    storage.setItem(KEY, JSON.stringify(settings));
    return true;
  } catch {
    return false;
  }
}
