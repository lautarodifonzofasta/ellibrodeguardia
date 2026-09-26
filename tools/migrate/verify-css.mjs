// One-off check: confirms css/*.css together contain the same CSS rules as the
// original index.html's first <style> block, ignoring whitespace/comments and
// the reordering introduced by splitting into multiple files. Compares the
// multiset of "}"-terminated chunks (works even with nested @media blocks,
// since chunks inside a media block are never reordered relative to each
// other, only whole top-level sections are moved between files).
import { readFileSync } from 'node:fs';

function chunks(css) {
  const stripped = css.replace(/\/\*[\s\S]*?\*\//g, '');
  return stripped
    .split('}')
    .map(c => c.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .sort();
}

const src = readFileSync(new URL('../../legacy-index.html', import.meta.url), 'utf8');
const styleStart = src.indexOf('<style>') + '<style>'.length;
const styleEnd = src.indexOf('</style>', styleStart);
const original = src.slice(styleStart, styleEnd);

const files = ['tokens.css', 'layout.css', 'components.css', 'responsive.css'];
const combined = files
  .map(f => readFileSync(new URL(`../../css/${f}`, import.meta.url), 'utf8'))
  .join('\n');

const a = chunks(original);
const b = chunks(combined);

console.log('original chunk count:', a.length);
console.log('combined chunk count:', b.length);

const bSet = new Map();
for (const c of b) bSet.set(c, (bSet.get(c) || 0) + 1);
const missing = [];
for (const c of a) {
  const n = bSet.get(c) || 0;
  if (n === 0) missing.push(c);
  else bSet.set(c, n - 1);
}
const extra = [];
for (const [c, n] of bSet) for (let i = 0; i < n; i++) extra.push(c);

console.log('missing from new files:', missing.length);
missing.forEach(c => console.log('  MISSING:', c.slice(0, 200)));
console.log('extra in new files (not in original):', extra.length);
extra.forEach(c => console.log('  EXTRA:', c.slice(0, 200)));

console.log(missing.length === 0 && extra.length === 0 ? 'OK: CSS content matches exactly.' : 'MISMATCH — review above.');
