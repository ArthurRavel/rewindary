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
