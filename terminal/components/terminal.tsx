'use client';
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Activity,
  LayoutDashboard,
  Star,
  Search,
  Globe,
  ArrowLeftRight,
  Pickaxe,
  Hammer,
  Flame,
  Truck,
  ChartNoAxesCombined,
  TrendingUp,
  Layers,
  Coins,
  Bookmark,
  Settings as SettingsIcon,
  RefreshCw,
  Command as CommandIcon,
  ChevronRight,
  ShieldCheck,
  PanelTop,
  Plus,
} from 'lucide-react';
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import {
  CommandDialog,
  Command,
  CommandInput,
  CommandList,
  CommandGroup,
  CommandItem,
  CommandEmpty,
} from '@/components/ui/command';
import { PriceChart } from './price-chart';
import { MarketSparklines } from './market-sparklines';
import {
  ItemAnalysis,
  ArbitrageScanner,
  CityMarkets,
  Heatmap,
  Movers,
} from './market-views';
import {
  Gathering,
  Transport,
  Production,
  GoldEstimator,
} from './economy-tools';
import {
  usePersonalTools,
  Watchlists,
  SettingsView,
  SavedScreens,
} from './personal-tools';
import {
  DEFAULT_SETTINGS,
  CITIES,
  type Settings,
  type Quote,
  type Item,
} from '@/lib/market/types';
import {
  DEFAULT_ITEMS,
  SEED_ITEMS,
  makeItem,
  searchItems,
} from '@/lib/market/metadata';
import { marketRequest, readLocal, writeLocal } from '@/lib/market/client';
import { age, arbitrage, valid } from '@/lib/market/analytics';
import {
  SelectBox,
  Num,
  FreshnessBadge,
  CityBadge,
  ItemLabel,
  Panel,
  Stat,
  Empty,
  MarketTable,
  ExportButton,
} from './market-ui';
const NAV = [
  ['Market Overview', LayoutDashboard],
  ['Watchlist', Star],
  ['Item Explorer', Search],
  ['City Markets', Globe],
  ['Arbitrage Scanner', ArrowLeftRight],
  ['Gathering', Pickaxe],
  ['Crafting', Hammer],
  ['Refining', Flame],
  ['Transport', Truck],
  ['Price History', ChartNoAxesCombined],
  ['Movers', TrendingUp],
  ['Liquidity', Layers],
  ['Gold', Coins],
  ['Heatmap', PanelTop],
  ['Saved Screens', Bookmark],
  ['Settings', SettingsIcon],
] as const;
export default function Terminal() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [ready, setReady] = useState(false);
  const [view, setView] = useState('Market Overview');
  const [selected, setSelected] = useState('T3_ORE');
  const [catalog, setCatalog] = useState<Item[]>(SEED_ITEMS);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [cached, setCached] = useState(false);
  const [last, setLast] = useState('');
  const [now, setNow] = useState(Date.now());
  const [palette, setPalette] = useState(false);
  const [search, setSearch] = useState('');
  const generation = useRef(0);
  const [toast, setToast] = useState('');
  const [previous, setPrevious] = useState<Quote[]>([]);
  const notify = useCallback((message: string) => {
    setToast(message);
    setTimeout(() => setToast(''), 5000);
  }, []);
  const [tracked, setTracked] = useState(DEFAULT_ITEMS);
  const itemMap = useMemo(
    () => new Map(catalog.map((i) => [i.id, i])),
    [catalog],
  );
  const item = (id: string) => itemMap.get(id) || makeItem(id);
  const ids = useMemo(
    () => [...new Set([...tracked, selected])].sort().join(','),
    [tracked, selected],
  );
  useEffect(() => {
    const p = new URLSearchParams(location.search);
    const saved = readLocal<Settings>('amt:settings', DEFAULT_SETTINGS);
    setSettings({
      ...DEFAULT_SETTINGS,
      ...saved,
      ...(['americas', 'europe', 'asia'].includes(p.get('server') || '')
        ? { region: p.get('server') as Settings['region'] }
        : {}),
      ...(CITIES.includes(p.get('city') || '') ? { city: p.get('city')! } : {}),
    });
    if (/^T\d_[A-Z0-9_]+(?:@[1-4])?$/.test(p.get('item') || '')) {
      setSelected(p.get('item')!);
      setView('Item Explorer');
    }
    if(NAV.some(([name])=>name===p.get('view')))setView(p.get('view')!);
    setTracked(readLocal('amt:tracked', DEFAULT_ITEMS));
    setReady(true);
    fetch('/api/items')
      .then((r) => r.json() as Promise<{ items: Item[] }>)
      .then((r) => {
        if (r.items?.length) setCatalog(r.items);
      })
      .catch(() => {});
  }, []);
  useEffect(() => {
    if (ready) {
      writeLocal('amt:settings', settings);
      writeLocal('amt:tracked', tracked);
      const p = new URLSearchParams(location.search);
      p.set('item', selected);
      p.set('city', settings.city);
      p.set('server', settings.region);
      p.set('view',view);
      history.replaceState(null, '', '?' + p.toString());
    }
  }, [ready, settings, selected, tracked,view]);
  const refresh = useCallback(async () => {
    const ticket = ++generation.current;
    setBusy(true);
    try {
      const chunks = ids.split(',').reduce<string[][]>((all, id, i) => {
        (all[Math.floor(i / 60)] ||= []).push(id);
        return all;
      }, []);
      const results = [];
      for (const chunk of chunks)
        results.push(
          await marketRequest<Quote[]>(
            new URLSearchParams({
              server: settings.region,
              items: chunk.join(','),
              quality: String(settings.quality),
            }).toString(),
          ),
        );
      if (ticket !== generation.current) return;
      const next = results.flatMap((r) => r.data);
      const snapshotKey =
        'amt:snapshot:' + settings.region + ':' + settings.quality;
      const prev = readLocal<Quote[]>(snapshotKey, []);
      const baselineKey = snapshotKey + ':baseline';
      const baselines = readLocal<Quote[]>(baselineKey, []);
      const keyOf=(q:Quote)=>q.item_id+':'+q.city+':'+q.quality;
      const previousMap=new Map(prev.map(q=>[keyOf(q),q]));
      const baselineIndexes=new Map(baselines.map((q,i)=>[keyOf(q),i]));
      for (const q of next) {
        const old = previousMap.get(keyOf(q));
        if (old && old.sell_price_min_date !== q.sell_price_min_date) {
          const i = baselineIndexes.get(keyOf(q))??-1;
          if (i >= 0) baselines[i] = old;
          else baselines.push(old);
        }
      }
      setPrevious(baselines);
      writeLocal(baselineKey, baselines);
      writeLocal(snapshotKey, next);
      setQuotes(next);
      setCached(results.some((r) => r.cached));
      setError(
        results
          .map((r) => r.error)
          .filter(Boolean)
          .join('; '),
      );
      setLast(results.map((r) => r.fetchedAt).sort()[0] || '');
    } catch (e) {
      if (ticket === generation.current)
        setError(e instanceof Error ? e.message : 'Source unavailable');
    } finally {
      if (ticket === generation.current) setBusy(false);
    }
  }, [ids, settings.region, settings.quality]);
  useEffect(() => {
    if (!ready) return;
    const key='amt:snapshot:'+settings.region+':'+settings.quality;
    setQuotes(readLocal<Quote[]>(key,[]));
    setPrevious(readLocal<Quote[]>(key+':baseline',[]));
    setLast('');
    setCached(true);
    setError('');
  }, [ready, settings.region, settings.quality]);
  useEffect(() => {
    if (!ready) return;
    void refresh();
    const timer = setInterval(() => {
      if (!document.hidden) void refresh();
    }, Math.max(settings.interval,Math.ceil(ids.split(',').length/60)*1500));
    return () => {
      clearInterval(timer);
      generation.current++;
    };
  }, [ready, refresh, settings.interval]);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 10000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setPalette((x) => !x);
        return;
      }
      if (/INPUT|TEXTAREA|SELECT/.test((e.target as HTMLElement).tagName))
        return;
      if (e.key === '/') {
        e.preventDefault();
        setPalette(true);
      }
      if (e.key.toLowerCase() === 'r') void refresh();
      if (e.key.toLowerCase() === 'w') setView('Watchlist');
      if (e.key.toLowerCase() === 'a') setView('Arbitrage Scanner');
      if (e.key.toLowerCase() === 'g') setView('Gathering');
      if (e.key === 'Escape') setPalette(false);
    };
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, [refresh]);
  const eligible = useMemo(
    () =>
      quotes.filter((q) => valid(q, 'sell', settings.maxAge || Infinity, now)),
    [quotes, settings.maxAge, now],
  );
  const routes = useMemo(
    () => arbitrage(quotes, settings.tax, settings.maxAge || Infinity, now),
    [quotes, settings.tax, settings.maxAge, now],
  );
  const fresh = quotes.filter(
    (q) => q.sell_price_min > 0 && age(q.sell_price_min_date, now) < 600000,
  ).length;
  const observed = quotes.filter((q) => q.sell_price_min > 0).length;
  const openItem = (id: string) => {
    setSelected(id);
    setView('Item Explorer');
    setPalette(false);
  };
  const results = useMemo(
    () => searchItems(catalog, search),
    [catalog, search],
  );
  const viewProps = {
    quotes,
    settings,
    now,
    item,
    selected,
    openItem,
    tracked,
    setTracked,
    notify,
  };
  const personal = usePersonalTools(viewProps);
  const addWatch = (id: string) => {
    setTracked((t) => [...new Set([...t, id])]);
    personal.setWatchlists((w) =>
      w.map((list, i) =>
        i === 0 ? { ...list, items: [...new Set([...list.items, id])] } : list,
      ),
    );
    notify(item(id).name + ' added to watchlist.');
  };
  useEffect(() => {
    const context = (
      document as Document & {
        modelContext?: {
          registerTool: (
            tool: unknown,
            options: { signal: AbortSignal },
          ) => void;
        };
      }
    ).modelContext;
    if (!context) return;
    const controller = new AbortController();
    try {
      context.registerTool(
        {
          name: 'open_market_item',
          description:
            'Open an Albion item analysis screen. Changes the selected item.',
          inputSchema: {
            type: 'object',
            properties: { itemId: { type: 'string' } },
            required: ['itemId'],
            additionalProperties: false,
          },
          annotations: { readOnlyHint: false },
          execute: (input: unknown) => {
            const id = (input as { itemId?: string })?.itemId;
            if (!id || !/^T\d_[A-Z0-9_]+(?:@[1-4])?$/.test(id))
              throw new Error('Invalid item ID');
            setSelected(id);
            setView('Item Explorer');
            return { selectedItem: id, view: 'Item Explorer' };
          },
        },
        { signal: controller.signal },
      );
    } catch {
      /* Experimental WebMCP is optional. */
    }
    return () => controller.abort();
  }, []);
  return (
    <SidebarProvider
      style={{ '--sidebar-width': '212px' } as React.CSSProperties}
    >
      <Sidebar className="terminal-sidebar">
        <SidebarHeader>
          <button className="brand" onClick={() => setView('Market Overview')}>
            <span className="brand-mark">
              <Activity size={23} />
            </span>
            <span>
              ALBION<span>MARKET TERMINAL</span>
            </span>
          </button>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>WORKSPACE</SidebarGroupLabel>
            <SidebarMenu>
              {NAV.map(([name, Icon], i) => (
                <SidebarMenuItem key={name}>
                  {i === 5 && <div className="nav-label">ECONOMY TOOLS</div>}
                  {i === 9 && <div className="nav-label">INTELLIGENCE</div>}
                  <SidebarMenuButton
                    isActive={view === name}
                    onClick={() => setView(name)}
                  >
                    <Icon />
                    <span>{name}</span>
                    {name === 'Arbitrage Scanner' && routes.length > 0 && (
                      <b className="nav-count">{routes.length}</b>
                    )}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <div className="sidebar-note">
            <ShieldCheck size={16} />
            <span>
              Public market intelligence
              <small>Powered by Albion Data Project</small>
            </span>
          </div>
          <button className="command-hint" onClick={() => setPalette(true)}>
            <CommandIcon size={14} /> Command palette <kbd>⌘ K</kbd>
          </button>
        </SidebarFooter>
      </Sidebar>
      <div className={`terminal-main ${settings.density}`}>
        <header className="topbar">
          <SidebarTrigger />
          <span className="workspace-label">
            TERMINAL <ChevronRight size={12} />
          </span>
          <SelectBox
            label="Server"
            value={settings.region}
            onChange={(region) =>
              setSettings((s) => ({
                ...s,
                region: region as Settings['region'],
              }))
            }
            options={[
              { value: 'americas', label: 'Americas' },
              { value: 'europe', label: 'Europe' },
              { value: 'asia', label: 'Asia' },
            ]}
          />
          <button
            className="global-search"
            onClick={() => {
              setSearch('');
              setPalette(true);
            }}
          >
            <Search size={15} />
            <span>Search items, cities, commands...</span>
            <kbd>/</kbd>
          </button>
          <div className={`api-status ${error ? 'amber' : 'positive'}`}>
            <i />
            {busy
              ? 'Refreshing'
              : error
                ? 'API degraded'
                : last
                  ? 'API connected'
                  : 'Connecting'}
          </div>
          <SelectBox
            label="Refresh interval"
            value={String(settings.interval)}
            onChange={(v) =>
              setSettings((s) => ({ ...s, interval: Number(v) }))
            }
            options={[
              { value: '5000', label: '5s' },
              { value: '10000', label: '10s' },
              { value: '30000', label: '30s' },
              { value: '60000', label: '1m' },
              { value: '300000', label: '5m' },
            ]}
          />
          <button
            className="icon-button"
            title="Refresh (R)"
            disabled={busy}
            onClick={() => void refresh()}
          >
            <RefreshCw size={16} className={busy ? 'spin' : ''} />
          </button>
          <button
            className="icon-button"
            title="Settings"
            onClick={() => setView('Settings')}
          >
            <SettingsIcon size={16} />
          </button>
        </header>
        <div className="ticker">
          {DEFAULT_ITEMS.slice(0, 7).map((id) => {
            const best = eligible
              .filter((q) => q.item_id === id)
              .sort((a, b) => a.sell_price_min - b.sell_price_min)[0];
            return (
              <button key={id} onClick={() => openItem(id)}>
                <span>{item(id).name}</span>
                <strong>
                  <Num value={best?.sell_price_min} />
                </strong>
                <small>{best?.city || 'No quote'}</small>
                <FreshnessBadge
                  date={best?.sell_price_min_date}
                  now={now}
                  compact
                />
              </button>
            );
          })}
        </div>
        <main className="workspace">
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                MARKET INTELLIGENCE{' '}
                <span>/ {settings.region.toUpperCase()}</span>
              </div>
              <h1>
                {view}
                <span className="live-label">PUBLIC DATA</span>
              </h1>
              <p>Every opportunity starts with a better view of the market.</p>
            </div>
            <div className="heading-actions">
              <span className="last-update">
                Last successful fetch
                <br />
                <b>
                  {last
                    ? new Date(last).toLocaleTimeString()
                    : 'Awaiting source'}{' '}
                  {cached && '· cached'}
                </b>
              </span>
              <button onClick={() => setView('Watchlist')}>
                <Plus size={14} /> Watchlist
              </button>
            </div>
          </div>
          {error && (
            <div className="notice amber">
              {error}{' '}
              {quotes.length
                ? 'Last known observations retained; check quote ages.'
                : 'No market values are being substituted.'}
              <button onClick={() => void refresh()}>Retry</button>
            </div>
          )}
          {['Market Overview', 'Item Explorer', 'Price History'].includes(
            view,
          ) && (
            <>
              <div className="instrument-tabs">
                {tracked.slice(0, 7).map((id) => (
                  <button
                    className={selected === id ? 'active' : ''}
                    key={id}
                    onClick={() => setSelected(id)}
                  >
                    {item(id).name}
                    <Num
                      value={
                        eligible
                          .filter((q) => q.item_id === id)
                          .sort(
                            (a, b) => a.sell_price_min - b.sell_price_min,
                          )[0]?.sell_price_min
                      }
                    />
                  </button>
                ))}
              </div>
              <div className="finance-grid">
                <PriceChart
                  key={selected + settings.region + view}
                  item={item(selected)}
                  quotes={quotes}
                  settings={settings}
                  now={now}
                  onWatch={addWatch}
                />
                <Panel title="Quote summary" tag="SELECTED ITEM">
                  <div className="quote-facts">
                    {(() => {
                      const qs = eligible.filter((q) => q.item_id === selected);
                      const ask = qs.toSorted(
                        (a, b) => a.sell_price_min - b.sell_price_min,
                      )[0];
                      const bid = quotes
                        .filter(
                          (q) =>
                            q.item_id === selected &&
                            valid(q, 'buy', settings.maxAge || Infinity, now),
                        )
                        .sort((a, b) => b.buy_price_max - a.buy_price_max)[0];
                      return (
                        <>
                          <div>
                            <span>Best ask</span>
                            <Num value={ask?.sell_price_min} />
                          </div>
                          <div>
                            <span>Buy in</span>
                            {ask ? (
                              <CityBadge city={ask.city} />
                            ) : (
                              <span>—</span>
                            )}
                          </div>
                          <div>
                            <span>Ask observed</span>
                            <FreshnessBadge
                              date={ask?.sell_price_min_date}
                              now={now}
                            />
                          </div>
                          <div>
                            <span>Best bid</span>
                            <Num value={bid?.buy_price_max} />
                          </div>
                          <div>
                            <span>Sell in</span>
                            {bid ? (
                              <CityBadge city={bid.city} />
                            ) : (
                              <span>—</span>
                            )}
                          </div>
                          <div>
                            <span>Bid observed</span>
                            <FreshnessBadge
                              date={bid?.buy_price_max_date}
                              now={now}
                            />
                          </div>
                          <div>
                            <span>Cross-city spread</span>
                            <Num
                              value={
                                ask && bid
                                  ? bid.buy_price_max - ask.sell_price_min
                                  : null
                              }
                            />
                          </div>
                          <div>
                            <span>Eligible ask cities</span>
                            <span>{qs.length} / 8</span>
                          </div>
                          <div>
                            <span>Quality</span>
                            <span>{settings.quality}</span>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                  <p className="footnote">
                    A price is an observation, not a promise. Compare the age of
                    both sides before trading.
                  </p>
                  <div className="form-actions">
                    <button onClick={() => addWatch(selected)}>
                      <Star size={13} /> Add to watchlist
                    </button>
                  </div>
                </Panel>
              </div>
            </>
          )}
          {view === 'Item Explorer' && <ItemAnalysis {...viewProps} />}
          {view === 'Price History' && <ItemAnalysis {...viewProps} />}
          {view === 'Arbitrage Scanner' && <ArbitrageScanner {...viewProps} />}
          {view === 'City Markets' && <CityMarkets {...viewProps} />}
          {view === 'Gathering' && <Gathering {...viewProps} />}
          {view === 'Transport' && <Transport {...viewProps} />}
          {view === 'Crafting' && <Production {...viewProps} />}
          {view === 'Refining' && <Production {...viewProps} refining />}
          {view === 'Movers' && <Movers {...viewProps} previous={previous} />}
          {view === 'Liquidity' && (
            <Movers {...viewProps} previous={previous} liquidity />
          )}
          {view === 'Heatmap' && <Heatmap {...viewProps} />}
          {view === 'Watchlist' && (
            <Watchlists {...viewProps} personal={personal} />
          )}
          {view === 'Settings' && (
            <SettingsView
              settings={settings}
              setSettings={setSettings}
              notify={notify}
            />
          )}
          {view === 'Saved Screens' && (
            <SavedScreens
              {...viewProps}
              setSettings={setSettings}
              setView={setView}
            />
          )}
          {view === 'Gold' && (
            <>
              <PriceChart
                item={item(selected)}
                quotes={quotes}
                settings={settings}
                now={now}
                gold
              />
              <GoldEstimator settings={settings} />
            </>
          )}
          {view === 'Market Overview' && (
            <>
              <MarketSparklines {...viewProps}/>
              <div className="stats-grid">
                <Stat
                  label="TRACKED ITEMS"
                  value={ids.split(',').length}
                  note="Across 8 market locations"
                />
                <Stat
                  label="FRESH SELL QUOTES"
                  value={<Num value={fresh} />}
                  note={
                    <span className="positive">
                      ● Observed within 10 minutes
                    </span>
                  }
                />
                <Stat
                  label="STALE SELL QUOTES"
                  value={
                    observed ? (
                      <Num
                        value={((observed - fresh) / observed) * 100}
                        suffix="%"
                      />
                    ) : (
                      '—'
                    )
                  }
                  note="10 minutes or older"
                  tone="amber"
                />
                <Stat
                  label="ARBITRAGE ROUTES"
                  value={routes.length}
                  note="After configured market tax"
                  tone="positive"
                />
              </div>
              <div className="overview-grid">
                <Panel
                  title="Market watch"
                  tag={`${tracked.length} ITEMS`}
                  actions={
                    <ExportButton
                      rows={eligible.map((q) => ({
                        ...q,
                        source: 'Albion Online Data Project',
                        cached,
                      }))}
                    />
                  }
                >
                  <MarketTable
                    rows={tracked.map((id) => ({
                      id,
                      q: eligible
                        .filter((q) => q.item_id === id)
                        .sort((a, b) => a.sell_price_min - b.sell_price_min)[0],
                    }))}
                    rowKey={(r) => r.id}
                    columns={[
                      {
                        label: 'ITEM',
                        render: (r) => (
                          <ItemLabel
                            item={item(r.id)}
                            onClick={() => openItem(r.id)}
                          />
                        ),
                      },
                      {
                        label: 'BEST ASK',
                        render: (r) => (
                          <Num
                            value={r.q?.sell_price_min}
                            exact={settings.exact}
                          />
                        ),
                      },
                      {
                        label: 'MARKET',
                        render: (r) =>
                          r.q ? (
                            <CityBadge city={r.q.city} />
                          ) : (
                            <span className="muted">Awaiting quote</span>
                          ),
                      },
                      {
                        label: 'FRESHNESS',
                        render: (r) => (
                          <FreshnessBadge
                            date={r.q?.sell_price_min_date}
                            now={now}
                          />
                        ),
                      },
                    ]}
                    limit={10}
                  />
                </Panel>
                <Panel title="Market pulse" tag="DATA QUALITY">
                  <div className="pulse-head">
                    <Activity size={20} />
                    <span>
                      Observation coverage
                      <strong>{observed} sell quotes</strong>
                    </span>
                  </div>
                  {CITIES.map((city) => {
                    const cityQuotes = quotes.filter(
                      (q) => q.city === city && q.sell_price_min > 0,
                    );
                    const count = cityQuotes.filter(
                      (q) => age(q.sell_price_min_date, now) < 600000,
                    ).length;
                    return (
                      <div className="city-health" key={city}>
                        <div>
                          <CityBadge city={city} />
                          <span>
                            {count}
                            <small> / {cityQuotes.length} fresh</small>
                          </span>
                        </div>
                        <div className="bar">
                          <i
                            style={{
                              width: `${cityQuotes.length ? (count / cityQuotes.length) * 100 : 0}%`,
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                  <p className="footnote">
                    Freshness reflects when a player observed an order, not when
                    this terminal fetched it.
                  </p>
                </Panel>
              </div>
              <Panel
                title="Cross-city opportunities"
                tag="EXECUTABLE SPREAD"
                actions={
                  <button
                    className="quiet"
                    onClick={() => setView('Arbitrage Scanner')}
                  >
                    Open scanner <ChevronRight size={14} />
                  </button>
                }
              >
                <MarketTable
                  rows={routes.slice(0, 5)}
                  rowKey={(r) => r.id}
                  columns={[
                    {
                      label: 'ITEM',
                      render: (r) => (
                        <ItemLabel
                          item={item(r.item)}
                          onClick={() => openItem(r.item)}
                        />
                      ),
                    },
                    {
                      label: 'BUY IN',
                      render: (r) => <CityBadge city={r.buy.city} />,
                    },
                    {
                      label: 'SELL IN',
                      render: (r) => <CityBadge city={r.sell.city} />,
                    },
                    {
                      label: 'BUY / SELL',
                      render: (r) => (
                        <>
                          <Num value={r.buy.sell_price_min} /> /{' '}
                          <Num value={r.sell.buy_price_max} />
                        </>
                      ),
                    },
                    {
                      label: 'NET / UNIT',
                      render: (r) => (
                        <span className="positive">
                          +<Num value={r.profit} />
                        </span>
                      ),
                    },
                    {
                      label: 'RETURN',
                      render: (r) => (
                        <span className="positive">
                          <Num value={r.margin} suffix="%" />
                        </span>
                      ),
                    },
                    {
                      label: 'QUOTE AGES',
                      render: (r) => (
                        <>
                          <FreshnessBadge
                            date={r.buy.sell_price_min_date}
                            now={now}
                            compact
                          />{' '}
                          /{' '}
                          <FreshnessBadge
                            date={r.sell.buy_price_max_date}
                            now={now}
                            compact
                          />
                        </>
                      ),
                    },
                  ]}
                />
              </Panel>
              <div className="two-column">
                <Movers {...viewProps} previous={previous} />
                <Heatmap {...viewProps} />
              </div>
            </>
          )}
        </main>
        <footer className="statusbar">
          <span>
            <i className="status-dot" /> {settings.region.toUpperCase()} SERVER{' '}
            <span className="divider">|</span> AODP REST API{' '}
            <span className="divider">|</span> QUALITY {settings.quality}
          </span>
          <span>
            Prices in silver · Crowdsourced observations · No guaranteed
            execution
          </span>
        </footer>
      </div>
      {toast && (
        <div role="status" className="notification">
          {toast}
        </div>
      )}
      <CommandDialog
        open={palette}
        onOpenChange={setPalette}
        title="Terminal command palette"
        description="Search items, navigate markets, or change server."
      >
        <Command shouldFilter={false}>
          <CommandInput
            value={search}
            onValueChange={setSearch}
            placeholder="Search Tin, T4 hide, 6.1, or a command..."
          />
          <CommandList>
            <CommandEmpty>No matching items or commands.</CommandEmpty>
            <CommandGroup heading="Commands">
              {NAV.filter(([name]) =>
                name.toLowerCase().includes(search.toLowerCase()),
              ).map(([name, Icon]) => (
                <CommandItem
                  key={name}
                  onSelect={() => {
                    setView(name);
                    setPalette(false);
                  }}
                >
                  <Icon size={15} />
                  {name}
                </CommandItem>
              ))}
              {['americas', 'europe', 'asia']
                .filter((s) =>
                  ('switch server ' + s).includes(search.toLowerCase()),
                )
                .map((region) => (
                  <CommandItem
                    key={region}
                    onSelect={() => {
                      setSettings((s) => ({
                        ...s,
                        region: region as Settings['region'],
                      }));
                      setPalette(false);
                    }}
                  >
                    Switch server · {region}
                  </CommandItem>
                ))}
              {'refresh'.includes(search.toLowerCase()) && (
                <CommandItem
                  onSelect={() => {
                    void refresh();
                    setPalette(false);
                  }}
                >
                  Refresh market data
                </CommandItem>
              )}
            </CommandGroup>
            <CommandGroup heading="Cities">
              {CITIES.filter((city) =>
                city.toLowerCase().includes(search.toLowerCase()),
              ).map((city) => (
                <CommandItem
                  key={city}
                  onSelect={() => {
                    setSettings((s) => ({ ...s, city }));
                    setView('City Markets');
                    setPalette(false);
                  }}
                >
                  Open {city} market
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandGroup heading="Items">
              {results.map((i) => (
                <CommandItem key={i.id} onSelect={() => openItem(i.id)}>
                  <span>{i.name}</span>
                  <small className="muted">{i.id}</small>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </CommandDialog>
    </SidebarProvider>
  );
}
