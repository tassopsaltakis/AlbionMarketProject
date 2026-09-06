import type { Region } from '../market/types';
export const PLAYER_HOSTS: Record<Region, string> = {
  americas: 'gameinfo.albiononline.com',
  europe: 'gameinfo-ams.albiononline.com',
  asia: 'gameinfo-sgp.albiononline.com',
};
export type PlayerRequestKind = 'search' | 'player' | 'guild' | 'members';
export function playerURL(params: URLSearchParams) {
  const region = params.get('server') || 'americas';
  const kind = params.get('kind') || 'search';
  const id = params.get('id') || '';
  const query = params.get('q')?.trim() || '';
  if (
    !Object.hasOwn(PLAYER_HOSTS, region) ||
    !['search', 'player', 'guild', 'members'].includes(kind)
  )
    throw new Error('Invalid player request');
  if (kind === 'search' && (query.length < 2 || query.length > 64))
    throw new Error('Enter between 2 and 64 characters');
  if (kind !== 'search' && !/^[A-Za-z0-9_-]{10,64}$/.test(id))
    throw new Error('Invalid player or guild ID');
  const path =
    kind === 'search'
      ? `search?q=${encodeURIComponent(query)}`
      : kind === 'player'
        ? `players/${id}`
        : kind === 'guild'
          ? `guilds/${id}`
          : `guilds/${id}/members`;
  return `https://${PLAYER_HOSTS[region as Region]}/api/gameinfo/${path}`;
}
export interface PublicIdentity {
  Id: string;
  Name: string;
  GuildId?: string;
  GuildName?: string;
  AllianceId?: string;
  AllianceName?: string;
  KillFame?: number;
  DeathFame?: number;
  MemberCount?: number;
  LifetimeStatistics?: Record<string, unknown>;
}
export interface SearchResult {
  players: PublicIdentity[];
  guilds: PublicIdentity[];
}
export interface PlayerEnvelope<T> {
  data: T;
  source: string;
  fetchedAt: string;
  cached: boolean;
  error?: string;
  sourceCors?: string;
}
