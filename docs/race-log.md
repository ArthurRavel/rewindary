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
