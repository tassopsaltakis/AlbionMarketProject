import { materialFamily } from './materials.ts';

export function refreshPlan(ids: string[], selected: string, quality: number) {
  const groups = new Map<number, string[]>();
  for (const id of new Set([selected, ...ids])) {
    const itemQuality = materialFamily(id) ? 1 : quality;
    const group = groups.get(itemQuality) || [];
    group.push(id);
    groups.set(itemQuality, group);
  }
  return [...groups.entries()].flatMap(([itemQuality, items]) =>
    Array.from({ length: Math.ceil(items.length / 60) }, (_, index) => ({
      quality: itemQuality,
      items: items.slice(index * 60, (index + 1) * 60),
    })),
  );
}
