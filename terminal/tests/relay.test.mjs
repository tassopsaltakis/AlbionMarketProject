import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker/player-proxy.ts';

const origin = 'https://tassopsaltakis.github.io';
const env = { ALLOWED_ORIGINS: origin };
test('relay rejects unapproved origins, methods, and invalid upstream queries', async () => {
  const request = (query, options = {}) =>
    new Request('https://relay.example/?' + query, options);
  assert.equal(
    (
      await worker.fetch(
        request('kind=search&q=test', {
          headers: { Origin: 'https://other.example' },
        }),
        env,
      )
    ).status,
    403,
  );
  assert.equal(
    (await worker.fetch(request('', { method: 'POST' }), env)).status,
    405,
  );
  assert.equal(
    (await worker.fetch(request('kind=player&id=https://other.example'), env))
      .status,
    400,
  );
  const preflight = await worker.fetch(
    request('', { method: 'OPTIONS', headers: { Origin: origin } }),
    env,
  );
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get('Access-Control-Allow-Origin'), origin);
});

test('relay keeps source and fetch timestamps when serving its cache', async () => {
  const realFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async (url) => {
    calls++;
    assert.match(
      url,
      /^https:\/\/gameinfo\.albiononline\.com\/api\/gameinfo\/search/,
    );
    return Response.json({ players: [], guilds: [] });
  };
  try {
    const request = new Request(
      'https://relay.example/?server=americas&kind=search&q=relaytest',
      { headers: { Origin: origin } },
    );
    const first = await (await worker.fetch(request, env)).json();
    const second = await (await worker.fetch(request, env)).json();
    assert.equal(calls, 1);
    assert.equal(second.cached, true);
    assert.equal(second.fetchedAt, first.fetchedAt);
    assert.equal(second.source, first.source);
  } finally {
    globalThis.fetch = realFetch;
  }
});
