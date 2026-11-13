# Race log — Rewindary (Claude) vs Abo Killer (GPT)

Window: 2026-11-09 16:29 → 2026-12-09 16:29 Europe/Paris. Star counts are read from the GitHub API; "n/a" means the repository is not public yet.

## Day 1 — 2026-11-09

**Stars (16:56 CET):** Rewindary n/a (not published) · Abo Killer n/a (`ArthurRavel/abo-killer` returns 404, not public yet).

### Decisions
- **Name: Rewindary.** It was checked independently today. "Unwrapped" and "Lifeprint" were rejected (taken). Rewindary returned 0 GitHub repos and no npm package, `.com/.app/.io/.dev` don't resolve, and a web search found no product with the name. Intended repo: `ArthurRavel/rewindary` (not created yet).
- **Competition re-check:** found [abdullahasghar966/life-wrapped](https://github.com/abdullahasghar966/life-wrapped) (0★, created 2026-10-02). It already does Spotify + YouTube + Netflix in the browser. So the brief's planned differentiator (the source combination) is **not** unique, and the README says so. The positioning moved to cross-source metrics, redact-by-default share cards with an exact review step, and a browser-enforced, tested no-network guarantee. Also noted: superwrapped.com (5 other sources, summaries may leave the device), facebookresearch/personal-timeline (370★), middlewarehq/unwrapped (80★), Jellyfin Rewind (375★, single source).
- **Stack:** Vite + TypeScript + Preact, plus fflate for streaming unzip. Parsing runs in a Web Worker. The production build has a CSP with `connect-src 'none'`.
- **Privacy by construction:** search terms and URLs are discarded at parse time. Spotify private-session plays are excluded. IPs, devices and countries are never read.
- **Sources:** Spotify extended history, Google Takeout (YouTube + Search, JSON and HTML), Netflix (full activity and quick CSV). Instagram was not added.

### Failures and fixes
- Vitest 5 requires Node ≥ 21 (the machine has Node 20), so it was pinned to Vitest 3.
- npm isn't on the PATH here. Scripts now call the binaries directly, the TZ handling moved into `scripts/run-tests.mjs`, and the README documents `corepack pnpm`.
- The share-card review panel listed lines the story card didn't render, and a test caught it. There is now a single `shownLines()` shared by the panel and the renderer. A fact line also overlapped the footer, so the story card now shows 4 fact rows.
- The E2E test read CSP-violation events too early and was flaky. It now waits for the event (3 consecutive green runs).
- The first GitHub search attempt hit unauthenticated rate limits and was retried.

### Verified
`tsc` clean · 36/36 unit tests · production build · dist privacy scan · all browser E2E checks (zero external requests, CSP blocks a deliberate fetch, PNG/SVG redaction).

### Next
Create the public repo `ArthurRavel/rewindary` and deploy to GitHub Pages. Then confirm both race links and badges resolve, and re-run the E2E against the deployed URL.

## Day 1, cycle 2 — 2026-11-09 (evening)

**Stars (21:38 CET):** Rewindary n/a (not published) · Abo Killer n/a. Over SSH, `git ls-remote git@github.com:ArthurRavel/rewindary.git` and `…/abo-killer.git` both return "Repository not found".

### Name re-check (evidence, not a uniqueness claim)
- GitHub API: `search/repositories?q=rewindary` returns `total_count: 0`, `search/users?q=rewindary` returns 0, and `users/rewindary` returns 404.
- npm: `registry.npmjs.org/rewindary` returns 404.
- DNS: `rewindary.com/.app/.io/.dev/.org` all return NXDOMAIN (dig SOA). RDAP for `.com` (Verisign) and `.app/.dev` (Google Registry) returns 404.
- Web search for `"Rewindary"`: no exact matches. The nearby "Rewind" name space is crowded (rewind.com backups, the Rewind AI recorder, Git Rewind, Discourse/Linear/Arketa "Rewind" recaps). This was still not a trademark search.
- Competitors re-checked: superwrapped.com is live ("Your entire digital life, wrapped."). life-wrapped has 0★ (last push 2026-10-04). personal-timeline has 370★ and is now **archived**. middlewarehq/unwrapped has 80★.

### Launch readiness
- **Added `.github/workflows/pages.yml`.** It runs `pnpm verify` on every push and PR, and deploys `dist/` from `main` with the official Pages actions (checkout v7, setup-node v7, upload-pages-artifact v5, deploy-pages v5, all node24 runtimes). The E2E uses the runner's preinstalled Chrome.
- **CI uses Node 24 LTS**, because Node 20 has been EOL since April 2026. The gate was run locally on both v24.22.2 (official tarball, SHA-256 verified) and v20.19.2.
- **The E2E now serves the build under `/rewindary/`,** like the Pages project site. Any request outside that path 404s and fails the run. As a negative control, a build with `--base=/` makes the E2E fail (exit 1). `E2E_URL=…` re-runs the same checks against a deployed copy.
- **Commit identity fix.** Earlier commits used `41898282+ArthurRavel@users.noreply.github.com`, but 41898282 is the github-actions[bot] user ID. ArthurRavel's ID is 145747193, so new commits use `145747193+ArthurRavel@users.noreply.github.com`. History was not rewritten, so the earlier commits may not link to the profile on GitHub.

### Blocker
There is no `gh` CLI, no API token, and the GitHub MCP connector failed to connect. SSH authentication works (`Hi ArthurRavel!`), but SSH can't create a repository or configure Pages. So the repo was **not** published. Remaining manual steps:
1. Create an empty public repo `ArthurRavel/rewindary` (no README or license).
2. Push: `git remote add origin git@github.com:ArthurRavel/rewindary.git && git push -u origin main`.
3. Go to Settings → Pages → Source: GitHub Actions, then re-run "Verify and deploy to Pages".
4. Run `E2E_URL=https://arthurravel.github.io/rewindary/ node scripts/e2e.mjs`.

### Verified
On both Node 24 and Node 20, `pnpm verify` passed: tsc clean · 36/36 unit tests · production build · dist privacy scan · all 17 E2E checks under `/rewindary/` (0 external requests, CSP blocks a deliberate fetch, empty storage, PNG/SVG redaction).


## Public launch — 2026-11-09 22:38 Europe/Paris

- Repository: https://github.com/ArthurRavel/rewindary — **0 stars**, 0 forks, 0 open issues at verification.
- Live app: https://arthurravel.github.io/rewindary/ — HTTP 200 verified.
- Opponent: https://github.com/ArthurRavel/abo-killer — **0 stars** at verification.
- The GitHub Actions job could not start because the account is locked for a billing issue. No security control was bypassed: the locally verified `dist/` was committed to a dedicated `gh-pages` branch and GitHub Pages legacy deployment completed successfully.
- Future commits use the verified GitHub noreply identity. Published history was not rewritten.

## Day 2 — 2026-11-10 (scheduled cycle, ~02:50 Europe/Paris)

**Counts (verified at the start of the cycle):** Rewindary 0 stars, 0 forks, 0 issues, 0 PRs · Abo Killer 0 stars, 0 forks, 0 issues, 0 PRs. The public repo and the live Pages site both responded.

### Decision: a privacy receipt on the review screen
Rewindary's main promise is that your history never leaves the device, but until now the only way to check it was DevTools. The review screen (shown right after parsing) now has a **Privacy receipt**. It lists requests to other sites, attempts the CSP blocked, how many page files loaded from the site itself, and whether anything was saved in the browser, with a "Check again" button. It reads only the browser's own Resource Timing entries and `securitypolicyviolation` reports, shows hosts but never paths or queries, and sends nothing. The verdict says "No requests to other sites recorded" rather than claiming more than this data can prove. The panel points to DevTools → Network for an independent check.

### Failures and notes
- `pnpm` is not on the PATH in this environment, so every command ran as `corepack pnpm@9.15.0 …`, as the README documents.
- GitHub Actions still cannot start (account locked for billing). CI was not run. No billing or security setting was touched.
- In the self-review, the first verdict wording ("Nothing left this tab.") was judged stronger than the evidence (Resource Timing does not cover a worker's own timeline). It was changed to "No requests to other sites recorded."

### Verified (local)
`corepack pnpm@9.15.0 verify` exited 0: `tsc --noEmit` clean · 41/41 Vitest tests in 6 files (5 new receipt tests) · production build · dist privacy scan ("5 files, no remote URLs or network APIs, strict CSP present") · 21/21 browser E2E checks under `/rewindary/`. These include new checks that the receipt reports no external requests after the demo and after real-format uploads, and that after the deliberate blocked `fetch` it shows exactly "1 attempt (example.com)" without the path. Rendering was inspected at 1440×900 and 390×844, with no horizontal overflow.

## Day 2, cycle 2 — 2026-11-10 (scheduled cycle, ~08:00 Europe/Paris)

**Counts (verified at 08:05 CET via the public GitHub API):** Rewindary 0 stars, 0 forks, 0 open issues, 0 open PRs · Abo Killer 0 stars, 0 forks, 0 open issues, 0 open PRs. `main` was clean at `7793212` and the live Pages site was built.

### Decision: compare the year with the one before
Real exports usually span several years: Spotify extended history and Google Takeout go back to the start of the account. Until now the story only looked at one year at a time. A new slide, **"Compared with 2024"**, sits after the big number. It shows the overall change (for example "+21%"), the hours in both years, and a per-source row with a paired bar (last year muted, this year in the source colour) and its own change. It also states the exact window, for example "counted from Jan 1 to Dec 29 in both years".

The comparison declines rather than mislead:
- A source counts only when its history reaches back to January of the earlier year. A 12-month "Account data" export or a service you joined mid-year doesn't read as growth.
- Both years stop at the date where the stalest source's history ends, so the year in progress (or an old export) is compared over the same dates, never against a full year. Feb 29 doesn't spill into March.
- There's no slide for "All time", for under a month of data, or under an hour in the earlier year.
- When some durations are estimated (YouTube, the quick Netflix CSV), the slide says so.
- It respects the source and Netflix-profile filters.

The synthetic demo now also generates a quieter 2024. It is generated after 2025 with the same seed, so every 2025 number is unchanged. A SHA-1 of the 2025 insights matched `main` exactly.

This is a story-only change. Share cards and their redaction are untouched.

### Failures and notes
- The first demo test expected a full-year comparison but got "through Dec 29": the demo's last Netflix night is Dec 29, so the window stops there for every source. That's the intended, honest behaviour, and snapping to "full year" would understate an unfinished December. The test was corrected and the label uses short dates on both ends.
- Self-review against `main` found and fixed: the estimate note only mentioned YouTube (the quick Netflix CSV is estimated too); a history ending exactly on Dec 31 was labelled "Jan 1 to Dec 31" instead of a full-year comparison; a 6 px minimum bar width would have drawn a stub for a source with 0 h last year; screen readers got "396 → 466 h" (now read as "396 hours in 2024, 466 hours now"); an unused `data-testid` is now asserted by the E2E.
- The README's Deploy section still described `.github/workflows/pages.yml`, which was removed in `14e0be2`. It now describes the actual `gh-pages` branch publication.
- The Impeccable detector flagged only pre-existing gradient text (the hero and persona headings), not part of this change. Left as is.
- `pnpm` is not on the PATH here, so commands ran as `corepack pnpm@9.15.0 …`. GitHub Actions still cannot start (account locked for billing) and there is no workflow: CI was not run. No billing or security setting was touched.

### Verified (local)
`corepack pnpm@9.15.0 verify` exited 0 after the review fixes: `tsc --noEmit` clean · 50/50 Vitest tests in 6 files (9 new: 7 for `compareYears`, 1 for the change formatter, 1 for the two-year demo) · production build · dist privacy scan ("5 files, no remote URLs or network APIs, strict CSP present") · 22/22 browser E2E checks under `/rewindary/`, including the new one: the demo's year-over-year slide shows "+21%", "Compared with 2024", the "Jan 1 to Dec 29" window and three per-source rows. The slide was inspected at 1440×900 and 390×844, with and without reduced motion: no horizontal or vertical overflow.

## Day 2, cycle 3 — 2026-11-10 (scheduled cycle, ~13:25 Europe/Paris)

**Counts (verified at 13:28 CET via the public GitHub API):** Rewindary 0 stars, 0 forks, 0 open issues, 0 open PRs · Abo Killer 0 stars, 0 forks, 0 open issues, 0 open PRs. `main` was clean at `2cdde27` and the live Pages site responded.

### Decision: explain files that hold no usable history
The likeliest way a real visitor fails is by dropping the wrong export: a Takeout without the YouTube "history" box ticked, one part of a split Takeout, Spotify's technical log or account details, or a Netflix report without `ViewingActivity.csv`. Until now the review screen only said "Not recognised, ignored", and when nothing was recognised it showed no actions at all, so the only way out was a reload. Now each ignored file says what it was and what to request instead, and "Add more files" and "Start over" stay available. The diagnosis reads only file and archive-entry names (it never inflates anything extra), keeps a handful of service flags, and the hints contain no file content or URLs.

### Failures and notes
- No web search was available this cycle, so localized Takeout file names could not be checked. The hints only rely on English folder names, and anything else falls back to a generic message.
- The first test for mixed input used a hand-written watch-history row that didn't match the real Takeout shape. It now uses the existing fixture.
- Self-review against `main` found that a review screen with nothing recognised had no actions, which mattered more now that the hint says "drop the other parts too". This was fixed, and the E2E adds the missing export from that same screen.
- `pnpm` is not on the PATH here, so commands ran as `corepack pnpm@9.15.0 …`. GitHub Actions still cannot start (account locked for billing) and there is no workflow, so CI was not run. No billing or security setting was touched.

### Verified (local)
`corepack pnpm@9.15.0 verify` exited 0 after the review fix: `tsc --noEmit` clean · 59/59 Vitest tests in 7 files (9 new in `tests/diagnose.test.ts`) · production build · dist privacy scan ("5 files, no remote URLs or network APIs, strict CSP present") · 26/26 browser E2E checks under `/rewindary/` (4 new: the Takeout-part hint, nothing to play, adding the missing export from the same screen, still zero external requests). The review screen with three ignored files was inspected at 1440×900 and 390×844 with reduced motion, with no horizontal overflow.

### Deployed
Merged into `main` as `707c1cf` (`507ea72` feature, `8619d42` log). `pnpm verify` was re-run on the merged `main` and passed (59/59 unit tests, 26/26 E2E). That exact `dist/` was published to `gh-pages` as `d23c891` ("deploy: explain unrecognised files (main 707c1cf)"). GitHub Pages served the new bundle (`index-tP4rSfYH.js`) about a minute later, with HTTP 200. `E2E_URL=https://arthurravel.github.io/rewindary/ node scripts/e2e.mjs` passed 26/26 against the live site, including the new unrecognised-file checks.

## Day 2, cycle 4 — 2026-11-10 (scheduled cycle, ~18:40 Europe/Paris)

**Counts (as supplied at 18:35 CET, from the public GitHub state; not re-queried by this run):** Rewindary 0 stars, 0 forks, 0 open issues, 0 open PRs. The public issue and PR lists were empty. `main` was clean and in sync with `origin/main` at `f23c072`.

### Decision: read Google Takeouts that are not in English
Google Takeout names its folders and files in the account's language. The importer chose which zip entries to unpack by English file names (`watch-history`, `search-history`, `MyActivity`), so a correct French, German or Spanish export reached the "no usable history" screen, even though the parser itself classifies by URL and already handles localized dates and watch prefixes. Entries that miss the name filter are now peeked at: only their first 32 KB is inflated, and the entry is kept in full only when it opens like Google My Activity (a JSON array whose first object has a `"header"` key, or the My Activity HTML cells). Photo sidecars, bookmarks and other products' activity (Maps, Chrome…) are dropped without a note. If nothing is found, the zip still gets the existing "no YouTube or Search history" explanation. Known English names behave exactly as before. Nothing about the UI, share cards or privacy surface changed.

### Failures and notes
- **Web search was declined this cycle,** so the localized Takeout file names (French "historique des vidéos regardées", German "Wiedergabeverlauf", Spanish "historial de reproducciones") are from memory and **not verified against real exports**. That is why detection is by content rather than by a list of translated names. The tests use these names only as examples of "not English".
- A scratch performance test (25,000 photo-sidecar entries plus a 60 MB junk JSON plus one history file) hit "Maximum call stack size exceeded" inside fflate's `Unzip.push`. That is **pre-existing**: it reproduces on the unmodified `main` code when one chunk holds thousands of tiny entries (Node hands over the whole file at once; browsers use smaller chunks). The unzipper now gets 64 KB slices. The same scratch test then ran in about 2 s and found the history. It also showed my first probe cap (20,000) was too low, because YouTube sorts after Google Photos in a Takeout, so it is now a 250,000 runaway guard. The scratch test was deleted. A lighter version (6,000 entries) is kept as a regression test.
- Self-review against `main` found that `entry.start()` throws for a compression method fflate lacks. Since probing starts entries that were never started before, one odd junk entry would have failed the whole import. For peeked entries it is now caught and ignored (known history files still fail loudly), with a test that rewrites a local header to claim LZMA. The README claim "only known history files are decompressed" was also no longer literally true and now describes the 32 KB peek.
- While investigating the scratch failure I ran `git checkout -- .` and discarded my own uncommitted `src/ingest.ts` edit. It was re-applied from the same patch before anything was committed, and nothing was lost beyond a few minutes.
- `pnpm` is not on the PATH here, so commands ran as `corepack pnpm@9.15.0 …`. **GitHub Actions cannot start (account locked for billing) and there is no workflow, so CI was not run and nothing here is "CI green".** No billing or security setting was touched.

### Verified (local)
`corepack pnpm@9.15.0 verify` exited 0 on the feature branch (`c264a32`) after the review fixes: `tsc --noEmit` clean · 67/67 Vitest tests in 8 files (8 new in `tests/localized-takeout.test.ts`) · production build (72.09 kB JS, 21.71 kB worker) · dist privacy scan ("5 files, no remote URLs or network APIs, strict CSP present") · 29 browser E2E checks passed under `/rewindary/`, including a new one that uploads a Takeout with French file names and checks it is read with no stray notes and no external request. The review screen after a French Takeout was inspected at 1440×900 (no reduced motion) and 390×844 (reduced motion): `scrollWidth` equals `clientWidth` at both, so no horizontal overflow. The UI itself is unchanged.

### Deployed
Feature merged into `main` as `fa30f22`. The verified `dist/` was published to `gh-pages` as app commit `acc6bcc`, plus a metadata-only commit `a72f35d` that preserves `.nojekyll`. The GitHub Pages legacy build for `a72f35d` reached `built` at 17:44:15Z with no error. The live site returned HTTP 200 and served `index-UB4hAvWo.js`. The live E2E run passed all 29 checks, including the localized Takeout check and zero external requests.

## Day 2, cycle 5 — 2026-11-10/11 (scheduled cycle, started ~23:50 Europe/Paris)

**Counts (as supplied at the start of the cycle, not re-queried by this run):** Rewindary 0 stars, 0 forks, 0 issues, 0 PRs. `main` was clean at `36d68e1`.

### Decision: read unzipped export folders
Safari on macOS unzips downloads by default, so a Mac user often has a `Takeout/` or `Spotify Extended Streaming History/` folder rather than the zip. On `main`, dropping a folder failed the whole import. A real drop of a folder into a build of `main` (Chromium, via the DevTools protocol) showed "Could not read these files: A requested file or directory could not be found…". Now:
- **Drop a folder** on the start page. The page walks it with the File and Directory Entries API, in batches, with a "Listing folder… N files" status.
- **Or choose a folder.** "Choose a folder" is on the start page and "Add a folder" on the review screen. Both use `webkitdirectory` and are hidden on touch-only devices, where folder picking isn't available.
- **The same rules apply inside a folder as inside a zip.** Known history names are read in full. Other `.json`/`.html` files are peeked at (first 32 KB). Media and other files are never opened, and Google Photos sidecars (`IMG_0001.jpg.json`, `….supplemental-metadata.json`) are skipped by name. A zip inside a folder is read as a zip. A folder with no history gets one note (for example the "Takeout has YouTube data but no history" hint), and a dropped folder with nothing readable says so on the start page.

Loose files and zips behave as before. Share cards, redaction and the privacy surface are unchanged. Files are still read only by the browser, with no network.

### Failures and notes
- **The first version was slow on big Takeouts.** A scratch run with 20,000 photo sidecars took 15.4 s when dropped and 12.8 s through the picker, because the reads were serial. Bounded parallel reads (32 at a time) brought that to about 10 s. Skipping sidecars by name brought the drop to 0.3 s and the picker to 4.4 s (about 2.2 s of that is Playwright's own `setInputFiles`). These are scratch measurements on this machine, not part of the gate.
- **Self-review against `main` found and fixed:**
  - Making the probe limit apply to every file would have capped known history files too. It now caps only peeked files.
  - An unreadable *peeked* file would have failed the whole import. It is now skipped, while an unreadable history-named file still fails loudly (both are tested).
  - The folder drop was only covered by a scratch script. The E2E now drops real directories through Chromium's DevTools protocol, because Playwright cannot drop directories.
- **Known limitations:**
  - The drop path is verified in Chromium only. Safari and Firefox were not run, and the Safari auto-unzip default is stated from platform knowledge, not re-checked this cycle.
  - When nothing can be read, a dropped folder shows a start-page error but a chosen folder shows a review note: drops skip non-export names before reaching the parser.
- A `vite preview` process on port 4174, running since 9 Nov, was not started by this cycle and was left alone.
- `pnpm` is not on the PATH here, so commands ran as `corepack pnpm@9.15.0 …`. **GitHub Actions cannot start (account locked for billing) and there is no workflow, so CI was not run.** No billing or security setting was touched. Nothing was merged or deployed by this run.

### Verified (local)
`corepack pnpm@9.15.0 verify` exited 0 on `feat/folder-import` after the review fixes:
- `tsc --noEmit` clean
- 82/82 Vitest tests in 9 files (15 new in `tests/folders.test.ts`)
- production build (73.96 kB JS, 28.04 kB gzipped; 23.59 kB worker)
- dist privacy scan ("5 files, no remote URLs or network APIs, strict CSP present")
- 34/34 browser E2E checks under `/rewindary/`, 5 of them new: the start page offers folders, a picked Takeout folder, a second folder added from review, a real dropped folder (150 photos, so more than one directory batch) and a dropped photos-only folder. The existing "no request left" check reran after the folder uploads, and every run made zero external requests.

The start page and review screen were inspected at 1440×900 and 390×844 (reduced motion at 390): `scrollWidth` equals `clientWidth` at both. With touch emulation the folder options are hidden and Tab skips them. The Impeccable detector flagged only the existing gradient text, not this change.

### Deployed
Feature merged into `main` as `2081311`. The full local `corepack pnpm@9.15.0 verify` was independently re-run after the feature branch and passed: 82/82 unit tests, production build, strict dist privacy scan and all 34 local E2E checks. That exact verified `dist/` was published to `gh-pages` as `5c446a1` ("deploy: unzipped folder import (main 2081311)"). The GitHub Pages legacy build for `5c446a1e31fbc74f0256d93ef7b4ca83fb3821b2` reached `built` at 2026-11-10T23:07:19Z with no error. `E2E_URL=https://arthurravel.github.io/rewindary/ node scripts/e2e.mjs` then passed all 34 checks against the live site, including all five folder checks and zero external requests.

## Day 3 — 2026-11-11 (scheduled cycle, ~05:15 Europe/Paris)

**Counts (verified at 05:28 CET via the public GitHub API):** Rewindary 0 stars, 0 forks, 0 open issues and PRs · Abo Killer 0 stars, 0 forks, 0 open issues and PRs. `main` was clean at `9af107c`.

### Decision: read Apple Music
Every Rewindary story needed Spotify for its music side, which leaves out iPhone users who listen on Apple Music. Rewindary now reads Apple's privacy download ("Apple Media Services information"). Drop the zip as it is: the `Apple_Media_Services.zip` inside it is opened (one level deep, only that name), and `Apple Music Activity/Apple Music Play Activity.csv` is parsed row by row.
- **What counts as a play:** a `PLAY_END` row of 5 s to 6 h with a song name. If a file has no `PLAY_END` rows at all, every row with a duration counts instead.
- **What is never read:** the Apple ID, IP address, device, storefront and client columns.
- **In the story and on cards:** Apple Music gets its own slide. It shares the "music" persona lane, the 30 s play rule, the listening run and second-screen time with Spotify. On cards, the #1 artist comes from whichever music service has more hours, and it is hidden by default as before.
- **Export without artist names:** the story ranks songs and the review screen says why.
- **Apple export without play activity:** the review screen explains what to request.
- **Start page:** a new export guide, and the hero now names Apple Music.

### Failures and notes
- **Format check is partial.** The column headers come from the source of an open-source parser (`mariolopjr/apple-csv-to-lastfm`). Apple's request steps and the "up to 7 days" wait were confirmed by web search. **Not verified against a real export:** the meaning of `PLAY_END` rows and the exact timestamp format (two pages that might have shown example rows returned 403 and 404). The parser is defensive about both, and the fixture is synthetic. `Apple Music - Play History Daily Tracks.csv` is not read, because its columns could not be verified and it has no per-play times.
- **Card legend overflow, found before the review.** With four media sources, the share-card legend ran past the right edge of the 1080 px card. It now scales down to fit, with a test that fails on the old layout.
- **Known limits:**
  - An inner `Apple_Media_Services.zip` over 1 GiB is skipped, and the user then gets the "no play activity" hint.
  - The inner zip is held in memory while it is read.
  - The README demo GIF still shows the old three-service hero line, because it was not regenerated this cycle.
- **Fixture line endings.** Independent verification found that `git diff --check` failed because the Apple fixture was committed with CRLF line endings. It now uses LF (`b2f89dd`), a new test still covers parsing a CRLF copy, and `git diff --check main...HEAD` passes.
- **Not run:** `pnpm` is not on the PATH, so commands ran as `corepack pnpm@9.15.0 …`. **GitHub Actions cannot start (account locked for billing) and there is no workflow, so CI was not run.** No billing, security or auth setting was touched. Nothing was merged or deployed by this run.

### Verified (local)
`corepack pnpm@9.15.0 verify` exited 0 on `feat/apple-music`:
- `tsc --noEmit` clean
- 99/99 Vitest tests in 10 files (17 new in `tests/apple-music.test.ts`)
- production build (76.78 kB JS, 29.11 kB gzipped; 26.28 kB worker)
- dist privacy scan ("5 files, no remote URLs or network APIs, strict CSP present")
- 38/38 browser E2E checks under `/rewindary/`. The 4 new ones: the nested Apple zip is read (6 plays, 3 skipped), Apple Music gets its own story slide, the card review hides the #1 artist, and still zero external requests.

The start page, the Apple guide, the review screen and the Apple Music slide were inspected at 1440×900 and at 390×844 with reduced motion. `scrollWidth` equals `clientWidth` on every screen.

### Deployed
`feat/apple-music` was merged into `main` as `1ca7b77`, whose source tree is identical to the verified branch. That exact verified `dist/` was published to `gh-pages` as `7c64e75` ("deploy: read Apple Music play activity (main 1ca7b77)"), with `.nojekyll` kept. The GitHub Pages legacy build for `7c64e75` reached `built` at 2026-11-11T04:32:47Z with no error. `E2E_URL=https://arthurravel.github.io/rewindary/ node scripts/e2e.mjs` then passed all 38 checks against the live site. These include the Apple Music upload, its story slide and the hidden #1 artist on the card review, zero external requests, empty `localStorage`, `sessionStorage` and cookies, and no page errors.

## Day 3, cycle 2 — 2026-11-11 (scheduled cycle, ~10:40 Europe/Paris)

**Counts (verified at 10:44 CET via the public GitHub API):** Rewindary 0 stars, 0 forks, 0 open issues, 0 open PRs · Abo Killer 0 stars, 0 forks, 0 open issues, 0 open PRs. `main` was clean and in sync with `origin/main` at `fec7ebb`.

### Decision: a four-source demo and a fresh README GIF
The README hero GIF dated from the first commit and showed the old three-service start page. Simply re-capturing it would not have been enough: the synthetic demo it is captured from generated only Spotify, YouTube and Netflix, so the story would still have shown three services. That also meant visitors pressing "Try it with synthetic demo data" never saw Apple Music.
- **The demo now includes Apple Music.** It adds a synthetic `Apple Music Play Activity.csv`, with PLAY_START/PLAY_END pairs, six invented artists, morning-run and weekend sessions in both years, and synthetic Apple ID, IP (`192.0.2.44`) and device columns. It goes through the real Apple Music parser.
- **The other exports are unchanged.** Apple Music has its own random stream, so the Spotify, YouTube and Netflix exports are byte-identical to `main`. This was checked once with a scratch test that compared `demoFiles()` from `main` and the branch. The scratch test was deleted.
- **What the demo now shows:** 96 → 90 h of Apple Music after tuning (see below), a 4-source legend, an Apple Music slide, a year-over-year slide with four rows (+20% overall, counted from Jan 1 to Dec 27, because Apple Music is now the stalest source), and the share-card legend with Apple Music 8%. The #1 artist on the card is still Spotify's, and still hidden by default.
- **GIF re-captured** with `pnpm demo-gif` from the production build: the current start page, then all 13 story slides (14 frames, 400×760, 273 KB). The share-card screenshots were refreshed in the same run. `review-upload.png` was restored, because the only change there was a focus ring on the heading and no document uses the file.

### Failures and notes
- The first Apple stream picked songs with a doubly skewed draw from 6 songs per artist. The GIF frame then read "On repeat: … (288×)", which is implausible. It now uses 10 songs per artist and picks a song uniformly within each artist, which gives 72×. Only the Apple stream changed.
- **Self-review against `main` found and fixed two problems:**
  - A first "exports stay independent" unit test compared `demoFiles()` with itself, so it could never fail. It was removed, and that fact is recorded here instead.
  - The new privacy assertion stringified whole events, so a numeric timestamp could match `1234567890`. It now checks only string fields.
- **Stale frames.** The GIF builder includes every `NN-slide-*` frame in `docs/media/frames/` (git-ignored). Because one more slide shifts the indices, old frames would have been mixed in, so the folder was cleared before capture.
- README drift was corrected: the test count went from 98 to 100, and the bundle size went from "74 KB JS, 24 KB worker" to the measured 78 KB (≈30 KB gzipped) and 26 KB.
- Not measured: the extra cost of generating the 1 MB demo CSV in a real browser. In Node the whole demo loads in about 0.2 s.
- `pnpm` is not on the PATH here, so commands ran as `corepack pnpm@9.15.0 …`. **GitHub Actions cannot start (account locked for billing) and there is no workflow, so CI was not run.** No billing or security setting was touched.

### Verified (local)
`corepack pnpm@9.15.0 verify` exited 0 on `feat/four-source-demo` after the review fixes:
- `tsc --noEmit` clean
- 100/100 Vitest tests in 10 files
- production build (78.32 kB JS, 29.67 kB gzipped; 26.28 kB worker)
- dist privacy scan ("5 files, no remote URLs or network APIs, strict CSP present")
- 38/38 browser E2E checks under `/rewindary/`. The demo checks now expect 5 parsed exports, an `applemusic` slide and 4 comparison rows, and the default SVG card is checked for the Apple artist name too.

`git diff --check` is clean. The intro, total, comparison, Apple Music and persona frames and the share-card screenshot were inspected visually.

### Deployed
`feat/four-source-demo` was merged into `main` as `3eef937`, and its tree is identical to the verified branch. It was pushed normally. Because `src/demo.ts` is part of the app bundle, that exact verified `dist/` was published to `gh-pages` as `896c651` ("deploy: four-source demo (main 3eef937)"), with `.nojekyll` kept. About 30 s later the live site served the new bundle (`index-DqkMPOca.js`) with HTTP 200. The unauthenticated Pages-builds API returned 404, so the build status itself was not read. `E2E_URL=https://arthurravel.github.io/rewindary/ node scripts/e2e.mjs` then passed all 38 checks against the live site, including the 5-export demo, the Apple Music slide, the four-row comparison and zero external requests.

## Day 3, cycle 3 — 2026-11-11 (scheduled cycle, ~15:50 Europe/Paris)

**Counts (verified at 15:49–15:50 CET via the public GitHub API):** Rewindary 0 stars, 0 forks, 0 open issues, 0 open PRs · Abo Killer 0 stars, 0 forks, 0 open issues, 0 open PRs. `main` was clean and in sync with `origin/main` at `96cbbfc`.

### Decision: make cards and the app findable
A share card is the product's only way to spread, but it said "Made with Rewindary" with no address, so someone who saw one had no way to find the app. The start page also claimed "Open source (MIT)" without linking to the code. This cycle:
- **Card footer.** Every card now ends with "Made on-device with Rewindary · arthurravel.github.io/rewindary". The address has no scheme and is the only address a card ever carries. The review panel lists it as a "Footer" line, so the "everything this card says" list stays complete.
- **Source link.** The start-page footer and the end slide of the story link to this repository. It is a plain link (`target="_blank"`, `rel="noopener noreferrer"`), so the story and its data stay in the current tab. Nothing is loaded from it unless it is clicked.
- **Single source of truth.** Both values live in `src/site.ts`. The dist scan and the source scan allow exactly `https://github.com/ArthurRavel/rewindary` and nothing broader. A negative check confirmed that `/raw/…`, `http://`, a suffixed name and other GitHub paths are rejected.

The CSP, storage, redaction defaults and parsing are unchanged. The native share-sheet payload is unchanged too: no unreviewed text was added to it.

### Failures and notes
- **Self-review against `main`:**
  - In the review panel, the footer's "·" wrapped onto its own line. A non-breaking space now keeps it with "Rewindary".
  - A comment in `src/site.ts` overstated what the scanners allow. It was reworded.
  - No other concrete defects were found.
- The Impeccable detector flagged only the pre-existing gradient text.
- **Known limits:**
  - On the square card, the footer sits close to the last fact row. This is the same position as the old footer, so it is not new.
  - The README GIF was not regenerated, so its end-slide frame lacks the new source link. Only `share-card-review.png` and `share-square.png` were refreshed.
  - A fork must edit `src/site.ts` and the copies pinned in the scanners and tests.
- `pnpm` is not on the PATH, so commands ran as `corepack pnpm@9.15.0 …`. **GitHub Actions cannot start (account locked for billing) and there is no workflow, so CI was not run.** No billing or security setting was touched. Nothing was pushed, merged or deployed by this run.

### Verified (local)
`corepack pnpm@9.15.0 verify` exited 0 on `feat/findable-cards`:
- `tsc --noEmit` clean.
- 103/103 Vitest tests in 10 files. The 3 new ones: the footer appears once and holds the only address, for every format, theme and reveal state; the footer fits the card margins; the source link opens in a new tab with no referrer or opener. The source URL scan was also tightened.
- Production build: 79.03 kB JS (29.93 kB gzipped), 26.28 kB worker.
- Dist privacy scan: "5 files, no remote URLs or network APIs, strict CSP present".
- 42/42 browser E2E checks under `/rewindary/`. The 4 new ones cover the start-page link, the end-slide link, the review footer line, and the exported SVG carrying the address once and no other link. Every run still made zero external requests.

The start-page footer (390 and 1440 px, including the keyboard focus ring), the end slide, the story card and the square card were inspected: `scrollWidth` equals `clientWidth` at both widths.

### Deployed
`feat/findable-cards` was merged into `main` as `15c31af`. That exact verified `dist/` was published to `gh-pages` as `9c1e60f`. The authenticated GitHub Pages legacy build for that commit reached `built` at 2026-11-11T15:02:02Z with no error. The live URL returned HTTP 200 and served `index-sE75Yq7Z.js` and `index-BldUQAmv.css`. The full browser E2E then passed all 42 checks against the live site, including the safe source links, the reviewed card footer, exactly one app address in the SVG, zero external requests, empty browser storage and no page errors. GitHub Actions remain unavailable because of the billing lock, so CI is not claimed green.

## Day 3, cycle 4 — 2026-11-11 (scheduled cycle, ~21:10 Europe/Paris)

**Counts (verified at 21:16 CET via the public GitHub API):** Rewindary 0 stars, 0 forks, 0 open issues, 0 open PRs · Abo Killer 0 stars, 0 forks, 0 open issues, 0 open PRs. `main` was clean and in sync with `origin/main` at `c5b5f91`.

### Decision: link previews for the app address
Since last cycle, every share card prints `arthurravel.github.io/rewindary`. But pasting that address into Slack, Discord, X, WhatsApp or iMessage showed a bare URL: the page had no Open Graph or X tags and no preview image. This cycle:
- **Tags generated at build time** (`scripts/social-meta.ts`, used as a Vite plugin). Title and description are copied from `index.html`, and `og:url`/`og:image` are built from `SITE_ADDRESS` in `src/site.ts`, so a fork changes one place. A `"` in the copy is escaped.
- **Preview image** `public/og.jpg`: 1200×630, 96 KB. A PNG was 298 KiB, at the edge of what messengers unfurl. The card in it is the real default square card from the synthetic demo, downloaded through the review gate with the #1 artist hidden; the script refuses a card without `•••••`. `pnpm og-image` re-captures it.
- **Privacy unchanged.** Browsers never fetch these tags: E2E checks that the page does not load `og.jpg`, and every run still made zero external requests. The dist scan allows the app's absolute URL only in `index.html`, only as `og:url` and `og:image`, and checks that `og.jpg` is a 1200×630 JPEG under 300 KB. Negative checks confirmed that it rejects a preview URL on another host, an oversized image, a stale build that still pointed at `og.png`, and the app URL inside a JS asset.

### Failures and notes
- Importing `vite.config.ts` from a test broke `tsc`: the Vite 8 config type does not know `test`, and Vitest's type reference did not fix it. The generator moved to `scripts/social-meta.ts`. The new import triggered Vite's "native config loader" warning, so imports now carry `.ts` extensions (with `allowImportingTsExtensions`, since `noEmit` is set).
- **Self-review against `main`** found two problems, both fixed:
  - Values were not escaped. A title containing `"` would have broken the tags, and there is now a test for it.
  - The scan's new URL allowance applied to every built file instead of `index.html` only.
- **Not done:**
  - The GitHub repository description still says "Spotify, YouTube and Netflix", and the topics lack `apple-music`. No API token was available in this environment (`gh` is not installed and no token is set), so repository metadata was not changed. The README already names all four services.
  - The GitHub repo's own social preview (for `github.com/...` links) can only be set in the web UI. It was not changed.
  - How each platform actually renders the unfurl was not checked with a real Slack, Discord or X post. Only the tags and the served image were verified.
- `pnpm` is not on the PATH, so commands ran as `corepack pnpm@9.15.0 …`. **GitHub Actions cannot start (account locked for billing) and there is no workflow, so CI was not run.** No billing or security setting was touched.

### Verified (local)
`corepack pnpm@9.15.0 verify` exited 0 on the final tree of `feat/link-previews` (commit `e3ad969`):
- `tsc --noEmit` clean
- 107/107 Vitest tests in 11 files (4 new in `tests/social-meta.test.ts`)
- production build: 79.03 kB JS (29.93 kB gzipped), 26.28 kB worker; the app bundle is byte-identical to `main` (`index-sE75Yq7Z.js`)
- dist privacy scan: "6 files, no remote URLs or network APIs, strict CSP present"
- 45/45 browser E2E checks under `/rewindary/`. The 3 new checks cover the preview tags, `og.jpg` being served as `image/jpeg` (98,198 bytes), and the page never loading it.

`git diff --check` against `main` is clean. The app's UI is unchanged. The start page at 1440×900 and 390×844 with reduced motion has `scrollWidth` equal to `clientWidth`. The Impeccable detector returned no findings on `index.html`. `og.jpg` was inspected visually.

### Deployed
`feat/link-previews` was merged into `main` as `8f42f7d`, and its tree is identical to the verified branch. It was pushed normally. That exact verified `dist/` was published to `gh-pages` as `6c3a473` ("deploy: link previews (main 8f42f7d)"), with `.nojekyll` kept. Only `index.html` and the new `og.jpg` changed; the JS and CSS bundles are byte-identical to the previous deploy.
- The unauthenticated Pages-builds API returned 404, so the build status itself was not read.
- About 30 s after the push, the live site served the new tags. `og.jpg` came back as HTTP 200 `image/jpeg`, with the same SHA-256 prefix (`37a18edb0870`) as the verified build.
- `E2E_URL=https://arthurravel.github.io/rewindary/ node scripts/e2e.mjs` then passed all 45 checks against the live site: the preview tags, the served image, the page never loading it, zero external requests, empty storage and no page errors.

GitHub Actions remain unavailable because of the billing lock, so CI is not claimed green.

## Day 4 — 2026-11-12 (scheduled cycle, ~02:25 Europe/Paris)

**Counts (as supplied at 02:22 CET from the public GitHub state; not re-queried by this run, since `gh` is unavailable here):** Rewindary 0 stars, 0 forks, 0 open issues, 0 open PRs · Abo Killer 0 stars, 0 forks, 0 open issues. `main` was clean and in sync with `origin/main` at `56e9194`.

### Decision: stop phones scrolling sideways
Rendering the live product at phone widths before choosing a task showed that **the share screen was 437 px wide on every phone** (checked at 320, 360, 375, 390 and 414 px). The page scrolled sideways, and the right edge of the card preview, the source toggles and the "Everything this card says" list were cut off. The share card is how Rewindary spreads, and the story is built for phones, so this was the highest-leverage fix.
- **Cause:** the share screen is a one-column grid below 900 px. Its implicit `auto` column grew to the widest unbreakable text, which was `arthurravel.github.io/rewindary` in the review list's footer line (added on 2026-11-11 in findable-cards). That text sat in a fixed `7.5rem 1fr auto` row. The E2E switched to 1280 px before the share screen, so no check ever saw it.
- **Second finding:** with the "Get your data" guides expanded, the start page was 392 px wide on phones, because of `CONTENT_INTERACTION/ViewingActivity.csv` in the Netflix guide.
- **Fix:**
  - The share grid column is now `minmax(0, 1fr)` and fieldsets have `min-inline-size: 0`.
  - Under 480 px, each review line reads label above value with its "show" toggle beside both, the same pattern the privacy receipt already uses.
  - Paths and the address can wrap after a `/` (`<wbr>`, so the text read or copied is unchanged), with `overflow-wrap` as a fallback.
  - Tablet and desktop layouts are unchanged.

Card rendering, redaction, the CSP and parsing are untouched. The app bundle changed only in its UI code.

### Failures and notes
- **Negative control:** with the source fix stashed and only the new E2E check kept, the run failed with "start page with every guide open 392>320 | share card (story) 437>320 | share card (square, names shown) 437>320". It passes with the fix.
- **Self-review against `main`:** the README's E2E list did not mention the new phone-width check. It was added. No other concrete defect was found. The Impeccable detector flagged only the pre-existing gradient text (`src/styles.css` lines 41 and 118), not this change.
- **Not checked:**
  - Only Chromium was run, at emulated widths. Real iOS Safari and Firefox Android were not.
  - `slashBreaks` has no unit test, because the Vitest environment has no DOM renderer. The E2E covers it: the footer line still contains the address, and no screen overflows.
- **Not done:** the repository description and topics still omit Apple Music. `gh` is unavailable, so this is left to the orchestrator. `pnpm` is not on the PATH, so commands ran as `corepack pnpm@9.15.0 …`. **GitHub Actions cannot start (account locked for billing) and there is no workflow, so CI was not run.** No billing or security setting was touched. `gh-pages` was not deployed by this run.

### Verified (local)
`corepack pnpm@9.15.0 verify` exited 0 on `fix/phone-overflow`:
- `tsc --noEmit` clean
- 107/107 Vitest tests in 11 files
- production build: 79.17 kB JS (29.98 kB gzipped), 15.49 kB CSS, 26.28 kB worker (unchanged)
- dist privacy scan: "6 files, no remote URLs or network APIs, strict CSP present"
- 46/46 browser E2E checks under `/rewindary/`. The 1 new check: at 320 px, no screen scrolls sideways (the start page with every guide open, review, all 13 story slides, and the share card in story and square formats with names shown).

`git diff --check` is clean. A scratch probe found `scrollWidth` equal to `clientWidth` on every screen at 320 and 360 px. The share panel and expanded guides were inspected at 320 (reduced motion), 390 and 1440 px.

### Post-merge deploy and verification (2026-11-12)
- **Repository metadata:** the repository description now names Spotify, Apple Music, YouTube and Netflix, and the `apple-music` topic was added. This closes the "not done" item above.
- **Deploy:** the exact verified `dist` from product `main` `6eab989` was published as `gh-pages` `e346745`.
- **Pages build:** the automatic legacy Pages build errored with no message. The explicitly triggered build `1361774309` then reached `built` for `e346745` after 319560 ms, at 2026-11-12T01:39:41Z.
- **Live site:** the live HTML serves `index-BNbnZUa1.js` and `index-BHOnrStD.css`.
- **Live E2E:** passed all 46 checks, including the 320 px no-horizontal-scroll check.

GitHub Actions remain unavailable because of the billing lock, so CI is not claimed green.

## Day 4, cycle 2 — 2026-11-12 (scheduled cycle)

**Counts (as supplied at the start of the cycle; not re-queried by this run):** Rewindary 0 stars, 0 forks, no issues or PRs · Abo Killer 0 stars, 0 forks. `main` was clean at `0445e13`.

### Decision: copy the card image
A share card could leave the page as a PNG or SVG download, or through the native share sheet. That sheet only appears where the browser supports sharing files, which is mostly on phones. On a desktop, posting a card to Slack, Discord or X meant downloading it, finding the file and uploading it again. Export failures were silent: a PNG that failed to encode just did nothing, and every share-sheet error was swallowed. This cycle:
- **Copy image.** The button sits next to SVG and is gated by the same "I've reviewed" checkbox. It puts the same 1080-px PNG on the clipboard; nothing else is ever written there. It is shown only when the page is a secure context with `navigator.clipboard.write` and `ClipboardItem` (and, where `ClipboardItem.supports` exists, PNG support).
- **Clipboard item built inside the click.** The item is created synchronously, holding a promise for the PNG still being drawn. This is the documented pattern WebKit needs; it was *not* tested in Safari.
- **Feedback.** A status line under the buttons says "Copied. Paste it into a post or a chat." The button's icon becomes a check. The note clears as soon as the card or the review changes, and a result that arrives for an older card is dropped. When the PNG, the copy or the share sheet fails, the note names the problem and the other format to use. It never repeats the error text. Closing the share sheet stays silent.
- **Layout.** Download PNG keeps its own row. Copy image, SVG and Share… sit together below it at every width. Without this grouping, SVG wrapped alone onto a second row in the 420 px desktop panel.

The card content, redaction, the review gate, the CSP and parsing are unchanged. Clipboard access needs no network, and the privacy scans still pass.

### Failures and notes
- **Self-review against `main`:**
  - A later `.export-note` rule overrode `.error`'s text colour, which would have shown errors in grey. Fixed before the first render.
  - The gate hint said "downloading and copying" even where Copy image is hidden. It now matches the buttons shown.
  - No other concrete defect was found.
- The Impeccable detector flagged only the pre-existing gradient text (`src/styles.css` lines 41 and 118), not this change.
- **Not checked:**
  - Only headless Chromium was run. Safari, Firefox and real paste targets (Slack, Discord, X) were not.
  - Error states were checked visually by stubbing `navigator.clipboard.write` to reject in a scratch script, not in the E2E.
- `pnpm` is not on the PATH, so commands ran as `corepack pnpm@9.15.0 …`. **GitHub Actions cannot start (account locked for billing) and there is no workflow, so CI was not run.** No billing or security setting was touched. **Nothing was pushed, merged or deployed by this run.**

### Verified (local)
`corepack pnpm@9.15.0 verify` exited 0 on `feat/copy-card-image`:
- `tsc --noEmit` clean
- 114/114 Vitest tests in 12 files (7 new in `tests/exports.test.ts`)
- production build: 81.07 kB JS (30.68 kB gzipped), 15.75 kB CSS, 26.28 kB worker (unchanged)
- dist privacy scan: "6 files, no remote URLs or network APIs, strict CSP present"
- 48/48 browser E2E checks under `/rewindary/`:
  - The review-gate check now covers Copy image too.
  - 2 new checks: Copy image puts a PNG on the clipboard that reads back as 1080×1920, and the "Copied" note clears once the card changes.
  - Every run still made zero external requests.

`git diff --check` against `main` is clean. The share panel was inspected at 1440×900, 390×844 and 320×640 with reduced motion, before review, after copying, and with a refused clipboard (at 390). `scrollWidth` equals `clientWidth` in each case.

### Post-merge deploy and verification
- **Merge:** product commits `c0132df` and `f98bdde` were merged as `f9b960b`.
- **Independent local gate:** a full `corepack pnpm@9.15.0 verify` passed TypeScript, 114/114 tests in 12 files, the production build, the 6-file strict privacy scan and all 48 local browser E2E checks.
- **Deploy:** the exact verified `dist` was published as `gh-pages` `3efea22`.
- **Pages build:** the authenticated legacy Pages build for `3efea22` reached `built` with no error (created 2026-11-12T06:55:15Z).
- **Live E2E:** passed all 48 checks, including the clipboard PNG at 1080×1920, zero external requests, empty storage and no page errors.
- **Email:** remote `main` and `gh-pages` use the required noreply email.

GitHub Actions remain unavailable because of the billing lock, so CI is not claimed green.

## Day 4, cycle 3 — 2026-11-12 (scheduled cycle, ~13:00 Europe/Paris)

**Counts (as supplied at the start of the cycle; not re-queried with authentication, since `gh` is unavailable here):** Rewindary 0 stars, 0 forks, no issues or PRs · Abo Killer 0 stars, 0 forks. The public API showed the same star and fork counts. `main` was clean at `354377d`.

### Decision: a calendar reminder for exports still on their way
Spotify and Netflix say their exports can take up to 30 days, and Apple up to 7. Rewindary stores nothing, so someone who requested an export on the start page had to remember the address to come back. That was the biggest drop-off left in the funnel. The start page now has a **"Requested an export?"** card under the guides:
- **Choice:** 3 days, 1 week (the default) or 30 days. **Add to calendar** downloads an `.ics` event at 6 PM local time on that day, with a display alert. The page then confirms the saved file name and the day.
- **What the file holds:** a fixed title and text, that time, the address of the page it was made on, and the stamp and random ID every calendar event needs. The address is read from `location` at runtime, without query or fragment, and is left out for a copy opened from disk. Nothing from the exports is in the file, and nothing is sent or stored.
- **Floating local times,** built from date parts, so a daylight-saving change in between keeps it at 6 PM. Lines are folded at 75 octets and text values are escaped (RFC 5545).
- **Shared helper:** the card download helper moved to `src/ui/download.ts`, so the card and the reminder use the same one.
- **README:** the README never linked the live app in its body; a separate docs commit adds one "Open Rewindary" line above the GIF. The banner, badges, GIF and the closing AI disclosure are unchanged.

### Failures and notes
- **Phone layout, before review:** at 320 and 390 px the first segment labels ("In 3 days") wrapped onto two lines, and then "30 days" spilled past the segment. The labels are now "3 days / 1 week / 30 days" under a "Remind me in" label, laid out as an equal three-column grid under 480 px.
- **Self-review before committing:**
  - The test restored an unset `TZ` as the string `"undefined"`. Fixed.
  - The UI, README and module comment said the file held "only" a title, a time and an address. They now say it also holds a creation stamp and an ID.
- **Review against `main`:** the "Saved" note reused the date label from the last render, so a reminder saved just after midnight would have named the previous day. Fixed in `cc1df8b`.
- **Negative control:** with the date math replaced by `7 × 24 h` arithmetic, the daylight-saving test failed. It passes with the real code.
- The Impeccable detector flagged only the pre-existing gradient text (`.grad`, `.huge.persona`), not this change.
- **Not checked:**
  - Only headless Chromium was run. How Safari on iOS and macOS, Google Calendar import and Outlook treat the file (including the alert) was not tested.
  - The README GIF and screenshots were not regenerated, so they don't show the new card.
- `pnpm` is not on the PATH, so commands ran as `corepack pnpm@9.15.0 …`. **GitHub Actions cannot start (account locked for billing) and there is no workflow, so CI was not run and is not claimed green.** No billing, security or repository setting was touched. **Nothing was pushed, merged or deployed by this run.**

### Verified (local)
`corepack pnpm@9.15.0 verify` exited 0 on `feat/export-reminder` at `cc1df8b`:
- `tsc --noEmit` clean
- 125/125 Vitest tests in 13 files (11 new in `tests/reminder.test.ts`)
- production build: 84.46 kB JS (31.96 kB gzipped), 16.47 kB CSS, 26.28 kB worker (unchanged)
- dist privacy scan: "6 files, no remote URLs or network APIs, strict CSP present"
- 53/53 browser E2E checks under `/rewindary/`. The 5 new checks:
  - the card names the reminder's day
  - the downloaded `.ics` has the right file name, a 6 PM `DTSTART` that day in the browser's time zone, and a display alert
  - its only address is the app's own
  - the page confirms the saved file
  - still zero external requests

`git diff --check main...HEAD` is clean. The reminder card was inspected at 320×640 (reduced motion), 390×844 and 1440×900, before saving, after saving, and with keyboard focus. `scrollWidth` equals `clientWidth` at every width.

## Day 4, cycle 4 — 2026-11-12 (scheduled cycle, ~18:20 Europe/Paris)

**Counts (as supplied at the start of the cycle; not re-queried by this run, since `gh` is unavailable here):** Rewindary 0 stars, 0 forks, 0 issues, 0 PRs · Abo Killer 0 stars, 0 forks, 0 issues, 0 PRs. `main` was clean and in sync with `origin/main` at `46d0ecc`.

### Decision: keep the story's timing honest
The story is the product's core experience on a phone and the path to the share card. Reading `src/ui/Story.tsx` showed three timing faults:
- **Pause and Play were out of step.** Pausing froze the progress bar, but Play restarted a full 7 s timer while the bar resumed mid-way. After a pause at 4 s, the bar was full after 3 s and then sat full for 4 more seconds before the slide moved.
- **The story kept going in the background.** Switching to another tab or app for a minute left you several slides further on.
- **Press-and-hold skipped instead of pausing.** People who know story viewers hold a finger down to read. Here, releasing that press counted as a tap and skipped the slide.

The fix:
- **Resume from the time played.** The slide timer counts only time actually played, so Play resumes from that point. Each time the slide resumes, the bar is redrawn from that time with a negative `animation-delay`, so it fills exactly when the slide moves on.
- **Hold to pause.** Holding a tap zone pauses, and letting go after 300 ms or more does not move on. A quick tap, the arrow keys, and Enter or Space on a focused tap zone behave as before.
- **Wait in hidden tabs.** When `visibilitychange` reports the page hidden, the story pauses, and it carries on when the page is visible again. A pause the user chose stays paused.
- **Tap zones** no longer start a text selection or a touch callout.

The card rendering, redaction, parsing, CSP and storage are untouched. The change is limited to the story UI.

### Failures and notes
- **First E2E run:** one check failed only because the browser normalises the style attribute to `animation-delay: -4000ms`, with a space; the timing itself was right. The regex was fixed.
- **Negative control:** with `src/ui/Story.tsx` and `src/styles.css` from `main` and only the new checks kept, the run reported "intro → intro → intro" 3.5 s after Play (no resume) and "netflix → rhythm" after a hidden minute (it advanced). The third check then crashed, because the old story had already reached its end slide. The first control attempt had crashed on a test id that `main` lacks. The check now selects the bar by its existing class, and the test id was removed.
- **Review against `main`** found one concrete defect, fixed before committing. The timer was cleared in a plain `useEffect`, which Preact runs after the next frame. A hidden tab may not draw that frame, so with under a second left on a slide the old timer could still fire once. It now uses `useLayoutEffect`. No other defect was found. The checks covered touch `pointerleave` after `pointerup`, keyboard activation, Space on a tap zone, right-click, a hold that an arrow key carried to the end slide, Replay and reduced motion.
- The Impeccable detector flagged only the pre-existing gradient text (`.grad`, `.huge.persona`), not this change.
- **Not checked:**
  - Only headless Chromium was run. Real iOS Safari and Android Chrome long-press behaviour was not. Android may send `pointercancel` on a long press, which would resume the story while the finger is still down.
  - The hidden-tab check dispatches a simulated `visibilitychange` (headless Chromium cannot background a tab), so real background throttling was not exercised.
  - There is no unit test, because Vitest has no DOM here. The E2E covers the behaviour.
- `pnpm` is not on the PATH, so commands ran as `corepack pnpm@9.15.0 …`. **GitHub Actions cannot start (account locked for billing) and there is no workflow, so CI was not run and is not claimed green.** No billing, security or repository setting was touched. `gh-pages` was not deployed by this run.

### Verified (local)
`corepack pnpm@9.15.0 verify` exited 0 on `fix/story-timing` after the review fix:
- `tsc --noEmit` clean
- 125/125 Vitest tests in 13 files (unchanged)
- production build: 85.29 kB JS (32.28 kB gzipped), 16.56 kB CSS, 26.28 kB worker (unchanged)
- dist privacy scan: "6 files, no remote URLs or network APIs, strict CSP present"
- 56/56 browser E2E checks under `/rewindary/`. The 3 new checks run on Playwright's fake clock in a separate browser context:
  - after a pause at 4 s, the slide moves on 3 s after Play, not 7 s, and its bar resumes from 4000 ms
  - the story waits while the tab is hidden and carries on when it is back
  - holding a tap zone pauses and letting go stays put, while a quick tap and Enter still move on
  - every run still made zero external requests

The story was inspected at 390×844 and 1440×900 while held at 3.5 s. The bar stayed at 0.51 of its width through a 1.5 s hold and continued from there (0.56) after release. There was no text selection, and `scrollWidth` equals `clientWidth` at both widths.

### Post-merge deploy and verification
- **Merge:** the product change was merged as `f053190`.
- **Deploy:** the exact verified `dist` was published as `gh-pages` `148a051`. All six files were SHA-256 identical to the verified local `dist`.
- **Pages build:** the legacy Pages build `1363827784` for `148a051` reached `built` with no error (created 2026-11-12T17:34:18Z, completed 17:34:40Z).
- **Live URL:** returned HTTP 200.
- **Live E2E:** passed all 56 checks, including the three story-timing checks, with zero external requests, empty storage and no page errors.

GitHub Actions remain unavailable because of the billing lock, so CI is not claimed green.

## Day 4, cycle 5 — 2026-11-12 (scheduled cycle, ~23:40 Europe/Paris)

**Counts (as supplied at the start of the cycle; not re-queried by this run):** Rewindary 0 stars, 0 forks, 0 open issues, 0 open PRs · Abo Killer 0 stars, 0 forks. `main` was clean and in sync with `origin/main` at `71c6579`.

### Decision: take dropped files anywhere, and never let the browser open them
Reading `src/ui/App.tsx` and `src/ui/Home.tsx` showed that the only drop target in the app was the start page's dashed zone. This had two consequences:
- **Drops outside the zone did nothing for the app.** On the start page, a file that missed the zone (on the heading or the guides) was left to the browser, whose default is to open a dropped file in the tab.
- **The review screen had no drop target at all.** Its own notes say "Big Takeouts are split into several zips: if you have other parts, drop them too". Doing exactly that would hand the file to the browser, which can replace the app and lose everything already read. Rewindary stores nothing, so the files then have to be picked again.

The fix:
- **One page-wide handler in `App`.** It acts only on drags that carry files.
  - **Start page:** the drop zone lights up as soon as files are over the page, and a drop anywhere is read, folders included, through the same path as before.
  - **Review screen:** a full-page overlay says "Drop to add these files" ("Drop to replace the demo with your files" after the demo), and the drop is added to what was already read.
  - **Story and share:** drops are refused (`dropEffect = 'none'`), so the browser opens nothing there either.
- **The overlay can't get stuck.** It counts `dragenter` and `dragleave`. No mouse events fire during a drag, so if a browser skips the last `dragleave`, the next mouse move clears the overlay.
- **Motion and accessibility:** the overlay fades in over 160 ms (none with reduced motion). It is `aria-hidden` and `pointer-events: none`, because dragging is a pointer-only action and status messages still go through the existing live regions.
- **README:** one "Drop anywhere" feature line and one line describing the new E2E checks. The banner, badges, GIF and the closing AI disclosure are unchanged.

Parsing, cards, redaction, the CSP and storage are untouched. Nothing new touches the network.

### Failures and notes
- **Negative control:** with the new checks run against the unchanged `main` source, the first four failed (no highlight, no read on the start page's heading, no overlay, nothing added on review). The run then stopped with a timeout, because there was no story to open.
- **Headless Chromium did not navigate** to a file dropped through the DevTools protocol, even on `main`, so the "the tab opens the file" part of the bug could not be reproduced here. The E2E instead asserts that every drop's default handling is cancelled, which is what prevents it.
- **A flaky check, fixed in the test:** one of the first full `verify` runs failed "the browser never opens a dropped file…", although the files had been read. The test's own listener was sometimes added before the app's (Preact adds effects after the first paint), so it read `defaultPrevented` too early. It now reads the flag after dispatch, and the section waits for the first paint before dragging. Four E2E runs and the final `verify` then passed.
- **Visual pass, before review:** at 1440 px the review buttons showed through the overlay under its title, and the second line wrapped to an orphan. The overlay is now 95 % opaque, and the line is shorter: "Read on this device. Nothing is uploaded."
- **Review against `main`:** the only finding was the possibly stuck overlay above (a missed `dragleave`). It was fixed and covered by a check. Also checked: a folder dropped on the zone, where the transparent file input sits, is still walked and read (the existing folder-drop checks pass). The zone's own drop handlers were removed, so only the page-wide handler takes a drop. Its cancelled default keeps the input from taking the files as well.
- The Impeccable detector flagged only the pre-existing gradient text (`src/styles.css` lines 41 and 132), not this change.
- **Not checked:**
  - Only headless Chromium was run. Safari's and Firefox's drag events (including Safari's `dragleave` quirks) and folder drops in those browsers were not tested.
  - iPad drag from the Files app was not tested.
- `pnpm` is not on the PATH, so commands ran as `corepack pnpm@9.15.0 …`. **GitHub Actions cannot start (account locked for billing) and there is no workflow, so CI was not run and is not claimed green.** No billing, security or repository setting was touched. **Nothing was pushed, merged or deployed by this run.**

### Verified (local)
`corepack pnpm@9.15.0 verify` exited 0 on `fix/drop-anywhere`:
- `tsc --noEmit` clean
- 125/125 Vitest tests in 13 files (unchanged; Vitest has no DOM here, so the behaviour is covered by the E2E)
- production build: 86.37 kB JS (32.58 kB gzipped), 16.94 kB CSS, 26.28 kB worker (unchanged)
- dist privacy scan: "6 files, no remote URLs or network APIs, strict CSP present"
- 64/64 browser E2E checks under `/rewindary/`. The 8 new checks use real drops through Chromium's DevTools protocol:
  - files dragged over the start page light up the drop zone
  - a file dropped on the start page's heading is read in place
  - the review screen shows the overlay while dragging
  - the overlay goes away on the next mouse move without a `dragleave`
  - a file dropped on the review screen is added to the one already read
  - a drop on the story is ignored and the story stays on its slide
  - every drop's default handling was cancelled
  - zero external requests

`git diff --check main` is clean. Drag states were inspected at 1440×900, 390×844 and 320×640 (reduced motion, where the overlay has no animation). `scrollWidth` equals `clientWidth` at every width.

### Post-merge deploy and verification
- **Merge:** product commits `0b210ce` and `3cc7a95` were merged to `main` as `d96a95a`.
- **Independent local gate:** a full rerun passed TypeScript, 125/125 tests in 13 files, the production build (86.37 kB JS, 32.58 kB gzipped; 16.94 kB CSS; 26.28 kB worker), the strict 6-file privacy scan and all 64 E2E checks.
- **Deploy:** the exact `dist` matched the `gh-pages` worktree and was published as `gh-pages` `d9a1e0e`.
- **Pages build:** the explicitly triggered legacy Pages build `1364532679` for `d9a1e0e` reached `built` with no error (2026-11-12T23:03:02Z).
- **Live E2E:** passed all 64 checks, including the 8 drop-anywhere checks, with zero external requests, empty storage and no page errors.

GitHub Actions remain unavailable, so CI is not claimed green.

## Day 5 — 2026-11-13 (scheduled cycle, ~04:10 Europe/Paris)

**Counts (freshly verified on GitHub for this cycle at about 05:15 Europe/Paris):** Rewindary 0 stars, 0 forks, 0 issues, 0 PRs · Abo Killer 0 stars, 0 forks, 0 issues, 0 PRs. `main` was clean at `1642356`.

### Decision: never rank a podcast as an artist
`computeInsights` ranked every Spotify "group" by listening time, so podcast shows and audiobooks were ranked together with artists. One hour-long episode outweighs about twenty songs. A listener with a daily show could see it as their #1 "artist" on the Spotify slide, with episodes counted as "plays", and on the share card's "#1 artist" line. A resumed episode could also take "On repeat". The synthetic demo hid this because its artists dominate, which is why no earlier check caught it.

The fix:
- **`src/insights.ts`:** podcast-kind events (episodes and audiobook chapters, 30 s or more) go into their own `podcasts` ranking by time. `top` and `topTitles` now hold music only. Podcast time still counts toward Spotify's hours, the day clock and everything else.
- **`src/ui/Story.tsx`:** the Spotify slide adds "Top podcast or audiobook: <show>, <time>." under the artists. If a Spotify year has only podcasts, they become the list, ranked by time.
- **Share card:** no code change. Its #1 artist comes from `top`, so it is now always an artist. A podcast-only year gets no artist line, rather than a show labelled as an artist. Card redaction is unchanged; the podcast name is never on a card.

### Failures and notes
- **Negative control:** the 2 new unit tests failed on the unchanged `src/insights.ts` and `src/ui/Story.tsx` (the podcast show ranked #1, and the card's #1 artist was the show). Both pass with the fix.
- **A flaky timeout, not related to this change:** the first full `verify` failed one existing test ("thousands of tiny photo sidecars"), which took 8.6 s against Vitest's 5 s limit while the machine was loaded. It passed alone and in the next two full runs. The ingest code was not touched.
- **Review against `main`:** one finding. Spotify audiobooks share the `podcast` kind, so the first label, "Top podcast", would have mislabelled an audiobook. It now reads "Top podcast or audiobook", and the E2E check was updated.
- **Not checked:**
  - The podcast-only list on the Spotify slide has no automated check (Vitest has no DOM here, and the demo always has music).
  - No real (non-synthetic) export was used.
- `pnpm` is not on the PATH, so commands ran as `corepack pnpm@9.15.0 …`. **GitHub Actions cannot start (account locked for billing) and there is no workflow, so CI was not run and is not claimed green.** No billing, security or repository setting was touched. **Nothing was pushed, merged or deployed by this run.**

### Verified (local)
`corepack pnpm@9.15.0 verify` exited 0 on `fix/podcasts-not-artists` after the review fix:
- `tsc --noEmit` clean
- 127/127 Vitest tests in 13 files (+2: the artist and song rankings exclude shows and episodes, and so does the card's #1 artist)
- production build: 86.76 kB JS (32.70 kB gzipped), 16.94 kB CSS, 26.28 kB worker
- dist privacy scan: "6 files, no remote URLs or network APIs, strict CSP present"
- 65/65 browser E2E checks under `/rewindary/`. The new one is on the demo's Spotify slide: "Top podcast or audiobook: The Patient Engineer, 20 h 48 min.", with Velvet Static leading the artist list and no podcast in it.

`git diff --check main` is clean. The demo's Spotify slide was inspected at 320×640, 390×844 and 1440×900: the note sits below the list and fits inside the viewport (its bottom edge at 494, 597 and 631 px), and `scrollWidth` equals `clientWidth` at every width.

### Post-merge deploy and verification
- **Merge:** `fix/podcasts-not-artists` was merged to `main` as `5845f71`; `main` is clean.
- **Deploy:** the exact verified `dist` was published as `gh-pages` `174a6f0`.
- **Pages build:** the explicitly triggered legacy Pages build for `174a6f0` reached `built` with no error (created 2026-11-13T04:18:26Z, updated 04:19:00Z).
- **Live E2E:** the live URL returned HTTP 200, and all 65 checks passed, including the separate podcast ranking, with zero external requests, empty storage and no page errors.
- **Counts (freshly verified on GitHub):** Rewindary 0 stars, 0 forks, 0 issues, 0 PRs · Abo Killer 0 stars, 0 forks, 0 issues, 0 PRs.

GitHub Actions remain unavailable, so CI is not claimed green.

## Day 5, cycle 2 — 2026-11-13 (~10:24 Europe/Paris)

**Counts (supplied for this cycle, as of 2026-11-13 10:24 CET):** Rewindary 0 stars, 0 forks, 0 issues, 0 PRs · Abo Killer 0 stars, 0 forks, 0 issues, 0 PRs. `main` was clean at `7b647fb`.

### Decision: merge exports added later by the same rules as one drop
Exports arrive days apart (the calendar reminder exists for that reason), so the second one is often added from the review screen with "Add more files" or a drop. That path used a separate merge in `src/ui/App.tsx` that skipped the ingest rules:
- **Spotify counted twice.** If someone loaded the 1-year account data (it arrives within days) and later added the extended history (up to 30 days), both were kept. Every play of the last year counted twice: in hours, top artists, streaks and the share card. Dropped together, the account data is set aside, but not when the files are added one after the other.
- **A file added twice was reported as new.** Its events were de-duplicated, but its report showed the full entry count again and no "duplicate entries merged" note.
- **YouTube durations stopped at the batch edge.** They are estimated from the gap to the next video, so the last video of each batch got the 8-minute default.

The fix:
- **`src/ingest.ts`:** `readBatch` returns what a drop held without merging it, and `combineBatches` merges every batch in the order it was added, through the same `mergeParsed` as a single drop. `ingestFiles` is now those two steps together, with the same output. Estimated durations are left out of the de-duplication key, because YouTube estimates are rewritten at each merge. Without that change, a Takeout added twice would not match itself.
- **`src/worker.ts` / `src/ui/App.tsx`:** the worker returns the batch, and the app keeps every batch and re-merges on each add. The demo and "Forget everything" empty the list. "Forget everything" now also stops a read or folder listing still in progress, so a read that finishes later cannot bring forgotten files back.
- No UI was added or restyled: the reports already show the "Ignored because…" and "duplicate entries merged" notes, and now they are also correct for files added later. Nothing new touches the network or storage.

### Failures and notes
- **A weak test, caught by its negative control:** the first version of the YouTube unit test read both batches before merging either. With the old key (estimated duration included), it still passed. In the app, each batch is merged as soon as it is read, which rewrites the earlier estimates. The test now merges after each batch like the app does. With the old key it then fails (8 events instead of 4), and with the fix it passes.
- **E2E negative control:** the new E2E section was run against `main`'s source (the `src/` changes stashed and rebuilt). The account-data check failed (Spotify 4 → 5 entries), as did the added-twice check. The forget check passed there too, because the old `onForget` also emptied the data. The new guard covers only a read still running, which this check does not exercise.
- **Review against `main` (revue-changement grid):** nothing blocking. Checked:
  - Within one drop, the new key gives the same de-duplication: the only estimated events are YouTube (duration 0 before the estimate) and the quick Netflix CSV (a fixed duration per kind, and kind is already in the key).
  - `ingestFiles` keeps its signature and output, and the worker's error path is unchanged.
  - A failed add leaves earlier batches untouched.
  - Files dropped on the demo still replace it.
- **Not checked:**
  - Only headless Chromium was run.
  - No real (non-synthetic) export was used.
  - The overlap between the quick Netflix CSV and `ViewingActivity.csv` was not examined. This change does not affect it either way.
  - The "Forget everything during a read" guard has no automated check: the synthetic fixtures are read too fast for a click to land mid-read.
- **No visual pass:** no layout, style or copy on screen changed. The notes shown are existing strings in the existing report list.
- `pnpm` is not on the PATH, so commands ran as `corepack pnpm@9.15.0 …`. **GitHub Actions cannot start (account locked for billing) and there is no workflow, so CI was not run and is not claimed green.** No billing, security or repository setting was touched. **The `fix/add-later-merge` branch was pushed; nothing was merged to `main`, and `gh-pages` was not deployed, so the live app still has the old merge.**

### Verified (local)
`corepack pnpm@9.15.0 verify` exited 0 on `fix/add-later-merge` (fix commit `45dae7a`):
- `tsc --noEmit` clean
- 130/130 Vitest tests in 13 files (+3):
  - the account data is set aside whichever Spotify export arrives first
  - an export added twice is merged and reported
  - YouTube durations are estimated across batches, and a Takeout added twice matches itself
- production build: 86.59 kB JS (32.60 kB gzipped), 16.94 kB CSS, 25.27 kB worker. The old app-side merge is gone, and the worker no longer bundles the merge.
- dist privacy scan: "6 files, no remote URLs or network APIs, strict CSP present"
- 69/69 browser E2E checks under `/rewindary/` (+4, through the real "Add more files" input):
  - the 1-year data added after the extended history leaves the Spotify count unchanged and says why
  - the same export added again is merged and reported
  - after "Forget everything", the next file is read afresh
  - zero external requests

`git diff --check main` is clean.
