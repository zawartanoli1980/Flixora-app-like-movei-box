# Large fictional demo catalog

The optional preview catalog contains **800 fictional titles**: 100 Movies, 100 Drama series, 100 Other TV series, 100 Anime, 100 Cartoons, 100 Cricket and 100 Other sports previews, plus 100 Other videos. Series contain **1,800 sample episodes** across two seasons each.

Titles, release dates, languages, genres and episode metadata are fictional samples. Cricket/sports entries are recording concepts, never labeled as live events or furnished with fake scores. Artwork is generated locally with CSS and does not use third-party movie posters. Cards and detail dialogs explicitly identify the entries as Demo. No playable media or distribution rights are attached; direct playback requests for demo IDs are rejected by the server. Demo previews cannot create real watchlist/history records, payments or access grants.

## Enable, hide and remove

Owner UI: **Admin → Demo catalog**. Add/refresh, hide/show and remove controls are enforced by the API with owner settings permissions and audited.

CLI from the repository root (use `npm.cmd` in Windows PowerShell):

- `npm run demo:seed` enables the sample catalog. Repeating it is safe and keeps stable IDs.
- `npm run demo:hide` hides samples without removing the enablement record.
- `npm run demo:clear` removes only the demo configuration.

The opt-in setting lives in the existing settings table. No migration or automatic startup seeding is needed. Fictional entries are generated independently of the real content table. Actual user, finance, upload and published-content metrics stay real. Profile maturity filters, category separation and catalog search also apply to demo previews. Show/seed is disabled for non-owner public/admin sessions lacking settings permission. The CLI remains a trusted local maintenance operation.

## Windows: update an existing local installation

The separate **Flixora-demo-update.zip** package contains a verified-file manifest, changed code files and `APPLY-DEMO-UPDATE.cmd`.

1. Close the existing API and Vite server windows using their window close buttons.
2. Extract the update ZIP into a new folder.
3. Double-click `APPLY-DEMO-UPDATE.cmd`.
4. The helper finds the existing project under your user folder (or asks you to select it), backs up replaced code, applies the update and enables demos. It then launches the two servers and opens the browser.

Your existing `.env`, `.flixora/platform.sqlite`, uploaded media, account passwords and npm install-script approvals are not overwritten. The helper adds only the demo npm commands and copies the listed code files. Previously replaced code is backed up under `.flixora/update-backups/`. File checksums are verified before any code replacement. No dependency upgrade, database reset or admin-password change is needed. On systems with multiple project copies, select the copy containing your existing local account.

This is a trusted local code-update operation: use only the package supplied with this repository. The helper's target is your existing project, not the newly extracted update folder. Browser/Node behavior is covered by automated tests; the Windows CMD launcher is provided for local use and is not claimed to have been executed on a Windows host in the cloud Linux environment. Default launcher ports are API 3201 and web 5173.

For a fresh source checkout, install dependencies normally, then double-click `ADD-DEMO.cmd`; this does not create a default administrator. Real media uploads still require ffmpeg/ffprobe, proper authorization and publication review.
