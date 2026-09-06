import type { Item } from './types';
const names: Record<string, string[]> = {
  ORE: [
    'Copper Ore',
    'Tin Ore',
    'Iron Ore',
    'Titanium Ore',
    'Runite Ore',
    'Meteorite Ore',
    'Adamantium Ore',
  ],
  HIDE: [
    'Rugged Hide',
    'Thin Hide',
    'Medium Hide',
    'Heavy Hide',
    'Robust Hide',
    'Thick Hide',
    'Resilient Hide',
  ],
  FIBER: [
    'Cotton',
    'Flax',
    'Hemp',
    'Skyflower',
    'Redleaf Cotton',
    'Sunflax',
    'Ghost Hemp',
  ],
  WOOD: [
    'Birch Logs',
    'Chestnut Logs',
    'Pine Logs',
    'Cedar Logs',
    'Bloodoak Logs',
    'Ashenbark Logs',
    'Whitewood Logs',
  ],
  ROCK: [
    'Limestone',
    'Sandstone',
    'Travertine',
    'Granite',
    'Slate',
    'Basalt',
    'Marble',
  ],
};
export function category(id: string): string {
  if (/_ORE|_HIDE|_FIBER|_WOOD|_ROCK/.test(id)) return 'Resource';
  if (/_METALBAR|_LEATHER|_CLOTH|_PLANKS|_STONEBLOCK/.test(id))
    return 'Refining material';
  if (/_MAIN_|_2H_|_OFF_/.test(id)) return 'Weapon';
  if (/_ARMOR_|_HEAD_|_SHOES_/.test(id)) return 'Armor';
  if (/ARTEFACT|ARTIFACT/.test(id)) return 'Artifact';
  if (/MEAL|FISH|FOOD/.test(id)) return 'Food';
  if (/POTION/.test(id)) return 'Potion';
  if (/MOUNT/.test(id)) return 'Mount';
  if (/CRAFT|RESOURCE/.test(id)) return 'Crafting material';
  return 'Miscellaneous';
}
export function makeItem(id: string, name?: string): Item {
  return {
    id,
    name: name || id.replaceAll('_', ' '),
    tier: Number(id.match(/^T(\d)/)?.[1] || 0),
    enchantment: Number(id.match(/@(\d)/)?.[1] || 0),
    category: category(id),
  };
}
export const SEED_ITEMS: Item[] = Object.entries(names)
  .flatMap(([kind, list]) =>
    list.map((name, i) => makeItem(`T${i + 2}_${kind}`, name)),
  )
  .concat([
    makeItem('T4_MAIN_RAPIER_MORGANA', "Adept's Bloodletter"),
    makeItem('T4_BAG', "Adept's Bag"),
    makeItem('T4_MOUNT_HORSE', "Adept's Riding Horse"),
  ]);
export const DEFAULT_ITEMS = [
  'T3_ORE',
  'T2_ORE',
  'T4_ORE',
  'T5_ORE',
  'T4_HIDE',
  'T5_HIDE',
  'T4_FIBER',
  'T5_FIBER',
  'T4_WOOD',
  'T5_WOOD',
  'T4_ROCK',
  'T5_ROCK',
  'T4_MAIN_RAPIER_MORGANA',
  'T4_BAG',
  'T4_MOUNT_HORSE',
];
export function searchItems(items: Item[], query: string) {
  const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  return items
    .map((item) => {
      const text =
        `${item.name} ${item.id} T${item.tier} ${item.tier}.${item.enchantment} ${item.category}`.toLowerCase();
      let score = 0;
      for (const term of terms) {
        if (text.includes(term)) {
          score += text.startsWith(term) ? 4 : 2;
          continue;
        }
        let i = 0;
        for (const char of text) if (char === term[i]) i++;
        if (i < term.length) return { item, score: -1 };
        score++;
      }
      return { item, score };
    })
    .filter((x) => x.score >= 0)
    .sort((a, b) => b.score - a.score || a.item.tier - b.item.tier)
    .slice(0, 60)
    .map((x) => x.item);
}
