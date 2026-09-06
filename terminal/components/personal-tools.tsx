'use client';
import { useState, useEffect, useRef } from 'react';
import { Bell, Plus, Trash2 } from 'lucide-react';
import {
  CITIES,
  type Settings,
  type Watchlist,
  type AlertRule,
  type AlertKind,
} from '@/lib/market/types';
import { DEFAULT_ITEMS } from '@/lib/market/metadata';
import { readLocal, writeLocal } from '@/lib/market/client';
import { runtime } from '@/lib/market/runtime';
import { valid, age, arbitrage } from '@/lib/market/analytics';
import {
  Panel,
  MarketTable,
  ItemLabel,
  Num,
  CityBadge,
  FreshnessBadge,
  SelectBox,
  NumberField,
  Toggle,
  Empty,
} from './market-ui';
import type { ViewProps } from './market-views';
export function usePersonalTools(p: ViewProps) {
  const [watchlists, setWatchlists] = useState<Watchlist[]>([
    {
      id: 'default',
      name: 'Core markets',
      items: DEFAULT_ITEMS,
      city: 'Thetford',
    },
  ]);
  const [alerts, setAlerts] = useState<AlertRule[]>([]);
  const [loaded, setLoaded] = useState(false);
  const fired = useRef(new Set<string>());
  useEffect(() => {
    setWatchlists(
      readLocal('amt:watchlists', [
        {
          id: 'default',
          name: 'Core markets',
          items: DEFAULT_ITEMS,
          city: 'Thetford',
        },
      ]),
    );
    setAlerts(readLocal('amt:alerts', []));
    setLoaded(true);
  }, []);
  useEffect(() => {
    if (loaded) {
      writeLocal('amt:watchlists', watchlists);
      writeLocal('amt:alerts', alerts);
    }
  }, [watchlists, alerts, loaded]);
  useEffect(() => {
    if (!loaded) return;
    const routes = arbitrage(
      p.quotes,
      p.settings.tax,
      Math.min(p.settings.maxAge || Infinity, 1800000),
      p.now,
    );
    for (const a of alerts) {
      if (a.region !== p.settings.region) continue;
      const q = p.quotes.find((q) => q.item_id === a.item && q.city === a.city);
      if (!q) continue;
      const sell = valid(
        q,
        'sell',
        Math.min(p.settings.maxAge || Infinity, 1800000),
        p.now,
      );
      const buy = valid(
        q,
        'buy',
        Math.min(p.settings.maxAge || Infinity, 1800000),
        p.now,
      );
      const route = routes.filter((r) => r.item === a.item);
      const triggered =
        a.kind === 'sell below'
          ? sell && q.sell_price_min < a.value
          : a.kind === 'sell above'
            ? sell && q.sell_price_min > a.value
            : a.kind === 'buy above'
              ? buy && q.buy_price_max > a.value
              : a.kind === 'margin above'
                ? route.some((r) => r.margin > a.value)
                : a.kind === 'spread above'
                  ? route.some((r) => r.spread > a.value)
                  : a.kind === 'becomes fresh'
                    ? sell && age(q.sell_price_min_date, p.now) < 600000
                    : sell &&
                      !!a.baseline &&
                      Math.abs((q.sell_price_min / a.baseline - 1) * 100) >=
                        a.value;
      if (triggered && !fired.current.has(a.id)) {
        fired.current.add(a.id);
        p.notify(
          `${p.item(a.item).name}: ${a.kind} ${a.value || ''} · ${a.city}`,
        );
        if (
          typeof Notification !== 'undefined' &&
          Notification.permission === 'granted'
        )
          new Notification('Albion Market Alert', {
            body: `${p.item(a.item).name} · ${a.kind} ${a.value}`,
          });
      }
      if (!triggered) fired.current.delete(a.id);
    }
  }, [p, alerts, loaded]);
  return { watchlists, setWatchlists, alerts, setAlerts, fired };
}
export type Personal = ReturnType<typeof usePersonalTools>;
export function Watchlists(p: ViewProps & { personal: Personal }) {
  const { watchlists, setWatchlists, alerts, setAlerts, fired } = p.personal;
  const [active, setActive] = useState('default'),
    [name, setName] = useState(''),
    [kind, setKind] = useState<AlertKind>('sell below'),
    [threshold, setThreshold] = useState(0);
  const list = watchlists.find((w) => w.id === active) || watchlists[0];
  const city = list?.city || p.settings.city;
  const rows = (list?.items || []).map((id) => {
    const qs = p.quotes.filter(
      (q) =>
        q.item_id === id &&
        valid(q, 'sell', p.settings.maxAge || Infinity, p.now),
    );
    return {
      id,
      q: qs.find((q) => q.city === city),
      best: qs.toSorted((a, b) => a.sell_price_min - b.sell_price_min)[0],
    };
  });
  function addItem() {
    if (!list) return;
    setWatchlists((w) =>
      w.map((l) =>
        l.id === list.id
          ? { ...l, items: [...new Set([...l.items, p.selected])] }
          : l,
      ),
    );
    if (!p.tracked.includes(p.selected))
      p.setTracked([...p.tracked, p.selected]);
    p.notify(`${p.item(p.selected).name} added to ${list.name}.`);
  }
  return (
    <>
      <Panel title="Watchlists" tag="SAVED ON THIS DEVICE">
        <div className="toolbar">
          <SelectBox
            label="Watchlist"
            value={list?.id || ''}
            onChange={setActive}
            options={watchlists.map((w) => ({ value: w.id, label: w.name }))}
          />
          <SelectBox
            label="Preferred city"
            value={city}
            onChange={(v) =>
              setWatchlists((w) =>
                w.map((l) => (l.id === list?.id ? { ...l, city: v } : l)),
              )
            }
            options={CITIES}
          />
          <button onClick={addItem}>
            <Plus size={14} /> Add {p.item(p.selected).name}
          </button>
          <input
            aria-label="New watchlist name"
            placeholder="New list name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button
            disabled={!name.trim()}
            onClick={() => {
              const id = crypto.randomUUID();
              setWatchlists((w) => [
                ...w,
                { id, name: name.trim(), items: [], city: p.settings.city },
              ]);
              setActive(id);
              setName('');
            }}
          >
            Create list
          </button>
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
            {
              label: `${city.toUpperCase()} ASK`,
              render: (r) => <Num value={r.q?.sell_price_min} />,
            },
            {
              label: 'BEST CITY / ASK',
              render: (r) =>
                r.best ? (
                  <>
                    <CityBadge city={r.best.city} />{' '}
                    <Num value={r.best.sell_price_min} />{' '}
                    <FreshnessBadge
                      date={r.best.sell_price_min_date}
                      now={p.now}
                      compact
                    />
                  </>
                ) : (
                  '—'
                ),
            },
            {
              label: 'LOCAL BID / ASK SPREAD',
              render: (r) => (
                <Num
                  value={
                    r.q &&
                    valid(r.q, 'buy', p.settings.maxAge || Infinity, p.now)
                      ? r.q.sell_price_min - r.q.buy_price_max
                      : null
                  }
                />
              ),
            },
            {
              label: 'FRESHNESS',
              render: (r) => (
                <FreshnessBadge date={r.q?.sell_price_min_date} now={p.now} />
              ),
            },
            {
              label: 'ALERT',
              render: (r) => (
                <span
                  className={
                    alerts.some(
                      (a) => a.item === r.id && fired.current.has(a.id),
                    )
                      ? 'amber'
                      : 'muted'
                  }
                >
                  {alerts.some(
                    (a) => a.item === r.id && fired.current.has(a.id),
                  )
                    ? 'Triggered'
                    : alerts.some((a) => a.item === r.id)
                      ? 'Watching'
                      : '—'}
                </span>
              ),
            },
            {
              label: 'REMOVE',
              render: (r) => (
                <button
                  className="quiet"
                  title={`Remove ${p.item(r.id).name}`}
                  onClick={() =>
                    setWatchlists((w) =>
                      w.map((l) =>
                        l.id === list?.id
                          ? { ...l, items: l.items.filter((id) => id !== r.id) }
                          : l,
                      ),
                    )
                  }
                >
                  <Trash2 size={13} />
                </button>
              ),
            },
          ]}
        />
      </Panel>
      <Panel title="Price alerts" tag="WHILE TERMINAL IS OPEN">
        <div className="toolbar">
          <ItemLabel item={p.item(p.selected)} />
          <CityBadge city={city} />
          <SelectBox
            label="Alert condition"
            value={kind}
            onChange={(v) => setKind(v as AlertKind)}
            options={[
              'sell below',
              'sell above',
              'buy above',
              'margin above',
              'spread above',
              'becomes fresh',
              'change above',
            ]}
          />
          <input
            type="number"
            min={0}
            aria-label="Alert threshold"
            value={threshold}
            onChange={(e) => setThreshold(Math.max(0, Number(e.target.value)))}
          />
          <button
            onClick={() => {
              const q = p.quotes.find(
                (q) =>
                  q.item_id === p.selected &&
                  q.city === city &&
                  valid(q, 'sell', 1800000, p.now),
              );
              if (kind === 'change above' && !q) {
                p.notify(
                  'A recent baseline quote is required for a change alert.',
                );
                return;
              }
              setAlerts((a) => [
                ...a,
                {
                  id: crypto.randomUUID(),
                  item: p.selected,
                  city,
                  kind,
                  value: threshold,
                  baseline: q?.sell_price_min,
                  region: p.settings.region,
                },
              ]);
              p.notify('Alert saved. Monitoring while this terminal is open.');
            }}
          >
            <Bell size={14} /> Create alert
          </button>
        </div>
        {alerts.map((a) => (
          <div className="alert-row" key={a.id}>
            <span>
              {p.item(a.item).name} · {a.kind} {a.value || ''} · {a.city} ·{' '}
              {a.region}
            </span>
            <button
              className="quiet"
              title="Delete alert"
              onClick={() =>
                setAlerts((list) => list.filter((r) => r.id !== a.id))
              }
            >
              <Trash2 size={13} />
            </button>
          </div>
        ))}
        {!alerts.length && (
          <Empty
            text="No active alerts"
            detail="Select an item and condition to start monitoring recent observations."
          />
        )}
        <p className="footnote">
          Price conditions use quotes no older than 30 minutes and respect your
          global age limit. Alerts are local and run only while the app is open.
          Browser notifications require explicit permission in Settings.
        </p>
      </Panel>
    </>
  );
}
export function SettingsView({
  settings,
  setSettings,
  notify,
}: {
  settings: Settings;
  setSettings: (s: Settings) => void;
  notify: (s: string) => void;
}) {
  return (
    <Panel title="Terminal settings" tag="LOCAL PREFERENCES">
      <div className="form-grid">
        <div className="field">
          Server
          <SelectBox
            label="Server region"
            value={settings.region}
            onChange={(region) =>
              setSettings({ ...settings, region: region as Settings['region'] })
            }
            options={['americas', 'europe', 'asia']}
          />
        </div>
        <div className="field">
          Default city
          <SelectBox
            label="Default city"
            value={settings.city}
            onChange={(city) => setSettings({ ...settings, city })}
            options={CITIES}
          />
        </div>
        <div className="field">
          Hide quotes older than
          <SelectBox
            label="Maximum quote age"
            value={String(settings.maxAge)}
            onChange={(v) => setSettings({ ...settings, maxAge: Number(v) })}
            options={[
              { value: '600000', label: '10 minutes' },
              { value: '1800000', label: '30 minutes' },
              { value: '3600000', label: '1 hour' },
              { value: '21600000', label: '6 hours' },
              { value: '86400000', label: '24 hours' },
              { value: '0', label: 'Never' },
            ]}
          />
        </div>
        <NumberField
          label="Market tax % (editable assumption)"
          value={settings.tax}
          onChange={(tax) => setSettings({ ...settings, tax })}
          max={50}
          step={0.1}
        />
        <NumberField
          label="Order setup fee % (editable assumption)"
          value={settings.setupFee}
          onChange={(setupFee) => setSettings({ ...settings, setupFee })}
          max={49}
          step={0.1}
        />
        <div className="field">
          Item quality
          <SelectBox
            label="Item quality"
            value={String(settings.quality)}
            onChange={(v) => setSettings({ ...settings, quality: Number(v) })}
            options={[
              { value: '1', label: '1 · Normal' },
              { value: '2', label: '2 · Good' },
              { value: '3', label: '3 · Outstanding' },
              { value: '4', label: '4 · Excellent' },
              { value: '5', label: '5 · Masterpiece' },
            ]}
          />
        </div>
        <div className="field">
          Density
          <SelectBox
            label="Table density"
            value={settings.density}
            onChange={(density) => setSettings({ ...settings, density })}
            options={['compact', 'comfortable']}
          />
        </div>
        <Toggle
          checked={settings.premium}
          onChange={(premium) => setSettings({ ...settings, premium })}
        >
          Premium character
        </Toggle>
        <Toggle
          checked={settings.exact}
          onChange={(exact) => setSettings({ ...settings, exact })}
        >
          Show exact numbers
        </Toggle>
      </div>
      <p className="settings-help">
        Initial tax (8%) and setup fee (2.5%) are editable assumptions, not
        verified live rates. Premium status does not silently change fees. Set
        your actual in-game values. Quotes are polled in batches; a 15-second
        upstream cache means faster polling may return the same observation.
      </p>
      <div className="form-actions">
        <button
          onClick={async () => {
            if (typeof Notification === 'undefined') {
              notify('This browser does not support notifications.');
              return;
            }
            const permission = await Notification.requestPermission();
            notify(`Browser notifications: ${permission}`);
          }}
        >
          <Bell size={14} /> Enable browser notifications
        </button>
      </div>
      <div className="player-api-setting">
        <label htmlFor="player-relay">Custom player relay (optional)</label>
        <input
          id="player-relay"
          type="url"
          placeholder={
            runtime().playerProxy || 'https://your-player-api.workers.dev'
          }
          value={settings.playerProxy || ''}
          onChange={(e) =>
            setSettings({ ...settings, playerProxy: e.target.value.trim() })
          }
        />
        <small>
          {runtime().playerProxy
            ? 'The site relay is configured automatically. Leave this blank to use it. '
            : 'The local server handles player lookups; static deployments need a configured relay. '}
          A relay receives the public names and IDs you search, never recruiting
          notes.
        </small>
      </div>
      <div className="data-sources">
        <h3>Public data sources</h3>
        <a
          href="https://www.albion-online-data.com/api/"
          target="_blank"
          rel="noreferrer"
        >
          Albion Online Data Project · prices, sell-order history, gold
        </a>
        <a
          href="https://gameinfo.albiononline.com/api/gameinfo/search?q=Albion"
          target="_blank"
          rel="noreferrer"
        >
          Albion Game Info · public player statistics and guild rosters
        </a>
        <a
          href="https://github.com/ao-data/ao-bin-dumps/tree/master/formatted"
          target="_blank"
          rel="noreferrer"
        >
          ao-data catalog · item names and identifiers
        </a>
        <span>Albion render service · item icons</span>
      </div>
    </Panel>
  );
}
interface Screen {
  id: string;
  name: string;
  selected: string;
  city: string;
  server: Settings['region'];
  view: string;
  timeframe: string;
}
export function SavedScreens(
  p: ViewProps & {
    setSettings: (s: Settings) => void;
    setView: (s: string) => void;
  },
) {
  const [screens, setScreens] = useState<Screen[]>([]),
    [name, setName] = useState('');
  useEffect(() => setScreens(readLocal('amt:screens', [])), []);
  function save() {
    const next = [
      ...screens,
      {
        id: crypto.randomUUID(),
        name: name.trim(),
        selected: p.selected,
        city: p.settings.city,
        server: p.settings.region,
        view: 'Item Explorer',
        timeframe:
          new URLSearchParams(location.search).get('timeframe') || '30D',
      },
    ];
    setScreens(next);
    writeLocal('amt:screens', next);
    setName('');
  }
  return (
    <Panel title="Saved screens" tag="LOCAL">
      <div className="toolbar">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-label="Screen name"
          placeholder="e.g. Tin markets"
        />
        <button disabled={!name.trim()} onClick={save}>
          <Plus size={14} /> Save current item screen
        </button>
        <span className="muted">
          {p.item(p.selected).name} · {p.settings.city} · {p.settings.region}
        </span>
      </div>
      {!screens.length ? (
        <Empty
          text="Keep your most useful market views"
          detail="Save the selected item, city, region, and timeframe for quick access."
        />
      ) : (
        <div className="saved-grid">
          {screens.map((s) => (
            <div className="saved-card" key={s.id}>
              <strong>{s.name}</strong>
              <small>
                {p.item(s.selected).name}
                <br />
                {s.city} · {s.server} · {s.timeframe}
              </small>
              <button
                onClick={() => {
                  const query = new URLSearchParams({
                    item: s.selected,
                    city: s.city,
                    server: s.server,
                    timeframe: s.timeframe,
                  });
                  history.replaceState(null, '', '?' + query);
                  p.setSettings({
                    ...p.settings,
                    city: s.city,
                    region: s.server,
                  });
                  p.openItem(s.selected);
                }}
              >
                Open screen
              </button>
              <button
                className="quiet"
                onClick={() => {
                  const next = screens.filter((x) => x.id !== s.id);
                  setScreens(next);
                  writeLocal('amt:screens', next);
                }}
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}
