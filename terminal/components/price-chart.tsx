'use client';
import { useEffect, useMemo, useState } from 'react';
import {
  Area,
  Line,
  ComposedChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Brush,
} from 'recharts';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Maximize2,
  RotateCcw,
  ChartNoAxesCombined,
  Copy,
  Star,
} from 'lucide-react';
import { marketRequest } from '@/lib/market/client';
import { timestamp, stats, valid } from '@/lib/market/analytics';
import {
  CITIES,
  CITY_COLORS,
  type Item,
  type Quote,
  type Settings,
  type HistorySeries,
  type GoldPoint,
} from '@/lib/market/types';
import {
  Panel,
  Num,
  FreshnessBadge,
  CityBadge,
  Empty,
  Loading,
  SelectBox,
  Toggle,
} from './market-ui';
const RANGES: Record<string, number> = {
  '24H': 1,
  '7D': 7,
  '30D': 30,
  '90D': 90,
  '1Y': 365,
  MAX: 730,
};
export function PriceChart({
  item,
  quotes,
  settings,
  now,
  onWatch,
  initialRange = '30D',
  gold = false,
}: {
  item: Item;
  quotes: Quote[];
  settings: Settings;
  now: number;
  onWatch?: (id: string) => void;
  initialRange?: string;
  gold?: boolean;
}) {
  const [range, setRange] = useState(initialRange);
  const [series, setSeries] = useState<HistorySeries[]>([]);
  const [goldData, setGoldData] = useState<GoldPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cached, setCached] = useState(false);
  const [cities, setCities] = useState<string[]>([settings.city]);
  const [log, setLog] = useState(false);
  const [average, setAverage] = useState(true);
  const [metric, setMetric] = useState('Price');
  const [chartKey, setChartKey] = useState(0);
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    const p = new URLSearchParams(location.search);
    const r = p.get('timeframe');
    if (r && RANGES[r]) setRange(r);
  }, []);
  useEffect(() => {
    setCities([settings.city]);
  }, [settings.city]);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    setSeries([]);
    setGoldData([]);
    const load = async () => {
      try {
        const p = new URLSearchParams({
          kind: gold ? 'gold' : 'history',
          server: settings.region,
          items: item.id,
          days: String(RANGES[range] || 30),
          quality: String(settings.quality),
        });
        const r = await marketRequest<HistorySeries[] | GoldPoint[]>(
          p.toString(),
        );
        if (!active) return;
        if (gold) setGoldData(r.data as GoldPoint[]);
        else setSeries(r.data as HistorySeries[]);
        setCached(r.cached);
        setError(r.error || '');
      } catch (e) {
        if (active)
          setError(e instanceof Error ? e.message : 'History unavailable');
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    const timer = setInterval(() => {
      if (!document.hidden) void load();
    }, 300000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [item.id, settings.region, settings.quality, range, gold]);
  const rawData = useMemo(() => {
    const byTime = new Map<number, Record<string, number>>();
    if (gold) {
      goldData
        .filter(
          (p) =>
            timestamp(p.timestamp) >= now - (RANGES[range] || 30) * 86400000 &&
            p.price > 0,
        )
        .forEach((p) =>
          byTime.set(timestamp(p.timestamp), {
            time: timestamp(p.timestamp),
            Gold: p.price,
          }),
        );
    } else
      series.forEach((s) =>
        s.data?.forEach((p) => {
          if (!Number.isFinite(timestamp(p.timestamp)) || p.avg_price <= 0)
            return;
          const t = timestamp(p.timestamp);
          const row = byTime.get(t) || { time: t };
          row[s.location] = p.avg_price;
          byTime.set(t, row);
        }),
      );
    const rows = [...byTime.values()].sort((a, b) => a.time - b.time);
    const primary = gold ? 'Gold' : cities[0];
    return rows.map((row, i) => {
      const values = (gold ? ['Gold'] : cities)
        .map((c) => row[c])
        .filter((v) => v > 0);
      const result = { ...row };
      const window = rows
        .slice(Math.max(0, i - 6), i + 1)
        .map((r) => r[primary])
        .filter((v) => v > 0);
      if (window.length)
        result.MA7 = window.reduce((a, b) => a + b, 0) / window.length;
      if (values.length > 1)
        result.Spread = Math.max(...values) - Math.min(...values);
      return result;
    });
  }, [series, goldData, cities, gold, range, now]);
  const data = useMemo(
    () =>
      metric !== 'Change %'
        ? rawData
        : rawData.map((row) => {
            const result = { ...row };
            for (const c of [...cities, 'Gold', 'MA7']) {
              const baseline = rawData.find((r) => r[c] > 0)?.[c];
              if (baseline && result[c] != null)
                result[c] = (result[c] / baseline - 1) * 100;
            }
            return result;
          }),
    [rawData, metric, cities],
  );
  const primary = gold ? 'Gold' : cities[0];
  const values = rawData.map((p) => p[primary]).filter((v) => v > 0);
  const summary = stats(values);
  const first = rawData.find((p) => p[primary] != null)?.[primary];
  const last = rawData.findLast((p) => p[primary] != null)?.[primary];
  const change = first && last != null ? ((last - first) / first) * 100 : null;
  const lastPoint = rawData.findLast((p) => p[primary] > 0);
  const periodChange = (days: number) => {
    if (!lastPoint) return null;
    const target = lastPoint.time - days * 86400000;
    const base = rawData.findLast((p) => p[primary] > 0 && p.time <= target);
    return base && target - base.time <= 86400000
      ? (lastPoint[primary] / base[primary] - 1) * 100
      : null;
  };
  const returns = values.slice(1).map((v, i) => (v / values[i] - 1) * 100);
  const meanReturn = returns.length
    ? returns.reduce((a, b) => a + b, 0) / returns.length
    : 0;
  const volatility =
    returns.length > 1
      ? Math.sqrt(
          returns.reduce((sum, r) => sum + (r - meanReturn) ** 2, 0) /
            returns.length,
        )
      : null;
  const itemQuotes = quotes.filter((q) => q.item_id === item.id);
  const best = itemQuotes
    .filter((q) => valid(q, 'sell', settings.maxAge || Infinity, now))
    .sort((a, b) => a.sell_price_min - b.sell_price_min)[0];
  const chartCities = gold ? ['Gold'] : cities;
  const lastGold = goldData.toSorted(
    (a, b) => timestamp(b.timestamp) - timestamp(a.timestamp),
  )[0];
  return (
    <Panel
      className={`chart-panel ${expanded ? 'expanded-chart' : ''}`}
      title={gold ? 'Gold / Silver' : item.name}
      tag={gold ? 'GOLD MARKET' : `${item.id} · Q${settings.quality}`}
      actions={
        <>
          <button
            className="quiet"
            title="Copy price snapshot"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(
                  JSON.stringify(
                    {
                      item: item.id,
                      region: settings.region,
                      quality: settings.quality,
                      quotes: itemQuotes,
                      source: 'Albion Online Data Project',
                    },
                    null,
                    2,
                  ),
                );
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              } catch {
                setCopied(false);
              }
            }}
          >
            <Copy size={13} />
            {copied ? 'Copied' : 'Copy'}
          </button>
          {onWatch && (
            <button
              className="quiet"
              title="Add item to watchlist"
              onClick={() => onWatch(item.id)}
            >
              <Star size={14} />
            </button>
          )}
          <button
            className="quiet"
            title={expanded ? 'Restore chart' : 'Expand chart'}
            onClick={() => setExpanded((v) => !v)}
          >
            <Maximize2 size={14} />
          </button>
        </>
      }
    >
      <div className="chart-quote">
        <div>
          <span className="chart-symbol">
            {gold ? 'GOLD' : `T${item.tier}.${item.enchantment}`}{' '}
            <span>
              · {gold ? 'Silver per gold' : 'Best available sell listing'}
            </span>
          </span>
          <div className="chart-price">
            <Num
              value={gold ? lastGold?.price : best?.sell_price_min}
              exact={settings.exact}
            />
            <span
              className={
                change != null && change >= 0 ? 'positive' : 'negative'
              }
            >
              {change == null
                ? ''
                : `${change >= 0 ? '+' : ''}${change.toFixed(2)}%`}
              <small>{change != null ? ' history range' : ''}</small>
            </span>
          </div>
          <div className="quote-caption">
            {best && !gold && <CityBadge city={best.city} />}
            <FreshnessBadge
              date={gold ? lastGold?.timestamp : best?.sell_price_min_date}
              now={now}
            />
            {cached && <span className="tag">CACHED HISTORY</span>}
          </div>
        </div>
        <div className="chart-range-stat">
          <span>HISTORICAL LOW / HIGH</span>
          <strong>
            <Num value={summary?.min} /> <span> / </span>{' '}
            <Num value={summary?.max} />
          </strong>
          <small>Observed averages · selected city</small>
        </div>
      </div>
      <div className="chart-controls">
        <Tabs
          value={range}
          onValueChange={(v) => {
            setRange(String(v));
            const p = new URLSearchParams(location.search);
            p.set('timeframe', String(v));
            history.replaceState(null, '', '?' + p);
          }}
        >
          <TabsList variant="line">
            {Object.keys(RANGES).map((r) => (
              <TabsTrigger key={r} value={r}>
                {r}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="chart-options">
          <SelectBox
            label="Chart metric"
            value={metric}
            onChange={(v) => {
              setMetric(v);
              if (v !== 'Price') setLog(false);
            }}
            options={['Price', 'Change %', ...(!gold ? ['City spread'] : [])]}
          />
          <Toggle checked={average} onChange={setAverage}>
            MA 7 buckets
          </Toggle>
          <Toggle
            checked={log}
            onChange={(v) => {
              setLog(v);
              if (v) setMetric('Price');
            }}
          >
            Log
          </Toggle>
          <button
            className="quiet"
            title="Reset chart zoom"
            onClick={() => setChartKey((k) => k + 1)}
          >
            <RotateCcw size={13} />
          </button>
        </div>
      </div>
      <div className="chart-canvas">
        {loading ? (
          <Loading />
        ) : !data.length ? (
          <Empty
            text={
              error
                ? 'Historical source unavailable'
                : 'No history for this selection'
            }
            detail={
              error ||
              'Try another city, item, or time range. The source may not contain observations for this item.'
            }
          />
        ) : metric === 'City spread' && cities.length < 2 ? (
          <Empty
            text="Select at least two cities"
            detail="The spread chart compares observations from the same historical time bucket."
          />
        ) : (
          <ResponsiveContainer
            width="100%"
            height="100%"
            initialDimension={{ width: 600, height: 280 }}
          >
            <ComposedChart
              key={chartKey}
              data={data}
              margin={{ top: 16, right: 18, left: 4, bottom: 0 }}
            >
              <defs>
                <linearGradient id="priceFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#639eff" stopOpacity={0.18} />
                  <stop offset="100%" stopColor="#639eff" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                stroke="#202b3c"
                vertical={false}
                strokeDasharray="3 5"
              />
              <XAxis
                dataKey="time"
                type="number"
                domain={['dataMin', 'dataMax']}
                scale="time"
                tickFormatter={(t) =>
                  new Date(t).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    ...(range === '24H' ? { hour: 'numeric' } : {}),
                  })
                }
                stroke="#475a73"
                tick={{ fontSize: 10, fill: '#7188a7' }}
                tickLine={false}
                axisLine={false}
                minTickGap={60}
              />
              <YAxis
                orientation="right"
                scale={log ? 'log' : 'auto'}
                domain={log ? ['auto', 'auto'] : ['auto', 'auto']}
                tickFormatter={(n) =>
                  new Intl.NumberFormat('en', {
                    notation: 'compact',
                    maximumFractionDigits: 1,
                  }).format(n)
                }
                tick={{ fontSize: 10, fill: '#7188a7' }}
                axisLine={false}
                tickLine={false}
                width={55}
              />
              <Tooltip
                labelFormatter={(t) => new Date(Number(t)).toLocaleString()}
                contentStyle={{
                  background: '#121c2b',
                  border: '1px solid #344866',
                  borderRadius: 4,
                  fontSize: 11,
                }}
                formatter={(v) => [
                  Number(v).toLocaleString(undefined, {
                    maximumFractionDigits: 2,
                  }),
                  undefined,
                ]}
                cursor={{ stroke: '#7e93b0', strokeDasharray: '3 3' }}
              />
              {metric === 'City spread' ? (
                <Area
                  dataKey="Spread"
                  stroke="#e4b06e"
                  fill="url(#priceFill)"
                  isAnimationActive={false}
                />
              ) : (
                chartCities.map((c, i) =>
                  i === 0 ? (
                    <Area
                      key={c}
                      type="linear"
                      dataKey={c}
                      stroke={gold ? '#e4ba63' : '#6aa6ff'}
                      strokeWidth={2}
                      fill="url(#priceFill)"
                      connectNulls={false}
                      isAnimationActive={false}
                    />
                  ) : (
                    <Line
                      key={c}
                      type="linear"
                      dataKey={c}
                      stroke={CITY_COLORS[CITIES.indexOf(c)]}
                      strokeWidth={1.5}
                      dot={false}
                      connectNulls={false}
                      isAnimationActive={false}
                    />
                  ),
                )
              )}
              {average && metric !== 'City spread' && (
                <Line
                  dataKey="MA7"
                  stroke="#bba0e9"
                  strokeWidth={1.2}
                  strokeDasharray="4 4"
                  dot={false}
                  connectNulls={false}
                  isAnimationActive={false}
                />
              )}
              <Brush
                dataKey="time"
                height={17}
                stroke="#30415b"
                fill="#0f1723"
                tickFormatter={(t) =>
                  new Date(t).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                  })
                }
                travellerWidth={8}
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>
      {!gold && (
        <div className="chart-legend">
          {CITIES.map((city, i) => (
            <button
              key={city}
              className={cities.includes(city) ? 'selected' : ''}
              onClick={() =>
                setCities((c) =>
                  c.includes(city)
                    ? c.length > 1
                      ? c.filter((x) => x !== city)
                      : c
                    : [...c, city],
                )
              }
            >
              <i style={{ background: CITY_COLORS[i] }} />
              {city}
            </button>
          ))}
        </div>
      )}
      {error && data.length > 0 && (
        <p className="footnote amber">
          {error} · Retaining cached historical observations.
        </p>
      )}
      <div className="history-stats">
        <div>
          <span>7D change</span>
          <Num value={periodChange(7)} suffix="%" />
        </div>
        <div>
          <span>30D change</span>
          <Num value={periodChange(30)} suffix="%" />
        </div>
        <div>
          <span>Bucket return volatility</span>
          <Num value={volatility} suffix="%" />
        </div>
        <div>
          <span>Range percentile</span>
          <Num
            value={
              summary && last != null && summary.max !== summary.min
                ? ((last - summary.min) / (summary.max - summary.min)) * 100
                : null
            }
            suffix="%"
          />
        </div>
        <div>
          <span>History ends</span>
          <span>
            {lastPoint ? new Date(lastPoint.time).toLocaleDateString() : '—'}
          </span>
        </div>
      </div>
      <div className="chart-foot">
        <span>
          <ChartNoAxesCombined size={12} />{' '}
          {gold ? 'Gold observations' : 'Sell-order averages'} ·{' '}
          {range === '24H' ? 'Hourly' : range === '7D' ? '6-hour' : 'Daily'}{' '}
          buckets{gold ? ' (source cadence)' : ''} · Drag the range handles to
          zoom and pan
        </span>
        <span>
          AODP{range === 'MAX' ? ' · up to 2 years where available' : ''}
        </span>
      </div>
    </Panel>
  );
}
