import fs from 'node:fs/promises';
const source =
  'https://raw.githubusercontent.com/ao-data/ao-bin-dumps/master/items.json';
const dump = process.argv[2]
  ? JSON.parse(await fs.readFile(process.argv[2], 'utf8'))
  : await (async () => {
      const response = await fetch(source);
      if (!response.ok)
        throw new Error('Recipe source HTTP ' + response.status);
      return response.json();
    })();
const catalog = JSON.parse(await fs.readFile('data/items.json', 'utf8'));
const names = new Map(catalog.items.map((item) => [item.id, item.name]));
const array = (value) =>
  value ? (Array.isArray(value) ? value : [value]) : [];
const id = (name, level) => (Number(level) > 0 ? `${name}@${level}` : name);
const recipes = [];
for (const kind of ['simpleitem', 'equipmentitem', 'weapon']) {
  for (const item of array(dump.items[kind])) {
    const refining = kind === 'simpleitem';
    if (
      refining &&
      !/^T[2-8]_(METALBAR|PLANKS|CLOTH|LEATHER|STONEBLOCK)(?:_LEVEL[1-4])?$/.test(
        item['@uniquename'],
      )
    )
      continue;
    const variants = [
      { ...item, level: item['@enchantmentlevel'] || 0 },
      ...array(item.enchantments?.enchantment).map((e) => ({
        ...e,
        level: e['@enchantmentlevel'],
      })),
    ];
    for (const variant of variants) {
      const output = id(item['@uniquename'], variant.level);
      if (!names.has(output)) continue;
      for (const req of array(variant.craftingrequirements)) {
        if (Number(req['@silver'] || 0) !== 0) continue;
        const resources = array(req.craftresource);
        // Only direct material recipes: no artifact, token, transmutation, or upgrade assumptions.
        if (
          !resources.length ||
          resources.some(
            (r) =>
              !/^T[2-8]_(ORE|WOOD|FIBER|HIDE|ROCK|METALBAR|PLANKS|CLOTH|LEATHER|STONEBLOCK)(?:_LEVEL[1-4])?$/.test(
                r['@uniquename'],
              ),
          )
        )
          continue;
        const ingredients = resources.map((r) => ({
          item: id(r['@uniquename'], r['@enchantmentlevel']),
          quantity: Number(r['@count']),
          ...(r['@maxreturnamount'] === '0' ? { returnable: false } : {}),
        }));
        if (ingredients.some((r) => !names.has(r.item) || !(r.quantity > 0)))
          continue;
        const outputQuantity = Number(req['@amountcrafted'] || 1);
        if (!(outputQuantity > 0)) continue;
        const inputLabel = refining
          ? ' · from ' + ingredients.map((r) => names.get(r.item)).join(' + ')
          : '';
        recipes.push({
          name: names.get(output) + ' [' + output + ']' + inputLabel,
          output,
          outputQuantity,
          ingredients,
          source,
          category: refining ? 'refining' : 'crafting',
          baseFocus: Number(req['@craftingfocus'] || 0),
        });
      }
    }
  }
}
if (recipes.length < 100)
  throw new Error('Unexpected recipe coverage; refusing to overwrite catalog');
await fs.writeFile(
  'data/recipes.json',
  JSON.stringify({ source, retrievedAt: new Date().toISOString(), recipes }),
);
console.log(
  JSON.stringify({
    recipes: recipes.length,
    refining: recipes.filter((r) => r.category === 'refining').length,
  }),
);
