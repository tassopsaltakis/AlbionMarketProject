import type { Quote } from './types';
import { timestamp } from './analytics.ts';

const fields = [
  'sell_price_min',
  'sell_price_max',
  'buy_price_min',
  'buy_price_max',
] as const;
const identity = (q: Quote) => `${q.item_id}:${q.city}:${q.quality}`;

// Callers supply observations from one region. Prices and dates travel together.
export function reconcileQuotes(
  incoming: Quote[],
  previous: Quote[],
  now = Date.now(),
): Quote[] {
  const old = new Map(previous.map((q) => [identity(q), q]));
  const result = new Map<string, Quote>();
  for (const quote of incoming) {
    const key = identity(quote);
    const prior = result.get(key) || old.get(key);
    const next = { ...quote };
    for (const field of fields) {
      const date = `${field}_date` as const;
      const nextTime = timestamp(quote[date]);
      const oldTime = timestamp(prior?.[date] || '');
      const validNext =
        Number.isFinite(nextTime) &&
        nextTime <= now + 60000 &&
        Number.isFinite(quote[field]) &&
        quote[field] >= 0;
      const validOld =
        prior &&
        Number.isFinite(oldTime) &&
        oldTime <= now + 60000 &&
        Number.isFinite(prior[field]) &&
        prior[field] >= 0;
      if (validOld && (!validNext || oldTime > nextTime)) {
        next[field] = prior[field];
        next[date] = prior[date];
      } else if (!validNext) {
        next[field] = 0;
        next[date] = '';
      }
    }
    result.set(key, next);
  }
  return [...result.values()];
}
