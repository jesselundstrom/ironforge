# Ironforge: Runtime Cutover Status

## Status

This cutover is complete as of 2026-03-31.

The shipped runtime is the Training Core only:

- auth
- onboarding
- dashboard
- workout logging
- history
- settings

Out of shipped runtime:

- nutrition
- removed legacy page shells
- deleted overlay flows that depended on removed globals

## Current Runtime Truths

- `src/app/main.tsx` is the production entrypoint.
- `src/app/AppShell.jsx` is the live shell.
- `src/stores/data-store.ts`, `src/stores/profile-store.ts`, `src/stores/program-store.ts`, `src/stores/workout-store.ts`, `src/stores/dashboard-store.ts`, and `src/stores/history-store.ts` own the shipped Training Core runtime.
- `public/manifest.json` and `public/sw.js` are the shipped PWA assets.
- `window.__IRONFORGE_E2E__` and `window.__IRONFORGE_STORES__` are test-only harness seams.
- `src/styles/compat-ui.css` and `src/styles/compat-state.css` are shrinking compatibility layers, not the source of truth for new UI.

## Repository Direction After Cutover

The remaining work is consolidation, not a fresh multi-phase migration plan.

Priority order:

1. Keep the shipped runtime aligned to the Training Core scope.
2. Remove obsolete tests, docs, and compatibility naming that still describe nutrition or legacy shells as live runtime surfaces.
3. Replace compatibility seams with typed store or service ownership when touching a surface.
4. Preserve persisted localStorage keys, Supabase payloads, and service-worker update strategy unless a change is deliberate and verified.

## What Still Counts As Compatibility

Some legacy-style globals and helper modules still exist for untouched seams, tests, or migration safety. They are compatibility shims, not architecture targets.

That means:

- do not add new production dependencies on deleted root-runtime globals
- prefer typed store actions and typed service modules for new work
- keep Playwright moving toward `window.__IRONFORGE_E2E__` and `window.__IRONFORGE_STORES__`
- keep `legacy` wording only where it truly refers to historical data compatibility

## Verification Expectations

For runtime-affecting changes, the default gate is:

1. `npm run lint`
2. `npm run typecheck`
3. `npm run build`
4. targeted Playwright for touched surfaces
5. `npm run test:e2e:ci`

For changes that affect cached assets or install behavior, also review the public PWA assets and do a manual installed-PWA pass on real devices when possible.

## Guidance For Future Updates

- Treat this file as a short status reference, not a long-lived migration phase plan.
- Put current cleanup or consolidation work in `docs/post-migration-consolidation.md`.
- If nutrition or recovery return to shipped runtime scope later, add a new forward-looking plan instead of reviving outdated cutover assumptions.
