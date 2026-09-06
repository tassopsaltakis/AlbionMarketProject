'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Search,
  Users,
  UserRound,
  BookmarkPlus,
  RefreshCw,
  Trash2,
  ExternalLink,
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
} from 'recharts';
import { playerRequest } from '@/lib/players/client';
import {
  playerStats,
  snapshot,
  retainSnapshot,
  fameRate,
  RESOURCES,
  type PlayerSnapshot,
} from '@/lib/players/analytics';
import {
  type PublicIdentity,
  type PlayerEnvelope,
  type SearchResult,
} from '@/lib/players/source';
import { readLocal, writeLocal } from '@/lib/market/client';
import { timestamp } from '@/lib/market/analytics';
import type { Settings } from '@/lib/market/types';
import {
  Panel,
  Stat,
  Num,
  MarketTable,
  SelectBox,
  NumberField,
  ExportButton,
  Empty,
  Loading,
} from './market-ui';
interface Recruit {
  player: PublicIdentity;
  region: string;
  source: string;
  observedAt: string;
  note: string;
}
function SourceTime({ value }: { value?: string | null }) {
  const time = timestamp(value || '');
  return (
    <span
      className={Number.isFinite(time) ? 'source-time' : 'muted'}
      title={value || 'Source update timestamp unavailable'}
    >
      {Number.isFinite(time)
        ? new Date(time).toLocaleDateString()
        : 'Unknown update time'}
      <small>
        {Number.isFinite(time)
          ? new Date(time).toLocaleTimeString()
          : 'Do not assume current'}
      </small>
    </span>
  );
}
export function PlayerExplorer({
  mode,
  settings,
  notify,
}: {
  mode: 'Players' | 'Guilds';
  settings: Settings;
  notify: (text: string) => void;
}) {
  const [query, setQuery] = useState(''),
    [tab, setTab] = useState('Search'),
    [results, setResults] = useState<SearchResult | null>(null),
    [detail, setDetail] = useState<PlayerEnvelope<PublicIdentity> | null>(null),
    [roster, setRoster] = useState<PublicIdentity[]>([]),
    [guild, setGuild] = useState<PublicIdentity | null>(null),
    [guildSource, setGuildSource] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [snapshots, setSnapshots] = useState<PlayerSnapshot[]>([]),
    [recruits, setRecruits] = useState<Recruit[]>([]),
    [minFame, setMinFame] = useState(0),
    [resource, setResource] = useState('All'),
    [rosterQuery, setRosterQuery] = useState(''),
    [sort, setSort] = useState('Gathering'),
    [rateMetric, setRateMetric] = useState<
      'gathering' | 'crafting' | 'farming' | 'fishing'
    >('gathering');
  const generation = useRef(0);
  useEffect(() => {
    setRecruits(readLocal<Recruit[]>('amp:recruits', []));
  }, []);
  useEffect(() => {
    generation.current++;
    setResults(null);
    setDetail(null);
    setRoster([]);
    setGuild(null);
    setError('');
    setBusy(false);
    setSnapshots([]);
  }, [settings.region]);
  function persist(list: Recruit[]) {
    setRecruits(list);
    writeLocal('amp:recruits', list);
  }
  async function search() {
    const ticket = ++generation.current;
    setDetail(null);
    setSnapshots([]);
    setResults(null);
    setBusy(true);
    setError('');
    setTab('Search');
    try {
      const r = await playerRequest<SearchResult>(
        new URLSearchParams({
          server: settings.region,
          kind: 'search',
          q: query,
        }),
        settings.playerProxy,
      );
      if (ticket !== generation.current) return;
      setResults(r.data);
      if (r.error) setError(r.error);
    } catch (e) {
      if (ticket === generation.current)
        setError(e instanceof Error ? e.message : 'Search unavailable');
    } finally {
      if (ticket === generation.current) setBusy(false);
    }
  }
  const openPlayer = useCallback(
    async (id: string, background = false) => {
      const ticket = ++generation.current;
      setBusy(true);
      setError('');
      if (!background) {
        setDetail(null);
        setSnapshots([]);
      }
      setTab('Search');
      try {
        const r = await playerRequest<PublicIdentity>(
          new URLSearchParams({ server: settings.region, kind: 'player', id }),
          settings.playerProxy,
        );
        if (ticket !== generation.current) return;
        if (!r.data.Id || !r.data.Name)
          throw new Error('No player profile returned');
        setDetail(r);
        const next = snapshot(r.data, settings.region, r.source, r.fetchedAt);
        const key = `amp:player-history:${settings.region}:${id}`;
        const previous = readLocal<PlayerSnapshot[]>(key, []);
        const list = next ? retainSnapshot(previous, next) : previous;
        writeLocal(key, list);
        setSnapshots(list);
        if (r.error) setError(r.error);
      } catch (e) {
        if (ticket === generation.current)
          setError(e instanceof Error ? e.message : 'Profile unavailable');
      } finally {
        if (ticket === generation.current) setBusy(false);
      }
    },
    [settings.region, settings.playerProxy],
  );
  const activePlayer = tab === 'Search' ? detail?.data.Id : undefined;
  useEffect(() => {
    if (!activePlayer) return;
    const timer = setInterval(() => {
      if (!document.hidden) void openPlayer(activePlayer, true);
    }, 300000);
    return () => clearInterval(timer);
  }, [activePlayer, openPlayer]);
  async function openGuild(identity: PublicIdentity) {
    const ticket = ++generation.current;
    setBusy(true);
    setError('');
    setGuild(identity);
    setRoster([]);
    setGuildSource('');
    setTab('Guild roster');
    try {
      const r = await playerRequest<PublicIdentity[]>(
        new URLSearchParams({
          server: settings.region,
          kind: 'members',
          id: identity.Id,
        }),
        settings.playerProxy,
      );
      if (ticket !== generation.current) return;
      if (!Array.isArray(r.data)) throw new Error('No guild roster returned');
      setRoster(r.data);
      setGuildSource(r.source);
      if (r.error) setError(r.error);
    } catch (e) {
      if (ticket === generation.current)
        setError(e instanceof Error ? e.message : 'Guild roster unavailable');
    } finally {
      if (ticket === generation.current) setBusy(false);
    }
  }
  function shortlist(
    player: PublicIdentity,
    source: string,
    observedAt: string,
  ) {
    const existing = recruits.find(
      (r) => r.region === settings.region && r.player.Id === player.Id,
    );
    persist([
      ...recruits.filter(
        (r) => !(r.region === settings.region && r.player.Id === player.Id),
      ),
      {
        player,
        region: settings.region,
        source,
        observedAt,
        note: existing?.note || '',
      },
    ]);
    notify(player.Name + ' saved to your local recruiting shortlist.');
  }
  const stats = detail ? playerStats(detail.data) : null;
  const rate = fameRate(snapshots, rateMetric);
  const rosterRows = roster
    .map((player) => ({ player, stats: playerStats(player) }))
    .filter(
      (r) =>
        r.player.Name.toLowerCase().includes(rosterQuery.toLowerCase()) &&
        (minFame === 0 ||
          (resource === 'All'
            ? (r.stats.gathering ?? -1)
            : (r.stats.resources.find((s) => s.resource === resource)?.fame ??
              -1)) >= minFame),
    )
    .sort((a, b) =>
      sort === 'Farming'
        ? (b.stats.farming ?? -1) - (a.stats.farming ?? -1)
        : sort === 'Crafting'
          ? (b.stats.crafting ?? -1) - (a.stats.crafting ?? -1)
          : resource === 'All'
            ? (b.stats.gathering ?? -1) - (a.stats.gathering ?? -1)
            : (b.stats.resources.find((r) => r.resource === resource)?.fame ??
                -1) -
              (a.stats.resources.find((r) => r.resource === resource)?.fame ??
                -1),
    );
  const saved = recruits.filter((r) => r.region === settings.region);
  return (
    <>
      <Panel
        title={mode === 'Players' ? 'Player research' : 'Guild research'}
        tag={settings.region.toUpperCase()}
      >
        <form
          className="player-search"
          onSubmit={(e) => {
            e.preventDefault();
            void search();
          }}
        >
          <Search size={19} />
          <input
            aria-label={mode === 'Players' ? 'Player name' : 'Guild name'}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={
              mode === 'Players'
                ? 'Search a player name'
                : 'Search a guild name'
            }
            minLength={2}
            maxLength={64}
          />
          <button disabled={busy || query.trim().length < 2} type="submit">
            {busy ? 'Loading…' : 'Search'}
          </button>
        </form>
        <div className="player-tabs">
          <Tabs value={tab} onValueChange={(v) => setTab(String(v))}>
            <TabsList variant="line">
              {(mode === 'Guilds'
                ? ['Search', 'Guild roster', 'Recruiting shortlist']
                : ['Search', 'Recruiting shortlist']
              ).map((t) => (
                <TabsTrigger key={t} value={t}>
                  {t}
                  {t === 'Recruiting shortlist' ? ` (${saved.length})` : ''}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
        <p className="footnote">
          Public Game Info records can lag behind the game. Fame is accumulated
          experience, not a resource count or proof of current activity.
          Searches stay within the selected server.
        </p>
      </Panel>
      {error && <div className="notice amber">{error}</div>}
      {busy && (
        <Panel title="Loading public records">
          <Loading />
        </Panel>
      )}
      {tab === 'Search' && (
        <>
          {results && !detail && (
            <div>
              {mode === 'Players' && (
                <Panel title="Players" tag="SOURCE-LIMITED RESULTS">
                  <MarketTable
                    rows={results.players || []}
                    rowKey={(r) => r.Id}
                    columns={[
                      {
                        label: 'PLAYER',
                        render: (r) => (
                          <button
                            className="identity-link"
                            onClick={() => void openPlayer(r.Id)}
                          >
                            <UserRound size={16} />
                            {r.Name}
                          </button>
                        ),
                      },
                      {
                        label: 'GUILD REPORTED',
                        render: (r) => r.GuildName || 'Not reported',
                      },
                      {
                        label: 'PROFILE',
                        render: (r) => (
                          <button
                            className="quiet"
                            onClick={() => void openPlayer(r.Id)}
                          >
                            View profile ↗
                          </button>
                        ),
                      },
                    ]}
                    limit={15}
                  />
                </Panel>
              )}
              {mode === 'Guilds' && (
                <Panel title="Guilds">
                  <MarketTable
                    rows={results.guilds || []}
                    rowKey={(r) => r.Id}
                    columns={[
                      {
                        label: 'GUILD',
                        render: (r) => (
                          <button
                            className="identity-link"
                            onClick={() => void openGuild(r)}
                          >
                            <Users size={16} />
                            {r.Name}
                          </button>
                        ),
                      },
                      {
                        label: 'ALLIANCE',
                        render: (r) => r.AllianceName || 'Not reported',
                      },
                      {
                        label: 'ROSTER',
                        render: (r) => (
                          <button
                            className="quiet"
                            onClick={() => void openGuild(r)}
                          >
                            Open roster ↗
                          </button>
                        ),
                      },
                    ]}
                    limit={15}
                  />
                </Panel>
              )}
            </div>
          )}
          {!detail && !results && !busy && (
            <Panel title="Find the people behind the economy">
              <Empty
                text={
                  mode === 'Players' ? 'Look up a player' : 'Look up a guild'
                }
                detail="Compare reported gathering specialities, farming fame, and crafting experience. Save candidates to build a recruiting shortlist."
              />
            </Panel>
          )}
          {detail && stats && (
            <>
              <Panel
                title={detail.data.Name}
                tag="PUBLIC PLAYER PROFILE"
                actions={
                  <>
                    <button
                      className="quiet"
                      onClick={() =>
                        shortlist(detail.data, detail.source, detail.fetchedAt)
                      }
                    >
                      <BookmarkPlus size={15} /> Shortlist
                    </button>
                    <button
                      className="quiet"
                      disabled={busy}
                      onClick={() => void openPlayer(detail.data.Id)}
                    >
                      <RefreshCw size={14} /> Refresh
                    </button>
                    <a
                      href={detail.source}
                      target="_blank"
                      rel="noreferrer"
                      className="source-link"
                    >
                      <ExternalLink size={13} /> Source
                    </a>
                  </>
                }
              >
                <div className="profile-heading">
                  <div>
                    <span className="profile-avatar">
                      <UserRound size={26} />
                    </span>
                    <span>
                      <strong>{detail.data.Name}</strong>
                      <small>
                        {detail.data.GuildName || 'No guild reported'}
                        {detail.data.AllianceName
                          ? ' · ' + detail.data.AllianceName
                          : ''}
                      </small>
                      <code>{detail.data.Id}</code>
                    </span>
                  </div>
                  <div>
                    <small>SOURCE STATISTICS UPDATED</small>
                    <SourceTime value={stats.updatedAt} />
                    <small>
                      Fetched {new Date(detail.fetchedAt).toLocaleString()}
                      {detail.cached ? ' · cached' : ''}
                    </small>
                  </div>
                </div>
                {stats.updatedAt &&
                  timestamp(stats.updatedAt) < Date.now() - 7 * 86400000 && (
                    <p className="danger-note">
                      These source statistics are over seven days old. Do not
                      interpret them as current activity or recent gathering
                      performance.
                    </p>
                  )}
                <div className="stats-grid">
                  <Stat
                    label="LIFETIME GATHERING FAME"
                    value={<Num value={stats.gathering} />}
                    note={
                      stats.specialty
                        ? `Largest reported resource: ${stats.specialty}`
                        : 'No resource specialty reported'
                    }
                  />
                  <Stat
                    label="LIFETIME FARMING FAME"
                    value={<Num value={stats.farming} />}
                    note="Farming is separate from gathering"
                  />
                  <Stat
                    label="LIFETIME CRAFTING FAME"
                    value={<Num value={stats.crafting} />}
                    note="Cumulative source statistic"
                  />
                  <Stat
                    label="LIFETIME FISHING FAME"
                    value={<Num value={stats.fishing} />}
                    note="Cumulative source statistic"
                  />
                </div>
                {detail.data.GuildId && (
                  <div className="form-actions">
                    <button
                      onClick={() =>
                        void openGuild({
                          Id: detail.data.GuildId!,
                          Name: detail.data.GuildName || detail.data.GuildId!,
                        })
                      }
                    >
                      <Users size={14} /> Open reported guild roster
                    </button>
                  </div>
                )}
              </Panel>
              <div className="two-column">
                <Panel title="Gathering specialities" tag="LIFETIME FAME">
                  <div className="resource-chart">
                    <ResponsiveContainer
                      width="100%"
                      height={240}
                      initialDimension={{ width: 400, height: 240 }}
                    >
                      <BarChart
                        data={stats.resources}
                        layout="vertical"
                        margin={{ left: 0, right: 30, top: 10, bottom: 10 }}
                      >
                        <XAxis type="number" hide />
                        <YAxis
                          type="category"
                          dataKey="resource"
                          axisLine={false}
                          tickLine={false}
                          tick={{ fill: '#8ca1bc', fontSize: 12 }}
                          width={60}
                        />
                        <Tooltip
                          contentStyle={{
                            background: '#152031',
                            border: '1px solid #334966',
                            fontSize: 12,
                          }}
                          formatter={(v) => Number(v).toLocaleString()}
                        />
                        <Bar
                          dataKey="fame"
                          fill="#649cda"
                          radius={[0, 3, 3, 0]}
                          isAnimationActive={false}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <MarketTable
                    rows={stats.resources}
                    rowKey={(r) => r.resource}
                    columns={[
                      { label: 'RESOURCE', render: (r) => r.resource },
                      {
                        label: 'TOTAL FAME',
                        render: (r) => <Num value={r.fame} />,
                      },
                      {
                        label: 'ROYAL',
                        render: (r) => <Num value={r.royal} />,
                      },
                      {
                        label: 'OUTLANDS',
                        render: (r) => <Num value={r.outlands} />,
                      },
                      {
                        label: 'AVALON',
                        render: (r) => <Num value={r.avalon} />,
                      },
                    ]}
                  />
                  <p className="footnote">
                    Geographic subtotals can differ from the reported total.
                    Missing source fields remain unavailable.
                  </p>
                </Panel>
                <Panel
                  title="Observed fame gains"
                  tag="LOCAL SNAPSHOTS"
                  actions={
                    <SelectBox
                      label="Fame metric"
                      value={rateMetric}
                      onChange={(v) => setRateMetric(v as typeof rateMetric)}
                      options={['gathering', 'farming', 'crafting', 'fishing']}
                    />
                  }
                >
                  <div className="stats-grid rate-stats">
                    <Stat
                      label="GAIN IN SAVED WINDOW"
                      value={<Num value={rate?.gain} />}
                      note={
                        rate
                          ? `${rate.hours.toFixed(1)} elapsed source hours`
                          : 'Waiting for a later source update'
                      }
                    />
                    <Stat
                      label="FAME / ELAPSED HOUR"
                      value={<Num value={rate?.perHour} />}
                      note="Includes offline time; not a session rate"
                    />
                  </div>
                  {snapshots.length > 1 ? (
                    <div className="resource-chart">
                      <ResponsiveContainer
                        width="100%"
                        height={230}
                        initialDimension={{ width: 400, height: 230 }}
                      >
                        <AreaChart
                          data={snapshots.map((s) => ({
                            ...s,
                            time: timestamp(s.updatedAt),
                          }))}
                        >
                          <CartesianGrid stroke="#233249" vertical={false} />
                          <XAxis
                            dataKey="time"
                            type="number"
                            domain={['dataMin', 'dataMax']}
                            tickFormatter={(t) =>
                              new Date(t).toLocaleDateString()
                            }
                            tick={{ fill: '#7f99bb', fontSize: 10 }}
                          />
                          <YAxis hide domain={['auto', 'auto']} />
                          <Tooltip
                            labelFormatter={(t) =>
                              new Date(Number(t)).toLocaleString()
                            }
                            contentStyle={{
                              background: '#152031',
                              border: '1px solid #334966',
                              fontSize: 11,
                            }}
                          />
                          <Area
                            dataKey={rateMetric}
                            stroke="#63bdaa"
                            fill="#63bdaa"
                            fillOpacity={0.1}
                            isAnimationActive={false}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <Empty
                      text={
                        snapshots.length
                          ? 'Baseline saved'
                          : 'No timestamped baseline available'
                      }
                      detail="A rate needs two distinct source updates at least one hour apart. Refreshing an unchanged record does not create progress."
                    />
                  )}
                  <p className="footnote">
                    {rate
                      ? `${new Date(timestamp(rate.from)).toLocaleString()} → ${new Date(timestamp(rate.to)).toLocaleString()}. `
                      : ''}
                    Only snapshots collected on this device are available. Fame
                    per elapsed hour is not items per hour, silver per hour, or
                    time spent online.
                  </p>
                  <div className="toolbar">
                    <ExportButton
                      name="player-snapshots"
                      rows={snapshots.map((s) => ({
                        ...s,
                        resources: JSON.stringify(s.resources),
                      }))}
                    />
                  </div>
                </Panel>
              </div>
            </>
          )}
        </>
      )}
      {tab === 'Guild roster' && (
        <Panel
          title={guild ? guild.Name + ' · guild roster' : 'Guild roster'}
          tag={`${roster.length} MEMBERS RETURNED`}
          actions={
            <ExportButton
              name="guild-gatherers"
              rows={rosterRows.map((r) => ({
                id: r.player.Id,
                name: r.player.Name,
                guild: r.player.GuildName,
                gathering_fame: r.stats.gathering,
                farming_fame: r.stats.farming,
                crafting_fame: r.stats.crafting,
                specialty: r.stats.specialty,
                stats_updated: r.stats.updatedAt,
                server: settings.region,
                source: guildSource,
              }))}
            />
          }
        >
          <div className="toolbar">
            <input
              aria-label="Filter guild members"
              value={rosterQuery}
              onChange={(e) => setRosterQuery(e.target.value)}
              placeholder="Filter roster"
            />
            <SelectBox
              label="Resource speciality"
              value={resource}
              onChange={setResource}
              options={['All', ...RESOURCES]}
            />
            <SelectBox
              label="Roster sort"
              value={sort}
              onChange={setSort}
              options={['Gathering', 'Farming', 'Crafting']}
            />
            <NumberField
              label="Minimum fame in selected resource"
              value={minFame}
              onChange={setMinFame}
            />
            {guild && (
              <button disabled={busy} onClick={() => void openGuild(guild)}>
                <RefreshCw size={13} /> Refresh roster
              </button>
            )}
          </div>
          {!guild ? (
            <Empty
              text="Select a guild from search"
              detail="The roster can be ranked by gathering, farming, or crafting fame."
            />
          ) : (
            <MarketTable
              rows={rosterRows}
              rowKey={(r) => r.player.Id}
              columns={[
                {
                  label: 'PLAYER',
                  render: (r) => (
                    <button
                      className="identity-link"
                      onClick={() => void openPlayer(r.player.Id)}
                    >
                      {r.player.Name}
                    </button>
                  ),
                },
                {
                  label: 'GATHERING FAME',
                  render: (r) => <Num value={r.stats.gathering} />,
                },
                {
                  label: 'SPECIALITY',
                  render: (r) => r.stats.specialty || 'Unavailable',
                },
                {
                  label: 'FARMING FAME',
                  render: (r) => <Num value={r.stats.farming} />,
                },
                {
                  label: 'CRAFTING FAME',
                  render: (r) => <Num value={r.stats.crafting} />,
                },
                {
                  label: 'SOURCE UPDATED',
                  render: (r) => <SourceTime value={r.stats.updatedAt} />,
                },
                {
                  label: 'SHORTLIST',
                  render: (r) => (
                    <button
                      className="quiet"
                      title={'Shortlist ' + r.player.Name}
                      onClick={() =>
                        shortlist(
                          r.player,
                          guildSource,
                          new Date().toISOString(),
                        )
                      }
                    >
                      <BookmarkPlus size={15} />
                    </button>
                  ),
                },
              ]}
              limit={25}
            />
          )}
          <p className="footnote">
            Guild membership and statistics reflect what the source reports.
            Gathering tier, focus, faction affiliation, play schedule, and
            available inventory are not supplied by these endpoints.
          </p>
        </Panel>
      )}
      {tab === 'Recruiting shortlist' && (
        <Panel
          title="Recruiting shortlist"
          tag="PRIVATE TO THIS BROWSER"
          actions={
            <ExportButton
              name="recruiting-shortlist"
              rows={saved.map((r) => ({
                id: r.player.Id,
                name: r.player.Name,
                region: r.region,
                guild: r.player.GuildName,
                gathering_fame: playerStats(r.player).gathering,
                farming_fame: playerStats(r.player).farming,
                stats_updated: playerStats(r.player).updatedAt,
                note: r.note,
                source: r.source,
              }))}
            />
          }
        >
          <MarketTable
            rows={saved}
            rowKey={(r) => r.player.Id}
            columns={[
              {
                label: 'PLAYER',
                render: (r) => (
                  <button
                    className="identity-link"
                    onClick={() => void openPlayer(r.player.Id)}
                  >
                    {r.player.Name}
                  </button>
                ),
              },
              {
                label: 'GATHERING FAME',
                render: (r) => <Num value={playerStats(r.player).gathering} />,
              },
              {
                label: 'SPECIALITY',
                render: (r) => playerStats(r.player).specialty || 'Unavailable',
              },
              {
                label: 'SOURCE UPDATED',
                render: (r) => (
                  <SourceTime value={playerStats(r.player).updatedAt} />
                ),
              },
              {
                label: 'LOCAL RECRUITING NOTE',
                render: (r) => (
                  <input
                    aria-label={'Recruiting note for ' + r.player.Name}
                    value={r.note}
                    maxLength={500}
                    placeholder="Role, availability to discuss…"
                    onChange={(e) =>
                      persist(
                        recruits.map((s) =>
                          s.region === r.region && s.player.Id === r.player.Id
                            ? { ...s, note: e.target.value }
                            : s,
                        ),
                      )
                    }
                  />
                ),
              },
              {
                label: 'REMOVE',
                render: (r) => (
                  <button
                    className="quiet"
                    title={'Remove ' + r.player.Name}
                    onClick={() =>
                      persist(
                        recruits.filter(
                          (s) =>
                            s.region !== r.region ||
                            s.player.Id !== r.player.Id,
                        ),
                      )
                    }
                  >
                    <Trash2 size={14} />
                  </button>
                ),
              },
            ]}
          />
          <p className="footnote">
            Notes are kept locally and are never sent to Albion’s APIs.
            Shortlisting someone does not contact or invite them. Open a profile
            to retrieve its latest available statistics.
          </p>
        </Panel>
      )}
    </>
  );
}
