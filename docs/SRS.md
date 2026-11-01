---
title: "Flixora Software Requirements Specification"
subtitle: "Web, iOS, Android, Backend, Streaming, and Community Platform"
author: "Flixora Product Engineering"
date: "1 November 2026"
version: "1.0"
---

# Document control

| Field | Value |
| --- | --- |
| Product | Flixora |
| Document | Software Requirements Specification (SRS) |
| Version | 1.0 |
| Status | Baseline for implementation and stakeholder review |
| Platforms | Responsive web, iOS, Android, backend services |
| Intended audience | Product owners, designers, engineers, QA, DevOps, security, content operations |

## Revision history

| Version | Date | Description |
| --- | --- | --- |
| 1.0 | 1 November 2026 | Initial complete product requirements baseline |

# 1. Introduction

## 1.1 Purpose

This SRS defines the functional and non-functional requirements for Flixora, a premium movie and media discovery and streaming application. It provides a shared, testable contract for product, design, engineering, quality assurance, security, and operations.

The specification covers the target production product. The repository also contains a demonstration implementation; features that need licensed content, DRM, production identity, billing, moderation operations, or deployment infrastructure remain dependent on those services.

## 1.2 Product vision

Flixora combines cinematic discovery, personalized recommendations, reliable adaptive streaming, profile-based viewing, offline playback, and community curation in one consistent experience across web and mobile devices.

## 1.3 Scope

Flixora shall provide:

- account authentication and multi-profile management;
- Adult and Kids experiences with age controls and Adult profile PIN protection;
- catalog browsing, search, advanced filters, and rich title metadata;
- personalized, trending, Top 10, and Continue Watching rails;
- HLS/DASH adaptive playback with track, episode, speed, seek, and source controls;
- synchronized watchlists and playback history;
- authorized encrypted offline downloads on supported mobile devices;
- ratings, reviews, comments, and user-curated playlists;
- territory, entitlement, age, rights, and device authorization;
- operational APIs, content moderation, observability, and secure administration.

Flixora shall only distribute content for which the operator has valid rights. The system shall not accept arbitrary public stream URLs from end users.

## 1.4 Out of scope for the initial production release

- user-uploaded movies or live-stream broadcasting;
- peer-to-peer media delivery;
- arbitrary third-party stream scraping;
- advertising marketplace and ad insertion;
- physical media sales;
- social direct messaging;
- end-user video editing.

## 1.5 Definitions

| Term | Definition |
| --- | --- |
| ABR | Adaptive bitrate streaming |
| CDN | Content delivery network |
| DASH | Dynamic Adaptive Streaming over HTTP |
| DRM | Digital rights management, such as Widevine or FairPlay |
| HLS | HTTP Live Streaming |
| Media | A movie, TV series, anime, or documentary catalog record |
| Profile | A viewing identity owned by one account |
| Playback session | Short-lived authorization for a profile/device to play one title or episode |
| Source | An approved, server-managed media manifest/CDN origin |
| Watch history | Profile-specific playback position and completion state |

# 2. Product overview

## 2.1 Product perspective

Flixora consists of:

1. a React web application;
2. an Expo/React Native iOS and Android application;
3. a versioned Express API;
4. PostgreSQL for transactional product data;
5. Redis and background workers for caching, jobs, rankings, and distributed controls;
6. an external OIDC identity provider;
7. a licensed media pipeline, private object storage, CDN, and DRM provider;
8. analytics, moderation, monitoring, and administrative services.

## 2.2 User classes

| Actor | Description | Main capabilities |
| --- | --- | --- |
| Visitor | Unauthenticated user | View marketing, supported devices, and sign-in/sign-up entry points |
| Account owner | Authenticated paying or entitled user | Manage account, profiles, devices, subscription, and privacy settings |
| Adult profile | General viewing profile | Browse entitled catalog, play content, manage library, downloads, and community activity |
| Kids profile | Restricted profile | Browse and play age-appropriate content; no public community posting |
| Moderator | Trusted operations user | Review reports, approve/reject content, apply sanctions, and audit actions |
| Content manager | Trusted catalog user | Manage metadata, artwork, territories, rights, episodes, tracks, and release schedules |
| Support agent | Limited operations user | Diagnose account/device issues without accessing payment secrets or raw credentials |
| System administrator | Infrastructure/security operator | Configure services, deployments, secrets, access, and incident response |

## 2.3 Operating environment

- Latest two stable versions of Chrome, Edge, Firefox, and Safari.
- iOS current major version and previous two major versions.
- Android 10 or newer for the initial supported mobile baseline.
- Responsive layouts from 360 CSS pixels through large desktop screens.
- PostgreSQL 16 or later.
- Node.js 22.12 or later for backend and web build tooling.
- HTTPS for every production client and service connection.

## 2.4 Assumptions and dependencies

- A licensed catalog and valid territory/time rights are supplied by content operations.
- OIDC identity, payment/entitlement, DRM, CDN, email/push, and analytics providers are configured.
- Mobile store certificates, bundle identifiers, privacy declarations, and review accounts are available.
- Users may experience intermittent networks; clients must recover without corrupting local state.
- Offline playback depends on platform DRM capability and rights-holder permission.
- Recommendations require consented behavioral events and sufficient data volume.

# 3. Functional requirements

Requirements use the terms **shall** and **must** for mandatory behavior. Each requirement has a stable identifier for design, implementation, and test traceability.

## 3.1 Authentication and account management

- **FR-AUTH-001:** The system shall support account registration and sign-in through an OIDC provider using Authorization Code with PKCE.
- **FR-AUTH-002:** The system shall verify access-token signature, issuer, audience, expiry, algorithm, and subject before processing authenticated API requests.
- **FR-AUTH-003:** The system shall support verified email recovery and provider-approved multi-factor authentication.
- **FR-AUTH-004:** The mobile application shall store refresh credentials only in OS-provided secure storage.
- **FR-AUTH-005:** The web application shall use secure, HTTP-only, same-site session cookies or another approved browser token architecture that does not expose long-lived refresh tokens to application JavaScript.
- **FR-AUTH-006:** The account owner shall be able to view active devices, revoke a device, sign out all devices, and delete the account.
- **FR-AUTH-007:** Account deletion shall enter a documented retention workflow and remove or anonymize personal data unless legal obligations require retention.
- **FR-AUTH-008:** The API shall provision the internal user record transactionally from a trusted identity event before profile creation.

## 3.2 Profiles and parental controls

- **FR-PRO-001:** An account shall support at least five profiles.
- **FR-PRO-002:** A profile shall include a name, avatar, locale, age limit, and Adult/Kids classification.
- **FR-PRO-003:** Watchlist, history, recommendations, ratings, reviews, playlists, and downloads shall be isolated by profile.
- **FR-PRO-004:** A Kids profile shall only receive media at or below its server-enforced age limit.
- **FR-PRO-005:** Kids profiles shall not create public reviews, comments, or public playlists.
- **FR-PRO-006:** An Adult profile may be protected by a 4–8 digit PIN stored only as a memory-hard server-side hash.
- **FR-PRO-007:** Five failed PIN attempts shall lock PIN verification for 15 minutes or the configured security interval.
- **FR-PRO-008:** Successful PIN verification shall issue a short-lived, owner- and profile-bound unlock token.
- **FR-PRO-009:** Playback of restricted media shall require a valid profile unlock token when the profile is PIN-protected.
- **FR-PRO-010:** The final profile on an account shall not be deletable until another profile exists or the account is deleted.

## 3.3 Home and discovery

- **FR-HOME-001:** The Home screen shall present a featured hero with artwork or an eligible muted preview, title metadata, Play, My List, and More Information actions.
- **FR-HOME-002:** Automatic preview shall respect reduced-motion, data-saver, autoplay, visibility, and network settings.
- **FR-HOME-003:** Home shall provide Continue Watching, personalized recommendations, Because You Watched, Trending, and territory-aware Top 10 rails.
- **FR-HOME-004:** Continue Watching shall use the active profile's latest synchronized playback state.
- **FR-HOME-005:** Top 10 shall represent unique engaged profiles for the current territory and ranking date, with abuse controls.
- **FR-HOME-006:** Recommendation cards shall include a meaningful explanation where applicable.
- **FR-HOME-007:** Unavailable, expired, age-ineligible, or unentitled titles shall not be recommended for playback.
- **FR-HOME-008:** Rail ordering and impressions shall be measurable for recommendation quality analysis.

## 3.4 Catalog, search, and filters

- **FR-CAT-001:** Users shall browse Movies, TV Series, Anime, and Documentaries.
- **FR-CAT-002:** Search shall match normalized title, alternative title, cast, director, genre, and synopsis metadata as permitted by the catalog provider.
- **FR-CAT-003:** Search shall tolerate case, accents, and common spelling differences.
- **FR-CAT-004:** Users shall filter by genre, release year, country, original language, IMDb rating, and media type.
- **FR-CAT-005:** Users shall combine multiple filters and clear them in one action.
- **FR-CAT-006:** Catalog responses shall be paginated and deterministically ordered.
- **FR-CAT-007:** The API shall reject unknown or invalid filter fields with a structured `400` response.
- **FR-CAT-008:** The API shall use parameterized queries and shall not interpolate user search text into SQL.
- **FR-CAT-009:** Catalog results shall enforce publication state, territory rights, entitlement, and profile age rules where the request is profile-scoped.
- **FR-CAT-010:** An empty result shall present recovery actions rather than a blank screen.

## 3.5 Media details and episodes

- **FR-DET-001:** The Details screen shall show title, synopsis, artwork, year, duration, genre, rating, age rating, languages, availability, and content type.
- **FR-DET-002:** Series shall expose seasons and ordered episode metadata.
- **FR-DET-003:** A user shall add or remove a title from My List idempotently.
- **FR-DET-004:** The screen shall expose Play/Resume/Restart according to history state.
- **FR-DET-005:** Download quality options shall only include renditions allowed by the asset, device, entitlement, available storage, and content rights.
- **FR-DET-006:** Public community content shall display moderation-approved items only.
- **FR-DET-007:** Related titles shall honor age, territory, availability, and entitlement rules.

## 3.6 Playback

- **FR-PLY-001:** Playback shall use HLS and/or DASH adaptive bitrate manifests from approved licensed sources.
- **FR-PLY-002:** Before playback, the API shall verify authenticated ownership, active profile, PIN unlock if required, age limit, entitlement, territory rights, asset availability, episode relationship, and concurrent-stream policy.
- **FR-PLY-003:** The API shall return only short-lived signed playback URLs and shall never expose private storage keys.
- **FR-PLY-004:** Clients shall not accept an arbitrary playback URL supplied by an end user.
- **FR-PLY-005:** The player shall provide play/pause, timeline, 10-second backward/forward seek, volume/mute, fullscreen, and playback speed from 0.5× through 2.0×.
- **FR-PLY-006:** The player shall allow selection from audio and subtitle tracks actually present in the authorized manifest.
- **FR-PLY-007:** Series playback shall expose an episode selector and preserve the selected season context.
- **FR-PLY-008:** When an authorized source fails, the client shall perform a bounded retry and switch to the next server-managed source while preserving playback time.
- **FR-PLY-009:** The client shall display an actionable error when no authorized source is usable.
- **FR-PLY-010:** The client shall refresh an expired playback authorization through the API without accepting an unsigned replacement.
- **FR-PLY-011:** Web playback shall use hls.js where native HLS is unavailable and a DRM-capable DASH adapter where required.
- **FR-PLY-012:** Mobile playback shall use native AVPlayer/ExoPlayer capabilities through the approved React Native adapter.
- **FR-PLY-013:** The player shall respect captions, audio description, and accessibility preferences when tracks are available.

## 3.7 Playback history and synchronization

- **FR-HIS-001:** The client shall checkpoint playback progress at least every 15 seconds and on pause, seek, background, title change, and exit.
- **FR-HIS-002:** A history checkpoint shall include profile, media, optional episode, position, duration, completion, unique event ID, and expected version.
- **FR-HIS-003:** The API shall use optimistic concurrency and return `409` for stale or duplicate updates.
- **FR-HIS-004:** The client shall reconcile a conflict with the latest server timestamp/version without silently overwriting newer progress.
- **FR-HIS-005:** A title shall be considered complete at a configurable threshold, initially 95 percent.
- **FR-HIS-006:** Users shall be able to restart a title or remove it from Continue Watching.
- **FR-HIS-007:** History shall synchronize across authorized devices for the same profile.

## 3.8 Offline downloads

- **FR-DL-001:** Supported mobile devices shall download authorized titles in 480p, 720p, 1080p, or 4K when the asset and rights allow the chosen quality.
- **FR-DL-002:** The server shall authorize each device/title/quality combination and issue an expiring offline DRM license.
- **FR-DL-003:** Media files and license material shall reside in encrypted application-controlled storage.
- **FR-DL-004:** The download manager shall show queued, downloading, paused, completed, failed, expired, and renewing states.
- **FR-DL-005:** Users shall pause, resume, retry, and remove individual downloads.
- **FR-DL-006:** The app shall show per-item progress, estimated size, total Flixora storage use, and available device storage.
- **FR-DL-007:** Downloads shall recover safely from process termination, partial files, and temporary network failure.
- **FR-DL-008:** Expired, revoked, or account-ineligible downloads shall stop playing and shall be renewed or removed according to rights policy.
- **FR-DL-009:** Profile and device ownership shall both be enforced for every download record.
- **FR-DL-010:** Browser download controls may be presented only as a clearly labelled simulation unless a supported licensed web-offline implementation exists.

## 3.9 Ratings, reviews, comments, and playlists

- **FR-COM-001:** An eligible Adult profile shall submit or update one 1–5 star rating per title.
- **FR-COM-002:** A review shall contain no more than 2,000 characters and shall enter moderation before public display.
- **FR-COM-003:** Users shall create threaded comments whose parent belongs to the same title.
- **FR-COM-004:** Users shall create private or public curated playlists and add, remove, and reorder titles.
- **FR-COM-005:** Public playlists shall show curator, title, description, item count, and included titles.
- **FR-COM-006:** Users shall report abusive reviews, comments, playlists, or profiles.
- **FR-COM-007:** Users shall block profiles where policy permits public profile interaction.
- **FR-COM-008:** All user-generated content shall render as escaped text; raw user HTML shall never be executed.
- **FR-COM-009:** Community write endpoints shall enforce authentication, profile ownership, age rules, input limits, rate limits, and moderation state.
- **FR-COM-010:** Moderators shall record an auditable reason for approval, rejection, removal, or sanction actions.

## 3.10 Notifications

- **FR-NOT-001:** Users may opt into release, download, account security, and recommendation notifications.
- **FR-NOT-002:** Security and account-recovery messages shall not depend on marketing consent.
- **FR-NOT-003:** Push/email preferences shall be configurable by category and device where supported.
- **FR-NOT-004:** Notifications shall deep-link to an authorized in-app destination and shall not expose private viewing details on a locked device unless the user permits previews.

## 3.11 Content and moderation administration

- **FR-ADM-001:** Authorized content managers shall create and update media, seasons, episodes, artwork, track metadata, source priority, and release schedules.
- **FR-ADM-002:** Rights records shall specify territory, validity interval, and offline permission.
- **FR-ADM-003:** The system shall prevent playback when rights are absent, not yet active, or expired.
- **FR-ADM-004:** Source health, availability window, region, and priority shall be configurable without client releases.
- **FR-ADM-005:** Administrative actions shall be role-restricted, logged, and reviewable.
- **FR-ADM-006:** Moderation queues shall support filtering, assignment, decision, appeal state, and audit history.

## 3.12 Billing and entitlements

- **FR-BIL-001:** The system shall obtain subscription and purchase state from an approved billing provider.
- **FR-BIL-002:** The backend, not the client, shall decide playback/download entitlement.
- **FR-BIL-003:** Billing webhooks shall be signature-verified, idempotent, and auditable.
- **FR-BIL-004:** Subscription loss shall follow a grace-period policy and shall revoke playback/download access when the policy expires.
- **FR-BIL-005:** Price, tax, renewal, cancellation, and trial terms shall be displayed according to store and territory requirements.

# 4. External interface requirements

## 4.1 User interface

- Dark deep-navy/black surfaces with violet primary accents, cyan/mint success or match indicators, and warm rating accents.
- Responsive navigation: persistent sidebar on wide screens and accessible overlay navigation on small screens.
- Visible keyboard focus, semantic labels, focus trapping/restoration for dialogs, and reduced-motion support.
- Loading, empty, offline, error, expired-session, and retry states for every network-dependent screen.
- Minimum interactive target of 44 by 44 CSS points on touch layouts.
- Text and essential controls shall meet WCAG 2.2 AA contrast requirements.

## 4.2 API interface

- JSON over HTTPS under `/api/v1`.
- Bearer access tokens for authenticated service requests unless the approved web session design uses protected cookies.
- Request IDs returned in `X-Request-ID` and propagated to logs/traces.
- Structured errors containing a stable code, safe message, optional field details, and request ID.
- Idempotency keys for billing, device registration, download authorization, and other retry-sensitive writes.
- Cursor pagination for high-volume production collections; bounded page/limit may be used during MVP migration.

## 4.3 Media interface

- Private relative manifest keys in the database.
- Five-minute default signed playback authorization, configurable by policy.
- HLS/DASH manifests, DRM metadata, available audio/subtitle tracks, maximum resolution, and authorized fallback sources.
- CDN and transcoder callbacks authenticated and idempotent.

## 4.4 Device interfaces

- iOS AVPlayer, FairPlay, secure key storage, and background asset downloads.
- Android Media3/ExoPlayer, Widevine, Keystore, and background DownloadService.
- OS notification and deep-link facilities.
- Accurate storage availability checks before downloads.

# 5. Data requirements

## 5.1 Core entities

| Entity | Purpose | Key relationships |
| --- | --- | --- |
| User | Stable account mapped to identity provider | Owns profiles and devices |
| Profile | Viewing identity and age/PIN policy | Owns history, library, community, recommendations |
| Media | Movie/series/anime/documentary metadata | Owns episodes, rights, sources |
| Episode | Ordered series episode | Belongs to one media record |
| Stream asset | Private approved manifest and track capabilities | Belongs to media and optional episode |
| Media rights | Territory/time/offline permission | Belongs to media |
| Watchlist | Saved title | Joins profile and media |
| Playback history | Position, completion, version | Joins profile, media, optional episode |
| Device | Authorized client installation | Belongs to user |
| Download | Offline asset/license state | Belongs to matching user, profile, device, asset |
| Rating/review | Profile opinion and moderation state | Joins profile and media |
| Comment | Threaded moderated text | Joins profile and media; parent uses same media |
| Playlist/item | Curated ordered collection | Belongs to profile and contains media |
| Viewing event | Idempotent analytics/recommendation signal | Joins profile/media/device/session |
| Recommendation set/item | Generated ranked suggestions and reasons | Belongs to profile |
| Daily ranking | Territory/date Top 10 | Joins territory/date/media |

## 5.2 Data integrity rules

- All persistent identifiers shall be UUIDs unless an external provider requires another immutable key.
- Profile-owned data shall be inaccessible to other accounts.
- An episode referenced by an asset, event, or history record shall belong to the same media record.
- A comment reply shall reference a parent comment on the same media record.
- A download profile and device shall belong to the same user.
- Playback positions shall be non-negative and shall not exceed known duration.
- Territory codes shall use uppercase ISO 3166-1 alpha-2 values.
- Timestamps shall be stored in UTC and rendered in the user's locale.
- Secrets, raw payment data, DRM keys, and identity-provider credentials shall not be stored in product content tables.

## 5.3 Retention and privacy

- Retention periods shall be defined for raw viewing events, security logs, deleted accounts, and moderation evidence.
- Users shall be able to request export and deletion of applicable personal data.
- Recommendation use of viewing history shall follow consent and regional privacy requirements.
- Analytics shall minimize identifiers and avoid collecting media playback data not required for the declared purpose.

# 6. Non-functional requirements

## 6.1 Performance

- **NFR-PERF-001:** Cached API reads shall achieve p95 latency of 400 ms or less within the primary service region, excluding client network time.
- **NFR-PERF-002:** Standard authenticated writes shall achieve p95 latency of 700 ms or less, excluding external provider delays.
- **NFR-PERF-003:** Playback shall begin within 2.5 seconds at p50 and 5 seconds at p95 on a stable 10 Mbps connection when the CDN is healthy.
- **NFR-PERF-004:** Seek-to-frame time shall be 2 seconds or less at p95 under the same conditions.
- **NFR-PERF-005:** Home shall render meaningful cached content within 2.5 seconds at p75 on a representative mid-range mobile device and 4G network.
- **NFR-PERF-006:** Search suggestions shall respond within 300 ms at p95 after debounce for a warmed service.
- **NFR-PERF-007:** Clients shall lazy-load player and non-critical routes and shall avoid downloading trailers until eligible to play.
- **NFR-PERF-008:** Supported mid-range mobile reference devices shall maintain at least 55 frames per second during normal navigation and scrolling.
- **NFR-PERF-009:** Mobile cold start shall complete within 3 seconds at p75 on the supported mid-range reference device.

## 6.2 Availability and reliability

- **NFR-REL-001:** Core authentication, catalog, and playback authorization services shall target 99.9 percent monthly availability for the initial production tier.
- **NFR-REL-002:** The system shall support graceful degradation when recommendations, community, analytics, or notifications are unavailable.
- **NFR-REL-003:** API writes and provider webhooks shall be retry-safe and idempotent where duplicates could corrupt state.
- **NFR-REL-004:** Source switching shall be bounded to avoid retry loops and excess provider load.
- **NFR-REL-005:** PostgreSQL backups shall support a documented recovery point objective of 15 minutes and recovery time objective of 60 minutes, subject to the selected tier.
- **NFR-REL-006:** Restore drills shall occur at least quarterly.

## 6.3 Security

- **NFR-SEC-001:** Production traffic shall use TLS 1.2 or newer with certificate verification enabled.
- **NFR-SEC-002:** Secrets shall reside in an approved secret manager and shall never be committed to source control or returned to clients.
- **NFR-SEC-003:** The API shall enforce least privilege, deny by default, validate all input, use parameterized SQL, and return safe errors.
- **NFR-SEC-004:** Browser origins shall use an exact allowlist; wildcard credentialed CORS is prohibited.
- **NFR-SEC-005:** Authentication, PIN, billing, playback, moderation, and administration actions shall be rate-limited and audited.
- **NFR-SEC-006:** PIN hashes shall use scrypt, Argon2id, or an equivalently reviewed memory-hard function with unique salts and upgradeable parameters.
- **NFR-SEC-007:** Signed playback and unlock tokens shall have narrow audience, purpose, subject, and expiry claims.
- **NFR-SEC-008:** The release process shall include dependency, secret, static-code, container, and infrastructure scanning.
- **NFR-SEC-009:** The service shall maintain an incident response plan and security contact.
- **NFR-SEC-010:** The design shall be reviewed against OWASP ASVS and applicable mobile security guidance before launch.

## 6.4 Scalability

- **NFR-SCL-001:** Stateless API instances shall scale horizontally behind a load balancer.
- **NFR-SCL-002:** Shared rate limits, caches, locks, and background jobs shall use a distributed store.
- **NFR-SCL-003:** Media delivery shall bypass application servers and use CDN traffic paths.
- **NFR-SCL-004:** Catalog and community queries shall use measured indexes and bounded result sizes.
- **NFR-SCL-005:** Viewing events shall support asynchronous ingestion and backpressure.

## 6.5 Accessibility

- **NFR-ACC-001:** Web experiences shall target WCAG 2.2 AA.
- **NFR-ACC-002:** Core flows shall be operable by keyboard and major screen readers.
- **NFR-ACC-003:** Mobile controls shall expose accessible names, roles, state, and logical focus order.
- **NFR-ACC-004:** Captions and audio-description choices shall be accessible when licensed tracks exist.
- **NFR-ACC-005:** The application shall respect text scaling, reduced motion, increased contrast, and OS accessibility preferences.

## 6.6 Compatibility and responsiveness

- **NFR-COMP-001:** Layout shall work from 360 px phone width to 4K desktop without horizontal page overflow.
- **NFR-COMP-002:** Core flows shall be tested on the supported browser, iOS, and Android matrix.
- **NFR-COMP-003:** Unsupported DRM/device combinations shall receive a clear compatibility message before purchase or download.

## 6.7 Maintainability and testability

- **NFR-MNT-001:** API contracts shall be versioned and backward-compatible within a supported major version.
- **NFR-MNT-002:** Business rules shall be separated from framework and provider adapters.
- **NFR-MNT-003:** Database changes shall use reviewed forward migrations and tested recovery plans.
- **NFR-MNT-004:** Required CI checks shall include unit, API integration, schema, web build, mobile typecheck/bundle, and critical end-to-end tests.
- **NFR-MNT-005:** Security-critical modules shall include negative and authorization tests.

## 6.8 Observability

- **NFR-OBS-001:** Logs shall be structured and include request ID, safe actor/resource identifiers, status, duration, and error code.
- **NFR-OBS-002:** Metrics shall cover latency, error rate, saturation, playback authorization, startup, buffering, source failover, and download success.
- **NFR-OBS-003:** Distributed traces shall connect gateway, API, database, jobs, and approved providers where supported.
- **NFR-OBS-004:** Logs and telemetry shall redact credentials, tokens, PINs, raw payment data, and sensitive personal content.
- **NFR-OBS-005:** Service-level alerts shall have owners, runbooks, and tested escalation paths.

## 6.9 Localization

- **NFR-L10N-001:** User-facing strings shall be externalized and support pluralization and locale formatting.
- **NFR-L10N-002:** The UI shall support right-to-left layouts before Urdu/Arabic RTL release.
- **NFR-L10N-003:** Metadata, subtitle, and audio labels shall display localized names with an original-language fallback.

# 7. Business rules

- **BR-001:** Rights and entitlement checks override all client-visible catalog or cached state.
- **BR-002:** A Kids profile's maximum age rating cannot exceed the configured Kids ceiling.
- **BR-003:** Public community content remains non-public until approved by policy or automated/manual moderation.
- **BR-004:** 4K playback/download is offered only when the plan, title, rights, device, display capability, bandwidth, and storage policy allow it.
- **BR-005:** A playback source is eligible only when enabled, within its availability window, in the correct region, and linked to the requested media/episode.
- **BR-006:** Expired playback and offline licenses cannot be extended solely by changing the device clock.
- **BR-007:** Recommendation and ranking systems must exclude content the profile cannot legally or safely play.
- **BR-008:** The account owner controls device revocation and profile deletion subject to the final-profile rule.

# 8. Error handling and recovery

- Network errors shall preserve recoverable local state and provide Retry where the operation is safe.
- Authentication expiry shall trigger one controlled refresh; repeated failure shall return to sign-in without loops.
- A stale history update shall fetch the latest state and reconcile visibly when necessary.
- A failed media source shall preserve playback time before failover.
- Download corruption shall remove the invalid partial segment/file and retry from a verified boundary.
- Storage exhaustion shall pause new downloads and offer storage management.
- Rights expiry during playback shall follow the rights-holder policy and show a clear message.
- Provider outages shall not expose internal stack traces, private URLs, or credentials.

# 9. Acceptance criteria

The initial production release is acceptable when all of the following are demonstrated in a staging environment that mirrors production:

1. A user can register/sign in, create Adult and Kids profiles, set a PIN, trigger lockout, unlock, and switch profiles without cross-profile data leakage.
2. Kids profile API requests cannot discover, save, review, recommend, or play titles above their age limit.
3. Users can search and combine every specified catalog filter; invalid parameters receive structured `400` responses.
4. Home renders personalized, Continue Watching, trending, and territory Top 10 rails with only eligible content.
5. A licensed title plays through an authorized HLS/DASH session with seek, speed, track, episode, and fullscreen controls.
6. A failed primary source switches to an approved secondary source while preserving position.
7. Playback history resumes on a second authorized device and handles a simulated version conflict.
8. A supported mobile device downloads an entitled title, pauses/resumes, plays offline under DRM, expires correctly, and removes its files/license.
9. Adult users can rate, review, comment, and curate a playlist; unapproved content is not public and reporting/moderation is auditable.
10. Rights, entitlement, device, territory, age, and PIN checks cannot be bypassed through direct API calls.
11. Required performance, accessibility, security, backup/restore, and supported-device checks pass with recorded evidence.
12. Monitoring dashboards and alerts identify a simulated API failure, database degradation, playback authorization spike, and CDN source failure.

# 10. Verification strategy

| Requirement area | Minimum verification |
| --- | --- |
| Authentication/profile ownership | API integration and end-to-end tests with two accounts and multiple profiles |
| PIN protection | Unit tests for hashing/tokens plus API lockout and replay tests |
| Search/filtering | Unit, SQL integration, Unicode, injection, and pagination tests |
| Playback authorization | Rights/age/territory/episode/source negative tests and signer tests |
| Player | Browser/device end-to-end tests with HLS/DASH, tracks, failover, and resume |
| Downloads | Physical iOS/Android tests for DRM, backgrounding, storage, expiry, and recovery |
| Community | Ownership, moderation, escaping, rate-limit, report, and Kids-policy tests |
| Database | PostgreSQL migration, constraint, concurrency, backup, and restore tests |
| Accessibility | Automated scans plus keyboard, VoiceOver, TalkBack, and zoom/manual review |
| Performance | Load tests, real-device startup tests, and playback quality-of-experience metrics |
| Security | Threat model, SAST/DAST, dependency/secret scans, ASVS review, and penetration test |

# 11. Implementation traceability

| Area | Repository location | Current baseline |
| --- | --- | --- |
| Responsive web UI | `src/` | Functional product demo with profile-isolated browser state |
| Web player | `src/Player.jsx` | Public sample playback, source fallback, tracks UI, episodes, resume |
| Mobile client | `mobile/` | Typechecked and Android-bundled Expo starter |
| API | `server/` | Versioned routes, validation, auth hooks, ownership, PIN, rights and playback signing |
| Database | `db/schema.sql` | PostgreSQL 16 bootstrap schema; requires migration/deployment environment |
| Architecture | `docs/ARCHITECTURE.md` | Production topology and security boundary guidance |
| Automated checks | `server/*.test.js`, package scripts | API/unit tests, web build, mobile typecheck; production integrations still require staging tests |

The current web PIN, downloads, reviews, and catalog are intentionally marked as demo behavior. Production acceptance requires the server, database, identity, billing, licensed media, CDN, DRM, moderation, notification, and observability integrations specified in this document.

# 12. Approval

This SRS becomes the baseline after review by Product, Engineering, Design, QA, Security, Content/Rights, Legal/Privacy, and Operations. Changes to a mandatory requirement shall receive a new revision, impact assessment, and traceability update.
