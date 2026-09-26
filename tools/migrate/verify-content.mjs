// Content-integrity safety net: compares the visible text of every module in
// legacy-index.html against the corresponding new content file. Fails loudly
// on any deletion. Run after any change to content/** during the migration,
// and any time a module is edited afterward, to guard against accidental loss.
import { readFileSync, readdirSync } from 'node:fs';

function stripTags(html) {
  return html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<style[\s\S]*?<\/style>/g, '')
    // Only well-formed tags (<tag ...> / </tag>) — plain "<45" / ">3×"
    // comparison symbols are common in clinical text and must survive.
    .replace(/<\/?[a-zA-Z][^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function wordSet(text) {
  // Order-insensitive word multiset — robust to structural reshuffling while
  // still catching real content loss (a missing word/number/dose disappears).
  const words = text.split(' ').filter(Boolean);
  const map = new Map();
  for (const w of words) map.set(w, (map.get(w) || 0) + 1);
  return map;
}

function diffWordSets(a, b) {
  const missing = [];
  for (const [w, n] of a) {
    const nb = b.get(w) || 0;
    if (nb < n) missing.push({ word: w, missingCount: n - nb });
  }
  return missing;
}

const legacy = readFileSync(new URL('../../legacy-index.html', import.meta.url), 'utf8');

function extractView(id) {
  const re = new RegExp(`VIEWS\\['${id}'\\]\\s*=\\s*\``);
  const m = re.exec(legacy);
  if (!m) return null;
  const start = m.index + m[0].length;
  const end = legacy.indexOf('`', start);
  return legacy.slice(start, end);
}

let totalChecked = 0;
let totalFailed = 0;

function check(id, newFileContent) {
  const original = extractView(id);
  if (original === null) {
    console.log(`SKIP (no VIEWS entry found): ${id}`);
    return;
  }
  const a = wordSet(stripTags(original));
  const b = wordSet(stripTags(newFileContent));
  const missing = diffWordSets(a, b);
  totalChecked++;
  if (missing.length) {
    totalFailed++;
    console.log(`FAIL: ${id} — missing words:`, missing.slice(0, 20));
  }
}

// Clinical modules
const moduleFiles = readdirSync(new URL('../../content/modules', import.meta.url));
for (const f of moduleFiles) {
  const id = f.replace(/\.html$/, '');
  const content = readFileSync(new URL(`../../content/modules/${f}`, import.meta.url), 'utf8');
  check(id, content);
}

// Home
check('home', readFileSync(new URL('../../content/home.html', import.meta.url), 'utf8'));

console.log(`\n${totalChecked} files checked, ${totalFailed} failed.`);
if (totalFailed > 0) process.exitCode = 1;
else console.log('OK: no content loss detected in migrated modules.');
