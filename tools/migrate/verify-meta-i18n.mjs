// Confirms a translated meta.<lang>.json has exactly the same keys as
// meta.json, and that icon/badge/type (non-translatable fields) are
// unchanged — only title/category/sub should differ.
import { readFileSync, existsSync } from 'node:fs';

const lang = process.argv[2];
if (!lang) { console.error('usage: node verify-meta-i18n.mjs <lang>'); process.exit(1); }

const base = JSON.parse(readFileSync(new URL('../../content/meta.json', import.meta.url), 'utf8'));
const path = new URL(`../../content/meta.${lang}.json`, import.meta.url);
if (!existsSync(path)) { console.error(`content/meta.${lang}.json does not exist`); process.exit(1); }
const translated = JSON.parse(readFileSync(path, 'utf8'));

const baseKeys = Object.keys(base);
const trKeys = Object.keys(translated);
const missing = baseKeys.filter(k => !trKeys.includes(k));
const extra = trKeys.filter(k => !baseKeys.includes(k));

console.log('missing keys:', missing);
console.log('extra keys:', extra);

let fieldMismatches = 0;
for (const k of baseKeys) {
  if (!translated[k]) continue;
  for (const field of ['icon', 'badge', 'type']) {
    if (base[k][field] !== translated[k][field]) {
      fieldMismatches++;
      console.log(`FIELD MISMATCH ${k}.${field}: es=${JSON.stringify(base[k][field])} vs ${lang}=${JSON.stringify(translated[k][field])}`);
    }
  }
  // Every base entry with a "sub" should have one in translation too (and vice versa) — catches a dropped sub.
  if (!!base[k].sub !== !!translated[k].sub) {
    fieldMismatches++;
    console.log(`SUB PRESENCE MISMATCH ${k}: es has sub=${!!base[k].sub}, ${lang} has sub=${!!translated[k].sub}`);
  }
}

const ok = missing.length === 0 && extra.length === 0 && fieldMismatches === 0;
console.log(ok ? 'OK' : 'MISMATCH');
if (!ok) process.exitCode = 1;
