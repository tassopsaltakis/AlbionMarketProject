import type { Recipe } from './types';

/** Initial batch requirements; resource returns are not available before crafting. */
export function shoppingList(
  recipe: Recipe,
  runs: number,
  owned: Record<string, number>,
  prices: Record<string, number>,
) {
  const totals = new Map<string, number>();
  for (const ingredient of recipe.ingredients)
    totals.set(
      ingredient.item,
      (totals.get(ingredient.item) || 0) +
        ingredient.quantity * Math.max(0, Math.floor(runs)),
    );
  return [...totals].map(([item, units]) => {
    const required = Math.ceil(units);
    const inventory = Math.max(0, Math.floor(owned[item] || 0));
    const purchase = Math.max(0, required - inventory);
    const price = prices[item] > 0 ? prices[item] : null;
    return {
      item,
      required,
      inventory,
      purchase,
      price,
      spend: purchase === 0 ? 0 : price == null ? null : purchase * price,
    };
  });
}
