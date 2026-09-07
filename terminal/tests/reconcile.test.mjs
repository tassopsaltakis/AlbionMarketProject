import test from 'node:test';
import assert from 'node:assert/strict';
import { reconcileQuotes } from '../lib/market/reconcile.ts';
const now = Date.parse('2026-09-06T12:00:00Z');
const quote = (price, date) => ({
  item_id: 'T3_ORE',
  city: 'Thetford',
  quality: 1,
  ...Object.fromEntries(
    [
      'sell_price_min',
      'sell_price_max',
      'buy_price_min',
      'buy_price_max',
    ].flatMap((f) => [
      [f, price],
      [f + '_date', date],
    ]),
  ),
});

test('market reconciliation chooses each side by source timestamp, not response arrival', () => {
  const old = quote(100, '2026-09-06T10:00:00');
  const incoming = {
    ...quote(80, '2026-09-06T09:00:00Z'),
    buy_price_max: 105,
    buy_price_max_date: '2026-09-06T11:00:00Z',
  };
  const [result] = reconcileQuotes([incoming], [old], now);
  assert.equal(result.sell_price_min, 100);
  assert.equal(result.sell_price_min_date, old.sell_price_min_date);
  assert.equal(result.buy_price_max, 105);
  assert.equal(result.buy_price_max_date, incoming.buy_price_max_date);
});
test('a newer dated zero clears a quote while undated and future responses cannot erase it', () => {
  const old = quote(100, '2026-09-06T10:00:00Z');
  assert.equal(
    reconcileQuotes([quote(0, '2026-09-06T11:00:00Z')], [old], now)[0]
      .sell_price_min,
    0,
  );
  for (const date of ['', '2026-09-07T00:00:00Z']) {
    assert.equal(
      reconcileQuotes([quote(0, date)], [old], now)[0].sell_price_min,
      100,
    );
    assert.equal(
      reconcileQuotes([quote(200, date)], [], now)[0].sell_price_min,
      0,
    );
  }
});
test('reconciliation deduplicates observations without crossing item, city or quality', () => {
  const old = quote(100, '2026-09-06T10:00:00Z');
  const earlier = quote(80, '2026-09-06T09:00:00Z');
  assert.equal(reconcileQuotes([old, earlier], [], now).length, 1);
  assert.equal(reconcileQuotes([old, earlier], [], now)[0].sell_price_min, 100);
  for (const changed of [
    { quality: 2 },
    { city: 'Martlock' },
    { item_id: 'T4_ORE' },
  ]) {
    assert.equal(
      reconcileQuotes([{ ...earlier, ...changed }], [old], now)[0]
        .sell_price_min,
      80,
    );
  }
});
