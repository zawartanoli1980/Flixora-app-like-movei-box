# Flixora

Flixora is a full-stack movie and media application foundation with a polished React web demo, an Expo/React Native mobile client, a modular Express API, and a PostgreSQL 16 schema.

The downloadable demo is intentionally honest about its boundaries: it uses public sample video and demo catalog metadata. Real movies, DRM, billing, encrypted downloads, and production identity require licensed providers and credentials.

## What works in the demo

- Responsive home, hero, discovery, search, multi-filter browsing, title details, watchlist, reviews, and community presentation.
- Adult and Kids demo profiles with profile-isolated local data, Kids catalog restrictions, and a clearly labelled demo PIN (`1234`).
- Profile-specific Continue Watching based on saved progress.
- Video controls for play/pause, ±10 seconds, speed, fullscreen, audio/subtitle/episode selection, and safe source failover.
- The web demo includes a simulated download queue; the Expo mobile client performs resumable direct-file downloads with pause, resume, cancel, storage accounting, restart recovery, and offline playback.
- Expo mobile screens for Home, Discover, Details, Player, Downloads, and Profiles; per-profile AsyncStorage; Kids filtering; HLS/DASH/MP4 playback; brightness/volume gestures; seek thumbnails; audio/subtitle tracks; and automatic source failover.
- Express `/api/v1` routes for health/readiness, catalog, episodes, profiles, PIN protection, watchlists, playback history, reviews, comments, playlists, and authorized playback sessions.
- Server-side TMDB integration for daily/weekly trends, movie/TV details, trailers, cast, search, discovery filters, normalized mobile data, and licensed source-template mapping.
- PostgreSQL models for users, profiles, media, episodes, licensed sources/rights, devices, downloads, community data, playback events, recommendation snapshots, and daily rankings.

## Web setup

Requires Node.js 22.12 or newer.

```sh
npm ci
npm run dev
```

Open `http://localhost:5173`. The web demo works without the API and stores preview data in browser storage.

Build and validate everything:

```sh
npm run check
```

## API setup

For a read-only demo catalog, copy `.env.example` values into your shell or environment manager and start:

```sh
DEMO_MODE=true WEB_ORIGINS=http://localhost:5173 npm run api
```

The API listens on port `3001`. Useful checks:

- `GET /api/v1/health`
- `GET /api/v1/readiness`
- `GET /api/v1/media?genre=Sci-Fi&rating=8&page=1&limit=24`

Profile and community writes require `DATABASE_URL`, OIDC settings, and a bearer token. Secure PIN unlock also requires `PROFILE_UNLOCK_SECRET`. Playback-session issuance requires active title rights, approved stream assets, `PLAYBACK_SIGNING_SECRET`, and `CDN_BASE_URL`. Apply [db/schema.sql](db/schema.sql) to a new PostgreSQL 16 database through a real migration workflow; do not reapply the bootstrap file to an existing database.

## Mobile setup

```sh
cd mobile
npm ci
npm run typecheck
npm run start
```

Use an Expo development build for native video behavior. Before publishing, replace the placeholder bundle identifiers in `mobile/app.json` and connect the API/authentication configuration. See [mobile/README.md](mobile/README.md).

## TMDB setup

Add a TMDB API Read Access Token to the server's `.env`; never expose it through an `EXPO_PUBLIC_*` variable. The mobile catalog automatically uses the normalized backend endpoints and falls back to bundled demo data when the backend is unavailable. Streaming source templates must point to content you are authorized to distribute.

See [docs/TMDB_INTEGRATION.md](docs/TMDB_INTEGRATION.md) for environment variables, endpoint examples, filtering options, source mapping, attribution, and production guidance.

## Repository map

- `src/` — responsive React web application
- `mobile/` — Expo/React Native TypeScript client
- `server/` — Express API, authorization, validation, demo catalog, and tests
- `db/schema.sql` — PostgreSQL 16 bootstrap schema
- `docs/ARCHITECTURE.md` — system design, security boundaries, and production rollout notes
- `docs/SRS.md` — complete Software Requirements Specification and acceptance baseline
- `docs/TMDB_INTEGRATION.md` — TMDB, normalization, search/discovery, and source mapping setup
- `dist/` — verified web production build

Never commit `.env` files, database credentials, signing secrets, DRM keys, or raw provider tokens. The included TMDB artwork URLs and public sample videos are demo dependencies; production must use artwork and streams for which you hold distribution rights.
