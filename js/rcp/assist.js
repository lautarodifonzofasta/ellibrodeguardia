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
const SPANISH = /^es(?:[-_]|$)/i;
const VOICE_WAIT_MS = 250;
const VOICE_WAIT_TRIES = 12;   // up to 3 s for the voice list

/** Argentina first, then the rest of Latin America, then Spain, then any other Spanish. */
function regionRank(lang) {
  const region = (lang.split(/[-_]/)[1] || '').toUpperCase();
  return region === 'AR' ? 0 : region === 'ES' ? 2 : region ? 1 : 3;
}

/**
 * @param {{onVoices?: () => void}} [options]  onVoices: the voice list changed
 *   (it loads asynchronously), e.g. to refresh the settings.
 */
export function createAssist({ onVoices } = {}) {
  let ctx = null;
  let unlocked = false;
  let metro = null;          // { bpm, src }: a looping one-beat buffer
  let wakeLock = null;
  let wantWakeLock = false;
  let requesting = false;
  let pending = [];          // texts waiting for the voice list
  let voiceTimer = null;
  let utterance = null;      // kept referenced while it speaks (Chrome may drop collected ones)

  // Chrome and Edge return no voices on the first call and load them in the
  // background: ask now, so they're ready by the first prompt.
  const onVoicesChanged = () => { flushPending(); onVoices?.(); };
  try {
    globalThis.speechSynthesis?.getVoices();
    globalThis.speechSynthesis?.addEventListener?.('voiceschanged', onVoicesChanged);
  } catch { /* no speech */ }

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
    // 'interrupted' is iPhone's state after a call or a locked screen.
    try { if (c && c.state !== 'running') c.resume(); } catch { /* ignore */ }
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

  function voices() {
    try { return globalThis.speechSynthesis?.getVoices() || []; } catch { return []; }
  }

  /**
   * The Spanish voice to use, or null. Within a region, a voice installed on
   * the device comes before an online one; offline, online voices can't speak.
   */
  function spanishVoice() {
    const offline = globalThis.navigator?.onLine === false;
    return voices()
      .filter(v => SPANISH.test(v.lang) && (!offline || v.localService))
      .sort((a, b) => regionRank(a.lang) - regionRank(b.lang) || Number(b.localService) - Number(a.localService))[0] || null;
  }

  /** For the settings: the voice in use, or why there is none. */
  function voiceStatus() {
    if (!globalThis.speechSynthesis) return { state: 'none' };
    const all = voices();
    if (!all.length) return { state: 'loading' };
    const v = spanishVoice();
    if (v) return { state: 'ok', name: v.name, lang: v.lang };
    return { state: all.some(x => SPANISH.test(x.lang)) ? 'offline' : 'none' };
  }

  function speakWith(text, v) {
    try {
      const u = new SpeechSynthesisUtterance(text);
      u.voice = v;
      u.lang = v.lang;
      u.rate = 1.05;
      utterance = u;
      globalThis.speechSynthesis.speak(u);
    } catch { /* speech unavailable */ }
  }

  function flushPending() {
    if (!pending.length || !voices().length) return;
    const texts = pending;
    pending = [];
    const v = spanishVoice();
    if (v) texts.forEach(t => speakWith(t, v));
  }

  function waitForVoices(tries = 0) {
    if (voiceTimer) return;
    voiceTimer = setTimeout(() => {
      voiceTimer = null;
      if (voices().length) flushPending();
      else if (tries + 1 < VOICE_WAIT_TRIES) waitForVoices(tries + 1);
      else pending = [];     // no voice list at all: stay silent
    }, VOICE_WAIT_MS);
  }

  /**
   * Speaks in Spanish or not at all: the device's default voice is often
   * English, and Spanish prompts read in English are worse than silence (the
   * screen, beeps and vibration still carry the alert). While the voice list
   * is loading, the text waits for it.
   */
  function speak(text) {
    if (!globalThis.speechSynthesis || !text) return;
    const v = spanishVoice();
    if (v) speakWith(text, v);
    else if (!voices().length) { pending.push(text); waitForVoices(); }
  }

  /** Speaks one text now, replacing anything queued (the "Probar voz" button). */
  function say(text) {
    pending = [];
    try { globalThis.speechSynthesis?.cancel(); } catch { /* ignore */ }
    speak(text);
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
      pending = [];
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

  /** One beat of audio: a short decaying click followed by silence. */
  function beatBuffer(c, bpm) {
    const length = Math.round(c.sampleRate * 60 / bpm);
    const buffer = c.createBuffer(1, length, c.sampleRate);
    const data = buffer.getChannelData(0);
    const clickLength = Math.round(c.sampleRate * CLICK_S);
    for (let i = 0; i < clickLength; i++) {
      data[i] = Math.sin(2 * Math.PI * CLICK_HZ * i / c.sampleRate) * 0.35 * (1 - i / clickLength);
    }
    return buffer;
  }

  function stopMetronome() {
    if (!metro) return;
    try { metro.src.stop(); } catch { /* already stopped */ }
    try { metro.src.disconnect(); } catch { /* ignore */ }
    metro = null;
  }

  /**
   * Starts, retunes or stops the metronome. The beat is a looping audio
   * buffer, so the audio hardware keeps time: no JS timer can drift, bunch
   * or skip clicks when the page is busy.
   */
  function metronome(on, bpm) {
    if (!on || !bpm) { stopMetronome(); return; }
    const c = audio();
    if (!c) return;
    if (metro && metro.bpm === bpm) return;
    stopMetronome();
    try {
      const src = c.createBufferSource();
      src.buffer = beatBuffer(c, bpm);
      src.loop = true;
      src.connect(c.destination);
      src.start(c.currentTime + 0.05);
      metro = { bpm, src };
    } catch { metro = null; }
  }

  async function requestWakeLock() {
    try { if (ctx && ctx.state !== 'running') ctx.resume(); } catch { /* needs a tap on some phones */ }
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
    pending = [];
    clearTimeout(voiceTimer);
    voiceTimer = null;
    utterance = null;
    try {
      globalThis.speechSynthesis?.removeEventListener?.('voiceschanged', onVoicesChanged);
      globalThis.speechSynthesis?.cancel();
    } catch { /* ignore */ }
  }

  return { unlock, play, say, voiceStatus, metronome, keepAwake, requestWakeLock, dispose, get unlocked() { return unlocked; } };
}
