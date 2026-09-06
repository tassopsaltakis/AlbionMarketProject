import fs from 'node:fs/promises';
const source='https://raw.githubusercontent.com/ao-data/ao-bin-dumps/master/formatted/items.json';
const response=await fetch(source);if(!response.ok)throw new Error(`Metadata source HTTP ${response.status}`);
const sourceItems=await response.json();
const rows=sourceItems.filter(i=>/^T\d_[A-Z0-9_]+(?:@[1-4])?$/.test(i.UniqueName)).map(i=>({id:i.UniqueName,name:i.LocalizedNames?.['EN-US']||i.UniqueName.replaceAll('_',' ')}));
await fs.mkdir('data',{recursive:true});
await fs.writeFile('data/items.json',JSON.stringify({source,retrievedAt:new Date().toISOString(),items:rows}));
console.log(`Saved ${rows.length} canonical item names, without market values.`);
