import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { materialUniverse, resourceVariant } from '../lib/market/materials.ts';
import { makeItem } from '../lib/market/metadata.ts';
const catalog = JSON.parse(
  fs.readFileSync(new URL('../data/items.json', import.meta.url), 'utf8'),
).items.map((i) => makeItem(i.id, i.name));
test('material universe includes canonical enchanted resources and refined materials', () => {
  const items = materialUniverse(catalog);
  assert.ok(items.length > 200);
  assert.ok(items.some((i) => i.id === 'T4_ORE_LEVEL1@1'));
  assert.ok(items.some((i) => i.id === 'T8_CLOTH_LEVEL4@4'));
  assert.ok(!items.some((i) => i.id.includes('MAIN_')));
});
test('resource selection resolves metadata IDs without inventing variants', () => {
  assert.equal(resourceVariant(catalog, 'ORE', 4, 1).id, 'T4_ORE_LEVEL1@1');
  assert.equal(resourceVariant(catalog, 'ROCK', 4, 4), undefined);
  assert.equal(resourceVariant(catalog, 'ORE', 3, 1), undefined);
});
