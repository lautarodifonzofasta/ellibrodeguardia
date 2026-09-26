// Cross-checks that every resultId a calculator's interpret() can produce
// has a corresponding, non-empty label/detail in its content JSON — for
// Spanish (required) and Portuguese (checked only if that translation
// exists yet, so partial translation coverage doesn't fail this). This is
// the safety net for the logic/content split introduced to support
// multiple languages: a typo'd or missing resultId key would otherwise only
// surface as a blank result box in the browser.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { interpret as gcs } from '../../js/calculators/calc-gcs.js';
import { interpret as sofa } from '../../js/calculators/calc-sofa.js';
import { interpret as wellsTep } from '../../js/calculators/calc-wells-tep.js';
import { interpret as curb65 } from '../../js/calculators/calc-curb65.js';
import { interpret as heart } from '../../js/calculators/calc-heart.js';
import { interpret as chads } from '../../js/calculators/calc-chads.js';
import { interpret as wellsTvp } from '../../js/calculators/calc-wells-tvp.js';
import { interpret as blatchford } from '../../js/calculators/calc-blatchford.js';

// A handful of scores per calculator known to hit every branch (not just
// the boundary values — just needs to visit each resultId at least once).
const CASES = {
  'calc-gcs': { fn: gcs, scores: [3, 8, 9, 12, 13, 15] },
  'calc-sofa': { fn: sofa, scores: [0, 3, 7, 11] },
  'calc-wells-tep': { fn: wellsTep, scores: [0, 2, 7] },
  'calc-curb65': { fn: curb65, scores: [0, 2, 3] },
  'calc-heart': { fn: heart, scores: [0, 4, 7] },
  'calc-chads': { fn: chads, scores: [0, 2, 4] },
  'calc-wells-tvp': { fn: wellsTvp, scores: [-2, 2, 7] },
  'calc-blatchford': { fn: blatchford, scores: [0, 1, 7] },
};

for (const [id, { fn, scores }] of Object.entries(CASES)) {
  const resultIds = [...new Set(scores.map(s => fn(s).resultId))];

  test(`${id}: Spanish content has text for every resultId (${resultIds.join(', ')})`, () => {
    const def = JSON.parse(readFileSync(new URL(`../../content/calculators/${id}.json`, import.meta.url), 'utf8'));
    for (const rid of resultIds) {
      const entry = def.results?.[rid];
      assert.ok(entry, `content/calculators/${id}.json is missing results["${rid}"]`);
      assert.ok(entry.label, `results["${rid}"].label is empty`);
      assert.ok(entry.detail, `results["${rid}"].detail is empty`);
    }
  });

  const ptPath = new URL(`../../content/calculators/${id}.pt-BR.json`, import.meta.url);
  test(`${id}: Portuguese content has text for every resultId, if translated yet`, { skip: !existsSync(ptPath) }, () => {
    const def = JSON.parse(readFileSync(ptPath, 'utf8'));
    for (const rid of resultIds) {
      const entry = def.results?.[rid];
      assert.ok(entry, `content/calculators/${id}.pt-BR.json is missing results["${rid}"]`);
      assert.ok(entry.label, `results["${rid}"].label is empty`);
      assert.ok(entry.detail, `results["${rid}"].detail is empty`);
    }
  });
}
