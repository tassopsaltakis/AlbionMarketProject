import test from 'node:test';
import assert from 'node:assert/strict';
import {
  age,
  freshness,
  valid,
  stats,
  arbitrage,
  transport,
  production,
  gathering,
  csv,
  timestamp,
} from '../lib/market/analytics.ts';
import { normalizeQuotes } from '../lib/market/normalize.ts';
import { searchItems, SEED_ITEMS } from '../lib/market/metadata.ts';
const now = Date.parse('2026-09-06T02:00:00Z');
const recent = new Date(now - 60000).toISOString();
const quote = (city, ask, bid, extra = {}) => ({
  item_id: 'T3_ORE',
  city,
  quality: 1,
  sell_price_min: ask,
  sell_price_min_date: recent,
  sell_price_max: ask,
  sell_price_max_date: recent,
  buy_price_min: bid,
  buy_price_min_date: recent,
  buy_price_max: bid,
  buy_price_max_date: recent,
  ...extra,
});
test('freshness boundaries and UTC interpretation', () => {
  assert.equal(timestamp('2026-09-06T02:00:00'), now);
  assert.equal(freshness(new Date(now - 119999).toISOString(), now), 'LIVE');
  assert.equal(freshness(new Date(now - 120000).toISOString(), now), 'FRESH');
  assert.equal(freshness(new Date(now - 600000).toISOString(), now), 'RECENT');
  assert.equal(freshness(new Date(now - 1800000).toISOString(), now), 'STALE');
  assert.equal(
    freshness(new Date(now - 7200000).toISOString(), now),
    'VERY STALE',
  );
});
test('missing, future and zero quotes cannot become tradable even when age is unrestricted', () => {
  assert.equal(age('0001-01-01T00:00:00', now), Infinity);
  assert.equal(
    valid(
      quote('A', 100, 90, { sell_price_min_date: '' }),
      'sell',
      Infinity,
      now,
    ),
    false,
  );
  assert.equal(valid(quote('A', 0, 90), 'sell', Infinity, now), false);
  assert.equal(
    valid(
      quote('A', 100, 90, {
        sell_price_min_date: new Date(now + 120000).toISOString(),
      }),
      'sell',
      Infinity,
      now,
    ),
    false,
  );
});
test('arbitrage sells to a bid, deducts tax, and never crosses item quality', () => {
  const rows = arbitrage(
    [
      quote('A', 100, 80),
      quote('B', 300, 150),
      quote('C', 200, 500, { quality: 2 }),
    ],
    8,
    600000,
    now,
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].sell.city, 'B');
  assert.equal(rows[0].profit, 38);
  assert.equal(rows[0].margin, 38);
});
test('stale buy side blocks arbitrage despite a fresh sell side', () => {
  assert.equal(
    arbitrage(
      [
        quote('A', 100, 80),
        quote('B', 200, 150, {
          buy_price_max_date: new Date(now - 7200000).toISOString(),
        }),
      ],
      8,
      600000,
      now,
    ).length,
    0,
  );
});
test('transport loss accounts for forfeited revenue and sunk cargo', () => {
  const zero = transport(100, 150, 10, 5, 10, 0, 0);
  assert.equal(zero.profit, 500);
  assert.equal(zero.expected, 500);
  assert.equal(zero.trips, 2);
  assert.equal(zero.perMinute, 25);
  const allLost = transport(100, 150, 10, 5, 10, 100, 0);
  assert.equal(allLost.expected, -1000);
  assert.ok(Math.abs(zero.breakEven - 33.3333333333) < 1e-6);
});
test('production requires every ingredient and applies returns before station costs', () => {
  const recipe = {
    output: 'T4_METALBAR',
    outputQuantity: 2,
    ingredients: [{ item: 'T4_ORE', quantity: 4 }],
    name: 'Test fixture',
    source: 'test',
  };
  assert.equal(production(recipe, {}, 200, 1, 25, 10, 8, 2), null);
  const r = production(recipe, { T4_ORE: 100 }, 200, 2, 25, 10, 8, 2);
  assert.equal(r.cost, 310);
  assert.equal(r.profit, 100);
  assert.equal(r.perItem, 25);
});
test('gathering includes travel opportunity cost', () => {
  const local = gathering(10, 100, 0, 0, 100, 10);
  assert.equal(local.gross, 1000);
  assert.equal(local.net, 900);
  assert.equal(gathering(10, 100, 0, 60, 100, 10).gross, 500);
});
test('median handles even samples and missing values', () => {
  assert.equal(stats([0, NaN]), null);
  assert.equal(stats([1, 2, 3, 4]).median, 2.5);
});
test('normalization preserves timestamps, rejects other qualities and invalid numbers', () => {
  const result = normalizeQuotes(
    [quote('A', -1, 100), quote('B', 200, 100, { quality: 2 })],
    ['T3_ORE'],
    1,
  );
  assert.equal(result.length, 1);
  assert.equal(result[0].sell_price_min, 0);
  assert.equal(result[0].sell_price_min_date, recent);
  assert.throws(() => normalizeQuotes({}, ['T3_ORE'], 1));
});
test('CSV quotes values and neutralizes spreadsheet formulas', () => {
  const result = csv([{ item: '=CMD()', city: 'a,"b"', price: 10 }]);
  assert.ok(result.includes("'=CMD()"));
  assert.ok(result.includes('a,""b""'));
});
test('item search understands names and tier/category terms', () => {
  assert.equal(searchItems(SEED_ITEMS, 'Tin')[0].id, 'T3_ORE');
  assert.ok(searchItems(SEED_ITEMS, 'T8 resource').every((i) => i.tier === 8));
  assert.equal(searchItems(SEED_ITEMS, 'T4 hide')[0].id, 'T4_HIDE');
});
