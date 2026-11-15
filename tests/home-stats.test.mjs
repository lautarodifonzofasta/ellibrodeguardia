import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

// The home page and the README show how much the app contains. These counts are
// computed from the content itself, so adding a module, a calculator or a drug
// fails this test until content/home.html and README.md are updated.

const text = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const json = path => JSON.parse(text(path));

const meta = json('content/meta.json');
const entries = Object.entries(meta).filter(([id]) => id !== 'home');
const moduleHtml = readdirSync(new URL('../content/modules/', import.meta.url))
  .filter(f => f.endsWith('.html'))
  .map(f => text(`content/modules/${f}`))
  .join('\n');

// Clinical modules: everything that is not a calculator or the drug reference
// (the RCP assistant counts as a module).
const modules = entries.filter(([, m]) => m.badge !== 'calc' && m.type !== 'drugs').length;

// Calculators: the ones in the menu, the ones embedded in a module with
// data-calculator="…" that have no menu entry, and the two inline ones
// (BISAP in pancreatitis.html, gestational age in ginecoobs.html).
const inMenu = entries.filter(([, m]) => m.badge === 'calc').length;
const embeddedOnly = new Set([...moduleHtml.matchAll(/data-calculator="([^"]+)"/g)].map(m => m[1]).filter(id => !meta[id]));
const inline = ['calcBISAP', 'calcEG'].filter(fn => new RegExp(`\\b${fn}\\b`).test(moduleHtml));
const calculators = inMenu + embeddedOnly.size + inline.length;

// Drugs with doses: every drug of every category listed in content/drugs/index.json.
const drugs = json('content/drugs/index.json').categories
  .reduce((n, c) => n + json(`content/drugs/${c}.json`).drugs.length, 0);

test('the inline calculators are still where the count expects them', () => {
  assert.deepEqual(inline, ['calcBISAP', 'calcEG']);
});

test('home page numbers match the content', () => {
  const shown = [...text('content/home.html').matchAll(/<div class="home-stat-n">(\d+)<\/div>/g)].map(m => Number(m[1]));
  assert.deepEqual(shown, [modules, calculators, drugs],
    'content/home.html: Módulos clínicos · Calculadoras · Fármacos con dosis');
});

test('README numbers match the content', () => {
  const line = text('README.md').match(/^(\d+) módulos · (\d+) calculadoras · (\d+) fármacos con dosis\s*$/m);
  assert.ok(line, 'README.md: missing the line "N módulos · N calculadoras · N fármacos con dosis"');
  assert.deepEqual(line.slice(1, 4).map(Number), [modules, calculators, drugs]);
});

test('the drug reference subtitle matches the number of drugs', () => {
  assert.equal(meta.drogas.sub, `${drugs} fármacos con dosis`);
});
