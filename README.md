# Albion Market Project

A community market dashboard for Albion Online: item price charts, material coverage, city comparisons, trade calculators, and public player and guild research.

## Run locally

Requires Node.js 22.13 or newer.

```sh
cd terminal
npm ci
npm run dev
```

Open http://localhost:3000. The local server proxies public market and player requests. No API key or account is required.

## Features

- Search 10,026 cataloged items; compare historical average prices across cities and timeframes.
- Browse all 248 cataloged raw and refined material variants, including their supported tiers and enchantments. Filter by family, city, price, freshness, and coverage.
- Compare buy and sell quotes, estimated arbitrage proceeds, city premiums, and changes between observed snapshots.
- Estimate gathering, transport, and production economics using editable assumptions. Production recipes must be supplied with a source; the app does not invent recipes.
- Save watchlists, price alerts, screens, and recruiting notes in your browser; export tables as CSV.
- Search public players and guilds, inspect resource-specific gathering fame, farming and crafting fame, and filter guild rosters for recruiting.

## Data and interpretation

Market prices and historical averages come from the [Albion Online Data Project](https://www.albion-online-data.com/). These are crowdsourced observations, not a live order book. Missing prices remain unavailable. Each quote retains its source timestamp, including when served from a cache. History consists of reported average-price buckets, not exchange candles. Apparent opportunities may disappear before a trade can be executed.

The item catalog is derived from [ao-bin-dumps](https://github.com/ao-data/ao-bin-dumps); icons come from Albion's public render service. Update the bundled catalog with `npm run metadata:update`, then review the resulting changes.

Player and guild data comes from Albion's public GameInfo endpoints for Americas, Europe, and Asia. Lifetime fame is not a resource count, current activity, or proof of gathering speed. The app calculates **observed fame per hour** only after it has retained distinct source updates at least one hour apart. It uses the source's elapsed time, and labels old statistics. Farming fame and resource gathering fame are separate measures. Inventory, focus, faction activity, online status, and actual resources gathered per hour are not supplied by these endpoints.

Alerts run only while the app is open. Browser storage is local to the device and can be cleared by the browser. Calculators are estimates; taxes, bonuses, travel time, and loss assumptions are editable.

## GitHub Pages

The workflow in `.github/workflows/pages.yml` validates pull requests and builds and deploys `main`. In the repository's **Settings → Pages**, select **GitHub Actions** as the build source. The build automatically uses the repository name as its base path.

```sh
cd terminal
npm run build:pages
npm run preview:pages
```

The static market dashboard requests the Data Project directly. **Player and guild lookups require a relay on GitHub Pages because GameInfo does not allow cross-origin browser requests.** A narrowly scoped Cloudflare Worker is included in `terminal/worker`; it is a separate optional deployment, not part of GitHub Pages.

To deploy that relay using your Cloudflare account:

```sh
cd terminal
npx wrangler login
npx wrangler deploy --config worker/wrangler.jsonc
```

Set `ALLOWED_ORIGINS` in the Worker configuration to your Pages origin. Set the GitHub Actions repository variable `PLAYER_PROXY_URL` to the deployed HTTPS Worker URL, then rerun the Pages workflow. A user can also enter a relay URL in the app's Settings. No Cloudflare credentials belong in the browser build. The Worker only proxies validated GameInfo routes and applies caching, timeouts, and a best-effort per-isolate request limit.

## Checks and structure

```sh
cd terminal
npm run typecheck
npm run lint
npm test
npm run build:pages
```

- `terminal/components`: shared dashboard views and controls.
- `terminal/lib/market`: source validation, caching, normalization, and financial calculations.
- `terminal/lib/players`: public lookup requests, lifetime-stat parsing, and snapshot-rate calculations.
- `terminal/app/api`: local/server proxy endpoints.
- `terminal/static`: static entry point for GitHub Pages.
- `terminal/tests`: calculation, request, cache, catalog, and player-stat regression tests.

The server and static builds share the same UI and calculations. Upstream API availability, crowdsourced coverage, and source update frequency remain outside this project's control.

## Contributing and ownership

See [CONTRIBUTING.md](CONTRIBUTING.md) for pull requests and [SECURITY.md](SECURITY.md) for vulnerability reports. Code is licensed under [Apache-2.0](LICENSE). Copyright remains with the respective authors; contributions do not transfer ownership. The license permits modification, redistribution, and commercial use subject to its terms. Albion Online names, artwork, and third-party data are not relicensed by this project. See [NOTICE](NOTICE).

This is an independent community project and is not affiliated with or endorsed by Albion Online or Sandbox Interactive.
