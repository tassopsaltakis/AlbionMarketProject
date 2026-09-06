import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const catalog = JSON.parse(
  fs.readFileSync(new URL('../data/recipes.json', import.meta.url), 'utf8'),
);
const items = new Set(
  JSON.parse(
    fs.readFileSync(new URL('../data/items.json', import.meta.url), 'utf8'),
  ).items.map((item) => item.id),
);
test('bundled recipes use canonical IDs, unique names, and positive quantities', () => {
  assert.ok(catalog.recipes.length > 2000);
  assert.equal(
    new Set(catalog.recipes.map((recipe) => recipe.name)).size,
    catalog.recipes.length,
  );
  for (const recipe of catalog.recipes) {
    assert.ok(items.has(recipe.output));
    assert.ok(recipe.outputQuantity > 0);
    for (const input of recipe.ingredients) {
      assert.ok(items.has(input.item));
      assert.ok(input.quantity > 0);
    }
  }
});
test('refining catalog preserves enchanted inputs and stone output quantities', () => {
  const bar = catalog.recipes.find(
    (recipe) => recipe.output === 'T4_METALBAR_LEVEL1@1',
  );
  assert.deepEqual(
    bar.ingredients.map((input) => [input.item, input.quantity]),
    [
      ['T4_ORE_LEVEL1@1', 2],
      ['T3_METALBAR', 1],
    ],
  );
  const stone = catalog.recipes.find(
    (recipe) =>
      recipe.output === 'T4_STONEBLOCK' &&
      recipe.ingredients.some((input) => input.item === 'T4_ROCK_LEVEL2@2'),
  );
  assert.equal(stone.outputQuantity, 4);
  assert.equal(
    stone.ingredients.find((input) => input.item === 'T3_STONEBLOCK').quantity,
    4,
  );
});
