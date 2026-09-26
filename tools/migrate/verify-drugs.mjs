// Verifies content/drugs/*.json against the raw extracted drogas table —
// same word-multiset approach as verify-content.mjs.
import { readFileSync, readdirSync } from 'node:fs';

function stripTags(html) {
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

const raw = readFileSync(new URL('intermediate/drogas.raw.html', import.meta.url), 'utf8');
const rawWords = wordSet(stripTags(raw));

const files = readdirSync(new URL('../../content/drugs', import.meta.url)).filter(f => f !== 'index.json');
const index = JSON.parse(readFileSync(new URL('../../content/drugs/index.json', import.meta.url), 'utf8'));
let jsonText = ' ' + index.intro.icon + ' ' + index.intro.title + ' ' + index.intro.text + ' ';
for (const f of files) {
  const data = JSON.parse(readFileSync(new URL(`../../content/drugs/${f}`, import.meta.url), 'utf8'));
  jsonText += ' ' + data.label + ' ' + data.columns.join(' ') + ' ';
  for (const d of data.drugs) jsonText += `${d.name} ${d.indication} ${d.dose} ${d.caution || ''} `;
}
const jsonWords = wordSet(stripTags(jsonText));

const missing = missingFrom(rawWords, jsonWords);
console.log(`raw word count: ${[...rawWords.values()].reduce((a, b) => a + b, 0)}, json word count: ${[...jsonWords.values()].reduce((a, b) => a + b, 0)}`);
console.log('missing from JSON:', missing.length);
missing.forEach(m => console.log(' ', m));
console.log(missing.length === 0 ? 'OK: drug data matches raw extraction.' : 'MISMATCH — review above.');
