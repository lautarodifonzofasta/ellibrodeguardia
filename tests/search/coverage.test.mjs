import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildSearchIndex, search } from '../../js/search-engine.js';

// How the ER actually asks for the newer content: patient words in the home box
// ("¿Qué tiene el paciente?", clinical modules only, like js/home.js) and score
// names in the search modal (everything, like js/search.js). If a keyword or
// alias change moves one of these, fix the content, not the expectation.

const read = path => JSON.parse(readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8'));
const meta = read('content/meta.json');
const index = buildSearchIndex(meta, read('content/motivos.json'));

const HOME = { kinds: ['mod'] };
const top = (query, opts) => search(index, query, opts)?.[0]?.id;
const first = (query, opts) => search(index, query, opts)?.[0];

const homeBox = [
  ['vomita sangre', 'hemorragia-digestiva'],
  ['vómito en borra de café', 'hemorragia-digestiva'],
  ['hace caca negra', 'hemorragia-digestiva'],
  ['rectorragia', 'hemorragia-digestiva'],
  ['sangrado por el ano', 'hemorragia-digestiva'],
  ['deposiciones con sangre roja', 'hemorragia-digestiva'],
  ['ataque de asma', 'asma'],
  ['primera crisis convulsiva', 'convulsiones'],
  ['le duele la cabeza', 'cefalea'],
  ['deposiciones líquidas', 'gastroenteritis'],
  ['status asmático', 'asma'],
  ['le chifla el pecho', 'asma'],
  ['asma primera hora', 'asma'],
  ['EPOC descompensado', 'epoc'],
  ['retenedor de CO2', 'epoc'],
  ['ventilación no invasiva', 'epoc'],
  ['no puede respirar', 'disnea'],
  ['dolor de cabeza toda la familia', 'monoxido'],
  ['brasero', 'monoxido'],
  ['respiró humo en un incendio', 'monoxido'],
  ['retención urinaria', 'rao'],
  ['HPB', 'rao'],
  ['flojo de vientre', 'gastroenteritis'],
  ['comió algo en mal estado', 'gastroenteritis'],
  ['SUH', 'gastroenteritis'],
  ['dolor testicular', 'escroto-agudo'],
  ['golpe en los testículos', 'escroto-agudo'],
  ['torsión', 'escroto-agudo'],
  ['torsión ovárica', 'dolor-abdominal'],
  ['se cortó la mano', 'heridas'],
  ['necesita puntos', 'heridas'],
  ['sutura', 'heridas'],
  ['antitetánica', 'heridas'],
  ['clavo oxidado', 'heridas'],
  ['lo mordió un perro', 'mordeduras'],
  ['mordedura de gato', 'mordeduras'],
  ['murciélago', 'mordeduras'],
  ['antirrábica', 'mordeduras'],
  ['se torció el tobillo', 'trauma-menor'],
  ['esguince', 'trauma-menor'],
  ['fractura expuesta', 'trauma-menor'],
  ['se le salió el hombro', 'trauma-menor'],
  ['escafoides', 'trauma-menor'],
  ['golpe en la cabeza', 'tec'],
  ['herida de arma blanca', 'politrauma'],
];

const anyBox = [
  ['NIHSS', 'calc-nihss'],
  ['NEWS2', 'calc-news2'],
  ['score de alerta temprana', 'calc-news2'],
  ['score Oakland', 'calc-oakland'],
  ['PEF', 'calc-pef'],
  ['flujómetro', 'calc-pef'],
  ['gasometría', 'calc-gases'],
  ['EAB', 'calc-gases'],
  ['Blatchford HDA', 'calc-blatchford'],
  ['score de hemorragia digestiva alta', 'calc-blatchford'],
  ['BISAP', 'pancreatitis'],
  ['TWIST', 'escroto-agudo'],
  ['regla canadiense', 'tec'],
  ['qSOFA', 'sepsis'],
];

test('home box: patient and ER words reach the right clinical module first', () => {
  for (const [query, id] of homeBox) assert.equal(top(query, HOME), id, `"${query}"`);
});

test('search modal: scores and their abbreviations reach the calculator, or the module that embeds it', () => {
  for (const [query, id] of anyBox) assert.equal(top(query), id, `"${query}"`);
});

test('"hemorragia digestiva alta/baja" open the module first, not only Score Oakland', () => {
  for (const query of ['hemorragia digestiva alta', 'hemorragia digestiva baja']) {
    const ids = search(index, query).map(r => r.id);
    assert.equal(ids[0], 'hemorragia-digestiva', `"${query}"`);
  }
  assert.ok(search(index, 'hemorragia digestiva baja').some(r => r.id === 'calc-oakland'));
});

test('lower GI bleeding also brings the chief complaint card with «No te olvides»', () => {
  const r = first('rectorragia', HOME);
  assert.equal(r.id, 'hemorragia-digestiva');
  assert.ok(r.dontMiss.some(d => d.label === 'Shock hemorrágico'));
});

test('«No te olvides» order for testicular and abdominal pain (only the first 4 are shown)', () => {
  assert.deepEqual(first('dolor testicular', HOME).dontMiss.map(d => d.label),
    ['Gangrena de Fournier', 'Hernia inguinal estrangulada', 'Cólico renal (dolor referido)', 'Aneurisma de aorta abdominal']);
  assert.deepEqual(first('dolor abdominal', HOME).dontMiss.map(d => d.label),
    ['Embarazo ectópico', 'Aneurisma de aorta', 'Isquemia mesentérica', 'Torsión testicular']);
});
