'use client';
import { useRef, useState } from 'react';
import type {
  Settings,
  Quote,
  HistorySeries,
  GoldPoint,
} from '@/lib/market/types';
import { marketRequest } from '@/lib/market/client';
import { playerRequest } from '@/lib/players/client';
import { runtime } from '@/lib/market/runtime';
import { age, ageLabel } from '@/lib/market/analytics';
import { Panel, MarketTable } from './market-ui';

type Check = { name: string; state: string; detail: string };
const references = [
  {
    name: 'Albion Online Data Project',
    url: 'https://www.albion-online-data.com/api',
    use: 'Connected: market observations, price history and gold. Updates depend on player uploads.',
  },
  {
    name: 'Albion Game Info',
    url: 'https://gameinfo.albiononline.com/api/gameinfo/search?q=Albion',
    use: 'Connected through the local server or configured relay: player statistics and guild rosters. No resource-per-hour or online-time feed.',
  },
  {
    name: 'ao-data game files',
    url: 'https://github.com/ao-data/ao-bin-dumps',
    use: 'Bundled: canonical item names, identifiers and crafting inputs. Catalog retrieval dates are available in the connection checks.',
  },
  {
    name: 'Albion Free Market',
    url: 'https://albionfreemarket.com/articles/view/albion-free-market-data-client-tutorial',
    use: 'Community reference: its upload client contributes to AODP. It does not provide an independent public price feed to this app.',
  },
  {
    name: 'Albion Online 2D',
    url: 'https://albiononline2d.com/',
    use: 'Comparison site: its market pages use AODP too. Check that region, item quality and observation time match.',
  },
  {
    name: 'Official Albion Wiki',
    url: 'https://wiki.albiononline.com/wiki/Albion_Online_Wiki',
    use: 'Reference for game mechanics. Calculator fees and return rates remain editable; wiki information is not treated as a live quote.',
  },
];

export function DataSources({
  settings,
  selected,
}: {
  settings: Settings;
  selected: string;
}) {
  const [checks, setChecks] = useState<Check[]>([]);
  const [busy, setBusy] = useState(false);
  const [checkedAt, setCheckedAt] = useState('');
  const running = useRef(false);
  async function checkConnections() {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    setChecks([]);
    const params = {
      server: settings.region,
      items: selected,
      quality: String(settings.quality),
    };
    const jobs: [string, () => Promise<Omit<Check, 'name'>>][] = [
      [
        'Market observations',
        async () => {
          const r = await marketRequest<Quote[]>(
            new URLSearchParams(params).toString(),
          );
          const usable = r.data.filter(
            (q) =>
              q.sell_price_min > 0 &&
              Number.isFinite(age(q.sell_price_min_date)),
          );
          const newest = usable.sort(
            (a, b) => age(a.sell_price_min_date) - age(b.sell_price_min_date),
          )[0];
          return {
            state: r.error
              ? 'Saved fallback'
              : r.cached
                ? 'Available · cached'
                : 'Available',
            detail:
              r.error ||
              `${usable.length} cities with dated asks. ${newest ? `Newest: ${newest.city}, ${ageLabel(newest.sell_price_min_date)} old.` : 'No dated asks for this selection.'}`,
          };
        },
      ],
      [
        'Price history',
        async () => {
          const r = await marketRequest<HistorySeries[]>(
            new URLSearchParams({
              ...params,
              kind: 'history',
              days: '7',
            }).toString(),
          );
          const count = r.data.reduce(
            (sum, series) =>
              sum + (Array.isArray(series.data) ? series.data.length : 0),
            0,
          );
          return {
            state: r.error
              ? 'Saved fallback'
              : r.cached
                ? 'Available · cached'
                : 'Available',
            detail:
              r.error ||
              `${count} history points returned for the last seven days. A successful request can still have gaps.`,
          };
        },
      ],
      [
        'Gold',
        async () => {
          const r = await marketRequest<GoldPoint[]>(
            new URLSearchParams({
              server: settings.region,
              kind: 'gold',
              days: '7',
            }).toString(),
          );
          return {
            state: r.error
              ? 'Saved fallback'
              : r.cached
                ? 'Available · cached'
                : 'Available',
            detail:
              r.error ||
              `${r.data.length} observations returned for the last seven days.`,
          };
        },
      ],
      [
        'Player and guild search',
        async () => {
          const r = await playerRequest<{
            players: unknown[];
            guilds: unknown[];
          }>(
            new URLSearchParams({
              server: settings.region,
              kind: 'search',
              q: 'Albion',
            }),
            settings.playerProxy,
          );
          return {
            state: r.error
              ? 'Saved fallback'
              : r.cached
                ? 'Available · cached'
                : 'Available',
            detail:
              r.error ||
              'Public search responded. Individual profiles may have older source statistics.',
          };
        },
      ],
      ...(['items', 'recipes'] as const).map(
        (kind): [string, () => Promise<Omit<Check, 'name'>>] => [
          kind === 'items' ? 'Item catalog' : 'Recipe catalog',
          async () => {
            const r = await fetch(
              runtime().static
                ? runtime().base + kind + '.json'
                : '/api/' + kind,
              { signal: AbortSignal.timeout(15000) },
            );
            if (!r.ok) throw new Error(`Catalog HTTP ${r.status}`);
            const raw = await r.json();
            if (!raw || typeof raw !== 'object')
              throw new Error('Catalog format is invalid');
            const data = raw as Record<string, unknown>;
            if (!Array.isArray(data[kind]))
              throw new Error('Catalog format is invalid');
            return {
              state: 'Available · bundled',
              detail: `${data[kind].length.toLocaleString()} records. Retrieved ${typeof data.retrievedAt === 'string' ? data.retrievedAt : 'at an unknown time'}.`,
            };
          },
        ],
      ),
    ];
    await Promise.all(
      jobs.map(async ([name, run]) => {
        let result: Check;
        try {
          result = { name, ...(await run()) };
        } catch (error) {
          result = {
            name,
            state: 'Unavailable',
            detail: error instanceof Error ? error.message : 'Request failed',
          };
        }
        setChecks((previous) => [...previous, result]);
      }),
    );
    setCheckedAt(new Date().toLocaleString());
    setBusy(false);
    running.current = false;
  }
  return (
    <>
      <Panel
        title="Data coverage and connections"
        tag={settings.region.toUpperCase()}
        actions={
          <button disabled={busy} onClick={() => void checkConnections()}>
            {busy ? 'Checking…' : 'Check connections'}
          </button>
        }
      >
        <p className="settings-help">
          Check the sources used by this browser for {selected}, quality{' '}
          {settings.quality}. Connection availability and observation freshness
          are different: a responding API can contain old or missing data.
          Checks respect the same request limits and caches as the rest of the
          app.
        </p>
        <div aria-live="polite">
          {checks.length > 0 ? (
            <MarketTable
              rows={checks}
              rowKey={(r) => r.name}
              columns={[
                { label: 'DATA', render: (r) => r.name },
                {
                  label: 'CONNECTION',
                  render: (r) => (
                    <span
                      className={
                        r.state === 'Unavailable' ||
                        r.state === 'Saved fallback'
                          ? 'negative'
                          : ''
                      }
                    >
                      {r.state}
                    </span>
                  ),
                },
                { label: 'COVERAGE', render: (r) => r.detail },
              ]}
            />
          ) : (
            <p className="settings-help">
              Run a check to see available data and any connection errors. No
              API keys are needed.
            </p>
          )}
          {checkedAt && !busy && (
            <p className="settings-help">
              Checked {checkedAt}. These results are a snapshot, not continuous
              monitoring.
            </p>
          )}
        </div>
      </Panel>
      <Panel title="Sources and community references" tag="PROVENANCE">
        <MarketTable
          rows={references}
          rowKey={(r) => r.name}
          columns={[
            {
              label: 'SOURCE',
              render: (r) => (
                <a href={r.url} target="_blank" rel="noreferrer">
                  {r.name} ↗
                </a>
              ),
            },
            { label: 'HOW IT HELPS', render: (r) => r.use },
          ]}
        />
        <p className="settings-help">
          Market prices, player statistics, game-file metadata and item icons
          come from different services. Multiple websites using the same AODP
          observation do not count as independent confirmation. Source
          timestamps stay attached to each quote.
        </p>
        <details className="settings-help">
          <summary>Additional services reviewed · September 6, 2026</summary>
          <p>
            <a href="https://openalbion.com/" target="_blank" rel="noreferrer">
              OpenAlbion
            </a>{' '}
            documents equipment APIs, but the tested public endpoint returned
            402 DEPLOYMENT_DISABLED. It is not connected.{' '}
            <a
              href="https://www.circleofwizards.com/albion-economy/"
              target="_blank"
              rel="noreferrer"
            >
              Circle of Wizards
            </a>{' '}
            republishes AODP market data through RapidAPI; it would not add
            independent observations.
          </p>
        </details>
      </Panel>
    </>
  );
}
