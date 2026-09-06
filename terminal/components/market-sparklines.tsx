'use client';
import { useState, useEffect } from 'react';
import { AreaChart, Area, ResponsiveContainer, Tooltip } from 'recharts';
import { marketRequest } from '@/lib/market/client';
import { timestamp, valid } from '@/lib/market/analytics';
import { materialFamily } from '@/lib/market/materials';
import type { HistorySeries } from '@/lib/market/types';
import type { ViewProps } from './market-views';
import { Num, FreshnessBadge } from './market-ui';
export function MarketSparklines(p: ViewProps) {
  return (
    <div className="mini-markets">
      {p.tracked.slice(0, 4).map((id) => (
        <Sparkline
          key={id + p.settings.region + p.settings.city}
          {...p}
          id={id}
        />
      ))}
    </div>
  );
}
export function Sparkline(p: ViewProps & { id: string }) {
  const [series, setSeries] = useState<HistorySeries[]>([]);
  useEffect(() => {
    let active = true;
    const load = () =>
      marketRequest<HistorySeries[]>(
        new URLSearchParams({
          kind: 'history',
          server: p.settings.region,
          items: p.id,
          quality: String(materialFamily(p.id) ? 1 : p.settings.quality),
          days: '7',
        }).toString(),
      )
        .then((r) => {
          if (active) setSeries(r.data);
        })
        .catch(() => {});
    void load();
    const timer = setInterval(() => {
      if (!document.hidden) void load();
    }, 300000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [p.id, p.settings.region, p.settings.quality]);
  const data =
    series
      .find((s) => s.location === p.settings.city)
      ?.data.filter((r) => r.avg_price > 0)
      .toSorted((a, b) => timestamp(a.timestamp) - timestamp(b.timestamp)) ||
    [];
  const first = data[0]?.avg_price;
  const last = data.at(-1)?.avg_price;
  const change = first && last ? (last / first - 1) * 100 : null;
  const q = p.quotes.find(
    (q) =>
      q.item_id === p.id &&
      q.city === p.settings.city &&
      valid(q, 'sell', p.settings.maxAge || Infinity, p.now),
  );
  const color = (change || 0) >= 0 ? '#5dcfa7' : '#e78292';
  return (
    <section className="mini-market">
      <button className="quiet" onClick={() => p.openItem(p.id)}>
        {p.item(p.id).name} <span>↗</span>
      </button>
      <div className="mini-price">
        <Num value={q?.sell_price_min} />
        <span style={{ color }}>
          <Num value={change} suffix="%" />
        </span>
      </div>
      <div className="mini-chart">
        {data.length > 1 ? (
          <ResponsiveContainer
            width="100%"
            height={50}
            initialDimension={{ width: 200, height: 50 }}
          >
            <AreaChart
              data={data}
              margin={{ top: 3, right: 0, bottom: 0, left: 0 }}
            >
              <Area
                dataKey="avg_price"
                stroke={color}
                fill={color}
                fillOpacity={0.07}
                strokeWidth={1.5}
                isAnimationActive={false}
              />
              <Tooltip
                contentStyle={{
                  background: '#111c2a',
                  border: '1px solid #2b3d58',
                  fontSize: 10,
                }}
                labelFormatter={(_, payload) =>
                  payload[0]?.payload?.timestamp || ''
                }
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="muted">No 7-day history for {p.settings.city}</div>
        )}
      </div>
      <div className="mini-caption">
        <span>{p.settings.city} · 7D history</span>
        <FreshnessBadge date={q?.sell_price_min_date} now={p.now} compact />
      </div>
    </section>
  );
}
