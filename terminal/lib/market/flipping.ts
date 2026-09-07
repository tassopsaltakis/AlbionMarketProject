import type { Quote } from './types';
import { valid, age } from './analytics.ts';
export interface Upgrade {
  from: string;
  to: string;
  inputs: { item: string; quantity: number }[];
}
export interface Flip {
  key: string;
  type: 'Direct' | 'Upgrade';
  from: string;
  item: string;
  quality: number;
  buyCity: string;
  sellCity: string;
  buy: number;
  sell: number;
  cost: number;
  fees: number;
  profit: number;
  margin: number;
  quoteAge: number;
  inputs: { item: string; quantity: number; price: number }[];
}
export function scanFlips(
  quotes: Quote[],
  upgrades: Upgrade[],
  options: {
    cities: string[];
    tax: number;
    setup: number;
    maxAge: number;
    direct: boolean;
    upgrade: boolean;
    listing: boolean;
  },
  now = Date.now(),
) {
  const map = new Map<string, Quote[]>();
  for (const q of quotes)
    if (options.cities.includes(q.city)) {
      const key = q.item_id + ':' + q.quality;
      map.set(key, [...(map.get(key) || []), q]);
    }
  const steps = new Map(upgrades.map((u) => [u.from, u]));
  const rows: Flip[] = [];
  for (const group of map.values())
    for (const buy of group) {
      if (
        !valid(buy, 'sell', options.maxAge, now) ||
        buy.city === 'Black Market'
      )
        continue;
      let item = buy.item_id;
      const inputs: Flip['inputs'] = [];
      let materialCost = 0,
        oldest = age(buy.sell_price_min_date, now);
      const visited = new Set<string>();
      for (let depth = 0; depth <= 3; depth++) {
        if (depth === 0 ? options.direct : options.upgrade) {
          for (const sell of map.get(item + ':' + buy.quality) || []) {
            const listing = options.listing && sell.city !== 'Black Market';
            if (!valid(sell, listing ? 'sell' : 'buy', options.maxAge, now))
              continue;
            if (depth === 0 && listing && sell.city === buy.city) continue;
            const price = listing ? sell.sell_price_min : sell.buy_price_max;
            const cost = buy.sell_price_min + materialCost;
            const fees =
              (price * (options.tax + (listing ? options.setup : 0))) / 100;
            const profit = price - fees - cost;
            if (profit <= 0) continue;
            rows.push({
              key: [buy.item_id, item, buy.quality, buy.city, sell.city].join(
                ':',
              ),
              type: depth ? 'Upgrade' : 'Direct',
              from: buy.item_id,
              item,
              quality: buy.quality,
              buyCity: buy.city,
              sellCity: sell.city,
              buy: buy.sell_price_min,
              sell: price,
              cost,
              fees,
              profit,
              margin: (profit / cost) * 100,
              quoteAge: Math.max(
                oldest,
                age(
                  listing ? sell.sell_price_min_date : sell.buy_price_max_date,
                  now,
                ),
              ),
              inputs: [...inputs],
            });
          }
        }
        if (!options.upgrade || visited.has(item)) break;
        visited.add(item);
        const step = steps.get(item);
        if (!step) break;
        let complete = true;
        for (const input of step.inputs) {
          const q = (map.get(input.item + ':1') || []).find(
            (q) => q.city === buy.city && valid(q, 'sell', options.maxAge, now),
          );
          if (!q) {
            complete = false;
            break;
          }
          materialCost += input.quantity * q.sell_price_min;
          oldest = Math.max(oldest, age(q.sell_price_min_date, now));
          inputs.push({ ...input, price: q.sell_price_min });
        }
        if (!complete) break;
        item = step.to;
      }
    }
  return rows.sort((a, b) => b.profit - a.profit);
}
