import { REGIONS, type Region, type Envelope } from './types';
const cache = new Map<
  string,
  { data: unknown; time: number; sourceCors?: string }
>();
const pending = new Map<string, Promise<Envelope<unknown>>>();
const requests: number[] = [];
export async function upstream<T>(
  region: Region,
  path: string,
  ttl = 15000,
): Promise<Envelope<T>> {
  return cachedFetch<T>(
    `https://${REGIONS[region]}.albion-online-data.com/api/v2/stats/${path}`,
    ttl,
  );
}
export async function cachedFetch<T>(
  url: string,
  ttl: number,
): Promise<Envelope<T>> {
  const old = cache.get(url);
  const wrap = (
    entry: { data: unknown; time: number; sourceCors?: string },
    cached: boolean,
    error?: string,
  ) => ({
    data: entry.data as T,
    source: url,
    fetchedAt: new Date(entry.time).toISOString(),
    cached,
    error,
    sourceCors: entry.sourceCors,
  });
  if (old && Date.now() - old.time < ttl) return wrap(old, true);
  if (pending.has(url)) return pending.get(url) as Promise<Envelope<T>>;
  const task = (async () => {
    try {
      let error: unknown;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const now = Date.now();
          while (requests.length && requests[0] < now - 300000)
            requests.shift();
          if (
            requests.length >= 240 ||
            requests.filter((t) => t > now - 60000).length >= 120
          )
            throw new Error(
              'Upstream request budget reached. Cached data retained.',
            );
          requests.push(now);
          const res = await fetch(url, {
            headers: { Accept: 'application/json', 'Accept-Encoding': 'gzip' },
            signal: AbortSignal.timeout(15000),
          });
          if (!res.ok) {
            if (res.status === 429)
              throw new Error('Source rate limit reached. Try again later.');
            throw new Error(`Source returned HTTP ${res.status}`);
          }
          const data = await res.json();
          const entry = {
            data,
            time: Date.now(),
            sourceCors:
              res.headers.get('access-control-allow-origin') || undefined,
          };
          cache.set(url, entry);
          if (cache.size > 100) cache.delete(cache.keys().next().value!);
          return wrap(entry, false);
        } catch (e) {
          error = e;
          if (String(e).includes('rate limit') || String(e).includes('budget'))
            break;
          if (attempt < 2)
            await new Promise((r) => setTimeout(r, 500 * 2 ** attempt));
        }
      }
      throw error;
    } catch (error) {
      if (old)
        return wrap(
          old,
          true,
          error instanceof Error ? error.message : 'Source unavailable',
        );
      throw error;
    } finally {
      pending.delete(url);
    }
  })();
  pending.set(url, task);
  return task as Promise<Envelope<T>>;
}
