// Browser-side assistance: voice (speechSynthesis, Spanish), beeps and the
// metronome (Web Audio), vibration, and the screen Wake Lock. Every API is
// optional: where a browser lacks one (e.g. vibration on iPhone Safari) that
// part is skipped without error. Audio must be unlocked by a user gesture
// (iPhone plays nothing otherwise), so the UI calls unlock() on every tap.

const BEEP_HZ = 880;
const BEEP_S = 0.12;
const BEEP_GAP_S = 0.25;
const CLICK_HZ = 1200;
const CLICK_S = 0.03;
const LOOKAHEAD_MS = 25;
const SCHEDULE_AHEAD_S = 0.12;

export function createAssist() {
  let ctx = null;
  let unlocked = false;
  let metro = null;          // { bpm, timer, nextAt }
  let wakeLock = null;
  let wantWakeLock = false;
  let requesting = false;

  function audio() {
    if (ctx) return ctx;
    try {
      const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
      if (AC) ctx = new AC();
    } catch { ctx = null; }
    return ctx;
  }

  /** Call from a tap: resumes audio and primes speech (required on iPhone). */
  function unlock() {
    const c = audio();
    try { if (c && c.state === 'suspended') c.resume(); } catch { /* ignore */ }
    if (!unlocked) {
      try { globalThis.speechSynthesis?.speak(new SpeechSynthesisUtterance('')); } catch { /* ignore */ }
      unlocked = true;
    }
  }

  function tone(freq, start, dur, gain = 0.25) {
    const c = audio();
    if (!c) return;
    try {
      const osc = c.createOscillator();
      const g = c.createGain();
      osc.frequency.value = freq;
      g.gain.setValueAtTime(gain, start);
      g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
      osc.connect(g).connect(c.destination);
      osc.start(start);
      osc.stop(start + dur + 0.02);
    } catch { /* audio unavailable */ }
  }

  function beep(times) {
    const c = audio();
    if (!c || !times) return 0;
    for (let i = 0; i < times; i++) tone(BEEP_HZ, c.currentTime + i * BEEP_GAP_S, BEEP_S);
    return times * BEEP_GAP_S * 1000;
  }

  function spanishVoice() {
    try {
      const voices = globalThis.speechSynthesis?.getVoices() || [];
      return voices.find(v => /^es[-_]AR/i.test(v.lang)) || voices.find(v => /^es[-_](419|US|MX)/i.test(v.lang)) ||
        voices.find(v => /^es/i.test(v.lang)) || null;
    } catch { return null; }
  }

  function speak(text) {
    const synth = globalThis.speechSynthesis;
    if (!synth || !text) return;
    try {
      const u = new SpeechSynthesisUtterance(text);
      const v = spanishVoice();
      if (v) u.voice = v;
      u.lang = v ? v.lang : 'es-AR';
      u.rate = 1.05;
      synth.speak(u);
    } catch { /* speech unavailable */ }
  }

  function vibrate(pattern) {
    try { if (pattern && typeof navigator.vibrate === 'function') navigator.vibrate(pattern); } catch { /* ignore */ }
  }

  /**
   * Plays cues from cues.js according to the settings. A new batch replaces
   * any speech still queued (stale messages are never read out late).
   */
  function play(cues, settings) {
    if (!cues.length) return;
    if (settings.audio) {
      try { globalThis.speechSynthesis?.cancel(); } catch { /* ignore */ }
      const beeps = cues.reduce((n, c) => Math.max(n, c.beep || 0), 0);
      const wait = beep(beeps);
      const texts = cues.map(c => c.voice).filter(Boolean);
      setTimeout(() => texts.forEach(speak), wait);
    }
    if (settings.vibration) {
      const v = cues.find(c => c.vibrate);
      if (v) vibrate(v.vibrate);
    }
  }

  /** Starts, retunes or stops the metronome (Web Audio clock, not timers, keeps it steady). */
  function metronome(on, bpm) {
    if (!on || !bpm) {
      if (metro) { clearInterval(metro.timer); metro = null; }
      return;
    }
    const c = audio();
    if (!c) return;
    if (metro && metro.bpm === bpm) return;
    if (metro) clearInterval(metro.timer);
    const period = 60 / bpm;
    const state = { bpm, nextAt: c.currentTime + 0.05, timer: null };
    state.timer = setInterval(() => {
      while (state.nextAt < c.currentTime + SCHEDULE_AHEAD_S) {
        tone(CLICK_HZ, state.nextAt, CLICK_S, 0.18);
        state.nextAt += period;
      }
    }, LOOKAHEAD_MS);
    metro = state;
  }

  async function requestWakeLock() {
    if (!wantWakeLock || wakeLock || requesting || document.visibilityState !== 'visible') return;
    requesting = true;
    try {
      if (navigator.wakeLock && typeof navigator.wakeLock.request === 'function') {
        wakeLock = await navigator.wakeLock.request('screen');
        wakeLock.addEventListener?.('release', () => { wakeLock = null; });
        if (!wantWakeLock) releaseWakeLock();
      }
    } catch { wakeLock = null; } finally { requesting = false; }
  }

  function releaseWakeLock() {
    const lock = wakeLock;
    wakeLock = null;
    try { lock?.release(); } catch { /* ignore */ }
  }

  /** Keep the screen on while `active` (re-requested when the app comes back). */
  function keepAwake(active) {
    if (active === wantWakeLock && (!active || wakeLock || requesting)) return;
    wantWakeLock = active;
    if (active) requestWakeLock();
    else releaseWakeLock();
  }

  function dispose() {
    metronome(false);
    wantWakeLock = false;
    releaseWakeLock();
    try { globalThis.speechSynthesis?.cancel(); } catch { /* ignore */ }
  }

  return { unlock, play, metronome, keepAwake, requestWakeLock, dispose, get unlocked() { return unlocked; } };
}
