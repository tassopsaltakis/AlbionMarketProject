import { playerURL, validatePlayerData } from '../lib/players/source.ts';
interface Environment {
  ALLOWED_ORIGINS?: string;
}
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
async function readPublicJSON(response: Response) {
  if (Number(response.headers.get('Content-Length')) > MAX_RESPONSE_BYTES)
    throw new Error('Player source response exceeds the supported size');
  const reader = response.body?.getReader();
  if (!reader) throw new Error('Player source returned an empty response');
  let bytes = 0;
  let text = '';
  const decoder = new TextDecoder();
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > MAX_RESPONSE_BYTES) {
        await reader.cancel();
        throw new Error('Player source response exceeds the supported size');
      }
      text += decoder.decode(chunk.value, { stream: true });
    }
    return JSON.parse(text + decoder.decode()) as unknown;
  } finally {
    reader.releaseLock();
  }
}
const counts = new Map<string, { start: number; count: number }>();
const upstreamCache = new Map<
  string,
  { data: unknown; source: string; fetchedAt: string; cached: boolean }
>();
const worker = {
  async fetch(request: Request, env: Environment): Promise<Response> {
    const origin = request.headers.get('Origin') || '';
    const allowed = (env.ALLOWED_ORIGINS || 'https://tassopsaltakis.github.io')
      .split(',')
      .map((s) => s.trim());
    const cors: Record<string, string> = {
      Vary: 'Origin',
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    };
    if (allowed.includes(origin)) cors['Access-Control-Allow-Origin'] = origin;
    if (request.method === 'OPTIONS')
      return new Response(null, {
        status: 204,
        headers: {
          ...cors,
          'Access-Control-Allow-Methods': 'GET',
          'Access-Control-Allow-Headers': 'Accept',
        },
      });
    if (request.method !== 'GET')
      return Response.json(
        { error: 'GET required' },
        { status: 405, headers: cors },
      );
    if (origin && !allowed.includes(origin))
      return Response.json(
        { error: 'Origin not allowed' },
        { status: 403, headers: cors },
      );
    if (new URL(request.url).pathname === '/health')
      return Response.json(
        { status: 'ok', service: 'Albion Market Project player relay' },
        { headers: cors },
      );
    let source: string;
    try {
      source = playerURL(new URL(request.url).searchParams);
    } catch {
      return Response.json(
        { error: 'Invalid query' },
        { status: 400, headers: cors },
      );
    }
    const now = Date.now();
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    const budget = counts.get(ip) || { start: now, count: 0 };
    if (now - budget.start > 60000) {
      budget.start = now;
      budget.count = 0;
    }
    if (++budget.count > 30)
      return Response.json(
        { error: 'Request limit reached; retry in a minute' },
        { status: 429, headers: cors },
      );
    counts.set(ip, budget);
    if (counts.size > 5000) counts.delete(counts.keys().next().value!);
    const cached = upstreamCache.get(source);
    if (cached && now - Date.parse(cached.fetchedAt) < 300000)
      return Response.json({ ...cached, cached: true }, { headers: cors });
    try {
      const response = await fetch(source, {
        headers: { Accept: 'application/json' },
        redirect: 'error',
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) throw new Error('Source HTTP ' + response.status);
      const result = {
        data: await readPublicJSON(response),
        source,
        fetchedAt: new Date().toISOString(),
        cached: false,
      };
      validatePlayerData(
        result.data,
        new URL(request.url).searchParams.get('kind') || 'search',
      );
      upstreamCache.set(source, result);
      if (upstreamCache.size > 10)
        upstreamCache.delete(upstreamCache.keys().next().value!);
      return Response.json(result, { headers: cors });
    } catch (e) {
      if (cached)
        return Response.json(
          { ...cached, cached: true, error: 'Player source unavailable' },
          { headers: cors },
        );
      return Response.json(
        { error: e instanceof Error ? e.message : 'Source unavailable' },
        { status: 502, headers: cors },
      );
    }
  },
};
export default worker;
