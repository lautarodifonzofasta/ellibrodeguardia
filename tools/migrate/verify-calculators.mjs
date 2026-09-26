// Verifies content/calculators/*.json against the raw extracted calc-*.raw.html
// files — word-multiset diff, same approach as verify-content.mjs. For each
// option, compares against the badge text if present (what was literally
// displayed in the original .calc-opt-pts div), falling back to the numeric
// points value for calculators that only show one number (sofa, heart, etc).
import { readFileSync, readdirSync } from 'node:fs';

function stripTags(html) {
  // Only strips well-formed tags (<tag ...> or </tag>) — plain "<45" / ">3×"
  // comparison symbols in clinical text are common and must survive.
  return html.replace(/<\/?[a-zA-Z][^>]*>/g, ' ').replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&amp;/g, '&');
}
function wordSet(text) {
  const map = new Map();
  for (const w of text.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean)) map.set(w, (map.get(w) || 0) + 1);
  return map;
}
function missingFrom(a, b) {
  const out = [];
  for (const [w, n] of a) { const nb = b.get(w) || 0; if (nb < n) out.push({ word: w, need: n - nb }); }
  return out;
}

const files = readdirSync(new URL('intermediate', import.meta.url)).filter(f => f.startsWith('calc-') && f.endsWith('.raw.html'));

let totalMissing = 0;
for (const f of files) {
  const id = f.replace('.raw.html', '');
  const raw = readFileSync(new URL(`intermediate/${f}`, import.meta.url), 'utf8');
  const rawWords = wordSet(stripTags(raw));

  const jsonPath = new URL(`../../content/calculators/${id}.json`, import.meta.url);
  const data = JSON.parse(readFileSync(jsonPath, 'utf8'));

  let text = ' ' + (data.intro?.icon || '') + ' ' + (data.intro?.title || '') + ' ' + (data.intro?.text || '') + ' ';
  if (data.groups) {
    for (const g of data.groups) {
      text += ' ' + (g.label || '') + ' ';
      for (const o of g.options) {
        text += ' ' + o.label + ' ' + (o.badge !== undefined ? o.badge : o.points) + ' ';
      }
    }
    text += ' ' + (data.result?.initialScore ?? '') + ' ' + (data.result?.initialLabel || '') + ' ' + (data.result?.note || '') + ' ';
  }
  if (data.inputs) {
    for (const inp of data.inputs) {
      text += ' ' + inp.label + ' ';
      if (inp.options) for (const o of inp.options) text += ' ' + o.label + ' ';
    }
    text += ' ' + (data.placeholder || '') + ' ';
  }
  const jsonWords = wordSet(stripTags(text));

  const missing = missingFrom(rawWords, jsonWords);
  totalMissing += missing.length;
  console.log(`${id}: raw=${[...rawWords.values()].reduce((a, b) => a + b, 0)} json=${[...jsonWords.values()].reduce((a, b) => a + b, 0)} missing=${missing.length}`);
  if (missing.length) missing.forEach(m => console.log('   ', m));
}
console.log(totalMissing === 0 ? '\nOK: all calculator JSON matches raw extraction.' : '\nMISMATCH — review above.');
