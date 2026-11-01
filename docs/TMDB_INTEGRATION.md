# Flixora TMDB integration

Flixora calls TMDB from the Express API. The mobile client never receives the TMDB read token. The API normalizes TMDB movies and TV shows into the same camel-case `MediaItem` shape used by the React Native application.

## 1. Create and configure a TMDB token

1. Create a TMDB account and request API access at <https://www.themoviedb.org/settings/api>.
2. Copy `.env.example` to `.env` in the repository root.
3. Add the **API Read Access Token** as `TMDB_API_TOKEN`.

```dotenv
PORT=3001
DEMO_MODE=true
WEB_ORIGINS=http://localhost:5173
DEFAULT_COUNTRY=US
TMDB_API_TOKEN=replace-with-your-v4-read-access-token
TMDB_LANGUAGE=en-US
```

Never put this token in `mobile/.env`, an `EXPO_PUBLIC_*` variable, source control, or a client-side web bundle.

Point the mobile client at the Express API:

```dotenv
# mobile/.env
EXPO_PUBLIC_API_URL=http://192.168.1.20:3001
```

Use the development machine's LAN address for a physical phone. Android Emulator can normally use `http://10.0.2.2:3001`; iOS Simulator can use `http://127.0.0.1:3001`.

## 2. Configure authorized streaming sources

TMDB supplies metadata and public trailer references. It does **not** provide movie or episode streams. Configure only CDN/origin URLs for content you are licensed to distribute:

```dotenv
STREAM_SERVER_1_TEMPLATE=https://stream-1.example.com/{mediaType}/{tmdbId}/video.mp4
STREAM_SERVER_2_TEMPLATE=https://stream-2.example.com/{mediaType}/{tmdbId}/video.mp4
STREAM_CDN_HLS_TEMPLATE=https://cdn.example.com/{mediaType}/{tmdbId}/master.m3u8
```

`{tmdbId}` is required. Templates also support `{mediaType}`, `{season}`, and `{episode}`. Episode placeholders are emitted only when both episode coordinates are present. Templates must use credential-free HTTPS URLs. Use a server-side playback-session endpoint when URLs require short-lived signatures; never place permanent CDN credentials in a template.

If the templates are omitted, TMDB titles still show metadata, cast and trailers, while `sources` remains empty and playback stays disabled.

## 3. Start the integration

```sh
npm ci
npm run api

cd mobile
npm ci
npm run start
```

`npm run api` reads the root `.env` when present. Confirm configuration:

```sh
curl http://localhost:3001/api/v1/readiness
curl 'http://localhost:3001/api/v1/tmdb/trending?type=all&window=day'
```

The mobile `CatalogProvider` loads daily trending results at startup, enriches a title with details/cast/trailers when its details screen opens, uses TMDB search after a 350 ms debounce, and retains the checked-in catalog as an offline fallback.

## API endpoints

| Endpoint | Purpose |
| --- | --- |
| `GET /api/v1/tmdb/trending?type=all&window=day&page=1` | Daily/weekly movie and TV trends |
| `GET /api/v1/tmdb/movie/:tmdbId` | Movie details, trailers, credits and certification |
| `GET /api/v1/tmdb/tv/:tmdbId` | TV details, trailers, credits and content rating |
| `GET /api/v1/tmdb/:type/:tmdbId/trailers` | Normalized YouTube/Vimeo trailers |
| `GET /api/v1/tmdb/:type/:tmdbId/cast` | Cast and crew metadata |
| `GET /api/v1/tmdb/search?q=dune&type=multi` | Movie/TV keyword search |
| `GET /api/v1/tmdb/discover?type=movie&genres=12,878&year=2024&ratingMin=7` | Advanced filtering |

Discovery supports type, genre IDs, year, original language, country, rating range, adult-content exclusion, page, and an allowlisted TMDB sort order. All query input is validated before reaching TMDB.

## Main modules

- `server/tmdb.js` — authenticated TMDB fetch client, bounded retries, timeout, cache, normalization, trailers and credits.
- `server/source-mapper.js` — HTTPS source templates mapped to Flixora `StreamSource` objects.
- `server/tmdb-routes.js` — validated public metadata endpoints.
- `mobile/src/services/catalogApi.ts` — typed mobile API client.
- `mobile/src/state/CatalogState.tsx` — dynamic catalog state and local fallback.

Unknown TMDB certifications default to age 18, so unrated titles do not enter Kids profiles. TMDB requests use a five-minute in-memory cache, coalesce identical in-flight calls, retry bounded `429`/`5xx` responses, and never log the bearer token.

## Attribution and production notes

Display the required TMDB attribution in the app's About/Credits screen: **“This product uses the TMDB API but is not endorsed or certified by TMDB.”** Follow the current TMDB branding and API terms for logos, attribution, caching, and commercial use.

TMDB IDs are external metadata identifiers. Persist a separate internal UUID when importing a title into PostgreSQL, and store the TMDB ID as a unique external reference. Playback history, rights, billing and signed CDN access should continue to use internal IDs and authorized backend checks.
