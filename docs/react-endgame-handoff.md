# Ironforge React Endgame Handoff

Use this file as the starting context for the next conversation.

## Current Status

The React endgame is still the target architecture, but the migration is being done in staged cutovers.

Phase 2 has now started with the first ownership-transfer cutover landed:

- The React shell now owns navigation, confirm state, and toast state through the Zustand runtime store instead of polling `window.getActivePageName()` / `window.getConfirmReactSnapshot()` or mirroring DOM-written toast content.
- `core/ui-shell.js` still exposes `showPage(...)`, `showToast(...)`, and `showConfirm(...)`, but those APIs now write into React-owned store actions when the shared app shell is mounted.
- The log start and active workout React screens now read store-backed workout view state instead of consuming `getLogStartReactSnapshot()` / `getLogActiveReactSnapshot()` directly from React.
- The History React screen now reads store-backed history view state instead of consuming `getHistoryReactSnapshot()` directly from React.
- The Dashboard React screen now reads store-backed dashboard view state instead of consuming `getDashboardReactSnapshot()` directly from React.
- The Settings React screens now read store-backed settings view state instead of consuming `getSettings*ReactSnapshot()` directly from React.
- The Nutrition React screen now reads store-backed nutrition view state instead of consuming `getNutritionReactSnapshot()` directly from React.
- The retired standalone `src/app-shell/main.jsx` and `src/onboarding-island/main.jsx` boot paths are no longer part of the active runtime.
- The legacy page snapshot getter exports and page `*-updated` bridge events for Log, History, Dashboard, Settings, and Nutrition are now deleted.
- The old page-specific island mounted flags are now deleted. Legacy runtime code checks runtime-bridge capability instead of `__IRONFORGE_*_ISLAND_MOUNTED__`.
- Settings tab selection is now owned by the runtime store and mirrored into the existing DOM shell by `AppShell`.
- Nutrition page activation no longer depends on `initNutritionPage()`. Entering Nutrition now refreshes through the shared `syncNutritionBridge()` path.
- Module-side React code now has an explicit program-registry seam in `src/core/program-registry.js` instead of reading `window.PROGRAMS` directly.
- Workout view updates are now pushed into the store from legacy workout code, while the existing workout logic, persistence, and program building remain in `core/workout-layer.js`.
- RPE, sport-check, summary, rest-timer state, and draft restore/clear flows continue to work under the new push-based shell/session bridge.

What is still not done:

- The workout domain still computes React-facing log view models inside legacy helpers before pushing them into the store; it is not yet a dedicated imported session service.
- The history domain still computes the History page view model inside `core/history-layer.js` before pushing it into the store; it is not yet a dedicated imported history service.
- The dashboard domain still computes the Dashboard page view model inside `core/dashboard-layer.js` before pushing it into the store; it is not yet a dedicated imported dashboard service.
- Exercise catalog and guide flows still depend on imperative DOM rendering and global callbacks.
- The rest-timer bar outside the active-workout subtree is still legacy DOM-driven.
- Nutrition history/request lifecycle still lives in `core/nutrition-layer.js`, even though route entry now refreshes through the shared bridge.
- The rest timer still renders through legacy DOM outside the React workout subtree, even though session state now tracks its active state directly instead of re-reading DOM classes.
- Global registries like `PROGRAMS` and `EXERCISE_LIBRARY` are still window-backed compatibility surfaces.
- Legacy script callers still use the underlying global registry, but higher-level/module-side code should now prefer explicit helpers over raw `window.PROGRAMS`.

## Files That Matter Most Right Now

- `core/workout-layer.js`
- `core/program-layer.js`
- `app.js`
- `src/app/AppShell.jsx`
- `src/app/services/legacy-runtime.ts`
- `src/app/store/runtime-store.ts`
- `src/log-start-island/main.jsx`
- `src/log-active-island/main.jsx`
- `docs/migration-inventory.md`

## Verified State

Most relevant local checks that passed:

- `npm.cmd run typecheck`
- `npm.cmd run build`
- `npm.cmd run test -- tests/app-shell-router.spec.ts tests/app-smoke.spec.ts tests/offline-shell.spec.ts tests/dashboard-island.spec.ts tests/history-island.spec.ts tests/log-start-island.spec.ts tests/log-active-island.spec.ts tests/workout-draft.spec.ts tests/workout-overlays.spec.ts tests/session-feedback.spec.ts tests/reward-moments.spec.ts tests/settings-navigation.spec.ts tests/settings-account-island.spec.ts tests/settings-body-island.spec.ts tests/settings-preferences-island.spec.ts tests/settings-program-island.spec.ts tests/settings-schedule-island.spec.ts tests/nutrition-island.spec.ts --workers=1`

## Recommended Next Step

Continue Phase 2 by shrinking the remaining hybrid surface inside the workout domain and retiring the remaining window-backed registries/helpers.

The goal is to keep the current workout logic intact where useful, but move the remaining workout/catalog/service seams behind explicit modules now that visible pages no longer depend on page snapshot getters, bridge events, mounted flags, or settings-tab DOM ownership.

## Phase 2 Plan: Workout Session Service / Store

### Goal

Replace log snapshot getters and island mount coordination with direct store-backed session ownership for:

- active workout
- workout timer/rest state
- collapse state
- draft save/restore lifecycle
- RPE / summary / sport-check prompt state
- pending log-start selection state

### Entry Criteria

- Phase 1 active workout React ownership is in place.
- Workout overlays already render through the React shell.
- Current persisted data shapes must remain compatible.

### Work Breakdown

1. Create a dedicated workout session service/store layer.

- Pull session read/write responsibilities behind explicit functions/selectors.
- Keep persistence logic compatible with existing draft/profile/workout storage.
- Keep program-building logic in legacy helpers if needed, but stop exposing raw window snapshot getters to React.

2. Move log start and active workout islands off snapshot getters.

- Keep the current pushed store-backed log view path, but move the view-model building and action wiring into an explicit session service/module instead of `core/workout-layer.js` globals.
- Delete the remaining React dependence on the exported snapshot getter helpers once no fallback callers need them.
- Keep a thin compatibility wrapper only where non-React legacy code still needs it temporarily.

3. Move timer/rest ownership into the session service.

- Session service should own elapsed timer state and selected rest duration.
- The React active screen should render timer/rest directly from service/store state.
- The legacy rest bar can stay temporarily bridged if needed, but the log route should stop treating DOM as state.

4. Move draft lifecycle into explicit session actions.

- Start session
- resume session
- persist draft
- clear draft on finish/discard
- restore draft on reload

5. Unify transient workout prompt state.

- RPE
- sport check
- summary

These already render through React, so the next step is to stop sourcing them from ad hoc legacy globals and move them behind the same session service API.

### Main Risks

- Breaking draft restore/clear semantics
- Breaking program-day / bonus-workout selection behavior
- Accidentally changing persisted workout payload shapes
- Reintroducing mixed ownership by keeping both store state and legacy globals alive for too long

### Acceptance Criteria

- The log route continues to render from direct session selectors/store state, and the temporary snapshot getter exports can be removed without changing React behavior.
- Starting, resuming, editing, finishing, and discarding a workout still work.
- Draft restore/clear still work across reloads.
- RPE / sport-check / summary prompts still work.
- No localStorage or workout history schema migration is required.

### Tests To Keep Running

- `tests/log-start-island.spec.ts`
- `tests/log-active-island.spec.ts`
- `tests/workout-draft.spec.ts`
- `tests/workout-overlays.spec.ts`
- `tests/session-feedback.spec.ts`
- `tests/reward-moments.spec.ts`

## Later Phases

### Phase 3. Workout overlays and catalog

- Rebuild exercise catalog and remaining workout modal/control flows so they no longer depend on imperative DOM rendering.
- Remove raw HTML generation for workout-specific overlays.

### Phase 4. Replace shell/global bridges

- `window.showPage`
- `window.showToast`
- `window.showConfirm`
- other shell-level global accessors

### Phase 5. Final cleanup

- remove dead hybrid fallback helpers
- replace remaining `window.PROGRAMS` / `window.EXERCISE_LIBRARY` reads where practical
- simplify boot/runtime path

## Working Rules For The Next Conversation

- Preserve persisted workout/profile/history data shapes unless a migration is explicit.
- Prefer deleting bridge code over layering a second bridge on top of it.
- Keep tests focused on real user flows through Playwright.
- If verification gets flaky, rerun with `--workers=1` before assuming the app code regressed.
