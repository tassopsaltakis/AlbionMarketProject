import catalog from '@/data/recipes.json';
export async function GET() {
  return Response.json(catalog, {
    headers: { 'Cache-Control': 'public, max-age=3600' },
  });
}
