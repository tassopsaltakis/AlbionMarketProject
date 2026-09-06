import { readLocal, writeLocal } from '../market/client';
import { runtime } from '../market/runtime';
import { playerURL, validatePlayerData, type PlayerEnvelope } from './source';
const pending = new Map<string, Promise<PlayerEnvelope<unknown>>>();
let nextAt = 0;
export async function playerRequest<T>(
  params: URLSearchParams,
  proxy?: string,
): Promise<PlayerEnvelope<T>> {
  params.sort();
  const source = playerURL(params);
  const key = 'amp:players:' + source;
  const old = readLocal<PlayerEnvelope<T> | null>(key, null);
  if (old && Date.now() - Date.parse(old.fetchedAt) < 300000)
    return { ...old, cached: true };
  if (pending.has(key)) return pending.get(key) as Promise<PlayerEnvelope<T>>;
  const promise = (async () => {
    try {
      const scheduled = Math.max(Date.now(), nextAt);
      nextAt = scheduled + 1500;
      await new Promise((r) => setTimeout(r, scheduled - Date.now()));
      let url: string;
      if (!runtime().static) url = '/api/players?' + params;
      else if (proxy || runtime().playerProxy) {
        const relay = new URL((proxy || runtime().playerProxy)!);
        if (
          relay.protocol !== 'https:' &&
          relay.hostname !== 'localhost' &&
          relay.hostname !== '127.0.0.1'
        )
          throw new Error('Player relay must use HTTPS');
        relay.search = params.toString();
        url = relay.toString();
      } else url = source;
      const response = await fetch(url, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(50000),
      });
      const raw = await response.json();
      if (!response.ok)
        throw new Error('Player source returned HTTP ' + response.status);
      const result = (
        runtime().static && !proxy && !runtime().playerProxy
          ? {
              data: raw,
              source,
              fetchedAt: new Date().toISOString(),
              cached: false,
            }
          : raw
      ) as PlayerEnvelope<T>;
      validatePlayerData(result.data, params.get('kind') || 'search');
      writeLocal(key, result);
      return result;
    } catch (e) {
      const message =
        e instanceof Error ? e.message : 'Player source unavailable';
      if (old) return { ...old, cached: true, error: message };
      throw new Error(
        runtime().static
          ? message +
              '. If the source blocks browser requests, configure the player API relay in Settings.'
          : message,
      );
    } finally {
      pending.delete(key);
    }
  })();
  pending.set(key, promise);
  return promise as Promise<PlayerEnvelope<T>>;
}
