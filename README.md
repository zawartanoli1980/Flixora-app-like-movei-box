# Flixora

Flixora now starts an empty, persistent streaming library with a protected content workspace. The original dark branding is retained. The active website does not load the old demo catalog, fabricated viewing statistics, sample movie links or simulated downloads.

This is the first functional delivery stage, **not a complete production streaming service**. See [implementation and integration checklist](docs/PLATFORM_DELIVERY.md) for precise boundaries and remaining work.

## Run locally

Requirements: Node **24+** (built-in SQLite), npm, `ffmpeg`, and `ffprobe`.

```sh
npm ci
npm --prefix mobile ci
npm run api
# Separate terminal, same repository directory:
npm run dev -- --port 5173 --strictPort
```

The API defaults to port 3201; Vite proxies `/api` to it. Both must run. Use `PORT` and `FLIXORA_API_TARGET` together to override. `npm run build` produces the web client; deploy it with the API behind the same HTTPS origin, forwarding `/api` to the API. A static-only host cannot provide accounts or playback authorization. Never use the Vite development server for a public production deployment.

Copy `.env.platform.example` to a private `.env` only if it does not already exist. Merge required settings rather than overwriting an existing file. Application data goes into ignored `.flixora/` by default. Mount `PLATFORM_DATA_DIR` on durable private storage for deployment. Never expose that directory through a static web server.

## Initial owner

There are no default accounts or passwords. Supply `OWNER_EMAIL` and a unique `OWNER_PASSWORD` (at least 12 characters) securely in your shell, then run:

```sh
npm run owner:create
```

Remove the two variables after this one-time operation. Do not put secret values in commands committed to Git, logs, or chat. A second owner bootstrap is refused. Open `/admin` and sign in. Only the owner can provision staff roles; public registration always creates customers.

## First content workflow

1. In **Content**, create a draft with one explicit primary section, metadata, license reference and rights dates.
2. Upload your authorized MP4 or WebM. Interrupted transfers can resume by reselecting the same file.
3. The durable processing queue inspects the video, decodes a representative segment, and generates a thumbnail. Failed jobs explain the error and can be retried.
4. A successful job moves the title to review. Publish it explicitly.
5. It appears only in its correct public library. Playback rechecks rights, serving region, maturity, publication and premium entitlement. Metadata-only records never become playable.

Series publish as metadata-only episode collections; only validated episodes are playable. Episodes must reference a series in the same section. Viewers can choose seasons/episodes and enable next-episode autoplay. Live-event publishing is blocked until an authorized live adapter exists. Rights expiry and missing files automatically unpublish content. A daily validation run temporarily removes the title from public playback and returns successful media to review. Passing once does not guarantee permanent availability.

## Authorized imports

Mount an authorized folder and set `AUTHORIZED_IMPORT_ROOT`. Put your own `catalog.json` at its root. Each entry has `metadata` matching the content form/API and optional `media`, a relative MP4/WebM path below the approved root. `providerId` is required and namespaced per source. Do not place credentials in the manifest.

```json
[
  {
    "metadata": {
      "providerId": "YOUR-STABLE-ASSET-ID",
      "title": "YOUR-LICENSED-TITLE",
      "description": "YOUR-DESCRIPTION",
      "section": "movies",
      "kind": "movie",
      "language": "en",
      "rightsStart": "2026-01-01T00:00:00.000Z",
      "rightsEnd": "2027-01-01T00:00:00.000Z",
      "license": "YOUR-CONTRACT-REFERENCE",
      "authorized": true,
      "premium": false
    },
    "media": "YOUR-RELATIVE-FILE.mp4"
  }
]
```

This is a format example, not seed data. Use your actual rights dates. Connect the storage source in **Sources**, then **Import now** or enable hourly checks. Jobs checkpoint each entry, detect duplicates, retain errors and support cancellation/resume. A manifest must remain unchanged while resuming a run. Ambiguous sections enter **Imports → Classification review**. Reviewed classifications create metadata drafts; attach and validate media separately. Missing `media` always produces a metadata-only draft. No remote URL fetcher, Netflix/MovieBox integration, DRM bypass or unauthorized scraper is provided.

## Accounts and integrations

- Google: set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and the exact `GOOGLE_REDIRECT_URI`; enable Google OIDC in your approved web client. Authorization code, PKCE, state, nonce, issuer/audience/signature and verified-email checks are implemented. Live Google validation is outstanding. Existing email accounts are never silently linked. Google-only accounts can set an account password through the email reset flow before using parental account controls.
- Email: set TLS SMTP settings and `PUBLIC_APP_URL`. Registration requires email verification; password reset tokens are hashed, expire in 30 minutes, are single-use and revoke all sessions. With no mail service, these actions explain the missing setup. Live delivery is outstanding.
- Payments: **no live or sandbox processor adapter has been enabled**. Cards, Easypaisa and JazzCash show Setup required. Checkout and webhook endpoints reject requests; a redirect, client event or screenshot cannot grant access. Merchant contracts, current official documentation, adapter implementation and verified sandbox tests are still required. Owner-created prepaid plan definitions cannot be sold yet.
- Complimentary access: Finance/Owner can grant expiring access and revoke it. Every playback request checks current entitlement. This is not a paid subscription.

See [configuration and acceptance checklist](docs/PLATFORM_DELIVERY.md) before deployment.

## Validation

```sh
npm run check
# Start the web development server, then:
npm run test:browser
```

The browser check requires Chromium (`CHROMIUM_PATH` can override `/usr/bin/chromium`). It uses a temporary isolated database and generated test-only video; no test accounts or movies enter the actual app. It exercises owner login, draft creation, real upload, processing, publication, actual browser video decoding, category isolation and mobile overflow. API tests cover permissions, imports, premium expiry/revocation, profiles, PIN lockout, email tokens and rejected unverified payments.

The Expo client and legacy API modules are retained for further migration and regression tests; they are not part of the active real-content website. The old standalone demo/ZIP are historical assets, not deployable versions of this platform. Do not publish them as a real catalog. Original prototype documentation is preserved in [docs/LEGACY_DEMO.md](docs/LEGACY_DEMO.md).
