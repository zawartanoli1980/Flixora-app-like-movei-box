# Delivery status and operating requirements

## Delivered and locally validated

| Area | Implemented |
| --- | --- |
| Active public website | Responsive dark Flixora design, eight exclusive primary libraries, search, honest empty states, connection status, real uploaded-media cards, generated thumbnails, native video controls |
| Database | Private SQLite WAL database, transactional numbered migrations with checksum tracking; no seed titles/accounts |
| Administration | Owner, Administrator, Content Manager, Finance, Support permission maps; API authorization; owner-only staff provisioning; actual counts and coverage; audit records |
| Manual media | 4 MiB resumable chunks, offset/size validation, MP4/WebM restriction, 20 GiB limit, private random filenames, durable jobs, ffprobe inspection, representative ffmpeg decode, generated thumbnails, review/publish/archive and editable metadata |
| Rights | Required authorization assertion and reference, start/end windows, trusted serving-region restrictions, expiry/missing-file unpublishing, daily decode rechecks, server checks on every media request |
| Classification | One database-constrained section, explicit admin/source override, parent-series/episode category matching with transactional series reclassification, nested episode collections, ambiguous-import review |
| Storage imports | Approved private mount only; metadata separate from media; namespaced provider deduplication, checkpointed runs, cancellation/resume, errors, hourly schedule switch, manual review; no URL-based SSRF surface |
| Customer account core | Cookie sessions, scrypt password hashes, Google authorization-code/PKCE handler, TLS SMTP registration and email verification/reset, reset session revocation, profile-specific lists/progress, Kids maturity checks, parental PIN lockout, session management and customer deletion |
| Monetization core | Free/mixed/premium mode, per-title premium flag, immutable prepaid plan definitions, expiring audited complimentary grants, immediate revocation/expiry denial |
| Settings | Brand text, announcement, contact, privacy, terms, maintenance, access mode; all persisted and consumed by the public app |
| Operations | Private data directory, migration checksums, backup helper, durable single-process queues, retained job errors and audit events |

An authorization checkbox records the operator's assertion; the software cannot independently establish ownership of a media license. Administrators must verify the contract and applicable territory before publishing. A successful ffmpeg decode validates a representative segment, not every byte or every client device.

## External integrations and remaining implementation

These are **not completed features**, and credentials alone do not complete every item:

| Integration / feature | Exact outstanding work |
| --- | --- |
| Google | Supply approved web-client credentials, permit Google endpoints, review current official OIDC guidance, exercise the actual callback/session and account-conflict cases on your HTTPS deployment |
| Email | Supply a reachable TLS SMTP account and sender, validate real delivery, SPF/DKIM/DMARC, verification/reset URLs and abuse controls; Google-only accounts use verified email reset to establish an account password |
| Cards / Easypaisa / JazzCash | Choose approved processors/merchant accounts and supported currencies; obtain current official specifications; implement hosted-checkout/tokenization adapters, persistent transaction/invoice/refund ledger, verified signed webhooks, replay/idempotency protection, reconciliation and entitlement activation; test sandbox before enabling live checkout |
| Subscription billing | Paid subscriptions, provider recurring capability, plan changes/grandfathering, trials, coupons, invoices, refunds and billing history still need the verified payment ledger; current plan definitions are not purchasable and their quality/device/stream policy is not enforced |
| Distributor APIs / feeds | Authorized redistribution agreement and a provider-specific adapter implementing cursors, provider rate limits/backoff and rights verification; only the mounted-storage connector is implemented |
| Storage / CDN / DRM | Durable disk is supported locally; object-store multipart uploads, signed CDN URLs, encryption/key management, DRM, secure offline licenses, adaptive renditions, separate audio/subtitle tracks and transcoding are still to be implemented |
| Sports | Primary Cricket and Other Sports libraries plus highlight/replay content kinds exist. Teams, competitions, timezone-aware event schedules, authorized live delivery and score-provider workflows are not implemented. Live-event publishing is blocked. No recordings are labeled live and no scores are invented |
| Series discovery | Nested season/episode selection and next-episode autoplay are implemented. Accurate intro markers and skip-intro editing remain to be built; no inaccurate Skip Intro control is shown |
| Discovery / profiles | Genre/language/year/country filters are exposed in More filters. Activity-based recommendations, configurable homepage rows, avatars, favorites distinct from My List, and viewing analytics remain to be built |
| Advanced administration | Bulk edits/uploads, scheduled publication, support tickets/reports, notification delivery, two-factor authentication, logo/favicon/color editing, SEO/share-image editing, review moderation and a backup UI are not implemented |
| Production scale | Current database and queues target one process on one host. PostgreSQL migration, multi-worker leases, distributed rate limits, monitoring/alerts, queue backoff policy, hardened worker isolation and automated retention/purge jobs are outstanding |

Support-role access currently exposes only connection status. Do not describe it as a complete support console. Revenue is not displayed as zero: financial reporting is explicitly unavailable until verified transactions exist.

## Official documentation checks

On 2026-11-16 this environment's egress proxy rejected CONNECT requests (HTTP 403) to:

- `https://developers.google.com/identity/openid-connect`
- `https://docs.stripe.com/webhooks`
- `https://easypaisa.com.pk/online-payments/`
- `https://payments.jazzcash.com.pk/`

Consequently current payment specifications and merchant eligibility were **not verified**. No provider endpoints, signatures, merchant capabilities or production availability are invented. Permit these documentation hosts in environment settings and provide the official merchant-approved integration material before implementing payment adapters. Actual Google OIDC operation additionally needs `accounts.google.com`, `oauth2.googleapis.com` and `www.googleapis.com`. SMTP needs its specific hostname/port and supported network route. Do not disable certificate verification or enter credentials into chat.

## Deployment

1. Use Node 24+ and current patched ffmpeg/ffprobe. Run `npm ci` and `npm run build`.
2. Mount a durable private `PLATFORM_DATA_DIR`. Use a dedicated restricted service account and one API process. Run the API from the repository root. Migrations execute automatically and reject changes to previously applied SQL; add new numbered migration files for future schema updates.
3. Serve `dist/` and proxy `/api` to the API on the **same HTTPS origin**. Set `NODE_ENV=production` so session cookies are Secure; they are always HttpOnly and SameSite Strict. OAuth state uses a temporary SameSite Lax cookie for the provider return. Do not allow shared caches to cache private API/media responses. Preserve Range requests.
4. Configure the API target and owner through private environment settings. There is no default password, no public admin-registration path and no production database seeded by tests.
5. Region-restricted titles use `PLATFORM_REGION`, a trusted deployment value, never a client-supplied region header. This is not a visitor geolocation service: use separately configured trusted regional deployments or implement a verified edge-geo integration before worldwide restricted-content distribution.
6. Test one owned file, the actual browser/device codec, rights expiry and entitlement revocation. Only configured approved sources may supply titles. Do not enable the legacy demo API or serve the old demo ZIP/HTML in production.
7. Complete real Google/email/provider acceptance and review the unimplemented checklist above before calling the service production ready.

JSON mutations and binary upload requests require explicit content types; cookie SameSite policy and no cross-origin API CORS exposure constrain CSRF. Production review must also account for origin isolation, subdomain ownership, TLS termination, load limits and external SMTP/OIDC access. Password hashes and session-token hashes are sensitive account data even though raw credentials are not retained. No raw card/CVV storage exists.

## Backup and restore

For a consistent media/database snapshot, stop the API and workers first. Confirm no process is writing the mounted data directory. From the repository root:

```sh
node --env-file-if-exists=.env scripts/backup-platform.mjs /absolute/new/private-backup-directory
```

The helper refuses an existing destination and a destination inside the data root. It uses SQLite `VACUUM INTO` and copies private media. Restrict access and encrypt backups using your storage provider's supported mechanism; encryption is not implemented by this helper. Backups include account data, identities, rights references and media. SMTP/Google credentials remain in your external secret manager and need their own recovery procedure.

Restore with the API stopped: preserve the current data directory outside the serving path, copy the backup database and `media/` into a new private data directory, point `PLATFORM_DATA_DIR` at it, and start the API. Verify migrations, owner login, uploaded-media checksum/availability, rights and one actual playback request before switching traffic. Do not overwrite an existing live database or merge WAL files into a backup. Backup and restore must be exercised on a disposable data directory before relying on them operationally.

## Acceptance evidence

- Existing API regression suite plus real-platform tests cover permissions, exact categories, uploads, real decoding, HTTP Range responses, source path/symlink restrictions, imports/dedup/review, premium expiry/revocation, session suspension, Kids profile isolation, PIN lockout, immutable prepaid plan definitions, email verification/reset and rejection of unverified payment events.
- Chromium end-to-end uses a temporary database/account/video and checks owner login → draft → upload → decode → review → publish → actual browser playback; category isolation and mobile horizontal overflow.
- No successful Google login, real email delivery, charge, webhook signature validation, paid subscription, licensed distributor import, CDN stream or native-device behavior is claimed by these local tests.

Playback authorization is checked on each new media/Range request. Previously buffered video and an already-open authorized response are not forcibly recalled when a grant expires. Production DRM/session services are needed for stronger ongoing enforcement.
