import type { PublicIdentity } from './source';
import { timestamp } from '../market/analytics.ts';
export const RESOURCES = ['Fiber', 'Hide', 'Ore', 'Rock', 'Wood'] as const;
export function statValue(value: unknown, path: string[]): number | null {
  let result: unknown = value;
  for (const key of path) {
    if (!result || typeof result !== 'object') return null;
    result = (result as Record<string, unknown>)[key];
  }
  return typeof result === 'number' && Number.isFinite(result) && result >= 0
    ? result
    : null;
}
export function playerStats(player: PublicIdentity) {
  const s = player.LifetimeStatistics;
  const killFame = statValue(player, ['KillFame']);
  const deathFame = statValue(player, ['DeathFame']);
  const resources = RESOURCES.map((resource) => ({
    resource,
    fame: statValue(s, ['Gathering', resource, 'Total']),
    royal: statValue(s, ['Gathering', resource, 'Royal']),
    outlands: statValue(s, ['Gathering', resource, 'Outlands']),
    avalon: statValue(s, ['Gathering', resource, 'Avalon']),
  }));
  const specialty = resources
    .filter((r) => r.fame != null && r.fame > 0)
    .sort((a, b) => b.fame! - a.fame!)[0]?.resource;
  return {
    killFame,
    deathFame,
    fameRatio:
      killFame != null && deathFame != null && deathFame > 0
        ? killFame / deathFame
        : null,
    pveActivities: [
      'Royal',
      'Outlands',
      'Avalon',
      'Hellgate',
      'CorruptedDungeon',
      'Mists',
    ].map((activity) => ({
      activity,
      fame: statValue(s, ['PvE', activity]),
    })),
    craftingRegions: ['Royal', 'Outlands', 'Avalon'].map((region) => ({
      region,
      fame: statValue(s, ['Crafting', region]),
    })),
    gathering: statValue(s, ['Gathering', 'All', 'Total']),
    crafting: statValue(s, ['Crafting', 'Total']),
    farming: statValue(s, ['FarmingFame']),
    fishing: statValue(s, ['FishingFame']),
    pve: statValue(s, ['PvE', 'Total']),
    resources,
    specialty,
    updatedAt: typeof s?.Timestamp === 'string' ? s.Timestamp : null,
  };
}
export interface PlayerSnapshot {
  playerId: string;
  name: string;
  region: string;
  source: string;
  observedAt: string;
  updatedAt: string;
  gathering: number | null;
  crafting: number | null;
  farming: number | null;
  fishing: number | null;
  resources: Record<string, number | null>;
}
export function snapshot(
  player: PublicIdentity,
  region: string,
  source: string,
  observedAt: string,
): PlayerSnapshot | null {
  const s = playerStats(player);
  const updated = timestamp(s.updatedAt || '');
  const observed = timestamp(observedAt);
  if (
    !s.updatedAt ||
    !Number.isFinite(updated) ||
    !Number.isFinite(observed) ||
    updated > observed + 60000
  )
    return null;
  return {
    playerId: player.Id,
    name: player.Name,
    region,
    source,
    observedAt,
    updatedAt: s.updatedAt,
    gathering: s.gathering,
    crafting: s.crafting,
    farming: s.farming,
    fishing: s.fishing,
    resources: Object.fromEntries(s.resources.map((r) => [r.resource, r.fame])),
  };
}
export function retainSnapshot(
  existing: PlayerSnapshot[],
  next: PlayerSnapshot,
) {
  const same = existing.filter(
    (s) => s.region === next.region && s.playerId === next.playerId,
  );
  if (same.some((s) => timestamp(s.updatedAt) === timestamp(next.updatedAt)))
    return same;
  return [...same, next]
    .sort((a, b) => timestamp(a.updatedAt) - timestamp(b.updatedAt))
    .slice(-96);
}
export type FameMetric =
  | 'gathering'
  | 'crafting'
  | 'farming'
  | 'fishing'
  | (typeof RESOURCES)[number];
export function fameRate(snapshots: PlayerSnapshot[], metric: FameMetric) {
  const value = (point: PlayerSnapshot): number | null =>
    metric === 'gathering' ||
    metric === 'crafting' ||
    metric === 'farming' ||
    metric === 'fishing'
      ? point[metric]
      : (point.resources[metric] ?? null);
  const points = snapshots
    .filter((s) => value(s) != null && Number.isFinite(timestamp(s.updatedAt)))
    .sort((a, b) => timestamp(a.updatedAt) - timestamp(b.updatedAt));
  const first = points[0],
    last = points.at(-1);
  if (
    !first ||
    !last ||
    points.some(
      (p) => p.playerId !== first.playerId || p.region !== first.region,
    )
  )
    return null;
  const hours =
    (timestamp(last.updatedAt) - timestamp(first.updatedAt)) / 3600000;
  if (
    points.some(
      (point, index) => index > 0 && value(point)! < value(points[index - 1])!,
    )
  )
    return null;
  const gain = value(last)! - value(first)!;
  if (hours < 1 || gain < 0) return null;
  return {
    gain,
    hours,
    perHour: gain / hours,
    perDay: (gain / hours) * 24,
    from: first.updatedAt,
    to: last.updatedAt,
  };
}
