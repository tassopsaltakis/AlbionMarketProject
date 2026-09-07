# Data sources

Albion Market Project uses public data without visitor API keys. The **Data Sources** tab checks the connections used by the current browser. A successful request does not establish that the underlying game observation is recent.

| Source | Role | Freshness boundary |
| --- | --- | --- |
| [Albion Online Data Project](https://www.albion-online-data.com/api) | Market quotes, historical statistics, gold | Only uploaded observations are available. Each price retains its own source timestamp. |
| [Albion Game Info](https://gameinfo.albiononline.com/api/gameinfo/search?q=Albion) | Player profiles, guilds and rosters | Source statistics may lag. Tracking rates require distinct dated updates; they measure fame per elapsed source hour, not resources per active gathering hour. |
| [ao-data game-file dumps](https://github.com/ao-data/ao-bin-dumps) | Bundled item identities and recipe inputs | Each generated catalog records its retrieval date. Mechanics, fees and character bonuses are not live market observations. |
| [Albion render service](https://render.albiononline.com/v1/item/T3_ORE.png) | Item icons | Presentation only. |

## Other sites reviewed on September 6, 2026

- [Albion Free Market](https://albionfreemarket.com/articles/view/albion-free-market-data-client-tutorial) documents an upload client that contributes to AODP. Its private uploads are not available to this application.
- [Albion Online 2D](https://albiononline2d.com/en/item?enchantment=0&tier=1) credits AODP for market prices. It is a useful comparison interface, not an independent market observation.
- [Circle of Wizards](https://www.circleofwizards.com/albion-economy/) documents an AODP-based RapidAPI wrapper. It is not integrated because it does not add an independent feed.
- [OpenAlbion](https://openalbion.com/weapons) documents public equipment metadata. The tested API endpoint returned HTTP 402 with `DEPLOYMENT_DISABLED`; it is not integrated. This is an availability finding on the review date, not a claim that its API always requires payment.
- The [official wiki](https://wiki.albiononline.com/wiki/Albion_Online_Wiki) is linked for mechanics research. Its content is not used as a live quote or silently substituted for user-entered calculator assumptions.

## Adding a provider

Verify the public endpoint and reuse terms, exact item IDs, region, quality, units, source timestamps and failure behavior. Identify the original collector so mirrors are not counted as independent evidence. Keep reference information, historical aggregates and current order observations distinct. Do not substitute history averages for executable buy or sell quotes.

Current market reconciliation is scoped to one region and matches item, city and quality. It selects each price/date pair separately, retains a newer saved observation when a response regresses, rejects future or invalid observations, and accepts a newer dated zero as an unavailable quote. It never gives retained prices a new observation timestamp.

Public player lookups on GitHub Pages need the configured relay when Game Info disallows browser access. The relay uses public endpoints without game API keys. Deployment account credentials remain outside the public app.
