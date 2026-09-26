// One-off: parses tools/migrate/intermediate/drogas.raw.html (itself produced
// by extract-and-split.mjs) into structured per-category JSON. Table rows are
// very regular, so a targeted parse is safe and removes the risk of a
// hand-transcription typo in medical dosing data.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const raw = readFileSync(new URL('intermediate/drogas.raw.html', import.meta.url), 'utf8');

const categories = [
  { id: 'cardio', label: '💓 Cardiovascular', anchor: 'dr-cardio' },
  { id: 'neuro', label: '🧠 Neurológico', anchor: 'dr-neuro' },
  { id: 'resp', label: '🫁 Respiratorio', anchor: 'dr-resp' },
  { id: 'atb', label: '🦠 ATB urgentes', anchor: 'dr-atb' },
  { id: 'analgesia', label: '💉 Analgesia', anchor: 'dr-analgesia' },
];

mkdirSync(new URL('../../content/drugs', import.meta.url), { recursive: true });

let totalDrugs = 0;
for (const cat of categories) {
  const secStart = raw.indexOf(`id="${cat.anchor}"`);
  const secEnd = raw.indexOf('</table>', secStart);
  const section = raw.slice(secStart, secEnd);

  const headers = [...section.matchAll(/<th>([^<]*)<\/th>/g)].map(m => m[1]);
  const hasCaution = headers.length === 4;

  const rowRe = /<tr><td class="tbl-name">([^<]*)<\/td><td>([\s\S]*?)<\/td><td>([\s\S]*?)<\/td>(?:<td>([\s\S]*?)<\/td>)?<\/tr>/g;
  const drugs = [];
  let m;
  while ((m = rowRe.exec(section))) {
    const [, name, indication, dose, caution] = m;
    drugs.push({
      name,
      indication,
      dose,
      ...(caution !== undefined ? { caution } : {}),
    });
  }

  writeFileSync(
    new URL(`../../content/drugs/${cat.id}.json`, import.meta.url),
    JSON.stringify({ id: cat.id, label: cat.label, columns: headers, drugs }, null, 2) + '\n'
  );
  console.log(`${cat.id}: ${drugs.length} drugs (columns: ${headers.join(', ')})`);
  totalDrugs += drugs.length;
}
console.log(`Total: ${totalDrugs} drugs across ${categories.length} categories.`);
