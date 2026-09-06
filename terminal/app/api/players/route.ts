import { cachedFetch } from '@/lib/market/server';
import { playerURL } from '@/lib/players/source';
export async function GET(request: Request) {
  let url: string;
  try {
    url = playerURL(new URL(request.url).searchParams);
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : 'Invalid request' },
      { status: 400 },
    );
  }
  try {
    return Response.json(await cachedFetch(url, 300000));
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : 'Player API unavailable' },
      { status: 502 },
    );
  }
}
