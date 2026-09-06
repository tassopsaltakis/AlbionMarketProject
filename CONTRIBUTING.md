# Contributing

Pull requests are welcome. For a substantial change, open an issue first so we
can agree on the problem and avoid overlapping work. Small fixes can go straight
to a pull request.

## Local development

Use Node.js 22.13 or later. From `terminal/`, run `npm ci`, then
`npm run dev:pages`. This uses the same browser-side API adapter as GitHub Pages.
`npm run dev` runs the optional server-proxied version.

Before submitting, run:

```sh
npm run typecheck
npm run lint
npm test
npm run build:pages
```

Keep changes focused and explain the behavior that changed, along with how you
verified it. Include screenshots for UI changes and regression tests for market
calculations, timestamps, or cache behavior.

## Market data rules

- Never add invented prices, history, trade volume, or recipes to the application.
- Preserve source timestamps. Fetch time is not observation time.
- Keep regions and item qualities separate in calculations and caches.
- Describe estimates and user-entered assumptions in the interface.
- Treat missing or invalid observations as unavailable, not zero-priced trades.
- Keep requests batched and rate limited; do not bypass the public API limits.

Test fixtures may use synthetic values when clearly isolated from the app.
Do not include account data, tokens, browser storage dumps, or personal secrets.

## Licensing and ownership

By intentionally submitting a contribution for inclusion, you license it under
Apache-2.0, as described in section 5 of LICENSE. You retain the copyright in your
contribution. You must have the right to submit the code or assets you contribute.
There is no copyright assignment requirement.

Third-party assets need their own compatible license and attribution. Albion
game assets and metadata are not covered by the project's source-code license.
Maintain existing copyright and attribution notices.

Be respectful in issues and reviews. Discuss the code and evidence, and keep
feedback specific enough that another contributor can act on it.
