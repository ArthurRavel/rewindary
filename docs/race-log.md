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
