import test from 'node:test';
import assert from 'node:assert/strict';
import { shoppingList } from '../lib/market/planning.ts';
test('shopping list aggregates duplicate inputs and subtracts inventory without guessing missing costs', () => {
  const recipe = {
    ingredients: [
      { item: 'ore', quantity: 2 },
      { item: 'ore', quantity: 1 },
      { item: 'bar', quantity: 1 },
    ],
  };
  const rows = shoppingList(recipe, 10, { ore: 5 }, { ore: 100 });
  assert.deepEqual(rows[0], {
    item: 'ore',
    required: 30,
    inventory: 5,
    purchase: 25,
    price: 100,
    spend: 2500,
  });
  assert.equal(rows[1].spend, null);
  assert.equal(shoppingList(recipe, 10, { bar: 10 }, {})[1].spend, 0);
});
