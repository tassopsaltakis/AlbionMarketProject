import type { Envelope } from './types';
const inFlight = new Map<string, Promise<Envelope<unknown>>>();
const memory=new Map<string,{value:Envelope<unknown>;time:number}>();
export function readLocal<T>(key: string, fallback: T): T {
  try {
    return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback;
  } catch {
    return fallback;
  }
}
export function writeLocal(key: string, data: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch {
    /* Storage may be unavailable or full. The current session remains usable. */
  }
}
export async function marketRequest<T>(query: string): Promise<Envelope<T>> {
  const params=new URLSearchParams(query);params.sort();
  const url = '/api/market?' + params.toString();
  const stored=memory.get(url);const ttl=params.get('kind')&&params.get('kind')!=='prices'?300000:5000;
  if(stored&&Date.now()-stored.time<ttl)return {...stored.value,cached:true} as Envelope<T>;
  if (inFlight.has(url)) return inFlight.get(url) as Promise<Envelope<T>>;
  const task = (async () => {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(55000) });
      const result = (await res.json()) as Envelope<T>;
      if (!res.ok) throw new Error(result.error || 'Source unavailable');
      if(!Array.isArray(result.data))throw new Error('Invalid market payload');
      memory.set(url,{value:result,time:Date.now()});
      if(memory.size>40)memory.delete(memory.keys().next().value!);
      writeLocal('amt:' + url, result);
      return result;
    } catch (e) {
      const old = readLocal<Envelope<T> | null>('amt:' + url, null);
      if (old)
        return {
          ...old,
          cached: true,
          error: e instanceof Error ? e.message : 'Offline',
        };
      throw e;
    } finally {
      inFlight.delete(url);
    }
  })();
  inFlight.set(url, task);
  return task;
}
