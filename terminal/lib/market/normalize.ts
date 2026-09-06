import type { Quote } from './types';
export function normalizeQuotes(
  data: unknown,
  ids: string[],
  quality: number,
): Quote[] {
  if (!Array.isArray(data)) throw new Error('Unexpected market response shape');
  return data
    .filter(
      (q): q is Record<string, unknown> =>
        !!q &&
        typeof q === 'object' &&
        ids.includes(q.item_id) &&
        Number(q.quality) === quality &&
        typeof q.city === 'string',
    )
    .map((q) => {
      const result: Record<string, unknown> = {
        item_id: q.item_id,
        city: q.city,
        quality,
      };
      for (const field of [
        'sell_price_min',
        'sell_price_max',
        'buy_price_min',
        'buy_price_max',
      ]) {
        const price = Number(q[field]);
        result[field] = Number.isFinite(price) && price > 0 ? price : 0;
        result[field + '_date'] =
          typeof q[field + '_date'] === 'string' ? q[field + '_date'] : '';
      }
      return result as unknown as Quote;
    });
}
