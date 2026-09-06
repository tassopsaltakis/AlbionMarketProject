import catalog from '@/data/items.json';
import { makeItem } from '@/lib/market/metadata';
export async function GET() {
  return Response.json(
    {
      items: catalog.items.map((i) => makeItem(i.id, i.name)),
      source: catalog.source,
      retrievedAt: catalog.retrievedAt,
      cached: true,
    },
    { headers: { 'Cache-Control': 'public, max-age=86400' } },
  );
}
