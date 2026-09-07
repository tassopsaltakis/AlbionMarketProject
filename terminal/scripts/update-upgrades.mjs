import fs from 'node:fs/promises';
const source =
  'https://raw.githubusercontent.com/ao-data/ao-bin-dumps/master/items.json';
const raw = process.argv[2]
  ? JSON.parse(await fs.readFile(process.argv[2], 'utf8'))
  : await (await fetch(source)).json();
const list = (value) => (value ? (Array.isArray(value) ? value : [value]) : []);
const upgrades = [];
for (const kind of ['weapon', 'equipmentitem'])
  for (const item of list(raw.items[kind])) {
    for (const level of list(item.enchantments?.enchantment)) {
      const tier = Number(level['@enchantmentlevel']);
      const inputs = list(level.upgraderequirements?.upgraderesource).map(
        (r) => ({ item: r['@uniquename'], quantity: Number(r['@count']) }),
      );
      if (
        !inputs.length ||
        ![1, 2, 3].includes(tier) ||
        !/^T[4-8]_/.test(item['@uniquename']) ||
        inputs.some((r) => !r.item || !(r.quantity > 0))
      )
        continue;
      const base = item['@uniquename'];
      upgrades.push({
        from: base + (tier > 1 ? '@' + (tier - 1) : ''),
        to: base + '@' + tier,
        inputs,
      });
    }
  }
await fs.writeFile(
  'data/upgrades.json',
  JSON.stringify({ source, retrievedAt: new Date().toISOString(), upgrades }),
);
console.log(`Saved ${upgrades.length} explicit upgrade steps.`);
