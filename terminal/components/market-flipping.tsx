'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import upgrades from '@/data/upgrades.json';
import { scanFlips } from '@/lib/market/flipping';
import { marketRequest, readLocal, writeLocal } from '@/lib/market/client';
import {
  CITIES,
  type Item,
  type Quote,
  type Settings,
} from '@/lib/market/types';
import {
  Panel,
  Toggle,
  NumberField,
  SelectBox,
  MarketTable,
  Num,
  ItemLabel,
  ExportButton,
  Stat,
} from './market-ui';

export function MarketFlipping({
  catalog,
  settings,
}: {
  catalog: Item[];
  settings: Settings;
}) {
  const [tiers, setTiers] = useState([4]);
  const [qualities, setQualities] = useState([1]);
  const [cities, setCities] = useState<string[]>(CITIES);
  const [direct, setDirect] = useState(true),
    [upgrade, setUpgrade] = useState(true);
  const [listing, setListing] = useState(false),
    [tax, setTax] = useState(settings.tax),
    [setup, setSetup] = useState(settings.setupFee);
  const [maxAge, setMaxAge] = useState(3600000),
    [minimum, setMinimum] = useState(0);
  const [search, setSearch] = useState(''),
    [sort, setSort] = useState('profit');
  const [quotes, setQuotes] = useState<Quote[]>([]),
    [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(
      'Choose your scan filters, then fetch flips.',
    ),
    [errors, setErrors] = useState<string[]>([]);
  const [saved, setSaved] = useState<string[]>([]),
    [savedOnly, setSavedOnly] = useState(false);
  const [selected, setSelected] = useState(''),
    [quantity, setQuantity] = useState(1),
    [travel, setTravel] = useState(0);
  const ticket = useRef(0),
    running = useRef(false);
  useEffect(() => {
    setSaved(readLocal('amp:flips:saved:' + settings.region, []));
    return () => {
      // Invalidate the current scan, not the generation captured at mount.
      // oxlint-disable-next-line react-hooks/exhaustive-deps
      ticket.current++;
    };
  }, [settings.region]);
  const candidates = useMemo(
    () =>
      catalog.filter(
        (i) =>
          tiers.includes(i.tier) &&
          (i.category === 'Weapon' ||
            i.category === 'Armor' ||
            /^T[4-8]_(BAG|CAPE)(?:_|@|$)/.test(i.id)),
      ),
    [catalog, tiers],
  );
  const itemIds = useMemo(
    () => new Set(candidates.map((i) => i.id)),
    [candidates],
  );
  const names = useMemo(
    () => new Map(catalog.map((i) => [i.id, i])),
    [catalog],
  );
  const rows = useMemo(
    () =>
      scanFlips(quotes, upgrades.upgrades, {
        cities,
        tax,
        setup,
        maxAge,
        direct,
        upgrade,
        listing,
      })
        .filter(
          (r) =>
            itemIds.has(r.item) &&
            qualities.includes(r.quality) &&
            r.profit >= minimum &&
            (!savedOnly || saved.includes(r.key)) &&
            `${names.get(r.item)?.name || ''} ${r.item}`
              .toLowerCase()
              .includes(search.toLowerCase()),
        )
        .sort((a, b) =>
          sort === 'margin'
            ? b.margin - a.margin
            : sort === 'age'
              ? a.quoteAge - b.quoteAge
              : b.profit - a.profit,
        ),
    [
      quotes,
      cities,
      tax,
      setup,
      maxAge,
      direct,
      upgrade,
      listing,
      itemIds,
      qualities,
      minimum,
      savedOnly,
      saved,
      names,
      search,
      sort,
    ],
  );
  const chosen = rows.find((r) => r.key === selected);
  const toggle = <T,>(values: T[], value: T) =>
    values.includes(value)
      ? values.filter((x) => x !== value)
      : [...values, value];
  async function scan() {
    if (running.current) return;
    running.current = true;
    const generation = ++ticket.current;
    setBusy(true);
    setQuotes([]);
    setErrors([]);
    setSelected('');
    const groups = qualities.map((quality) => ({ quality, ids: [...itemIds] }));
    if (upgrade) {
      const materials = [
        ...new Set(
          upgrades.upgrades
            .filter((u) => itemIds.has(u.to))
            .flatMap((u) => u.inputs.map((i) => i.item)),
        ),
      ];
      const normal = groups.find((g) => g.quality === 1);
      if (normal) normal.ids.push(...materials);
      else groups.push({ quality: 1, ids: materials });
    }
    const batches = groups.flatMap((g) =>
      Array.from({ length: Math.ceil(g.ids.length / 60) }, (_, index) => ({
        quality: g.quality,
        ids: g.ids.slice(index * 60, index * 60 + 60),
      })),
    );
    let completed = 0,
      failed = 0;
    for (const batch of batches) {
      if (ticket.current !== generation) break;
      setStatus(
        `Fetching batch ${completed + 1} of ${batches.length}. Results appear as batches arrive.`,
      );
      try {
        const result = await marketRequest<Quote[]>(
          new URLSearchParams({
            server: settings.region,
            quality: String(batch.quality),
            items: batch.ids.join(','),
          }).toString(),
        );
        if (ticket.current !== generation) break;
        setQuotes((old) => [...old, ...result.data]);
        if (result.error) {
          failed++;
          setErrors((old) => [...new Set([...old, result.error!])]);
        }
      } catch (error) {
        if (ticket.current !== generation) break;
        failed++;
        setErrors((old) => [
          ...new Set([
            ...old,
            error instanceof Error ? error.message : 'Source unavailable',
          ]),
        ]);
      }
      completed++;
    }
    if (ticket.current === generation)
      setStatus(
        `Scan finished: ${completed}/${batches.length} batches; ${failed} failed or used saved data. ${candidates.length} item variants selected. Checked ${new Date().toLocaleTimeString()}.`,
      );
    running.current = false;
    setBusy(false);
  }
  function save(key: string) {
    const next = toggle(saved, key);
    setSaved(next);
    writeLocal('amp:flips:saved:' + settings.region, next);
  }
  return (
    <>
      <Panel title="Market Flipping" tag="DIRECT & ENCHANTMENT UPGRADES">
        <p className="settings-help">
          Scan equipment, bags and capes across cities. Buy from a sell offer,
          optionally enchant the item, then sell to a buy order or compare a
          planned sell listing. All prices are observations; order quantities
          and guaranteed fills are unavailable.
        </p>
        <fieldset disabled={busy} className="flip-scan-controls">
          <legend>Scan filters</legend>
          <div className="toolbar">
            <Toggle checked={direct} onChange={setDirect}>
              Direct flips
            </Toggle>
            <Toggle checked={upgrade} onChange={setUpgrade}>
              Upgrade flips
            </Toggle>
          </div>
          <div className="toolbar">
            Tiers{' '}
            {[4, 5, 6, 7, 8].map((t) => (
              <Toggle
                key={t}
                checked={tiers.includes(t)}
                onChange={() => setTiers(toggle(tiers, t))}
              >
                T{t}
              </Toggle>
            ))}
          </div>
          <div className="toolbar">
            Quality{' '}
            {['Normal', 'Good', 'Outstanding', 'Excellent', 'Masterpiece'].map(
              (name, index) => (
                <Toggle
                  key={name}
                  checked={qualities.includes(index + 1)}
                  onChange={() => setQualities(toggle(qualities, index + 1))}
                >
                  {name}
                </Toggle>
              ),
            )}
          </div>
          <div className="toolbar">
            Locations{' '}
            {CITIES.map((city) => (
              <Toggle
                key={city}
                checked={cities.includes(city)}
                onChange={() => setCities(toggle(cities, city))}
              >
                {city}
              </Toggle>
            ))}
          </div>
        </fieldset>
        <div className="form-grid">
          <SelectBox
            label="Sale method"
            value={listing ? 'listing' : 'instant'}
            onChange={(v) => setListing(v === 'listing')}
            options={[
              { value: 'instant', label: 'Sell to existing buy orders' },
              { value: 'listing', label: 'Plan a sell listing (may not fill)' },
            ]}
          />
          <SelectBox
            label="Maximum observation age"
            value={String(maxAge)}
            onChange={(v) => setMaxAge(Number(v))}
            options={[
              { value: '600000', label: 'Up to 10 minutes old' },
              { value: '3600000', label: 'Up to 1 hour old' },
              { value: '21600000', label: 'Up to 6 hours old' },
              { value: '86400000', label: 'Up to 24 hours old' },
            ]}
          />
          <NumberField
            label="Sales tax % — use your in-game rate"
            value={tax}
            onChange={setTax}
            max={50}
            step={0.1}
          />
          {listing && (
            <NumberField
              label="Sell order setup fee %"
              value={setup}
              onChange={setSetup}
              max={49}
              step={0.1}
            />
          )}
        </div>
        <div className="form-actions">
          <button
            disabled={
              busy ||
              !tiers.length ||
              !qualities.length ||
              !cities.length ||
              (!direct && !upgrade) ||
              !candidates.length
            }
            onClick={() => void scan()}
          >
            Fetch flips · {candidates.length.toLocaleString()} item variants
          </button>
          {busy && (
            <button
              onClick={() => {
                ticket.current++;
                setStatus('Stopped. Completed batches remain available.');
              }}
            >
              Stop scan
            </button>
          )}
        </div>
        <output className="settings-help">{status}</output>
        {errors.length > 0 && (
          <p className="danger-note">
            {errors.join('; ')} — results are incomplete; check observation
            ages.
          </p>
        )}
      </Panel>
      <Panel
        title="Flip opportunities"
        tag={`${rows.length.toLocaleString()} MATCHES`}
        actions={
          <ExportButton
            rows={rows.slice(0, 1000).map((r) => ({
              ...r,
              inputs: JSON.stringify(r.inputs),
              server: settings.region,
              sale_method:
                listing && r.sellCity !== 'Black Market'
                  ? 'planned listing'
                  : 'existing buy order',
            }))}
          />
        }
      >
        <div className="toolbar">
          <input
            aria-label="Search flips by name"
            placeholder="Search items…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <SelectBox
            label="Sort flips"
            value={sort}
            onChange={setSort}
            options={[
              { value: 'profit', label: 'Highest profit per item' },
              { value: 'margin', label: 'Highest return on cost' },
              { value: 'age', label: 'Newest observations' },
            ]}
          />
          <Toggle checked={savedOnly} onChange={setSavedOnly}>
            Saved trades
          </Toggle>
          <NumberField
            label="Minimum profit per item"
            value={minimum}
            onChange={setMinimum}
          />
        </div>
        <MarketTable
          rows={rows.slice(0, 1000)}
          rowKey={(r) => r.key}
          limit={20}
          columns={[
            {
              label: 'ITEM / TYPE',
              render: (r) => (
                <>
                  <ItemLabel item={names.get(r.item)!} />
                  <small>
                    {r.type} · quality {r.quality}
                    {r.type === 'Upgrade' &&
                      ` · from ${names.get(r.from)?.name || r.from}`}
                  </small>
                </>
              ),
            },
            {
              label: 'BUY / UPGRADE COST',
              render: (r) => (
                <>
                  {r.buyCity}
                  <br />
                  <Num value={r.cost} />
                </>
              ),
            },
            {
              label: 'SELL',
              render: (r) => (
                <>
                  {r.sellCity}
                  <br />
                  <Num value={r.sell} />
                </>
              ),
            },
            {
              label: 'PROFIT / ITEM',
              render: (r) => (
                <span className="positive">
                  <Num value={r.profit} />
                </span>
              ),
            },
            {
              label: 'RETURN ON COST',
              render: (r) => `${r.margin.toFixed(1)}%`,
            },
            {
              label: 'OLDEST INPUT',
              render: (r) => `${Math.floor(r.quoteAge / 60000)}m ago`,
            },
            {
              label: 'PLAN',
              render: (r) => (
                <>
                  <button onClick={() => setSelected(r.key)}>Calculate</button>
                  <button onClick={() => save(r.key)}>
                    {saved.includes(r.key) ? 'Unsave' : 'Save'}
                  </button>
                </>
              ),
            },
          ]}
        />
        <p className="settings-help">
          Showing up to 1,000 matches. Upgrade materials are bought in the
          purchase city at normal quality. Only cataloged .0 → .1 → .2 → .3
          upgrade paths are used; no .4 upgrades are assumed. Black Market sales
          always use buy orders. Profit excludes travel and relisting costs
          until you enter them below.
        </p>
      </Panel>
      {chosen && (
        <Panel
          title="Calculate this flip"
          tag={names.get(chosen.item)?.name || chosen.item}
        >
          <div className="form-grid">
            <NumberField
              label="Quantity (verify available orders in game)"
              value={quantity}
              onChange={(v) => setQuantity(Math.max(1, Math.floor(v)))}
              min={1}
            />
            <NumberField
              label="Total travel and other costs"
              value={travel}
              onChange={setTravel}
            />
          </div>
          <div className="stats-grid">
            <Stat
              label="CAPITAL NEEDED"
              value={<Num value={chosen.cost * quantity + travel} />}
            />
            <Stat
              label="SALES FEES"
              value={<Num value={chosen.fees * quantity} />}
            />
            <Stat
              label="NET PROFIT"
              value={<Num value={chosen.profit * quantity - travel} />}
            />
          </div>
          <MarketTable
            rows={[
              { item: chosen.from, quantity: 1, price: chosen.buy },
              ...chosen.inputs,
            ]}
            rowKey={(r) => r.item}
            columns={[
              {
                label: 'PURCHASE',
                render: (r) => names.get(r.item)?.name || r.item,
              },
              { label: 'QUANTITY', render: (r) => r.quantity * quantity },
              { label: 'UNIT PRICE', render: (r) => <Num value={r.price} /> },
              {
                label: 'TOTAL',
                render: (r) => <Num value={r.price * r.quantity * quantity} />,
              },
            ]}
          />
          <p className="settings-help">
            Upgrade recipe source:{' '}
            <a href={upgrades.source} target="_blank" rel="noreferrer">
              ao-data game files
            </a>
            , retrieved {upgrades.retrievedAt}. Confirm material quantities and
            costs in game before buying.
          </p>
        </Panel>
      )}
    </>
  );
}
