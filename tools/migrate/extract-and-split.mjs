// One-off migration script (dev-only, not part of the shipped site).
// Extracts content from the legacy monolithic index.html into small, reviewable
// files under content/**, verbatim — no markup rewriting. Also cross-checks the
// three sources of truth (VIEWS keys, the hardcoded sidebar HTML, and the META
// object) against each other so nothing gets silently dropped, and writes a
// single meta.json (sidebar is the richest source: title+category+icon+sub+badge).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const src = readFileSync(new URL('../../legacy-index.html', import.meta.url), 'utf8');

// Of the 11 sidebar items badged "CALC", only 9 are actually interactive
// point-scoring calculators (present in the `configs` map / use calcToggle
// or calcCheck). calc-nihss and calc-psi are static reference tables with no
// interactive elements at all — they get type:"module" (the default) so the
// router treats them like any other content page instead of routing them
// through the calculator engine.
const INTERACTIVE_CALC_IDS = new Set([
  'calc-gcs', 'calc-sofa', 'calc-wells-tep', 'calc-curb65', 'calc-heart',
  'calc-chads', 'calc-wells-tvp', 'calc-blatchford', 'calc-sodio',
]);

// ── 1. Extract every VIEWS['id'] = `...`; block, in document order ──
// Safe as a simple scan: verified separately that no `${}` interpolation or
// stray backticks exist inside any VIEWS content block (all `${}` usage is
// confined to the small router/search/calculator helper functions).
const views = [];
{
  const re = /VIEWS\['([\w-]+)'\]\s*=\s*`/g;
  let m;
  while ((m = re.exec(src))) {
    const contentStart = m.index + m[0].length;
    const contentEnd = src.indexOf('`', contentStart);
    if (contentEnd === -1) throw new Error(`Unterminated template literal for VIEWS['${m[1]}']`);
    views.push({ id: m[1], content: src.slice(contentStart, contentEnd), start: m.index, end: contentEnd });
  }
}
console.log(`Found ${views.length} VIEWS entries.`);

// ── 2. Extract the META object (for cross-check only) ──
const metaObj = {};
{
  const startMarker = 'const META = {';
  const objStart = src.indexOf(startMarker) + startMarker.length - 1; // position of the opening {
  let depth = 0, i = objStart, end = -1;
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) { end = i; break; } }
  }
  const body = src.slice(objStart + 1, end);
  const entryRe = /'([\w-]+)':\s*\{\s*name:\s*'((?:[^'\\]|\\.)*)',\s*cat:\s*'((?:[^'\\]|\\.)*)',\s*ico:\s*'((?:[^'\\]|\\.)*)'\s*\}/g;
  let em;
  while ((em = entryRe.exec(body))) {
    metaObj[em[1]] = { name: em[2], cat: em[3], ico: em[4] };
  }
}
console.log(`Found ${Object.keys(metaObj).length} META entries.`);

// ── 3. Extract the hardcoded sidebar block and parse each item ──
const navStart = src.indexOf('<nav id="sidebar">');
const navEnd = src.indexOf('</nav>', navStart) + '</nav>'.length;
const navHtml = src.slice(navStart, navEnd);

const sidebarMeta = {}; // id -> {title, category, icon, sub, badge}
const sidebarOrder = [];
{
  // Split into per-section chunks so we know each item's category label.
  const sectionRe = /<div class="sb-section-lbl">([^<]*)<\/div>([\s\S]*?)(?=<div class="sb-div">|<\/div>\s*<\/nav>|$)/g;
  let sm;
  while ((sm = sectionRe.exec(navHtml))) {
    const category = sm[1].trim();
    const body = sm[2];
    const itemRe = /<div class="sb-item[^"]*" data-view="([\w-]+)"[^>]*>\s*<span class="sb-item-ico">([^<]*)<\/span>\s*<div class="sb-item-txt"><div class="sb-item-name">([^<]*)<\/div>(?:<div class="sb-item-sub">([^<]*)<\/div>)?<\/div>(?:\s*<span class="sb-badge b-(\w+)">[^<]*<\/span>)?/g;
    let im;
    while ((im = itemRe.exec(body))) {
      const [, id, icon, title, sub, badge] = im;
      const type = INTERACTIVE_CALC_IDS.has(id) ? 'calculator' : id === 'drogas' ? 'drugs' : undefined;
      sidebarMeta[id] = { title, category, icon, ...(sub ? { sub } : {}), ...(badge ? { badge } : {}), ...(type ? { type } : {}) };
      sidebarOrder.push(id);
    }
  }
}
console.log(`Found ${sidebarOrder.length} sidebar items.`);

// ── 4. Cross-check the three sources ──
const viewIds = new Set(views.map(v => v.id));
const sidebarIds = new Set(sidebarOrder);
const metaIds = new Set(Object.keys(metaObj));

const inViewsNotSidebar = [...viewIds].filter(id => !sidebarIds.has(id));
const inSidebarNotViews = [...sidebarIds].filter(id => !viewIds.has(id));
const inViewsNotMeta = [...viewIds].filter(id => !metaIds.has(id) && id !== 'home');
const inMetaNotViews = [...metaIds].filter(id => !viewIds.has(id));

console.log('\n--- Cross-check report ---');
console.log('VIEWS ids missing from sidebar:', inViewsNotSidebar);
console.log('Sidebar ids missing from VIEWS:', inSidebarNotViews);
console.log('VIEWS ids missing from META (pre-existing bug, fixed by meta.json):', inViewsNotMeta);
console.log('META ids missing from VIEWS (stale entries):', inMetaNotViews);

// ── 5. Write meta.json — sidebar is ground truth (has title/category/icon/sub/badge),
//       in original sidebar order, which is also the intended display order ──
const metaJson = {};
for (const id of sidebarOrder) metaJson[id] = sidebarMeta[id];
mkdirSync(new URL('../../content', import.meta.url), { recursive: true });
writeFileSync(new URL('../../content/meta.json', import.meta.url), JSON.stringify(metaJson, null, 2) + '\n');
console.log(`\nWrote content/meta.json with ${Object.keys(metaJson).length} entries.`);

// ── 6. Write each module's content verbatim ──
const calcIds = [...INTERACTIVE_CALC_IDS];

mkdirSync(new URL('../../content/modules', import.meta.url), { recursive: true });
mkdirSync(new URL('../../tools/migrate/intermediate', import.meta.url), { recursive: true });

let moduleCount = 0;
for (const v of views) {
  const trimmed = v.content.replace(/^\n+/, '').replace(/\s+$/, '') + '\n';
  if (v.id === 'home') {
    writeFileSync(new URL('../../content/home.html', import.meta.url), trimmed);
  } else if (v.id === 'drogas') {
    writeFileSync(new URL('../../tools/migrate/intermediate/drogas.raw.html', import.meta.url), trimmed);
  } else if (calcIds.includes(v.id)) {
    writeFileSync(new URL(`../../tools/migrate/intermediate/${v.id}.raw.html`, import.meta.url), trimmed);
  } else {
    writeFileSync(new URL(`../../content/modules/${v.id}.html`, import.meta.url), trimmed);
    moduleCount++;
  }
}
console.log(`Wrote ${moduleCount} clinical module files to content/modules/.`);
console.log(`Wrote ${calcIds.length} calculator raw files + 1 drogas raw file to tools/migrate/intermediate/ for manual structuring.`);

// ── 7. Extract the calculator scoring `configs` map verbatim, for reference while porting ──
{
  const marker = 'const configs = {';
  const objStart = src.indexOf(marker) + marker.length - 1;
  let depth = 0, i = objStart, end = -1;
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) { end = i; break; } }
  }
  const body = src.slice(objStart, end + 1);
  writeFileSync(new URL('../../tools/migrate/intermediate/calc-scoring-source.txt', import.meta.url), body + '\n');
  console.log('Wrote tools/migrate/intermediate/calc-scoring-source.txt (verbatim reference for porting calculator logic).');
}
