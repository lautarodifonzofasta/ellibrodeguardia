// Confirms translated content/drugs/*.<lang>.json have the same drug count
// and column count per category as the Spanish originals (structure parity —
// not a translation-quality check, just "nothing got dropped").
import { readFileSync, existsSync } from 'node:fs';

const lang = process.argv[2];
if (!lang) { console.error('usage: node verify-drugs-i18n.mjs <lang>'); process.exit(1); }

const index = JSON.parse(readFileSync(new URL('../../content/drugs/index.json', import.meta.url), 'utf8'));
let problems = 0;

for (const cat of index.categories) {
  const es = JSON.parse(readFileSync(new URL(`../../content/drugs/${cat}.json`, import.meta.url), 'utf8'));
  const ptPath = new URL(`../../content/drugs/${cat}.${lang}.json`, import.meta.url);
  if (!existsSync(ptPath)) { console.log(`MISSING: content/drugs/${cat}.${lang}.json`); problems++; continue; }
  const pt = JSON.parse(readFileSync(ptPath, 'utf8'));

  if (es.drugs.length !== pt.drugs.length) {
    console.log(`${cat}: drug count mismatch — es=${es.drugs.length} ${lang}=${pt.drugs.length}`);
    problems++;
  }
  if (es.columns.length !== pt.columns.length) {
    console.log(`${cat}: column count mismatch — es=${es.columns.length} ${lang}=${pt.columns.length}`);
    problems++;
  }
  for (let i = 0; i < Math.min(es.drugs.length, pt.drugs.length); i++) {
    const hasCautionEs = es.drugs[i].caution !== undefined;
    const hasCautionPt = pt.drugs[i].caution !== undefined;
    if (hasCautionEs !== hasCautionPt) {
      console.log(`${cat}[${i}] (${es.drugs[i].name}): caution field presence mismatch`);
      problems++;
    }
  }
}

console.log(problems === 0 ? 'OK' : `${problems} problem(s) found`);
if (problems) process.exitCode = 1;
