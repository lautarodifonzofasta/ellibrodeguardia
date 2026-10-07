// Shared search engine: the home search box, the search modal (Ctrl/Cmd+K)
// and the sidebar filter all use this one index, so they find the same things.
//
// It matches the title, subtitle, category and id of every content/meta.json
// entry, its "keywords" (abbreviations, synonyms, everyday words) and the
// chief complaints in content/motivos.json. Accents and case are ignored; it
// matches while typing (prefixes), tolerates plurals and one typo per word
// (two in words of 8+ letters).
//
// No DOM access: the tests import it straight from Node (tests/search/).

const STOP_WORDS = new Set((
  'de del la las el los en y e o u con por para a al un una unos unas que se su sus le les lo me mi ' +
  'muy mas como es esta este tiene tengo paciente pte hay dosis si no ya'
).split(' '));

// The title weighs most; synonyms almost as much, since they are how a module
// gets asked for in the ER.
const WEIGHT = { title: 10, alias: 9, keyword: 8, sub: 5, id: 4, category: 2 };

// How many «No te olvides» diagnoses are shown per chief complaint.
export const DONT_MISS_SHOWN = 4;

export function normalize(text) {
  return String(text ?? '')
    .replace(/β/g, 'beta ')
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9%]+/g, ' ')
    .trim();
}

export function tokenize(text) {
  return normalize(text).split(' ').filter(t => t && !STOP_WORDS.has(t));
}

// 'mod' = clinical module · 'calc' = calculator or score · 'ref' = drug reference
export function kindOf(entry) {
  if (entry.type === 'calculator' || entry.badge === 'calc') return 'calc';
  if (entry.type === 'drugs') return 'ref';
  return 'mod';
}

export function categoryName(category) {
  return String(category ?? '').replace(/^[^\p{L}]+/u, '');
}

function field(text, weight, isSynonym) {
  const tokens = tokenize(text);
  return { text, weight, isSynonym, tokens, joined: tokens.join(' ') };
}

export function buildSearchIndex(meta, motivos = []) {
  const entries = [];
  for (const [id, m] of Object.entries(meta)) {
    if (id === 'home') continue;
    const fields = [
      field(m.title, WEIGHT.title, false),
      field(id.replace(/^calc-/, '').replace(/-/g, ' '), WEIGHT.id, false),
      field(categoryName(m.category), WEIGHT.category, false),
    ];
    if (m.sub) fields.push(field(m.sub, WEIGHT.sub, false));
    for (const k of m.keywords ?? []) fields.push(field(k, WEIGHT.keyword, true));
    entries.push({ id, kind: kindOf(m), fields });
  }
  for (const motivo of motivos) {
    const opens = (motivo.opens ?? []).filter(id => meta[id]);
    if (!opens.length) continue;
    entries.push({
      kind: 'motivo',
      motivo,
      opens,
      fields: [
        field(motivo.title, WEIGHT.title, true),
        ...(motivo.aliases ?? []).map(a => field(a, WEIGHT.alias, true)),
      ],
    });
  }
  const vocabulary = [...new Set(entries.flatMap(e => e.fields.flatMap(f => f.tokens)))];
  return { meta, entries, vocabulary };
}

// Edit distance with transpositions (restricted Damerau): "convulcion" is 1
// away from "convulsion". Stops as soon as it exceeds `max`.
function editDistance(a, b, max) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev2 = null;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2] + 1);
      cur[j] = v;
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > max) return max + 1;
    prev2 = prev;
    prev = cur;
  }
  return prev[b.length];
}

// Exact > prefix (while typing) > plural or verb form > typo. Typos are only
// tried for words that don't exist as such in the index, so "falla" doesn't
// bring "falta" and "focal" doesn't bring "fecal".
function tokenScore(q, t, allowTypo) {
  if (q === t) return 1;
  if (q.length < 3 || t.length < 3) return 0;
  if (t.length > q.length && t.startsWith(q)) return q.length >= 4 ? 0.86 : 0.72;
  if (q.length > t.length && t.length >= 5 && q.startsWith(t) && q.length - t.length <= 4) return 0.82;
  if (allowTypo && q.length >= 4 && t.length >= 4 && q[0] === t[0]) {
    const max = q.length >= 8 ? 2 : 1;
    if (editDistance(q, t, max) <= max) return 0.66;
  }
  return 0;
}

function existsDirectly(vocabulary, q) {
  return vocabulary.some(t => tokenScore(q, t, false) > 0);
}

// An entry's score: the best of the whole phrase and the word-by-word sum.
// `coverage` = the share of the query words it matched.
function scoreEntry(entry, queryTokens, queryJoined, typoTokens) {
  let phrase = 0;
  let phraseField = null;
  for (const f of entry.fields) {
    if (!f.joined) continue;
    let s = 0;
    if (f.joined === queryJoined) s = 100;
    else if (queryJoined.length >= 3 && f.joined.startsWith(queryJoined)) s = 72;
    else if (queryJoined.length >= 4 && (' ' + f.joined).includes(' ' + queryJoined)) s = 55;
    s *= f.weight;
    if (s > phrase) { phrase = s; phraseField = f; }
  }
  let sum = 0;
  let matched = 0;
  let best = 0;
  let bestField = null;
  for (const q of queryTokens) {
    let top = 0;
    let topField = null;
    for (const f of entry.fields) {
      for (const t of f.tokens) {
        const s = tokenScore(q, t, typoTokens.has(q)) * f.weight;
        if (s > top) { top = s; topField = f; }
      }
    }
    if (top > 0) {
      matched++;
      sum += top;
      if (top > best) { best = top; bestField = topField; }
    }
  }
  const coverage = matched / queryTokens.length;
  const byWords = (sum * 10 / queryTokens.length) * coverage * coverage;
  return phrase >= byWords
    ? { score: phrase, coverage: phrase ? 1 : coverage, field: phraseField }
    : { score: byWords, coverage, field: bestField };
}

// Returns null for an empty query; otherwise [{ id, score, via, dontMiss }]
// sorted by relevance. `via` = the synonym that matched (when it isn't the
// title); `dontMiss` = up to DONT_MISS_SHOWN diagnoses from its chief complaint.
// `kinds` filters by type ('mod', 'calc', 'ref'); a chief complaint only brings
// modules of those types.
export function search(index, query, { kinds = ['mod', 'calc', 'ref'] } = {}) {
  const queryTokens = tokenize(query);
  if (!queryTokens.length) return null;
  const queryJoined = queryTokens.join(' ');
  const typoTokens = new Set(queryTokens.filter(q => q.length >= 4 && !existsDirectly(index.vocabulary, q)));

  const hits = [];
  for (const entry of index.entries) {
    if (entry.kind !== 'motivo' && !kinds.includes(entry.kind)) continue;
    const r = scoreEntry(entry, queryTokens, queryJoined, typoTokens);
    if (r.score > 0) hits.push({ entry, ...r });
  }
  // When something matches every query word, drop what matches only some.
  const anyComplete = hits.some(h => h.coverage === 1);
  const keep = h => h.coverage === 1 || (!anyComplete && queryTokens.length >= 2 && h.coverage >= 0.5);

  const results = new Map();
  const add = (id, score, via, dontMiss) => {
    const r = results.get(id);
    if (!r) { results.set(id, { id, score, via, dontMiss }); return; }
    if (score > r.score) { r.score = score; r.via = via; }
    if (dontMiss && !r.dontMiss) r.dontMiss = dontMiss;
  };
  const viaFor = (h, id) => {
    const f = h.field;
    return f && f.isSynonym && f.joined !== tokenize(index.meta[id].title).join(' ') ? f.text : null;
  };

  for (const h of hits) {
    if (!keep(h)) continue;
    if (h.entry.kind !== 'motivo') {
      add(h.entry.id, h.score, viaFor(h, h.entry.id), null);
      continue;
    }
    // A chief complaint brings its modules; the first one carries «No te olvides».
    h.entry.opens.forEach((id, i) => {
      if (!kinds.includes(kindOf(index.meta[id]))) return;
      let dontMiss = null;
      if (i === 0) {
        const title = normalize(index.meta[id].title);
        dontMiss = (h.entry.motivo.dontMiss ?? [])
          .filter(d => normalize(d.label) !== title)
          .slice(0, DONT_MISS_SHOWN);
      }
      add(id, h.score - i * 5, viaFor(h, id), dontMiss);
    });
  }
  return [...results.values()].sort((a, b) => b.score - a.score);
}
