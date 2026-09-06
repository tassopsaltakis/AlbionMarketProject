import test from 'node:test';
import assert from 'node:assert/strict';
import { marketURL } from '../lib/market/request.ts';
test('public API paths keep regions and qualities separate', () => {
  for (const [region, host] of [
    ['americas', 'west'],
    ['europe', 'europe'],
    ['asia', 'east'],
  ]) {
    const r = marketURL(
      new URLSearchParams({ server: region, items: 'T4_ORE@1', quality: '3' }),
    );
    assert.equal(new URL(r.url).hostname, host + '.albion-online-data.com');
    assert.equal(new URL(r.url).searchParams.get('qualities'), '3');
    assert.ok(r.url.includes('T4_ORE@1'));
  }
});
test('history aggregation changes with requested range', () => {
  assert.equal(
    new URL(
      marketURL(new URLSearchParams({ kind: 'history', days: '1' })).url,
    ).searchParams.get('time-scale'),
    '1',
  );
  assert.equal(
    new URL(
      marketURL(new URLSearchParams({ kind: 'history', days: '30' })).url,
    ).searchParams.get('time-scale'),
    '24',
  );
});
test('gold range uses gold endpoint without item market parameters', () => {
  const r = marketURL(new URLSearchParams({ kind: 'gold', days: '365' }));
  const url = new URL(r.url);
  assert.ok(url.pathname.endsWith('/gold.json'));
  assert.equal(url.searchParams.has('qualities'), false);
  assert.ok(url.searchParams.has('date'));
});
test('request validation prevents arbitrary hosts and unbounded item lists', () => {
  assert.throws(() => marketURL(new URLSearchParams({ server: 'toString' })));
  assert.throws(() =>
    marketURL(new URLSearchParams({ items: '../../private' })),
  );
  assert.throws(() => marketURL(new URLSearchParams({ quality: '6' })));
  assert.throws(() =>
    marketURL(
      new URLSearchParams({
        items: Array.from({ length: 101 }, (_, i) => `T4_TEST_${i}`).join(','),
      }),
    ),
  );
});

test('gold uses the date format accepted by the live endpoint', () => {
  const url = new URL(
    marketURL(
      new URLSearchParams({ kind: 'gold', days: '7' }),
      Date.parse('2026-09-06T12:00:00Z'),
    ).url,
  );
  assert.equal(url.searchParams.get('date'), '08-30-2026');
  assert.equal(url.searchParams.get('end_date'), '09-06-2026');
});
