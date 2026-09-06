import test from 'node:test';
import assert from 'node:assert/strict';
import {
  playerStats,
  snapshot,
  retainSnapshot,
  fameRate,
} from '../lib/players/analytics.ts';
import { playerURL, validatePlayerData } from '../lib/players/source.ts';
import { validateProfileUpdate } from '../lib/players/consistency.ts';
test('player payload validation rejects malformed search and roster records', () => {
  assert.doesNotThrow(() =>
    validatePlayerData({ players: [], guilds: [] }, 'search'),
  );
  assert.doesNotThrow(() =>
    validatePlayerData([{ Id: 'fixture', Name: 'Fixture' }], 'members'),
  );
  assert.throws(() => validatePlayerData({ players: {} }, 'search'));
  assert.throws(() =>
    validatePlayerData([{ Id: 'fixture', Name: null }], 'members'),
  );
  assert.throws(() => validatePlayerData({ error: 'Unavailable' }, 'player'));
});
const player = {
  Id: 'test_player_identifier',
  Name: 'Fixture only',
  LifetimeStatistics: {
    Gathering: { All: { Total: 100 }, Ore: { Total: 60 } },
    FarmingFame: 50,
    Timestamp: '2026-09-05T00:00:00Z',
  },
};
test('player stats preserve missing values without inventing zeros', () => {
  const s = playerStats(player);
  assert.equal(s.gathering, 100);
  assert.equal(s.farming, 50);
  assert.equal(s.crafting, null);
  assert.equal(s.specialty, 'Ore');
  assert.equal(s.resources.find((r) => r.resource === 'Wood').fame, null);
});
test('same source update cannot become a second progress sample', () => {
  const first = snapshot(player, 'americas', 'fixture', '2026-09-05T01:00:00Z');
  const second = snapshot(
    player,
    'americas',
    'fixture',
    '2026-09-05T05:00:00Z',
  );
  const saved = retainSnapshot([first], second);
  assert.equal(saved.length, 1);
  assert.equal(fameRate(saved, 'gathering'), null);
});
test('fame rate uses source interval, not browser fetch interval', () => {
  const first = snapshot(player, 'americas', 'fixture', '2026-09-05T01:00:00Z');
  const later = snapshot(
    {
      ...player,
      LifetimeStatistics: {
        ...player.LifetimeStatistics,
        Gathering: { All: { Total: 340 } },
        Timestamp: '2026-09-06T00:00:00Z',
      },
    },
    'americas',
    'fixture',
    '2026-09-06T02:00:00Z',
  );
  const rate = fameRate([first, later], 'gathering');
  assert.equal(rate.hours, 24);
  assert.equal(rate.perHour, 10);
  assert.equal(rate.perDay, 240);
  assert.equal(
    fameRate([first, { ...later, region: 'europe' }], 'gathering'),
    null,
  );
  assert.equal(
    fameRate([first, { ...later, gathering: 1 }], 'gathering'),
    null,
  );
});
test('source-less profiles cannot be given fabricated timestamps', () => {
  assert.equal(
    snapshot(
      { Id: 'id', Name: 'fixture' },
      'europe',
      'test',
      '2026-09-06T01:00:00Z',
    ),
    null,
  );
});

test('invalid fetch times and future source updates cannot become progress samples', () => {
  assert.equal(snapshot(player, 'americas', 'fixture', 'invalid'), null);
  assert.equal(
    snapshot(player, 'americas', 'fixture', '2026-09-04T23:00:00Z'),
    null,
  );
});

test('equivalent UTC source timestamps represent one progress sample', () => {
  const first = snapshot(player, 'americas', 'fixture', '2026-09-05T01:00:00Z');
  const next = { ...first, updatedAt: '2026-09-05T00:00:00' };
  assert.equal(retainSnapshot([first], next).length, 1);
});

test('profile updates preserve identity and never regress a dated saved record', () => {
  const now = Date.parse('2026-09-06T12:00:00Z');
  const dated = (Timestamp) => ({
    ...player,
    LifetimeStatistics: { ...player.LifetimeStatistics, Timestamp },
  });
  assert.doesNotThrow(() =>
    validateProfileUpdate(
      dated('2026-09-06T00:00:00Z'),
      player.Id,
      player,
      now,
    ),
  );
  assert.doesNotThrow(() =>
    validateProfileUpdate(player, player.Id, player, now),
  );
  assert.throws(
    () =>
      validateProfileUpdate(
        { ...player, Id: 'different_player' },
        player.Id,
        player,
        now,
      ),
    /different player/,
  );
  assert.throws(
    () =>
      validateProfileUpdate(
        dated('2026-09-04T00:00:00Z'),
        player.Id,
        player,
        now,
      ),
    /older or undated/,
  );
  assert.throws(
    () => validateProfileUpdate(dated(undefined), player.Id, player, now),
    /older or undated/,
  );
  assert.throws(
    () =>
      validateProfileUpdate(
        dated('2026-09-07T00:00:00Z'),
        player.Id,
        player,
        now,
      ),
    /future/,
  );
});
test('resource rates preserve missing values and reject intervening counter resets', () => {
  const first = snapshot(player, 'americas', 'fixture', '2026-09-05T01:00:00Z');
  const middle = {
    ...first,
    updatedAt: '2026-09-05T12:00:00Z',
    resources: { Ore: 40 },
  };
  const last = {
    ...first,
    updatedAt: '2026-09-06T00:00:00Z',
    resources: { Ore: 300 },
  };
  assert.equal(fameRate([first, last], 'Ore').perHour, 10);
  assert.equal(fameRate([first, last], 'Wood'), null);
  assert.equal(fameRate([first, middle, last], 'Ore'), null);
});
test('player routes validate IDs and keep regions separate', () => {
  assert.match(
    playerURL(
      new URLSearchParams({ server: 'europe', kind: 'player', id: player.Id }),
    ),
    /^https:\/\/gameinfo-ams\.albiononline\.com/,
  );
  assert.throws(() =>
    playerURL(new URLSearchParams({ server: 'toString', q: 'test' })),
  );
  assert.throws(() =>
    playerURL(new URLSearchParams({ kind: 'player', id: '../secret' })),
  );
  assert.throws(() => playerURL(new URLSearchParams({ q: 'a' })));
});
