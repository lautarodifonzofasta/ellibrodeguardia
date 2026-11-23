import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { normalizar, coincide } from '../js/imagenes.js';

// "¿Qué imagen pido?": the filter logic and the shape of every card in
// content/modules/imagenes-trauma.html.

const html = readFileSync(new URL('../content/modules/imagenes-trauma.html', import.meta.url), 'utf8');
const sinTags = s => s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const tarjetas = [...html.matchAll(/<div class="img-card" data-img-zona="([^"]*)" data-img-k="([^"]*)">([\s\S]*?)\n<\/div>/g)]
  .map(([, zona, k, cuerpo]) => ({ zona, texto: `${k} ${sinTags(cuerpo)}`, cuerpo }));
const chips = [...html.matchAll(/class="tab[^"]*" data-img-zona="([^"]*)"/g)].map(m => m[1]);
const buscar = (consulta, zona = '') => tarjetas.filter(t => coincide(t, consulta, zona)).map(t => sinTags(t.cuerpo));

test('normalizar ignores case and accents', () => {
  assert.equal(normalizar('  Muñeca  '), 'muneca');
  assert.equal(normalizar('RMN'), 'rmn');
  assert.equal(normalizar(null), '');
});

test('every card has an area chip, a suspected injury and a first study', () => {
  assert.ok(tarjetas.length >= 25, `only ${tarjetas.length} cards parsed`);
  for (const t of tarjetas) {
    assert.ok(chips.includes(t.zona), `no chip for area "${t.zona}"`);
    assert.match(t.cuerpo, /<div class="img-sosp">[^<]+<\/div>/);
    assert.match(t.cuerpo, /<span class="tag t-g">1\.º<\/span>/);
  }
});

test('every area chip has at least one card', () => {
  for (const zona of chips.filter(Boolean)) assert.ok(tarjetas.some(t => t.zona === zona), `chip "${zona}" is empty`);
});

test('an empty query with no chip shows everything', () => {
  assert.equal(buscar('').length, tarjetas.length);
});

test('the chip limits the list to one area', () => {
  const tobillo = buscar('', 'tobillo');
  assert.ok(tobillo.length >= 2);
  assert.ok(tobillo.every(t => t.startsWith('Tobillo')));
});

test('the way it is asked in the ER finds the right card', () => {
  assert.match(buscar('menisco')[0], /RM sin contraste/);
  assert.match(buscar('lesion meniscal')[0], /RM sin contraste/);
  assert.match(buscar('escafoides')[0], /proyección de escafoides/);
  assert.match(buscar('metatarsiano')[0], /frente, oblicua y perfil/);
  assert.match(buscar('LISFRANC')[0], /con carga/);
  assert.match(buscar('tobillo ottawa')[0], /frente, perfil y mortaja/);
  assert.match(buscar('hombro salido')[0], /axilar/);
  assert.match(buscar('cadera anciano')[0], /RM sin contraste/);
});

test('all the words of the query must match, and the chip is respected', () => {
  assert.equal(buscar('menisco', 'tobillo').length, 0);
  assert.equal(buscar('palabra-que-no-existe').length, 0);
});
