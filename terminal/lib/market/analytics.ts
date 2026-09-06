import type { Quote, Recipe } from './types';
export function timestamp(value?: string) {
  if (!value || value.startsWith('0001')) return NaN;
  return Date.parse(/[zZ]|[+-]\d\d:\d\d$/.test(value) ? value : value + 'Z');
}
export function age(value?: string, now = Date.now()) {
  const time = timestamp(value);
  return Number.isFinite(time) && time <= now + 60000
    ? Math.max(0, now - time)
    : Infinity;
}
export function freshness(value?: string, now = Date.now()) {
  const a = age(value, now);
  return a < 120000
    ? 'LIVE'
    : a < 600000
      ? 'FRESH'
      : a < 1800000
        ? 'RECENT'
        : a < 7200000
          ? 'STALE'
          : Number.isFinite(a)
            ? 'VERY STALE'
            : 'NO DATA';
}
export function ageLabel(value?: string, now = Date.now()) {
  const a = age(value, now);
  if (!Number.isFinite(a)) return 'No observation';
  const m = Math.floor(a / 60000);
  return m < 1
    ? `${Math.floor(a / 1000)}s`
    : m < 60
      ? `${m}m`
      : `${Math.floor(m / 60)}h ${m % 60}m`;
}
export function valid(
  q: Quote,
  side: 'sell' | 'buy',
  maxAge = Infinity,
  now = Date.now(),
) {
  const observationAge = age(
    q[side === 'sell' ? 'sell_price_min_date' : 'buy_price_max_date'],
    now,
  );
  return (
    Number.isFinite(observationAge) &&
    q[side === 'sell' ? 'sell_price_min' : 'buy_price_max'] > 0 &&
    age(
      q[side === 'sell' ? 'sell_price_min_date' : 'buy_price_max_date'],
      now,
    ) <= maxAge
  );
}
export function stats(values: number[]) {
  const v = values
    .filter((x) => Number.isFinite(x) && x > 0)
    .sort((a, b) => a - b);
  if (!v.length) return null;
  const mean = v.reduce((a, b) => a + b, 0) / v.length;
  const sd = Math.sqrt(v.reduce((a, b) => a + (b - mean) ** 2, 0) / v.length);
  return {
    mean,
    median:
      v.length % 2
        ? v[(v.length - 1) / 2]
        : (v[v.length / 2 - 1] + v[v.length / 2]) / 2,
    min: v[0],
    max: v.at(-1)!,
    sd,
    cv: (sd / mean) * 100,
  };
}
export function outlier(price: number, values: number[]) {
  const s = stats(values);
  return (
    !!s && values.length >= 3 && (price > s.median * 3 || price < s.median / 3)
  );
}
export function arbitrage(
  quotes: Quote[],
  tax: number,
  maxAge: number,
  now = Date.now(),
) {
  const groups = new Map<string, Quote[]>();
  quotes.forEach((q) => {
    const key = q.item_id + ':' + q.quality;
    groups.set(key, [...(groups.get(key) || []), q]);
  });
  return [...groups.values()]
    .flatMap((group) =>
      group
        .filter((q) => valid(q, 'sell', maxAge, now))
        .flatMap((buy) =>
          group
            .filter(
              (sell) =>
                sell.city !== buy.city && valid(sell, 'buy', maxAge, now),
            )
            .map((sell) => {
              const spread = sell.buy_price_max - buy.sell_price_min;
              const profit =
                sell.buy_price_max * (1 - tax / 100) - buy.sell_price_min;
              const margin = (profit / buy.sell_price_min) * 100;
              const quoteAge = Math.max(
                age(buy.sell_price_min_date, now),
                age(sell.buy_price_max_date, now),
              );
              const suspicious =
                outlier(
                  buy.sell_price_min,
                  group.map((q) => q.sell_price_min).filter(Boolean),
                ) || margin > 100;
              const confidence = Math.max(
                0,
                Math.round(
                  100 -
                    Math.min(75, (quoteAge / 7200000) * 75) -
                    (suspicious ? 25 : 0),
                ),
              );
              return {
                id: `${buy.item_id}:${buy.quality}:${buy.city}:${sell.city}`,
                item: buy.item_id,
                buy,
                sell,
                spread,
                profit,
                margin,
                quoteAge,
                confidence,
                suspicious,
                lethal: [buy.city, sell.city].some((c) =>
                  ['Caerleon', 'Black Market', 'Brecilien'].includes(c),
                ),
              };
            }),
        ),
    )
    .filter((x) => x.profit > 0)
    .sort((a, b) => b.profit - a.profit);
}
export function gathering(
  price: number,
  rate: number,
  yieldBonus: number,
  travel: number,
  load: number,
  tax: number,
) {
  const units = rate * (1 + yieldBonus / 100);
  const tripUnits = Math.max(1, load);
  const trips = units / tripUnits;
  const gross = (units * price) / (1 + (trips * travel) / 60);
  return {
    gross,
    net: gross * (1 - tax / 100),
    stack: price * 999,
    trip: price * tripUnits * (1 - tax / 100),
  };
}
export function transport(
  buy: number,
  sell: number,
  quantity: number,
  capacity: number,
  minutes: number,
  loss: number,
  tax: number,
) {
  const cargo = buy * quantity;
  const revenue = sell * quantity * (1 - tax / 100);
  const profit = revenue - cargo;
  const expectedLoss = (revenue * loss) / 100;
  const trips = Math.ceil(quantity / Math.max(1, capacity));
  return {
    cargo,
    revenue,
    profit,
    expectedLoss,
    expected: profit - expectedLoss,
    trips,
    perMinute: (profit - expectedLoss) / Math.max(1, trips * minutes),
    breakEven: revenue ? (profit / revenue) * 100 : 0,
  };
}
export function production(
  recipe: Recipe,
  prices: Record<string, number>,
  sell: number,
  quantity: number,
  returns: number,
  station: number,
  tax: number,
  setup: number,
) {
  if (recipe.ingredients.some((i) => !(prices[i.item] > 0))) return null;
  const raw = recipe.ingredients.reduce(
    (sum, i) => sum + i.quantity * prices[i.item],
    0,
  );
  const cost =
    recipe.ingredients.reduce(
      (sum, i) =>
        sum +
        i.quantity *
          prices[i.item] *
          (i.returnable === false ? 1 : 1 - returns / 100),
      0,
    ) + station;
  const revenue = sell * recipe.outputQuantity * (1 - (tax + setup) / 100);
  return {
    raw,
    cost,
    profit: (revenue - cost) * quantity,
    perItem: (revenue - cost) / recipe.outputQuantity,
    margin: cost ? ((revenue - cost) / cost) * 100 : 0,
    breakEven: cost / recipe.outputQuantity / (1 - (tax + setup) / 100),
  };
}
export function csv(rows: Record<string, unknown>[]) {
  if (!rows.length) return '';
  const keys = Object.keys(rows[0]);
  const cell = (x: unknown) =>
    '"' +
    (typeof x === 'string'
      ? x
      : typeof x === 'number' || typeof x === 'boolean'
        ? `${x}`
        : x == null
          ? ''
          : JSON.stringify(x)
    )
      .replaceAll('"', '""')
      .replace(/^[=+@-]/, "'$&") +
    '"';
  return [
    keys.map(cell).join(','),
    ...rows.map((row) => keys.map((k) => cell(row[k])).join(',')),
  ].join('\r\n');
}
