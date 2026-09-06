import { marketURL } from './request.ts';
import { normalizeQuotes } from './normalize.ts';
import type { Envelope } from './types';
let nextRequestAt = 0;
let cooldownUntil = 0;
/** One request every 1.5 seconds leaves headroom below both public API limits. */
async function reserveRequest() {
  const scheduled = Math.max(Date.now(), nextRequestAt, cooldownUntil);
  nextRequestAt = scheduled + 1500;
  await new Promise((resolve) =>
    setTimeout(resolve, Math.max(0, scheduled - Date.now())),
  );
}
export async function browserSource<T>(
  params: URLSearchParams,
): Promise<Envelope<T>> {
  const request = marketURL(params);
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    await reserveRequest();
    try {
      const response = await fetch(request.url, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(15000),
      });
      if (response.status === 429) {
        cooldownUntil = Date.now() + 60000;
        throw new Error(
          'Albion API rate limit reached. Retrying after cooldown.',
        );
      }
      if (!response.ok)
        throw new Error(`Albion API returned HTTP ${response.status}`);
      const raw = await response.json();
      const data =
        request.kind === 'prices'
          ? normalizeQuotes(raw, request.ids, request.quality)
          : raw;
      if (!Array.isArray(data))
        throw new Error('Unexpected market response shape');
      return {
        data: data as T,
        source: request.url,
        fetchedAt: new Date().toISOString(),
        cached: false,
      };
    } catch (error) {
      lastError = error;
      if (cooldownUntil > Date.now()) break;
      if (attempt < 2)
        await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** attempt));
    }
  }
  throw lastError;
}
