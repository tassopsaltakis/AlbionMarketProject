import test from 'node:test';
import assert from 'node:assert/strict';
import { refreshPlan } from '../lib/market/refresh-plan.ts';

test('selected equipment is requested before the material universe at its exact quality', () => {
  const ids = Array.from({ length: 125 }, (_, index) => `T4_FIXTURE_${index}`);
  ids.unshift('T3_ORE', 'T4_ORE_LEVEL1@1');
  const batches = refreshPlan(ids, 'T4_MAIN_FIRESTAFF@3', 5);
  assert.equal(batches[0].items[0], 'T4_MAIN_FIRESTAFF@3');
  assert.equal(batches[0].quality, 5);
  assert.ok(batches.every((batch) => batch.items.length <= 60));
  assert.deepEqual(batches.find((batch) => batch.quality === 1).items, [
    'T3_ORE',
    'T4_ORE_LEVEL1@1',
  ]);
  const requested = batches.flatMap((batch) => batch.items);
  assert.equal(new Set(requested).size, ids.length + 1);
  assert.equal(requested.length, ids.length + 1);
});

test('selected materials retain normal quality and are never requested twice', () => {
  const batches = refreshPlan(
    ['T3_ORE', 'T3_ORE', 'T4_MAIN_FIRESTAFF'],
    'T3_ORE',
    4,
  );
  assert.deepEqual(batches, [
    { quality: 1, items: ['T3_ORE'] },
    { quality: 4, items: ['T4_MAIN_FIRESTAFF'] },
  ]);
});
