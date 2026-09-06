# Security

Do not post credentials, personal data, or an exploitable vulnerability in a public
issue. Use the repository's **Security → Report a vulnerability** option when it
is available. If private reporting is unavailable, open an issue asking for a
private contact channel without including the exploit details.

The app has no account system and requires no API keys. Watchlists, alerts,
recipes, preferences, and cached observations are stored in the browser on the
current device. Clearing site storage removes them.

GitHub Pages serves only static files. Public Albion API requests run in the
browser. Never put secrets in build variables, client code, or recipe imports.

Dependency advisories are checked during maintenance. Report data-integrity
issues, including stale quotes being shown as fresh, as correctness bugs unless
they expose a security vulnerability.
# Public build credentials

The browser and player relay call public Albion data endpoints without private API keys. Cloudflare and GitHub OAuth credentials are deployment credentials stored by local tooling, outside this repository. Never put credentials in `VITE_*` variables: those values are published in JavaScript. `PLAYER_PROXY_URL` is a public URL, not a secret. CI scans the compiled site for common credential formats as an additional check; it is not a guarantee that every possible secret format will be detected.
