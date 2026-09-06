import test from 'node:test';
import assert from 'node:assert/strict';
import { playerRequest } from '../lib/players/client.ts';
import { playerURL } from '../lib/players/source.ts';

test('an older player response retains the newer saved profile and its original fetch time', async () => {
  const params = new URLSearchParams({
    kind: 'player',
    server: 'americas',
    id: 'fixture_player_identifier',
  });
  const source = playerURL(params);
  const old = {
    data: {
      Id: params.get('id'),
      Name: 'Fixture',
      LifetimeStatistics: {
        Timestamp: '2026-09-05T00:00:00Z',
        Gathering: { All: { Total: 240 } },
      },
    },
    source,
    fetchedAt: '2026-09-05T01:00:00Z',
    cached: false,
  };
  const store = new Map([['amp:players:' + source, JSON.stringify(old)]]);
  const originalFetch = globalThis.fetch;
  const originalStorage = globalThis.localStorage;
  globalThis.localStorage = {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => store.set(key, value),
  };
  globalThis.fetch = async () =>
    Response.json({
      ...old,
      fetchedAt: new Date().toISOString(),
      data: {
        ...old.data,
        LifetimeStatistics: { Timestamp: '2026-09-04T00:00:00Z' },
      },
    });
  try {
    const result = await playerRequest(params);
    assert.deepEqual(result.data, old.data);
    assert.equal(result.fetchedAt, old.fetchedAt);
    assert.equal(result.cached, true);
    assert.match(result.error, /older or undated/);
    assert.deepEqual(JSON.parse(store.get('amp:players:' + source)), old);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalStorage === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = originalStorage;
  }
});
