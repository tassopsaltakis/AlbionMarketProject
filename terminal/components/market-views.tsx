'use client';
import { useMemo, useState } from 'react';
import { Star, ArrowRight, TriangleAlert } from 'lucide-react';
import {
  age,
  ageLabel,
  arbitrage,
  valid,
  stats,
  outlier,
} from '@/lib/market/analytics';
import {
  CITIES,
  type Quote,
  type Item,
  type Settings,
} from '@/lib/market/types';
import {
  Panel,
  MarketTable,
  Num,
  FreshnessBadge,
  CityBadge,
  ItemLabel,
  SelectBox,
  NumberField,
  Toggle,
  Stat,
  ExportButton,
  Empty,
} from './market-ui';
export interface ViewProps {
  quotes: Quote[];
  settings: Settings;
  now: number;
  item: (id: string) => Item;
  selected: string;
  openItem: (id: string) => void;
  tracked: string[];
  setTracked: (ids: string[]) => void;
  notify: (message: string) => void;
}
export function ItemAnalysis(p: ViewProps) {
  const q = p.quotes.filter((q) => q.item_id === p.selected);
  const sell = q.filter((q) =>
    valid(q, 'sell', p.settings.maxAge || Infinity, p.now),
  );
  const s = stats(sell.map((q) => q.sell_price_min));
  const sorted = sell.toSorted((a, b) => a.sell_price_min - b.sell_price_min);
  const bestBid = Math.max(
    0,
    ...q
      .filter((q) => valid(q, 'buy', p.settings.maxAge || Infinity, p.now))
      .map((q) => q.buy_price_max),
  );
  return (
    <>
      <div className="stats-grid">
        <Stat
          label="CITY AVERAGE ASK"
          value={<Num value={s?.mean} />}
          note="Eligible city observations"
        />
        <Stat
          label="MEDIAN ASK"
          value={<Num value={s?.median} />}
          note="Derived statistic"
        />
        <Stat
          label="STANDARD DEVIATION"
          value={<Num value={s?.sd} />}
          note="Across eligible city asks"
        />
        <Stat
          label="COEFFICIENT OF VARIATION"
          value={<Num value={s?.cv} suffix="%" />}
          note="City dispersion, not time volatility"
        />
      </div>
      <Panel
        title="City-by-city market comparison"
        tag="EXACT OBSERVATIONS"
        actions={
          <ExportButton
            rows={q.map((q) => ({
              ...q,
              source: 'Albion Online Data Project',
              sell_age_ms: age(q.sell_price_min_date, p.now),
              buy_age_ms: age(q.buy_price_max_date, p.now),
            }))}
          />
        }
      >
        <MarketTable
          rows={q.filter(
            (q) =>
              valid(q, 'sell', p.settings.maxAge || Infinity, p.now) ||
              valid(q, 'buy', p.settings.maxAge || Infinity, p.now),
          )}
          rowKey={(q) => q.city + q.quality}
          columns={[
            {
              label: 'CITY / RANK',
              render: (r) => (
                <>
                  <CityBadge city={r.city} />{' '}
                  <small className="muted">
                    #{sorted.findIndex((q) => q.city === r.city) + 1 || '—'}
                  </small>
                </>
              ),
            },
            {
              label: 'SELL MIN',
              render: (r) => (
                <div className={sorted[0]?.city === r.city ? 'positive' : ''}>
                  <Num
                    value={
                      valid(r, 'sell', p.settings.maxAge || Infinity, p.now)
                        ? r.sell_price_min
                        : null
                    }
                  />
                  <br />
                  <FreshnessBadge date={r.sell_price_min_date} now={p.now} />
                  {s &&
                    outlier(
                      r.sell_price_min,
                      sell.map((q) => q.sell_price_min),
                    ) && <span className="pill amber">Outlier</span>}
                </div>
              ),
            },
            {
              label: 'SELL MAX',
              render: (r) => (
                <>
                  <Num
                    value={
                      r.sell_price_max > 0 &&
                      age(r.sell_price_max_date, p.now) <=
                        (p.settings.maxAge || Infinity)
                        ? r.sell_price_max
                        : null
                    }
                  />
                  <br />
                  <FreshnessBadge
                    date={r.sell_price_max_date}
                    now={p.now}
                    compact
                  />
                </>
              ),
            },
            {
              label: 'BUY MIN',
              render: (r) => (
                <>
                  <Num
                    value={
                      r.buy_price_min > 0 &&
                      age(r.buy_price_min_date, p.now) <=
                        (p.settings.maxAge || Infinity)
                        ? r.buy_price_min
                        : null
                    }
                  />
                  <br />
                  <FreshnessBadge
                    date={r.buy_price_min_date}
                    now={p.now}
                    compact
                  />
                </>
              ),
            },
            {
              label: 'BUY MAX',
              render: (r) => (
                <span className={r.buy_price_max === bestBid ? 'positive' : ''}>
                  <Num
                    value={
                      valid(r, 'buy', p.settings.maxAge || Infinity, p.now)
                        ? r.buy_price_max
                        : null
                    }
                  />
                  <br />
                  <FreshnessBadge date={r.buy_price_max_date} now={p.now} />
                </span>
              ),
            },
            {
              label: 'SPREAD / %',
              render: (r) =>
                valid(r, 'sell', p.settings.maxAge || Infinity, p.now) &&
                valid(r, 'buy', p.settings.maxAge || Infinity, p.now) ? (
                  <>
                    <Num value={r.sell_price_min - r.buy_price_max} />
                    <small className="muted">
                      {' '}
                      /{' '}
                      <Num
                        value={
                          ((r.sell_price_min - r.buy_price_max) /
                            r.sell_price_min) *
                          100
                        }
                        suffix="%"
                      />
                    </small>
                  </>
                ) : (
                  '—'
                ),
            },
            {
              label: 'MIDPOINT',
              render: (r) => (
                <Num
                  value={
                    valid(r, 'sell', p.settings.maxAge || Infinity, p.now) &&
                    valid(r, 'buy', p.settings.maxAge || Infinity, p.now)
                      ? (r.sell_price_min + r.buy_price_max) / 2
                      : null
                  }
                />
              ),
            },
            {
              label: 'CITY PREMIUM',
              render: (r) => (
                <Num
                  value={
                    s && valid(r, 'sell', p.settings.maxAge || Infinity, p.now)
                      ? (r.sell_price_min / s.mean - 1) * 100
                      : null
                  }
                  suffix="%"
                />
              ),
            },
          ]}
        />
      </Panel>
    </>
  );
}
export function ArbitrageScanner(p: ViewProps) {
  const [minProfit, setMinProfit] = useState(0),
    [minMargin, setMinMargin] = useState(0),
    [tier, setTier] = useState('All'),
    [enchant, setEnchant] = useState('All'),
    [category, setCategory] = useState('All'),
    [origin, setOrigin] = useState('All'),
    [dest, setDest] = useState('All'),
    [exclude, setExclude] = useState(false),
    [stale, setStale] = useState(false),
    [sort, setSort] = useState('Net profit'),
    [units, setUnits] = useState(100),
    [maxMinutes, setMaxMinutes] = useState(30);
  const routes = useMemo(
    () =>
      arbitrage(
        p.quotes,
        p.settings.tax,
        Math.min(
          p.settings.maxAge || Infinity,
          stale ? maxMinutes * 60000 : Math.min(maxMinutes * 60000, 1800000),
        ),
        p.now,
      )
        .filter(
          (r) =>
            r.profit >= minProfit &&
            r.margin >= minMargin &&
            (tier === 'All' || p.item(r.item).tier === Number(tier)) &&
            (enchant === 'All' ||
              p.item(r.item).enchantment === Number(enchant)) &&
            (category === 'All' || p.item(r.item).category === category) &&
            (origin === 'All' || r.buy.city === origin) &&
            (dest === 'All' || r.sell.city === dest) &&
            (!exclude ||
              ![r.buy.city, r.sell.city].some((c) =>
                ['Caerleon', 'Black Market'].includes(c),
              )),
        )
        .sort((a, b) =>
          sort === 'Return %'
            ? b.margin - a.margin
            : sort === 'Freshness'
              ? a.quoteAge - b.quoteAge
              : sort === 'Raw spread'
                ? b.spread - a.spread
                : b.profit - a.profit,
        ),
    [
      p.quotes,
      p.settings,
      p.now,
      minProfit,
      minMargin,
      tier,
      enchant,
      category,
      origin,
      dest,
      exclude,
      stale,
      maxMinutes,
      sort,
    ],
  );
  return (
    <Panel
      title="Arbitrage scanner"
      tag={`${routes.length} ROUTES`}
      actions={
        <ExportButton
          name="arbitrage"
          rows={routes.map((r) => ({
            item: r.item,
            quality: r.buy.quality,
            buy_city: r.buy.city,
            sell_city: r.sell.city,
            buy: r.buy.sell_price_min,
            sell: r.sell.buy_price_max,
            buy_observed: r.buy.sell_price_min_date,
            sell_observed: r.sell.buy_price_max_date,
            profit: r.profit,
            profit_10: r.profit * 10,
            profit_100: r.profit * 100,
            profit_1000: r.profit * 1000,
            margin: r.margin,
            confidence_estimate: r.confidence,
            lethal_route: r.lethal,
          }))}
        />
      }
    >
      <div className="form-grid">
        <NumberField
          label="Minimum profit / unit"
          value={minProfit}
          onChange={setMinProfit}
        />
        <NumberField
          label="Minimum return %"
          value={minMargin}
          onChange={setMinMargin}
        />
        <NumberField
          label="Maximum quote age (minutes)"
          value={maxMinutes}
          onChange={setMaxMinutes}
          min={1}
        />
      </div>
      <div className="toolbar">
        <SelectBox
          label="Tier"
          value={tier}
          onChange={setTier}
          options={['All', '2', '3', '4', '5', '6', '7', '8']}
        />
        <SelectBox
          label="Enchantment"
          value={enchant}
          onChange={setEnchant}
          options={['All', '0', '1', '2', '3', '4']}
        />
        <SelectBox
          label="Category"
          value={category}
          onChange={setCategory}
          options={[
            'All',
            ...new Set(p.tracked.map((id) => p.item(id).category)),
          ]}
        />
        <SelectBox
          label="Origin city"
          value={origin}
          onChange={setOrigin}
          options={['All', ...CITIES]}
        />
        <ArrowRight size={12} />
        <SelectBox
          label="Destination city"
          value={dest}
          onChange={setDest}
          options={['All', ...CITIES]}
        />
        <SelectBox
          label="Sort opportunities"
          value={sort}
          onChange={setSort}
          options={['Net profit', 'Return %', 'Freshness', 'Raw spread']}
        />
        <Toggle checked={exclude} onChange={setExclude}>
          Exclude Caerleon / Black Market
        </Toggle>
        <Toggle checked={stale} onChange={setStale}>
          Allow over 30m
        </Toggle>
        <SelectBox
          label="Profit quantity"
          value={String(units)}
          onChange={(v) => setUnits(Number(v))}
          options={['10', '100', '1000']}
        />
      </div>
      <MarketTable
        rows={routes}
        rowKey={(r) => r.id}
        columns={[
          {
            label: 'ITEM',
            render: (r) => (
              <ItemLabel
                item={p.item(r.item)}
                onClick={() => p.openItem(r.item)}
              />
            ),
          },
          {
            label: 'BUY ASK',
            render: (r) => (
              <>
                <CityBadge city={r.buy.city} />
                <br />
                <Num value={r.buy.sell_price_min} />
                <br />
                <FreshnessBadge date={r.buy.sell_price_min_date} now={p.now} />
              </>
            ),
          },
          {
            label: 'SELL BID',
            render: (r) => (
              <>
                <CityBadge city={r.sell.city} />
                <br />
                <Num value={r.sell.buy_price_max} />
                <br />
                <FreshnessBadge date={r.sell.buy_price_max_date} now={p.now} />
              </>
            ),
          },
          { label: 'RAW SPREAD', render: (r) => <Num value={r.spread} /> },
          {
            label: 'NET / UNIT',
            render: (r) => (
              <span className="positive">
                <Num value={r.profit} />
              </span>
            ),
          },
          {
            label: `NET / ${units}`,
            render: (r) => (
              <span className="positive">
                <Num value={r.profit * units} />
              </span>
            ),
          },
          {
            label: 'RETURN',
            render: (r) => <Num value={r.margin} suffix="%" />,
          },
          {
            label: 'CONFIDENCE',
            render: (r) => (
              <span title="Application estimate: freshness penalty and suspicious-spread penalty">
                {r.confidence}/100{' '}
                {r.suspicious && <span className="amber">Outlier</span>}
              </span>
            ),
          },
          {
            label: 'ROUTE RISK',
            render: (r) => (
              <span className={r.lethal ? 'amber' : 'muted'}>
                {r.lethal ? 'Lethal route possible' : 'Route not assessed'}
              </span>
            ),
          },
        ]}
      />
      <p className="footnote">
        Buy the lowest sell listing; sell into the highest buy order.{' '}
        {p.settings.tax}% configured sales tax, no setup fee for immediate order
        execution. Quantities are scenarios: available order depth is unknown.
        Confidence is an application-generated estimate, not a fill guarantee.
      </p>
    </Panel>
  );
}
export function CityMarkets(p: ViewProps) {
  const [city, setCity] = useState(p.settings.city);
  const [sort, setSort] = useState('Cheapest relative');
  const rows = p.tracked
    .map((id) => {
      const qs = p.quotes.filter(
        (q) =>
          q.item_id === id &&
          valid(q, 'sell', p.settings.maxAge || Infinity, p.now),
      );
      const s = stats(qs.map((q) => q.sell_price_min));
      return {
        id,
        qs,
        s,
        local: qs.find((q) => q.city === city),
        premium:
          s && qs.find((q) => q.city === city)
            ? (qs.find((q) => q.city === city)!.sell_price_min / s.mean - 1) *
              100
            : null,
      };
    })
    .sort((a, b) =>
      sort === 'Highest premium'
        ? (b.premium ?? -Infinity) - (a.premium ?? -Infinity)
        : (a.premium ?? Infinity) - (b.premium ?? Infinity),
    );
  return (
    <>
      <Panel
        title="City comparison matrix"
        tag="ASK VS CITY AVERAGE"
        actions={
          <SelectBox
            label="City"
            value={city}
            onChange={setCity}
            options={CITIES}
          />
        }
      >
        <div className="toolbar">
          <SelectBox
            label="City ranking"
            value={sort}
            onChange={setSort}
            options={['Cheapest relative', 'Highest premium']}
          />
          <span className="muted">
            Green: below average · Red: above average · quote age underneath
          </span>
          <ExportButton
            rows={rows.map((r) =>
              Object.fromEntries([
                ['item', r.id],
                ...CITIES.map((c) => [
                  c,
                  r.qs.find((q) => q.city === c)?.sell_price_min ?? '',
                ]),
              ]),
            )}
          />
        </div>
        <MarketTable
          rows={rows}
          rowKey={(r) => r.id}
          columns={[
            {
              label: 'ITEM',
              render: (r) => (
                <ItemLabel
                  item={p.item(r.id)}
                  onClick={() => p.openItem(r.id)}
                />
              ),
            },
            ...CITIES.map((c) => ({
              label: c.toUpperCase(),
              render: (r: (typeof rows)[number]) => {
                const q = r.qs.find((q) => q.city === c);
                return (
                  <span
                    className={
                      q && r.s
                        ? q.sell_price_min < r.s.mean * 0.98
                          ? 'positive'
                          : q.sell_price_min > r.s.mean * 1.02
                            ? 'negative'
                            : ''
                        : ''
                    }
                  >
                    <Num value={q?.sell_price_min} />
                    <br />
                    <FreshnessBadge
                      date={q?.sell_price_min_date}
                      compact
                      now={p.now}
                    />
                  </span>
                );
              },
            })),
            {
              label: `${city.toUpperCase()} PREMIUM`,
              render: (r) => <Num value={r.premium} suffix="%" />,
            },
          ]}
        />
      </Panel>
      <Panel title={`${city} imports & exports`}>
        <MarketTable
          rows={arbitrage(
            p.quotes,
            p.settings.tax,
            p.settings.maxAge || Infinity,
            p.now,
          ).filter((r) => r.buy.city === city || r.sell.city === city)}
          rowKey={(r) => r.id}
          columns={[
            {
              label: 'ITEM',
              render: (r) => (
                <ItemLabel
                  item={p.item(r.item)}
                  onClick={() => p.openItem(r.item)}
                />
              ),
            },
            {
              label: 'TRADE',
              render: (r) => (r.buy.city === city ? 'Export' : 'Import'),
            },
            {
              label: 'ROUTE',
              render: (r) => (
                <>
                  <CityBadge city={r.buy.city} /> →{' '}
                  <CityBadge city={r.sell.city} />
                </>
              ),
            },
            { label: 'NET / UNIT', render: (r) => <Num value={r.profit} /> },
            {
              label: 'OBSERVATIONS',
              render: (r) => (
                <>
                  <FreshnessBadge
                    date={r.buy.sell_price_min_date}
                    now={p.now}
                  />{' '}
                  /{' '}
                  <FreshnessBadge
                    date={r.sell.buy_price_max_date}
                    now={p.now}
                  />
                </>
              ),
            },
          ]}
        />
      </Panel>
    </>
  );
}
export function Heatmap(p: ViewProps) {
  const [metric, setMetric] = useState('City premium');
  const [size, setSize] = useState('Price');
  const [city, setCity] = useState(p.settings.city);
  const data = p.tracked.map((id) => {
    const qs = p.quotes.filter(
      (q) =>
        q.item_id === id &&
        valid(q, 'sell', p.settings.maxAge || Infinity, p.now),
    );
    const s = stats(qs.map((q) => q.sell_price_min));
    const q = qs.find((q) => q.city === city);
    return {
      id,
      q,
      s,
      premium: q && s ? (q.sell_price_min / s.mean - 1) * 100 : null,
    };
  });
  return (
    <Panel title="Market heatmap" tag="TRACKED UNIVERSE">
      <div className="toolbar">
        <SelectBox
          label="Heatmap color"
          value={metric}
          onChange={setMetric}
          options={['City premium', 'City dispersion']}
        />
        <SelectBox
          label="Heatmap size"
          value={size}
          onChange={setSize}
          options={['Price', 'Spread', 'Quote coverage']}
        />
        <SelectBox
          label="Heatmap city"
          value={city}
          onChange={setCity}
          options={CITIES}
        />
      </div>
      {[...new Set(data.map((r) => p.item(r.id).category))].map((category) => (
        <div key={category}>
          <div className="nav-label">{category.toUpperCase()}</div>
          <div className="heatmap">
            {data
              .filter((r) => p.item(r.id).category === category)
              .map((r) => {
                const n = metric === 'City premium' ? r.premium : r.s?.cv;
                const weight =
                  size === 'Price'
                    ? r.q?.sell_price_min
                    : size === 'Spread'
                      ? r.s
                        ? r.s.max - r.s.min
                        : 0
                      : p.quotes.filter(
                          (q) =>
                            q.item_id === r.id &&
                            valid(
                              q,
                              'sell',
                              p.settings.maxAge || Infinity,
                              p.now,
                            ),
                        ).length;
                return (
                  <button
                    key={r.id}
                    onClick={() => p.openItem(r.id)}
                    style={{
                      flexGrow: Math.min(
                        5,
                        Math.max(1, Math.log10((weight || 0) + 1)),
                      ),
                      background:
                        n == null
                          ? '#17202b'
                          : n > 0
                            ? `rgba(130,49,68,${Math.min(0.9, 0.2 + Math.abs(n) / 100)})`
                            : `rgba(25,117,94,${Math.min(0.9, 0.2 + Math.abs(n) / 100)})`,
                    }}
                  >
                    <strong>{p.item(r.id).name}</strong>
                    <Num value={n} suffix="%" />
                    <small>
                      <Num value={r.q?.sell_price_min} /> silver · {city}
                    </small>
                    <FreshnessBadge
                      date={r.q?.sell_price_min_date}
                      now={p.now}
                      compact
                    />
                  </button>
                );
              })}
          </div>
        </div>
      ))}
      <p className="footnote">
        Dispersion measures variation across city asks. Quote coverage counts
        available city observations; it is not trade volume.
      </p>
    </Panel>
  );
}
export function Movers(
  p: ViewProps & { previous: Quote[]; liquidity?: boolean },
) {
  const [sort, setSort] = useState(p.liquidity ? 'Quote coverage' : 'Gainers');
  const rows = p.tracked
    .map((id) => {
      const qs = p.quotes.filter(
        (q) =>
          q.item_id === id &&
          valid(q, 'sell', p.settings.maxAge || Infinity, p.now),
      );
      const q = qs.find((q) => q.city === p.settings.city);
      const previous = p.previous.find(
        (r) =>
          r.item_id === id &&
          r.city === p.settings.city &&
          r.quality === p.settings.quality,
      );
      const changed =
        q && previous && q.sell_price_min_date !== previous.sell_price_min_date;
      const delta =
        changed && previous.sell_price_min > 0
          ? q.sell_price_min - previous.sell_price_min
          : null;
      const s = stats(qs.map((q) => q.sell_price_min));
      return {
        id,
        q,
        delta,
        change:
          delta != null && previous
            ? (delta / previous.sell_price_min) * 100
            : null,
        coverage: qs.length,
        dispersion: s?.cv,
        spread:
          q && valid(q, 'buy', p.settings.maxAge || Infinity, p.now)
            ? q.sell_price_min - q.buy_price_max
            : null,
        previous,
      };
    })
    .sort((a, b) =>
      sort === 'Losers'
        ? (a.change ?? Infinity) - (b.change ?? Infinity)
        : sort === 'Absolute change'
          ? Math.abs(b.delta ?? 0) - Math.abs(a.delta ?? 0)
          : sort === 'Bid/ask spread'
            ? (b.spread ?? -Infinity) - (a.spread ?? -Infinity)
            : sort === 'City dispersion'
              ? (b.dispersion ?? -Infinity) - (a.dispersion ?? -Infinity)
              : sort === 'Quote coverage'
                ? b.coverage - a.coverage
                : (b.change ?? -Infinity) - (a.change ?? -Infinity),
    );
  return (
    <Panel
      title={p.liquidity ? 'Liquidity indicators' : 'Market movers'}
      tag="OBSERVED SNAPSHOTS"
    >
      <div className="toolbar">
        <SelectBox
          label="Rank movers"
          value={sort}
          onChange={setSort}
          options={[
            'Gainers',
            'Losers',
            'Absolute change',
            'Bid/ask spread',
            'City dispersion',
            'Quote coverage',
          ]}
        />
        <span className="muted">
          {p.settings.city} · Change since prior distinct observation
        </span>
      </div>
      <MarketTable
        rows={rows}
        rowKey={(r) => r.id}
        columns={[
          {
            label: 'ITEM',
            render: (r) => (
              <ItemLabel item={p.item(r.id)} onClick={() => p.openItem(r.id)} />
            ),
          },
          { label: 'ASK', render: (r) => <Num value={r.q?.sell_price_min} /> },
          {
            label: 'CHANGE',
            render: (r) => (
              <span className={(r.change || 0) >= 0 ? 'positive' : 'negative'}>
                <Num value={r.change} suffix="%" />
              </span>
            ),
          },
          { label: 'SILVER CHANGE', render: (r) => <Num value={r.delta} /> },
          {
            label: 'BID / ASK SPREAD',
            render: (r) => <Num value={r.spread} />,
          },
          {
            label: 'CITY DISPERSION',
            render: (r) => <Num value={r.dispersion} suffix="%" />,
          },
          {
            label: 'QUOTE COVERAGE',
            render: (r) => (
              <span>
                {r.coverage} / {CITIES.length} cities
              </span>
            ),
          },
          {
            label: 'OBSERVATION',
            render: (r) => (
              <FreshnessBadge date={r.q?.sell_price_min_date} now={p.now} />
            ),
          },
          {
            label: 'BASELINE',
            render: (r) => (
              <FreshnessBadge
                date={r.previous?.sell_price_min_date}
                now={p.now}
                compact
              />
            ),
          },
        ]}
      />
      <p className="footnote">
        No transaction volume or order depth is available from current quotes.
        Coverage and bid/ask spreads are liquidity proxies only. Changes remain
        blank until a different timestamp is observed; no simulated movement is
        shown.
      </p>
    </Panel>
  );
}
