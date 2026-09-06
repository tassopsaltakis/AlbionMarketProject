'use client';
import { useMemo, useState } from 'react';
import { ArrowUpRight, Pickaxe, Factory } from 'lucide-react';
import { CITIES, type Item } from '@/lib/market/types';
import { MATERIAL_FAMILIES, materialFamily } from '@/lib/market/materials';
import { age, valid, stats } from '@/lib/market/analytics';
import type { ViewProps } from './market-views';
import {
  Panel,
  MarketTable,
  ItemLabel,
  Num,
  CityBadge,
  FreshnessBadge,
  SelectBox,
  ExportButton,
} from './market-ui';
export function MaterialOverview(p: ViewProps & { materials: Item[] }) {
  const [family, setFamily] = useState('All'),
    [stage, setStage] = useState('All'),
    [tier, setTier] = useState('All'),
    [enchantment, setEnchantment] = useState('All'),
    [city, setCity] = useState('Best city'),
    [sort, setSort] = useState('Resource / tier'),
    [query, setQuery] = useState('');
  const quoteMap = useMemo(() => {
    const map = new Map<string, typeof p.quotes>();
    for (const q of p.quotes) {
      if (q.quality !== 1) continue;
      const group = map.get(q.item_id) || [];
      group.push(q);
      map.set(q.item_id, group);
    }
    return map;
  }, [p.quotes]);
  const rows = useMemo(
    () =>
      p.materials
        .filter(
          (i) =>
            (family === 'All' || materialFamily(i.id)?.key === family) &&
            (stage === 'All' || materialFamily(i.id)?.stage === stage) &&
            (tier === 'All' || i.tier === Number(tier)) &&
            (enchantment === 'All' || i.enchantment === Number(enchantment)) &&
            `${i.name} ${i.id}`.toLowerCase().includes(query.toLowerCase()),
        )
        .map((item) => {
          const all = quoteMap.get(item.id) || [];
          const asks = all
            .filter((q) =>
              valid(q, 'sell', p.settings.maxAge || Infinity, p.now),
            )
            .sort((a, b) => a.sell_price_min - b.sell_price_min);
          const bids = all
            .filter((q) =>
              valid(q, 'buy', p.settings.maxAge || Infinity, p.now),
            )
            .sort((a, b) => b.buy_price_max - a.buy_price_max);
          const q =
            city === 'Best city' ? asks[0] : asks.find((q) => q.city === city);
          const mean = stats(asks.map((q) => q.sell_price_min))?.mean;
          return {
            item,
            asks,
            q,
            bid: bids[0],
            spread:
              asks.length > 1
                ? asks.at(-1)!.sell_price_min - asks[0].sell_price_min
                : null,
            coverage: asks.length,
            premium: q && mean ? (q.sell_price_min / mean - 1) * 100 : null,
          };
        })
        .sort((a, b) =>
          sort === 'Lowest ask'
            ? (a.q?.sell_price_min ?? Infinity) -
              (b.q?.sell_price_min ?? Infinity)
            : sort === 'Largest city spread'
              ? (b.spread ?? -Infinity) - (a.spread ?? -Infinity)
              : sort === 'Freshest'
                ? age(a.q?.sell_price_min_date, p.now) -
                  age(b.q?.sell_price_min_date, p.now)
                : sort === 'Quote coverage'
                  ? b.coverage - a.coverage
                  : (materialFamily(a.item.id)?.name || '').localeCompare(
                      materialFamily(b.item.id)?.name || '',
                    ) ||
                    a.item.tier - b.item.tier ||
                    a.item.enchantment - b.item.enchantment,
        ),
    [
      p.materials,
      p.settings.maxAge,
      p.now,
      quoteMap,
      family,
      stage,
      tier,
      enchantment,
      query,
      city,
      sort,
    ],
  );
  const available = rows.filter((r) => r.q).length;
  const fresh = rows.filter(
    (r) => r.q && age(r.q.sell_price_min_date, p.now) < 600000,
  ).length;
  return (
    <>
      <div className="material-heading">
        <div>
          <h2>Materials, at a glance</h2>
          <p>
            Every cataloged resource and refined variant. Select a family, then
            compare the exact tier and enchantment.
          </p>
        </div>
        <span className="pill">{p.materials.length} VERIFIED VARIANTS</span>
      </div>
      <div className="material-sectors">
        {Object.entries(MATERIAL_FAMILIES).map(([key, f]) => {
          const items = p.materials.filter(
            (i) => materialFamily(i.id)?.key === key,
          );
          const count = items.filter((i) =>
            (quoteMap.get(i.id) || []).some((q) =>
              valid(q, 'sell', p.settings.maxAge || Infinity, p.now),
            ),
          ).length;
          return (
            <button
              key={key}
              className={family === key ? 'active' : ''}
              onClick={() => {
                setFamily(family === key ? 'All' : key);
                setStage('All');
              }}
            >
              <span className="sector-icon">
                {f.stage === 'Raw' ? (
                  <Pickaxe size={15} />
                ) : (
                  <Factory size={15} />
                )}
              </span>
              <span>
                <strong>{f.name}</strong>
                <small>
                  {f.stage} · {items.length} variants
                </small>
              </span>
              <span className="sector-coverage">
                {count}
                <small>priced</small>
              </span>
            </button>
          );
        })}
      </div>
      <Panel
        title="Complete materials market"
        tag="QUALITY 1 · ALL VALID ENCHANTMENTS"
        actions={
          <ExportButton
            name="materials"
            rows={rows.map((r) => ({
              item: r.item.id,
              name: r.item.name,
              tier: r.item.tier,
              enchantment: r.item.enchantment,
              family: materialFamily(r.item.id)?.name,
              ask: r.q?.sell_price_min,
              ask_city: r.q?.city,
              ask_observed: r.q?.sell_price_min_date,
              bid: r.bid?.buy_price_max,
              bid_city: r.bid?.city,
              bid_observed: r.bid?.buy_price_max_date,
              eligible_city_count: r.coverage,
              source: 'Albion Online Data Project',
              server: p.settings.region,
            }))}
          />
        }
      >
        <div className="toolbar">
          <input
            aria-label="Filter material names"
            placeholder="Filter materials…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <SelectBox
            label="Material stage"
            value={stage}
            onChange={setStage}
            options={['All', 'Raw', 'Refined']}
          />
          <SelectBox
            label="Material family"
            value={family}
            onChange={setFamily}
            options={[
              { value: 'All', label: 'All materials' },
              ...Object.entries(MATERIAL_FAMILIES).map(([value, f]) => ({
                value,
                label: f.name,
              })),
            ]}
          />
          <SelectBox
            label="Material tier"
            value={tier}
            onChange={setTier}
            options={[
              { value: 'All', label: 'All tiers' },
              ...['1', '2', '3', '4', '5', '6', '7', '8'].map((value) => ({
                value,
                label: 'T' + value,
              })),
            ]}
          />
          <SelectBox
            label="Material enchantment"
            value={enchantment}
            onChange={setEnchantment}
            options={[
              { value: 'All', label: 'All enchantments' },
              ...['0', '1', '2', '3', '4'].map((value) => ({
                value,
                label: '.' + value,
              })),
            ]}
          />
          <SelectBox
            label="Material city"
            value={city}
            onChange={setCity}
            options={['Best city', ...CITIES]}
          />
          <SelectBox
            label="Material sort"
            value={sort}
            onChange={setSort}
            options={[
              'Resource / tier',
              'Lowest ask',
              'Largest city spread',
              'Freshest',
              'Quote coverage',
            ]}
          />
        </div>
        <div className="material-summary">
          <span>{rows.length} variants in view</span>
          <span>{available} with eligible asks</span>
          <span className="positive">{fresh} observed within 10m</span>
          <span>{rows.length - available} without eligible asks</span>
        </div>
        <MarketTable
          rows={rows}
          rowKey={(r) => r.item.id}
          limit={25}
          columns={[
            {
              label: 'MATERIAL',
              render: (r) => (
                <ItemLabel
                  item={r.item}
                  onClick={() => p.openItem(r.item.id)}
                />
              ),
            },
            {
              label: 'TIER / ENCHANT',
              render: (r) => (
                <span className={`enchantment e${r.item.enchantment}`}>
                  T{r.item.tier}.{r.item.enchantment}
                </span>
              ),
            },
            {
              label: 'LOWEST / SELECTED ASK',
              render: (r) => (
                <>
                  <Num value={r.q?.sell_price_min} exact={p.settings.exact} />
                  <br />
                  {r.q && <CityBadge city={r.q.city} />}
                </>
              ),
            },
            {
              label: 'ASK OBSERVATION',
              render: (r) => (
                <FreshnessBadge date={r.q?.sell_price_min_date} now={p.now} />
              ),
            },
            {
              label: 'HIGHEST BID',
              render: (r) => (
                <>
                  <Num value={r.bid?.buy_price_max} exact={p.settings.exact} />
                  <br />
                  {r.bid && <CityBadge city={r.bid.city} />}
                  <br />
                  <FreshnessBadge
                    date={r.bid?.buy_price_max_date}
                    now={p.now}
                    compact
                  />
                </>
              ),
            },
            {
              label: 'CITY ASK RANGE',
              render: (r) => <Num value={r.spread} />,
            },
            {
              label: 'CITY PREMIUM',
              render: (r) => (
                <span
                  className={(r.premium || 0) > 0 ? 'negative' : 'positive'}
                >
                  <Num value={r.premium} suffix="%" />
                </span>
              ),
            },
            {
              label: 'COVERAGE',
              render: (r) => (
                <span>
                  {r.coverage} / {CITIES.length}
                </span>
              ),
            },
            {
              label: 'ANALYZE',
              render: (r) => (
                <button
                  className="quiet"
                  title={`Analyze ${r.item.name}`}
                  onClick={() => p.openItem(r.item.id)}
                >
                  <ArrowUpRight size={15} />
                </button>
              ),
            },
          ]}
        />
        <p className="footnote">
          Variants come from the canonical item catalog, including resource IDs
          such as T4_ORE_LEVEL1@1. Nonexistent enchantments are not synthesized.
          A missing observation remains empty. Use Item Explorer for weapons,
          artifacts, food, and other tradable items.
        </p>
      </Panel>
    </>
  );
}
