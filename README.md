# Usage website

Public download and documentation site for Phone Usage and Mac Usage:
https://usage.jerrylusato.com. MIT licensed, with static HTML/CSS/JS and a small
Cloudflare Worker for public release discovery. No account, analytics, or app-data upload.

## Local verification and deployment

Requires Node 22+. Install locked dependencies, run tests and syntax checks, then deploy:

```sh
npm ci
npm test
npm run check
npx wrangler deploy --dry-run
npx wrangler whoami
npm run deploy
```

`wrangler.jsonc` declares the Worker, static assets, and custom domain. The initial deployment
uses authenticated local Wrangler. GitHub Actions deploys verified pushes to `main` using
`CLOUDFLARE_API_TOKEN` stored as an encrypted repository secret and the repository variable
`CLOUDFLARE_DEPLOY_ENABLED=true`. Without that variable CI verifies but skips deployment. The token needs Workers Scripts
Edit for the configured account, and Zone Read / Workers Routes Edit for jerrylusato.com.
Never commit tokens or Wrangler authentication files. PR checks do not access deployment secrets.

## Release discovery

`GET /api/releases` queries public GitHub latest releases for the two app repositories,
then validates the accompanying `release-manifest.json`: stable version/tag, positive build,
source commit, expected package name, SHA-256 digest, size, and owned download URLs.
Packages must include `SHA256SUMS`. GitHub's asset digest is checked when supplied.
Metadata is cached for five minutes at the edge. The browser only queries this same-origin API.
Source-build links remain visible until a valid published package is available, or if GitHub
is temporarily unavailable. No nonexistent binary download is advertised.

Each app pipeline publishes immutable GitHub release assets; the website discovers newer
releases without needing a new website deployment. Android downloads are signed APKs.
Mac downloads are Developer ID signed and notarized universal DMGs. Versions in source-only
fallback copy reflect the initial baselines: Android 1.1.1 (3), Mac 1.0.0 (1). Change these
fallback values and the matching static HTML when the minimum supported source baseline changes.
Drafts and prereleases do not become the stable download. Publish fixes as new versions;
never move release tags or replace existing assets.

## Files

- `public/index.html`, `style.css`, `site.js`: responsive landing page and download controls.
- `public/privacy.html`: app and website privacy boundaries.
- `public/_headers`: browser security policies for static assets.
- `src/worker.js`: release validation, API method handling, cache and asset routing.
- `tests/releases.test.js`: publication and destination validation regression tests.
- `.github/workflows/verify-deploy.yml`: checks and production deployment.

Dashboard illustrations contain example data, not personal recorded history. Public downloads
and source links are served by GitHub; website requests are served by Cloudflare. Updates to
app architecture, privacy, prerequisites, or distribution must update the website copy too.
