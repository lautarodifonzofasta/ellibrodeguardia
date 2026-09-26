// Structural check for translated content/modules/*.<lang>.html: since the
// text itself differs by design (translation, not verbatim copy), this
// counts structural markers instead — algorithm steps, drug/dose chips,
// table rows, list items, callouts, tabs — and flags any translated file
// whose counts don't match the Spanish original. Catches an accidentally
// dropped section without requiring word-for-word comparison.
import { readFileSync, readdirSync } from 'node:fs';

const lang = process.argv[2];
if (!lang) { console.error('usage: node verify-modules-i18n.mjs <lang>'); process.exit(1); }

const MARKERS = {
  'class="step"': /class="step"/g,
  'class="drug"': /class="drug"|class="drug /g,
  'class="dose"': /class="dose"/g,
  '<tr>': /<tr>/g,
  '<li>': /<li>/g,
  'class="cl ': /class="cl /g,
  'class="tab ': /class="tab "|class="tab on"|class="tab"/g,
  'class="mod-card"': /class="mod-card"/g,
};

function counts(html) {
  const out = {};
  for (const [k, re] of Object.entries(MARKERS)) out[k] = (html.match(re) || []).length;
  return out;
}

const dir = new URL('../../content/modules', import.meta.url);
const files = readdirSync(dir).filter(f => f.endsWith(`.${lang}.html`));

let problems = 0;
for (const f of files) {
  const id = f.replace(`.${lang}.html`, '');
  const esPath = new URL(`../../content/modules/${id}.html`, import.meta.url);
  const es = readFileSync(esPath, 'utf8');
  const pt = readFileSync(new URL(`../../content/modules/${f}`, import.meta.url), 'utf8');
  const ce = counts(es), cp = counts(pt);
  const diffs = Object.keys(MARKERS).filter(k => ce[k] !== cp[k]);
  if (diffs.length) {
    problems++;
    console.log(`${id}: ${diffs.map(k => `${k} es=${ce[k]} ${lang}=${cp[k]}`).join(', ')}`);
  }
}

console.log(`\nChecked ${files.length} translated modules.`);
console.log(problems === 0 ? 'OK' : `${problems} file(s) with structural mismatches`);
if (problems) process.exitCode = 1;
