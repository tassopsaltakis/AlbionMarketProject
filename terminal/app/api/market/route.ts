import { upstream } from '@/lib/market/server';
import { normalizeQuotes } from '@/lib/market/normalize';
import { REGIONS, CITIES, type Region, type Quote } from '@/lib/market/types';
export async function GET(request: Request) {
  const p = new URL(request.url).searchParams;
  const region = p.get('server') || 'americas';
  const ids = [...new Set((p.get('items') || 'T3_ORE').split(','))];
  const quality = p.get('quality') || '1';
  const kind = p.get('kind') || 'prices';
  if (
    !Object.hasOwn(REGIONS,region) ||
    ids.length > 100 ||
    ids.some((id) => !/^T\d_[A-Z0-9_]+(?:@[1-4])?$/.test(id)) ||
    !['prices', 'history', 'gold'].includes(kind) ||
    !/^[1-5]$/.test(quality)
  )
    return Response.json(
      { error: 'Invalid request parameters' },
      { status: 400 },
    );
  try {
    const locations = CITIES.join(',');
    let path = '';
    if (kind === 'gold') {const days=Math.min(730,Math.max(1,Number(p.get('days'))||30));path=`gold.json?date=${new Date(Date.now()-days*86400000).toISOString().slice(0,10)}&end_date=${new Date().toISOString().slice(0,10)}`;}
    else if (kind === 'history') {
      const days = Math.min(730, Math.max(1, Number(p.get('days')) || 30));
      const start = new Date(Date.now() - days * 86400000)
        .toISOString()
        .slice(0, 10);
      path = `history/${ids[0]}.json?locations=${encodeURIComponent(locations)}&qualities=${quality}&date=${start}&end_date=${new Date().toISOString().slice(0, 10)}&time-scale=${days <= 1 ? 1 : days <= 7 ? 6 : 24}`;
    } else
      path = `prices/${ids.join(',')}.json?locations=${encodeURIComponent(locations)}&qualities=${quality}`;
    const result = await upstream<unknown>(
      region as Region,
      path,
      kind === 'prices' ? 15000 : 300000,
    );
    if (kind === 'prices') result.data=normalizeQuotes(result.data,ids,Number(quality));
    else if(!Array.isArray(result.data))throw new Error('Unexpected history response shape');
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
