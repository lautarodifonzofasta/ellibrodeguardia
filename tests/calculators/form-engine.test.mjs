import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { readValues } from '../../js/calculators/form-engine.js';
import { FORM_CALCULATORS, SCORED_CALCULATORS } from '../../js/calculators/index.js';

const dir = new URL('../../content/calculators/', import.meta.url);
const load = id => JSON.parse(readFileSync(new URL(`${id}.json`, dir), 'utf8'));

test('readValues: numbers (comma or point), empty fields and selects', () => {
  const def = { inputs: [{ id: 'a', type: 'number' }, { id: 'b', type: 'number' }, { id: 'c', type: 'number' }, { id: 's', type: 'select' }] };
  const raw = { a: '7,30', b: '', c: 'x', s: 'hour' };
  assert.deepEqual(readValues(def, id => raw[id]), { a: 7.3, b: undefined, c: undefined, s: 'hour' });
});

test('every form calculator has a JSON definition with "form": true and inputs', () => {
  for (const id of Object.keys(FORM_CALCULATORS)) {
    const def = load(id);
    assert.equal(def.form, true, id);
    assert.ok(def.inputs.length > 0, id);
    assert.ok(def.placeholder, id);
    assert.equal(FORM_CALCULATORS[id](readValues(def, () => '')), null, `${id}: empty form must give no result`);
  }
});

test('every calculator JSON is registered in exactly one engine (calc-sodio keeps its own)', () => {
  for (const file of readdirSync(dir).filter(f => f.endsWith('.json'))) {
    const id = file.replace('.json', '');
    const def = load(id);
    if (id === 'calc-sodio') continue;
    assert.equal(Boolean(def.groups), id in SCORED_CALCULATORS, `${id}: scored registry`);
    assert.equal(def.form === true, id in FORM_CALCULATORS, `${id}: form registry`);
  }
});
