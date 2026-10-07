import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildSearchIndex, search, normalize, kindOf, DONT_MISS_SHOWN } from '../../js/search-engine.js';

const read = path => JSON.parse(readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8'));
const meta = read('content/meta.json');
const motivos = read('content/motivos.json');
const index = buildSearchIndex(meta, motivos);
const ids = Object.keys(meta).filter(id => id !== 'home');

const top = (query, opts) => search(index, query, opts)?.[0]?.id;
const found = (query, opts) => (search(index, query, opts) ?? []).map(r => r.id);

// ── Content ──

test('every meta.json entry has "keywords": a list of distinct, non-empty strings', () => {
  for (const id of ids) {
    const kw = meta[id].keywords;
    assert.ok(Array.isArray(kw) && kw.length > 0, `${id}: missing "keywords" in content/meta.json`);
    for (const k of kw) assert.ok(typeof k === 'string' && normalize(k), `${id}: empty keyword`);
    const norms = kw.map(normalize);
    assert.equal(new Set(norms).size, norms.length, `${id}: repeated keywords`);
  }
});

test('motivos.json: each chief complaint opens existing modules; each diagnosis points to a module or null', () => {
  assert.ok(motivos.length > 0);
  for (const m of motivos) {
    assert.ok(m.title, 'chief complaint without a title');
    assert.ok(Array.isArray(m.aliases), `${m.title}: "aliases" must be a list`);
    assert.ok(m.opens.length > 0, `${m.title}: "opens" is empty`);
    for (const id of m.opens) assert.ok(meta[id], `${m.title}: module "${id}" does not exist`);
    for (const d of m.dontMiss) {
      assert.ok(d.label, `${m.title}: diagnosis without a label`);
      assert.ok(d.module === null || meta[d.module], `${m.title}: module "${d.module}" does not exist`);
    }
  }
});

// ── Matching ──

test('normalize ignores accents, case and punctuation', () => {
  assert.equal(normalize('  Convulsión / STATUS '), 'convulsion status');
  assert.equal(normalize('β-hCG'), 'beta hcg');
});

test('every module comes first when searching for its own title', () => {
  for (const id of ids) assert.equal(top(meta[id].title), id, `"${meta[id].title}"`);
});

test('understands everyday ER words and abbreviations', () => {
  assert.equal(top('mareo'), 'vertigo');
  assert.equal(top('falta de aire'), 'disnea');
  assert.equal(top('dolor de pecho'), 'dolor-toracico');
  assert.equal(top('IAM'), 'dolor-toracico');
  assert.equal(top('se desmayó'), 'sincope');
  assert.equal(top('potasio'), 'hiperkalemia');
  assert.equal(top('golpe en la cabeza'), 'tec');
  assert.equal(top('dolor de panza'), 'dolor-abdominal');
  assert.ok(found('adrenalina').includes('anafilaxia'));
  assert.ok(found('mareo').includes('sincope'));
});

test('tolerates typos and matches while typing', () => {
  assert.equal(top('convulcion'), 'convulsiones');
  assert.equal(top('hiperkalemai'), 'hiperkalemia');
  assert.equal(top('neumonia'), 'neumonia');
  assert.equal(top('convul'), 'convulsiones');
  assert.equal(top('hipogl'), 'hipoglucemia');
});

test('no typo matching for words that exist: "falla" does not bring "falta de aire"', () => {
  assert.equal(top('falla'), 'falla-renal');
  assert.ok(!found('falla').includes('disnea'));
  assert.ok(!found('focal').includes('hemorragia-digestiva'), '"focal" must not match "materia fecal"');
});

test('when something matches every word, partial matches are left out', () => {
  assert.deepEqual(found('falta de aire'), ['disnea']);
});

test('kinds filters by type: the home shows clinical modules only', () => {
  assert.ok(found('wells').includes('calc-wells-tep'));
  const modulesOnly = search(index, 'wells', { kinds: ['mod'] });
  assert.ok(modulesOnly.length > 0);
  for (const r of modulesOnly) assert.equal(kindOf(meta[r.id]), 'mod', r.id);
  assert.ok(!found('fármacos', { kinds: ['mod'] }).includes('drogas'));
});

test('a chief complaint puts «No te olvides» on its first module, up to 4 diagnoses', () => {
  const [vertigo] = search(index, 'mareo');
  assert.equal(vertigo.via, 'mareo');
  assert.deepEqual(vertigo.dontMiss.map(d => d.label),
    ['ACV de fosa posterior', 'Arritmia', 'Hipoglucemia', 'Hemorragia digestiva']);
  for (const m of motivos) {
    const r = search(index, m.title, { kinds: ['mod'] }).find(x => x.id === m.opens[0]);
    assert.ok(r, `${m.title}: does not bring ${m.opens[0]}`);
    assert.ok(r.dontMiss.length <= DONT_MISS_SHOWN);
    assert.ok(!r.dontMiss.some(d => normalize(d.label) === normalize(meta[r.id].title)), `${m.title}: repeats its own module`);
  }
});

test('empty query → null; no match → empty list', () => {
  assert.equal(search(index, '   '), null);
  assert.equal(search(index, 'de la'), null);
  assert.deepEqual(search(index, 'xyzzy'), []);
});

test('a chief complaint pointing to a missing module is ignored, without breaking', () => {
  const idx = buildSearchIndex(meta, [{ title: 'Prueba', aliases: [], opens: ['no-existe'], dontMiss: [] }]);
  assert.deepEqual(search(idx, 'prueba'), []);
});
