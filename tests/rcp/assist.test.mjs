import { test, mock, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createAssist } from '../../js/rcp/assist.js';

// A stand-in for the browser's speechSynthesis: a voice list that can load
// late (as in Chrome and Edge) and a record of what was spoken, with which voice.
const voice = (name, lang, localService) => ({ name, lang, localService, default: false });
const ENGLISH = voice('Microsoft David - English (United States)', 'en-US', true);
const SPAIN = voice('Microsoft Helena - Spanish (Spain)', 'es-ES', true);
const US_ONLINE = voice('Google español de Estados Unidos', 'es-US', false);
const AR_ONLINE = voice('Microsoft Elena Online (Natural) - Spanish (Argentina)', 'es-AR', false);

let synth;
const realNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');

beforeEach(() => {
  synth = {
    voices: [], spoken: [], listener: null,
    getVoices() { return this.voices; },
    speak(u) { this.spoken.push({ text: u.text, lang: u.voice?.lang ?? null }); },
    cancel() {},
    addEventListener(type, fn) { if (type === 'voiceschanged') this.listener = fn; },
    removeEventListener() { this.listener = null; },
    load(list) { this.voices = list; this.listener?.(); },
  };
  globalThis.speechSynthesis = synth;
  globalThis.SpeechSynthesisUtterance = class { constructor(text) { this.text = text; } };
  mock.timers.enable({ apis: ['setTimeout'] });
});

afterEach(() => {
  mock.timers.reset();
  delete globalThis.speechSynthesis;
  delete globalThis.SpeechSynthesisUtterance;
  if (realNavigator) Object.defineProperty(globalThis, 'navigator', realNavigator);
});

const setOnline = onLine => Object.defineProperty(globalThis, 'navigator', { value: { onLine }, configurable: true });

test('voice: Argentina first, then Latin America, then Spain; never the English default', () => {
  synth.voices = [ENGLISH, SPAIN, US_ONLINE, AR_ONLINE];
  const assist = createAssist();
  assist.say('Prueba de voz.');
  assert.deepEqual(synth.spoken, [{ text: 'Prueba de voz.', lang: 'es-AR' }]);
  synth.voices = [ENGLISH, SPAIN, US_ONLINE];
  assist.say('Otra.');
  assert.equal(synth.spoken.at(-1).lang, 'es-US');
  assert.deepEqual(assist.voiceStatus(), { state: 'ok', name: US_ONLINE.name, lang: 'es-US' });
});

test('voice: within a region, one installed on the device before an online one', () => {
  const mxOnline = voice('Microsoft Dalia Online (Natural) - Spanish (Mexico)', 'es-MX', false);
  const mxLocal = voice('Microsoft Sabina - Spanish (Mexico)', 'es_MX', true);
  synth.voices = [mxOnline, mxLocal];
  createAssist().say('x');
  assert.equal(synth.spoken[0].lang, 'es_MX');
});

test('voice: with no Spanish voice it stays silent instead of reading in English', () => {
  synth.voices = [ENGLISH];
  const assist = createAssist();
  assist.say('Iniciar compresiones.');
  mock.timers.tick(5000);
  assert.deepEqual(synth.spoken, []);
  assert.deepEqual(assist.voiceStatus(), { state: 'none' });
});

test('voice: offline, online voices are skipped (a local Spanish one is used if any)', () => {
  setOnline(false);
  synth.voices = [ENGLISH, AR_ONLINE];
  const assist = createAssist();
  assist.say('x');
  assert.deepEqual(synth.spoken, []);
  assert.deepEqual(assist.voiceStatus(), { state: 'offline' });
  synth.voices = [ENGLISH, AR_ONLINE, SPAIN];
  assist.say('y');
  assert.deepEqual(synth.spoken, [{ text: 'y', lang: 'es-ES' }]);
});

test('voice: a prompt waits for the voice list, which loads after the first call', () => {
  const assist = createAssist();
  assert.deepEqual(assist.voiceStatus(), { state: 'loading' });
  assist.play([{ id: 'a', voice: 'Iniciar compresiones. Conectar el monitor.', beep: 0, vibrate: null }], { audio: true, vibration: false });
  mock.timers.tick(0);                          // play() speaks after its (zero) beep time
  assert.deepEqual(synth.spoken, []);
  mock.timers.tick(600);
  synth.load([ENGLISH, AR_ONLINE]);             // voiceschanged
  assert.deepEqual(synth.spoken, [{ text: 'Iniciar compresiones. Conectar el monitor.', lang: 'es-AR' }]);
});

test('voice: the list is polled when voiceschanged never fires (Safari), and waiting gives up after 3 s', () => {
  const assist = createAssist();
  assist.say('uno');
  mock.timers.tick(500);
  synth.voices = [SPAIN];                        // loaded, no event
  mock.timers.tick(250);
  assert.deepEqual(synth.spoken, [{ text: 'uno', lang: 'es-ES' }]);

  synth.voices = [];
  assist.say('dos');
  for (let i = 0; i < 14; i++) mock.timers.tick(250);
  synth.load([SPAIN]);
  assert.equal(synth.spoken.length, 1, 'a text that waited more than 3 s is dropped, not read late');
});

test('voice: a new batch of prompts replaces texts still waiting for the voice list', () => {
  const assist = createAssist();
  const cue = voice => [{ id: voice, voice, beep: 0, vibrate: null }];
  assist.play(cue('Prepararse para evaluar ritmo.'), { audio: true, vibration: false });
  mock.timers.tick(0);
  assist.play(cue('Detener compresiones. Evaluar ritmo.'), { audio: true, vibration: false });
  mock.timers.tick(0);
  synth.load([AR_ONLINE]);
  assert.deepEqual(synth.spoken.map(s => s.text), ['Detener compresiones. Evaluar ritmo.']);
});
