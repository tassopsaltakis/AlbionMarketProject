'use client';
import type { PublicIdentity } from '@/lib/players/source';
import { playerStats } from '@/lib/players/analytics';
import { Panel, Stat, Num, MarketTable, ExportButton } from './market-ui';

export function PlayerBackground({
  player,
  region,
  source,
}: {
  player: PublicIdentity;
  region: string;
  source: string;
}) {
  const stats = playerStats(player);
  const labels: Record<string, string> = {
    Royal: 'Royal Continent',
    Outlands: 'Outlands',
    Avalon: 'Avalon',
    Hellgate: 'Hellgates',
    CorruptedDungeon: 'Corrupted Dungeons',
    Mists: 'Mists',
  };
  return (
    <>
      <Panel
        title="Combat and PvE experience"
        tag="REPORTED LIFETIME TOTALS"
        actions={
          <ExportButton
            rows={[
              {
                player: player.Name,
                player_id: player.Id,
                server: region,
                guild: player.GuildName || '',
                alliance: player.AllianceName || '',
                gathering_fame: stats.gathering,
                farming_fame: stats.farming,
                crafting_fame: stats.crafting,
                fishing_fame: stats.fishing,
                pve_fame: stats.pve,
                kill_fame: stats.killFame,
                death_fame: stats.deathFame,
                kill_to_death_fame_ratio: stats.fameRatio,
                statistics_updated_at: stats.updatedAt,
                source,
              },
            ]}
          />
        }
      >
        <div className="stats-grid">
          <Stat
            label="PVE FAME"
            value={<Num value={stats.pve} />}
            note="Reported cumulative PvE experience"
          />
          <Stat
            label="KILL FAME"
            value={<Num value={stats.killFame} />}
            note="Fame, not number of kills"
          />
          <Stat
            label="DEATH FAME"
            value={<Num value={stats.deathFame} />}
            note="Fame, not number of deaths"
          />
          <Stat
            label="KILL / DEATH FAME"
            value={
              stats.fameRatio == null ? '—' : stats.fameRatio.toFixed(2) + '×'
            }
            note="Unavailable when death fame is zero or missing"
          />
        </div>
        <p className="settings-help">
          Use these as background experience when reviewing a recruit. They do
          not establish recent activity, gathering efficiency or PvP skill. The
          lifetime statistics update date is shown in the profile above.
        </p>
      </Panel>
      <div className="two-column">
        <Panel title="PvE activity breakdown" tag="LIFETIME FAME">
          <MarketTable
            rows={stats.pveActivities}
            rowKey={(r) => r.activity}
            columns={[
              { label: 'ACTIVITY / AREA', render: (r) => labels[r.activity] },
              { label: 'REPORTED FAME', render: (r) => <Num value={r.fame} /> },
            ]}
          />
          <p className="settings-help">
            These categories may not account for the full PvE total. Missing
            values remain unavailable; zero means the source explicitly reported
            zero.
          </p>
        </Panel>
        <Panel title="Crafting by region" tag="LIFETIME FAME">
          <MarketTable
            rows={stats.craftingRegions}
            rowKey={(r) => r.region}
            columns={[
              { label: 'REGION', render: (r) => labels[r.region] },
              { label: 'REPORTED FAME', render: (r) => <Num value={r.fame} /> },
            ]}
          />
          <p className="settings-help">
            Regional crafting experience does not reveal item specializations,
            focus efficiency, inventory or current location. Confirm those
            details with the player.
          </p>
        </Panel>
      </div>
    </>
  );
}
