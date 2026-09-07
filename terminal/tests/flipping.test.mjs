import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { scanFlips } from '../lib/market/flipping.ts';
const now = Date.parse('2026-09-06T12:00:00Z');
const date = '2026-09-06T11:59:00Z';
const q = (item_id, city, ask, bid, quality = 1) => ({
  item_id,
  city,
  quality,
  sell_price_min: ask,
  sell_price_min_date: date,
  sell_price_max: ask,
  sell_price_max_date: date,
  buy_price_min: bid,
  buy_price_min_date: date,
  buy_price_max: bid,
  buy_price_max_date: date,
});
const options = {
  cities: ['Thetford', 'Martlock', 'Black Market'],
  tax: 8,
  setup: 2.5,
  maxAge: 3600000,
  direct: true,
  upgrade: true,
  listing: false,
};
const steps = [
  {
    from: 'T4_BAG',
    to: 'T4_BAG@1',
    inputs: [{ item: 'T4_RUNE', quantity: 192 }],
  },
  {
    from: 'T4_BAG@1',
    to: 'T4_BAG@2',
    inputs: [{ item: 'T4_SOUL', quantity: 192 }],
  },
];
test('direct flips sell to the bid and keep quality separate', () => {
  const rows = scanFlips(
    [
      q('T4_BAG', 'Thetford', 100, 50),
      q('T4_BAG', 'Martlock', 200, 150),
      q('T4_BAG', 'Black Market', 0, 1000, 2),
    ],
    [],
    options,
    now,
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].profit, 38);
  assert.equal(rows[0].fees, 12);
});
test('multi-step upgrades include every material in the purchase city', () => {
  const quotes = [
    q('T4_BAG', 'Thetford', 100, 0),
    q('T4_RUNE', 'Thetford', 2, 0),
    q('T4_SOUL', 'Thetford', 3, 0),
    q('T4_BAG@2', 'Black Market', 0, 2000),
  ];
  const [row] = scanFlips(quotes, steps, { ...options, direct: false }, now);
  assert.equal(row.cost, 1060);
  assert.equal(row.profit, 780);
  assert.equal(row.inputs.length, 2);
  assert.equal(
    scanFlips(
      quotes.filter((r) => r.item_id !== 'T4_SOUL'),
      steps,
      { ...options, direct: false },
      now,
    ).length,
    0,
  );
  assert.equal(
    scanFlips(
      quotes.map((r) =>
        r.item_id === 'T4_SOUL' ? { ...r, city: 'Martlock' } : r,
      ),
      steps,
      { ...options, direct: false },
      now,
    ).length,
    0,
  );
  assert.equal(
    scanFlips(
      quotes.map((r) =>
        r.item_id === 'T4_RUNE'
          ? { ...r, sell_price_min_date: '2026-09-05T00:00:00Z' }
          : r,
      ),
      steps,
      { ...options, direct: false },
      now,
    ).length,
    0,
  );
});
test('planned listings charge setup fees but Black Market always uses bids', () => {
  const rows = scanFlips(
    [
      q('T4_BAG', 'Thetford', 100, 0),
      q('T4_BAG', 'Martlock', 200, 150),
      q('T4_BAG', 'Black Market', 9999, 300),
    ],
    [],
    { ...options, listing: true },
    now,
  );
  const listing = rows.find(
    (r) => r.buyCity === 'Thetford' && r.sellCity === 'Martlock',
  );
  assert.equal(listing.profit, 79);
  const black = rows.find(
    (r) => r.buyCity === 'Thetford' && r.sellCity === 'Black Market',
  );
  assert.equal(black.sell, 300);
  assert.equal(black.fees, 24);
  assert.ok(rows.every((r) => r.buyCity !== 'Black Market'));
});
test('upgrade catalog preserves explicit costs and excludes unsupported .4 paths', () => {
  const { upgrades } = JSON.parse(
    fs.readFileSync(new URL('../data/upgrades.json', import.meta.url), 'utf8'),
  );
  assert.deepEqual(
    upgrades.find((r) => r.to === 'T4_MAIN_FIRESTAFF@1').inputs,
    [{ item: 'T4_RUNE', quantity: 288 }],
  );
  assert.ok(
    upgrades.every(
      (r) => !r.to.endsWith('@4') && r.inputs.every((i) => i.quantity > 0),
    ),
  );
  assert.equal(new Set(upgrades.map((r) => r.from)).size, upgrades.length);
});
