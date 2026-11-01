# Flixora mobile app

This Expo/React Native client implements Flixora's primary navigation and dark cinematic interface using `#0F0F0F`, neon purple `#8B5CF6`, and cyan `#06B6D4`.

Included UI:

- React Navigation native stack plus bottom tabs for Home, Explore, Downloads, and Profile.
- Stack screens for Movie Details, Video Player, and Multi-Profile Selection.
- Auto-advancing featured hero carousel with Play, Watchlist, details, and page indicators.
- Continue Watching progress, Top 10, Trending, Action, and personalized rails.
- Responsive discovery grid and search/genre filtering.
- Details backdrop gradient, HD/4K/IMDb badges, Play/Download/Watchlist/Share actions.
- Overview, authorized server links, episodes, and reviews tabs.
- `expo-video` player with source switching, fullscreen/PiP, speed, and ±10 second seek.
- Profile-isolated AsyncStorage watchlists, download queues, and playback history with Kids filtering.
- Server-proxied TMDB trending, search and detail enrichment with a bundled offline fallback.

## Dynamic TMDB catalog

Set `EXPO_PUBLIC_API_URL` to the Flixora Express API. `CatalogProvider` loads normalized daily trending movies/TV shows, debounces Explore searches, and fetches trailers/cast when a TMDB details screen opens. Keep `TMDB_API_TOKEN` only in the root API `.env`. Full setup is documented in `../docs/TMDB_INTEGRATION.md`.

## Custom player

`src/screens/PlayerScreen.tsx` provides a full-screen custom overlay over `expo-video`:

- HLS, DASH and progressive MP4 content-type selection;
- play/pause, ±10-second seek, timeline and generated frame-preview thumbnails/time;
- swipe vertically on the left for app brightness and on the right for player volume;
- Auto/480p/720p/1080p/4K selection using authorized source renditions;
- native audio/subtitle track selection;
- server drawer and automatic failover while preserving playback position;
- episode-aware local progress plus version-safe API checkpoints every 10 seconds;
- offline-file selection when the network is unavailable.

Copy `.env.example` to `.env` and set `EXPO_PUBLIC_API_URL` when a backend is available. Call `saveAccessToken()` from `src/services/playbackApi.ts` after authentication; the token is stored with device-only SecureStore protection. The API client serializes writes, sends UUID event IDs, and resolves optimistic-version conflicts against the repository's playback-history endpoint.

The checked-in demo catalog uses readable slug IDs and therefore keeps progress local. A backend-fed production catalog must use the UUID profile/media/episode IDs returned by the API.

## Download manager

`src/downloads/DownloadProvider.tsx` implements per-profile resumable MP4 downloads with background sessions, persistent resume data, integrity receipts, pause, resume, cancel, removal, storage usage, file verification after restart, network checks and offline playback. Progress updates and persistent writes are throttled to avoid storage churn. Files live inside the app-only document sandbox; receipts are kept in device-only SecureStore. iOS Data Protection and Android file-based encryption protect the sandbox at rest on secured devices.

Protected offline HLS/DASH must use FairPlay (`AVAssetDownloadURLSession`) or Widevine/Media3 native persistent licenses. The JavaScript manager intentionally rejects adaptive manifests instead of downloading unprotected segments. Add a native DRM download adapter before distributing licensed content.

```sh
cd mobile
npm ci
npm run typecheck
npm run start
```

Validated exports:

```sh
npx expo export --platform android
npx expo export --platform ios
```

The checked-in catalog, remote artwork and sample streams are demonstration data. Production use requires API authentication, adult PIN verification, licensed catalog artwork, server-authorized HLS/DASH manifests, DRM/persistent offline licenses, cross-device catalog IDs, analytics and moderation. Update the placeholder bundle IDs before a store build.
