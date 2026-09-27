// Dev-only demo of the resuscitation engine (Fase 1 has no screens yet):
// runs the acceptance-criteria path on the AHA 2025 profile with simulated
// times and prints what the screen would show, the summary and the
// chronology.
//   node tools/rcp-demo.mjs
// While the profile's "Validado por" is still [REVISAR], the demo signs a
// copy in memory ("DEMO") so it can run; the app itself refuses it.
import { readFileSync } from 'node:fs';
import { createEngine } from '../js/rcp/engine.js';
import { getStatus, summarize, chronology } from '../js/rcp/status.js';
import { serializeSession, deserializeSession } from '../js/rcp/storage.js';

const shipped = JSON.parse(readFileSync(new URL('../content/rcp/aha-2025-adulto.json', import.meta.url), 'utf8'));
const pending = /\[\s*revisar/i.test(shipped.validatedBy);
const profile = pending ? { ...shipped, validatedBy: 'DEMO' } : shipped;
const rcp = createEngine(profile);

const T0 = Date.now();
const at = s => T0 + s * 1000;
const mmss = ms => `${String(Math.floor(ms / 60000)).padStart(2, '0')}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`;
const clock = ms => new Date(ms).toLocaleTimeString('es-AR', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });

function show(label, s, t) {
  const st = getStatus(s, profile, at(t));
  const cyc = st.cycle ? `ciclo ${st.cycle.number} ${mmss(st.cycle.elapsedMs)}${st.cycle.durationMs ? '/' + mmss(st.cycle.durationMs) : ''}` : '';
  console.log(`[${mmss(st.totalMs)}] ${label.padEnd(26)} Box ${String(st.algorithm?.box ?? '-').padEnd(3)} ${st.state.padEnd(13)} ${cyc}`);
  if (st.prompt) console.log(`         pantalla: ${st.prompt.screen}`);
  if (st.algorithm?.actions.length) console.log(`         recordatorios: ${st.algorithm.actions.join(' · ')}`);
  for (const i of st.indications) {
    const opts = i.options ? ' → ' + i.options.map(o => `${o.name} ${o.dose.amount}`).join(' o ') : '';
    console.log(`         indicación del perfil: ${i.message.screen}${opts} (${i.reason ?? 'dosis ' + i.doseNumber})`);
  }
}

console.log(`Perfil: ${profile.name} · ${profile.version}${pending ? '   ⚠ "Validado por" pendiente: la app no lo usa hasta que se complete' : ''}\n`);
let s = rcp.createSession({ id: 'demo', now: at(0) });
s = rcp.startCpr(s, at(0));                                   show('Iniciar RCP', s, 0);
s = rcp.beginRhythmCheck(s, at(40));
s = rcp.selectRhythm(s, 'shockable', at(42));                 show('Evaluar ritmo → FV', s, 42);
s = rcp.confirmShock(s, at(45));                              show('Descarga realizada', s, 45);
s = rcp.resumeCpr(s, at(46));                                 show('Reiniciar compresiones', s, 46);
s = rcp.recordVascularAccess(s, 'IV', at(70));                show('Acceso IV registrado', s, 70);
show('(preaviso)', s, 46 + 106);
show('(fin de ciclo)', s, 46 + 120);

s = deserializeSession(serializeSession(s));                  show('(recarga de la página)', s, 166);

s = rcp.beginRhythmCheck(s, at(167));
s = rcp.selectRhythm(s, 'shockable', at(169));
s = rcp.confirmShock(s, at(172));
s = rcp.resumeCpr(s, at(173));                                show('2ª descarga y reinicio', s, 173);
const adr = getStatus(s, profile, at(175)).indications.find(i => i.drugId === 'adrenalina');
s = rcp.giveMedication(s, { drugId: 'adrenalina', name: 'Adrenalina', dose: adr.dose.amount, route: adr.dose.route }, at(180));
const w = getStatus(s, profile, at(181)).medications.inProfile.find(m => m.drugId === 'adrenalina');
console.log(`         Adrenalina dada · ${w.windowText.replace('{mm:ss}', mmss(w.window.fromAt - at(181)))}`);
s = rcp.confirmRosc(s, at(240));                              show('ROSC confirmado', s, 240);

const sum = summarize(s, profile, at(300));
console.log(`\nResumen: ${mmss(sum.durationMs)} de RCP · ${sum.cycles} ciclos · ${sum.shocks} descargas · ` +
  `${sum.medications.map(m => `${m.name} ×${m.count}`).join(', ')} · ROSC ${sum.rosc.confirmed ? 'sí, ' + clock(sum.rosc.at) : 'no'} · ` +
  `pausas: ${sum.pauses.count}, máx ${mmss(sum.pauses.maxMs)}, total ${mmss(sum.pauses.totalMs)}`);
console.log('\nCronología:');
for (const e of chronology(s)) {
  console.log(`  ${clock(e.at)}  +${mmss(e.offsetMs)}  ciclo ${e.cycle}  Box ${String(e.box).padEnd(2)} ${e.type}${Object.keys(e.data).length ? ' ' + JSON.stringify(e.data) : ''}`);
}
