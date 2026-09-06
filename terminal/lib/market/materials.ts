import type { Item } from './types';
export const MATERIAL_FAMILIES: Record<
  string,
  { name: string; stage: string; resource: string }
> = {
  ORE: { name: 'Ore', stage: 'Raw', resource: 'Ore' },
  WOOD: { name: 'Logs', stage: 'Raw', resource: 'Wood' },
  HIDE: { name: 'Hide', stage: 'Raw', resource: 'Hide' },
  FIBER: { name: 'Fiber', stage: 'Raw', resource: 'Fiber' },
  ROCK: { name: 'Stone', stage: 'Raw', resource: 'Stone' },
  METALBAR: { name: 'Metal bars', stage: 'Refined', resource: 'Ore' },
  PLANKS: { name: 'Planks', stage: 'Refined', resource: 'Wood' },
  LEATHER: { name: 'Leather', stage: 'Refined', resource: 'Hide' },
  CLOTH: { name: 'Cloth', stage: 'Refined', resource: 'Fiber' },
  STONEBLOCK: { name: 'Stone blocks', stage: 'Refined', resource: 'Stone' },
};
export function materialFamily(id: string) {
  const key = id.match(
    /^T[1-8]_(ORE|WOOD|HIDE|FIBER|ROCK|METALBAR|PLANKS|LEATHER|CLOTH|STONEBLOCK)(?:_LEVEL[1-4])?(?:@[1-4])?$/,
  )?.[1];
  return key ? { key, ...MATERIAL_FAMILIES[key] } : null;
}
export function materialUniverse(items: Item[]) {
  return items
    .filter((i) => materialFamily(i.id))
    .sort(
      (a, b) =>
        a.tier - b.tier ||
        a.enchantment - b.enchantment ||
        a.name.localeCompare(b.name),
    );
}
export function resourceVariant(
  items: Item[],
  family: string,
  tier: number,
  enchantment: number,
) {
  return items.find(
    (i) =>
      materialFamily(i.id)?.key === family &&
      i.tier === tier &&
      i.enchantment === enchantment,
  );
}
