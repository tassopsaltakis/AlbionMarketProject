import { playerURL } from '../lib/players/source.ts';
interface Environment {
  ALLOWED_ORIGINS?: string;
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
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) throw new Error('Source HTTP ' + response.status);
      const result = {
        data: await response.json(),
        source,
        fetchedAt: new Date().toISOString(),
        cached: false,
      };
      upstreamCache.set(source, result);
      if (upstreamCache.size > 100)
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
