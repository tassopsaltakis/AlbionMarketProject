import { cachedFetch } from '@/lib/market/server';
import { normalizeQuotes } from '@/lib/market/normalize';
import { marketURL } from '@/lib/market/request';

export async function GET(request: Request) {
  let source: ReturnType<typeof marketURL>;
  try {
    source = marketURL(new URL(request.url).searchParams);
  } catch {
    return Response.json(
      { error: 'Invalid request parameters' },
      { status: 400 },
    );
  }
  try {
    const result = await cachedFetch<unknown>(
      source.url,
      source.kind === 'prices' ? 15000 : 300000,
    );
    if (source.kind === 'prices')
      result.data = normalizeQuotes(result.data, source.ids, source.quality);
    else if (!Array.isArray(result.data))
      throw new Error('Unexpected history response shape');
    return Response.json(result, {
      headers: { 'Cache-Control': 'private, no-cache' },
    });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : 'Market source unavailable',
      },
      { status: 502 },
    );
  }
}
