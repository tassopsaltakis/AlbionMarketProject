import test from 'node:test';
import assert from 'node:assert/strict';
import { marketRequest, writeLocal, readLocal } from '../lib/market/client.ts';
const data = new Map();
globalThis.localStorage = {
  getItem: (key) => data.get(key) || null,
  setItem: (key, value) => data.set(key, value),
};
test('offline response retains original observation envelope', async () => {
  const old = {
    data: [
      {
        item_id: 'T3_ORE',
        sell_price_min: 100,
        sell_price_min_date: '2026-09-05T10:00:00',
      },
    ],
    source: 'test fixture',
    fetchedAt: '2026-09-05T10:05:00Z',
    cached: false,
  };
  writeLocal('amt:/api/market?items=T3_ORE&server=asia', old);
  const original = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error('Offline test');
  };
  try {
    const result = await marketRequest('server=asia&items=T3_ORE');
    assert.deepEqual(result.data, old.data);
    assert.equal(result.fetchedAt, old.fetchedAt);
    assert.equal(result.cached, true);
    assert.equal(result.error, 'Offline test');
  } finally {
    globalThis.fetch = original;
  }
});
test('parallel identical requests are deduplicated', async () => {
  let count = 0;
  const original = globalThis.fetch;
  globalThis.fetch = async () => {
    count++;
    await new Promise((r) => setTimeout(r, 10));
    return Response.json({
      data: [],
      source: 'test',
      fetchedAt: '2026-09-06T00:00:00Z',
      cached: false,
    });
  };
  try {
    await Promise.all([
      marketRequest('items=T4_ORE&server=europe'),
      marketRequest('server=europe&items=T4_ORE'),
    ]);
    assert.equal(count, 1);
  } finally {
    globalThis.fetch = original;
  }
});
test('invalid storage JSON gracefully falls back', () => {
  data.set('broken', '{');
  assert.deepEqual(readLocal('broken', []), []);
});
