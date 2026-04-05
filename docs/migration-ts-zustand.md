# Ironforge: Legacy Runtime Migration to TypeScript + Zustand

## Status

The visible-shell migration is complete, but runtime ownership consolidation is still in progress as of 2026-04-05.

All seven planned phases for the React + Vite shell are delivered and verified. The remaining work is no longer "page shell migration", but it is also not ordinary cleanup: profile/program/runtime ownership is still being consolidated out of the bidirectional legacy sync layer.

This closeout date supersedes the earlier 2026-03-25 claim. At that point the app shell and most typed runtime seams were in place, but the page-level `history-store`, `dashboard-store`, and `nutrition-store` were still bridge-fed compatibility stubs. Those stores now own their read models directly and the `syncHistoryBridge`, `syncDashboardBridge`, and `syncNutritionBridge` runtime path is no longer part of the live page flow.

Closeout checkpoints completed:

- React workout entry points now use `workoutStore` actions instead of direct legacy workout globals.
- End-to-end tests use the test-only `window.__IRONFORGE_STORES__` bridge where migrated store seams exist.
- CI now includes a migration guardrail that blocks new `src/` regressions back to legacy workout globals and `window.eval(...)` on migrated workout surfaces.
- History, Dashboard, and Nutrition now render from typed store-owned page models instead of legacy snapshot pushes.
- `src/domain/planning.ts` now owns typed fatigue math, and `window.computeFatigue` is a typed compatibility delegate installed from `src/app/services/planning-runtime.ts`.
- `src/stores/nutrition-store.ts` now owns nutrition runtime state and command flow, while `src/app/services/nutrition-coach.ts` is the UI-facing wrapper.
- `core/history-layer.js` is retired from the live runtime load order, and its legacy globals are now provided by `src/stores/history-store.ts`.
- `core/nutrition-layer.js` is no longer part of the live page flow; its legacy globals are now provided by `src/stores/nutrition-store.ts`.
- `core/dashboard-layer.js` is no longer part of the live page flow; dashboard helpers and compatibility delegates now live in typed runtime code.
- bootstrap normalization for profile/program/schedule/workout startup data now runs through the typed runtime bridge and `src/domain/profile-bootstrap.ts` instead of being owned inline by `core/data-layer.js`.

## Visible Shell Complete

The page-store migration follow-up seams listed below are closed.

### 1. Nutrition runtime state ownership: done

`nutrition-store` now owns nutrition runtime state directly, including selected action, request lifecycle flags, scroll version, current day history, and session context. Typed UI callers use `src/app/services/nutrition-coach.ts`, and legacy `window.*` entry points delegate into the store instead of owning runtime state in `core/nutrition-layer.js`.

### 2. Legacy layer retirement status: closed

- `core/history-layer.js`: retired from live runtime ownership and removed from load order
- `core/nutrition-layer.js`: compatibility/reference only and removed from live load order
- `core/dashboard-layer.js`: retired from live runtime ownership and removed from load order

### 3. Fatigue ownership: done

`src/domain/planning.ts` now contains the typed fatigue implementation. The dashboard store consumes it directly from typed inputs, and `window.computeFatigue` remains only as a thin compatibility delegate for untouched legacy planning/workout/program callers.

## Current Consolidation Gate

The visible-shell cleanup follow-up work is complete, but runtime ownership cleanup is still active.

Gate status:

- `syncHistoryBridge` removed from `window`: done
- `syncDashboardBridge` removed from `window`: done
- `syncNutritionBridge` removed from `window`: done
- islands render from Zustand instead of legacy snapshot pushes: done
- dedicated island tests exist for History, Dashboard, and Nutrition: done
- cleanup-phase regression coverage for fatigue/history/nutrition delegates: done
- dashboard compatibility delegates now come from typed runtime ownership instead of `core/dashboard-layer.js`: done
- nutrition support concerns are split into helper modules while the store remains the state owner: done
- CI-safe single-worker Playwright gate exists as `npm run test:e2e:ci`: done
- full Playwright confirmation: done

## Summary

Ironforge's visible UI migration is complete. The shipped app shell already runs through React + Vite from `src/app/main.tsx` and `src/app/AppShell.jsx`, and the shared `src/app/store/runtime-store.ts` is already part of the live runtime.

The remaining migration target is the legacy business/runtime layer in `app.js`, `core/*.js`, and `programs/*.js`. That work now centers on ownership cleanup: reducing multi-writer state, shrinking compatibility bridges, and moving the remaining business logic behind typed store/domain seams while preserving current behavior, current data formats, and the current Playwright suite.

Recent consolidation progress:

- `core/data-layer.js` now acts as loader/persister for startup and merge flows, while typed bootstrap normalization lives in `src/domain/profile-bootstrap.ts`.
- `window.__IRONFORGE_APP_RUNTIME__.bootstrapProfileRuntime(...)` is now the typed bootstrap bridge for startup/profile-document/legacy-blob normalization.
- `profileStore` now has an atomic bootstrap hydrate path for `profile + schedule` together instead of relying on sequential store writes during typed bootstrap ownership.

The first milestone is intentionally conservative:

- **Foundation first**
- **No behavior change**
- **No runtime ownership changes yet**
- **Full verification stays green before moving to the next phase**

## Current Baseline

- React already owns the visible shell, page tree, overlays, and navigation.
- `src/app/store/runtime-store.ts` already exists and is not part of the first migration target.
- Legacy business logic still lives primarily in:
  - `app.js`
  - `core/data-layer.js`
  - `core/i18n-layer.js`
  - `core/program-layer.js`
  - `core/plan-engine.js`
  - `core/dashboard-layer.js`
  - `core/history-layer.js`
  - `core/workout-layer.js`
  - `core/nutrition-layer.js`
  - `programs/*.js`
- Compatibility globals and bridges still exist and remain valid until late migration phases:
  - `window.workouts`, `window.profile`, `window.schedule`, `window.activeWorkout`
  - `window.PROGRAMS`, `window.EXERCISE_LIBRARY`
  - `window.showPage`, `window.showToast`, `window.showConfirm`, `window.loadData`
  - `window.__IRONFORGE_RUNTIME_BRIDGE__`
- The current automated baseline is:
  - `npm run typecheck`
  - `npm run build`
  - Playwright end-to-end suite in `tests/` with **23 spec files**
- `docs/migration-inventory.md` does **not** currently exist and is not part of this migration plan.
- `sw.js` already uses a fetch strategy compatible with Vite hashed assets, so service-worker support is not a missing prerequisite.

## Migration Decisions

- Scope: Migrate the remaining legacy runtime in `app.js`, `core/*.js`, and `programs/*.js`
- Architecture: Zustand stores with co-located actions
- Runtime strategy: Incremental migration with temporary compatibility shims
- Type strategy: Introduce a fresh typed domain model, but preserve persisted wire/storage shapes
- Safety rule: Every phase must keep the app functional and compatible with the existing Playwright suite
- First milestone: Foundation only, no behavior change

## Target Structure

```text
src/
  app/
    main.tsx
    AppShell.jsx
    utils/
      env.ts
  domain/
    types.ts
    config.ts
    program-plugin.ts
    normalizers.ts
    exercise-library.ts
    planning-helpers.ts
    workout-helpers.ts
    history-helpers.ts
    dashboard-helpers.ts
  stores/
    i18n-store.ts
    data-store.ts
    profile-store.ts
    program-store.ts
    workout-store.ts
    fatigue-store.ts
    nutrition-store.ts
```

Notes:

- `src/app/store/runtime-store.ts` stays in place as existing UI runtime state.
- Adapter modules such as `src/core/program-registry.js`, `src/core/exercise-library.js`, and `src/core/state.js` may remain temporarily as compatibility surfaces while the migration is in progress.
- `index.html` may continue loading legacy scripts until each migrated surface is ready to take ownership.

## Completed Phases

### Phase 0: Foundation

Goal: add typed foundations without changing runtime ownership.

Creates:

- `src/domain/types.ts`
- `src/domain/program-plugin.ts`
- `src/domain/config.ts`
- `src/app/utils/env.ts`

Rules:

- No behavior change
- No legacy file deletions
- No new store becomes the source of truth yet

Gate:

- `npm run typecheck`
- `npm run build`

### Phase 1: i18n and data seams

Goal: move persistence and translation access behind typed store seams while preserving the current global contract.

Creates:

- `src/stores/i18n-store.ts`
- `src/stores/data-store.ts`

Responsibilities:

- Port existing localStorage access, sync-state cache, draft persistence, cloud sync, auth bootstrap, and realtime sync behavior
- Preserve current localStorage keys and Supabase document keys
- Keep `window.loadData`, `window.currentUser`, `window.workouts`, `window.profile`, and `window.schedule` working through compatibility writes/delegation

Gate:

- `npm run typecheck`
- `npm run build`
- full Playwright suite

### Phase 2: profile ownership and normalization helpers

Goal: move profile and schedule state behind typed store ownership and extract pure normalization logic.

Creates:

- `src/domain/normalizers.ts`
- `src/stores/profile-store.ts`

Responsibilities:

- Hold typed profile and schedule state
- Preserve compatibility writes back to legacy globals for untouched code
- Keep settings surfaces functioning without changing persisted shapes

Gate:

- `npm run typecheck`
- `npm run build`
- full Playwright suite

### Phase 3: read-side helper extraction

Goal: migrate read-heavy domain logic before workout mutations.

Creates:

- `src/domain/exercise-library.ts`
- `src/domain/planning-helpers.ts`
- `src/domain/history-helpers.ts`
- `src/domain/dashboard-helpers.ts`
- `src/stores/program-store.ts`
- `src/stores/fatigue-store.ts`
- optional read-only `src/stores/workout-store.ts` slices as needed

Responsibilities:

- Port exercise lookup, fatigue math, planning logic, history grouping, dashboard composition, and program registry reads
- Keep `window.PROGRAMS` and `window.EXERCISE_LIBRARY` compatible until later phases

Gate:

- `npm run typecheck`
- `npm run build`
- full Playwright suite

### Phase 4: program plugins to TypeScript

Goal: port program modules one by one while preserving their runtime contract and stored state.

Creates:

- `src/programs/forge.ts`
- `src/programs/wendler531.ts`
- `src/programs/stronglifts5x5.ts`
- `src/programs/casualfullbody.ts`
- `src/programs/hypertrophysplit.ts`

Responsibilities:

- Preserve program registration timing and program state shapes
- Preserve current settings hooks and HTML-based settings rendering until a later refactor
- Switch from legacy `<script>` program registration only after TS modules are fully compatible

Gate:

- `npm run typecheck`
- `npm run build`
- full Playwright suite

### Phase 5: workout mutations

Goal: move workout lifecycle logic into typed store actions.

Creates:

- `src/stores/workout-store.ts`
- `src/domain/workout-helpers.ts`

Migration order:

1. start workout
2. set toggles and field updates
3. rest timer state
4. RPE prompt state
5. finish/discard flow

Responsibilities:

- Keep legacy global entry points as thin delegators until tests and remaining runtime callers are migrated
- Preserve draft persistence, finish/discard semantics, overlays, and current stored workout payloads

Gate:

- `npm run typecheck`
- `npm run build`
- full Playwright suite

### Phase 6: dashboard, history, and nutrition stores

Goal: migrate the remaining page-level legacy runtime logic behind typed stores.

Creates:

- `src/stores/nutrition-store.ts`
- remaining page-facing helper/store modules needed for dashboard and history

Responsibilities:

- Move islands/pages from bridge-fed legacy snapshots to direct store-backed data
- Preserve Supabase edge-function nutrition flow and day-scoped local nutrition history behavior

Gate:

- `npm run typecheck`
- `npm run build`
- full Playwright suite

### Phase 7: final bridge and global removal

Goal: remove compatibility scaffolding only after the typed runtime fully owns the legacy surface.

Deletes late, not early:

- legacy global delegators
- remaining bridge-only sync helpers
- legacy `<script>` loading that is no longer needed
- obsolete compatibility adapters

Possible end-state removals include:

- `core/ui-shell.js`
- large portions of `app.js`
- migrated `core/*.js` files
- migrated `programs/*.js` files

Gate:

- `npm run typecheck`
- `npm run build`
- full Playwright suite
- targeted verification that remaining tests no longer depend on legacy globals where replacements exist

## Invariants

These must remain true throughout the migration:

1. Persisted localStorage keys stay compatible unless an explicit migration is added.
2. Supabase profile-document and workouts-table compatibility stays intact.
3. Program state shapes stay compatible with existing user data.
4. Offline behavior remains supported.
5. i18n behavior remains supported.
6. Nutrition requests continue to flow through the Supabase `nutrition-coach` edge function.
7. Touch/mobile/PWA behavior must not regress.

## Verification

Each migration phase should be verified with:

1. `npm run typecheck`
2. `npm run build`
3. Full Playwright suite

For any phase that changes cached runtime assets, review `sw.js` and decide whether the cache version or fetch strategy needs to be updated.

## Guidance For Future Work

- This file is the active migration roadmap for the legacy runtime replacement.
- Do not add new migration instructions that refer to `docs/migration-inventory.md` unless that file is explicitly created later for a real need.
- Prefer updating this file when the migration direction changes, rather than scattering migration status bullets across agent-guidance files.
- If a future cleanup removes more legacy runtime files, track that as normal architecture cleanup rather than reopening this seven-phase migration plan.
- Post-migration cleanup work now lives in `docs/post-migration-consolidation.md`.
