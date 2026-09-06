import { CITIES, REGIONS, type Region } from './types.ts';
export function marketURL(params: URLSearchParams, now = Date.now()) {
  const region = params.get('server') || 'americas';
  const kind = params.get('kind') || 'prices';
  const ids = [...new Set((params.get('items') || 'T3_ORE').split(','))];
  const quality = params.get('quality') || '1';
  if (
    !Object.hasOwn(REGIONS, region) ||
    ids.length > 100 ||
    ids.some((id) => !/^T\d_[A-Z0-9_]+(?:@[1-4])?$/.test(id)) ||
    !['prices', 'history', 'gold'].includes(kind) ||
    !/^[1-5]$/.test(quality)
  )
    throw new Error('Invalid request parameters');
  const days = Math.min(730, Math.max(1, Number(params.get('days')) || 30));
  const start = new Date(now - days * 86400000).toISOString().slice(0, 10);
  const end = new Date(now).toISOString().slice(0, 10);
  const query = new URLSearchParams();
  let path = '';
  if (kind === 'gold') {
    path = 'gold.json';
    // Gold currently rejects ISO dates on some regions despite the shared API docs.
    const goldDate = (date: string) =>
      date.slice(5, 10) + '-' + date.slice(0, 4);
    query.set('date', goldDate(start));
    query.set('end_date', goldDate(end));
  } else {
    path = `${kind}/${kind === 'history' ? ids[0] : ids.join(',')}.json`;
    query.set('locations', CITIES.join(','));
    query.set('qualities', quality);
    if (kind === 'history') {
      query.set('date', start);
      query.set('end_date', end);
      query.set('time-scale', days <= 1 ? '1' : days <= 7 ? '6' : '24');
    }
  }
  return {
    url: `https://${REGIONS[region as Region]}.albion-online-data.com/api/v2/stats/${path}?${query}`,
    kind,
    ids,
    quality: Number(quality),
    region: region as Region,
  };
}
