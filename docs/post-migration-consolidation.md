# Ironforge Post-Cutover Consolidation

## Summary

The runtime cutover is done, but the repo still carries naming and test debt from the migration period. This document tracks cleanup after the cutover, with the assumption that the shipped app is the Training Core only.

Current end-state target:

- the shipped runtime lives in `src/`
- compatibility code is narrow and clearly marked
- Playwright defaults to typed test harness seams
- docs and filenames match current product scope

## Active Consolidation Priorities

### 1. Keep Training Core scope explicit

- Active shipped pages are `dashboard`, `log`, `history`, and `settings`.
- Nutrition and removed legacy-shell surfaces should not appear in active runtime docs or verification gates.
- Obsolete specs for deleted pages, deleted overlay contracts, or removed globals should be rewritten or deleted promptly.

### 2. Replace stale migration naming

- Prefer `compat` over `legacy` when a file or seam exists only to support untouched compatibility behavior.
- Keep `legacy` wording only for historical payloads, old imported snapshots, or intentionally preserved bridge semantics.
- Active page and spec naming should use `page`, `settings`, `dashboard`, `history`, or `log` terminology instead of `island` unless the code is genuinely about a compatibility seam.

### 3. Keep bridges narrow and explicit

- Prefer typed store or service entry points first.
- Keep `window.*` bindings small, deliberate, and easy to delete later.
- Avoid introducing new broad runtime bridges or generic sync helpers.

### 4. Treat performance cleanup as part of runtime hardening

- Signed-in pages should stay split out of the login/bootstrap path.
- If Vite warns about oversized entry chunks, prefer low-risk route or vendor chunking before deeper architectural changes.

### 5. Keep PWA validation in the release loop

- When changing shell boot paths, caching, manifests, or chunking, run one installed-PWA pass on iPhone and Android against the public `manifest.json` and `sw.js`.
- Record any device-specific regressions in a short follow-up note instead of letting them live only in chat history.

## Default Verification Gate

For consolidation slices that affect runtime behavior:

1. `npm run lint`
2. `npm run typecheck`
3. `npm run build`
4. targeted Playwright for touched surfaces
5. `npm run test:e2e:ci`

Manual device validation is still required for PWA-specific changes when the slice touches install or update behavior.
