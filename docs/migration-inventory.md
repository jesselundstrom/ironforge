# React Cutover Inventory

This file is the living checklist for the staged React cutover.

Status values:

- `legacy`: still owned by the hybrid runtime
- `in_progress`: actively being migrated
- `done`: replaced or deleted

## Current Runtime Baseline

| Area | Current owner | Target owner | Status | Delete condition |
| --- | --- | --- | --- | --- |
| Bottom navigation and page activation | `core/ui-shell.js` compatibility facade | React app shell + router/store | `in_progress` | `showPage` no longer needed for primary navigation |
| Confirm modal | `core/ui-shell.js` compatibility facade | React app shell/store | `in_progress` | legacy confirm snapshot helper is removed |
| Toast host | `core/ui-shell.js` compatibility facade | React app shell/store | `in_progress` | toast state no longer written through DOM ids |
| Onboarding mount | `app.js` + `src/app/OnboardingFlow.jsx` | React app entry | `done` | onboarding no longer mounts through a separate entry |
| Page islands | `src/*-island/main.jsx` | React routes/components | `in_progress` | each page reads store/services directly |
| Workout session state | `app.js` + `core/workout-layer.js` + `core/data-layer.js` | session service + store | `in_progress` | timer/draft/RPE/finish-discard state no longer depends on globals |
| Nutrition page state | `core/nutrition-layer.js` store bridge | React route + services | `in_progress` | nutrition history/request state moves behind imported services |
| Settings tabs state | React runtime store + `AppShell` tab host | store + React settings route | `done` | settings tabs already render from runtime state |
| History/dashboard state | `core/history-layer.js` + `core/dashboard-layer.js` snapshot/event bridge | store + route components | `in_progress` | history/dashboard islands stop using bridge snapshots and the getter exports are deleted |
| Program registry | `core/program-layer.js` registry helpers + `window.PROGRAMS` compatibility | imported registry module | `in_progress` | callers use explicit registry helpers or imported accessors instead of reading `window.PROGRAMS` directly |
| Exercise library access | `window.EXERCISE_LIBRARY` | imported service/module | `legacy` | page/runtime code no longer reads exercise metadata via globals |
| App build entry | many island module scripts in `index.html` | one top-level React app entry | `in_progress` | page islands are fully collapsed into the app entry |

## Global Bridge Surface

| Bridge point | Current owner | Target owner | Status | Delete condition |
| --- | --- | --- | --- | --- |
| `window.showPage` | `core/ui-shell.js` | router navigation action | `in_progress` | routes/pages stop calling it directly |
| `window.showToast` | `core/ui-shell.js` | toast store/provider | `in_progress` | toast provider owns all messages |
| `window.showConfirm` | `core/ui-shell.js` | confirm store/provider | `in_progress` | confirm provider owns modal open/close |
| `window.getIronforgeState` | `app.js` | Zustand selectors/services | `legacy` | consumers read store/services directly |
| `window.getActivePageName` | `core/ui-shell.js` | router/store | `in_progress` | active route is derived from React state only |
| `window.getConfirmReactSnapshot` | `core/ui-shell.js` | store | `in_progress` | confirm data is not snapshot-driven |
| `window.getLogStartReactSnapshot` | `core/workout-layer.js` | session selectors/store actions | `done` | log start route no longer depends on the getter and the helper is deleted |
| `window.getLogActiveReactSnapshot` | `core/workout-layer.js` | session selectors/store actions | `done` | log active route no longer depends on the getter and the helper is deleted |
| `window.getSettingsAccountReactSnapshot` | `app.js` | settings selectors | `done` | settings account route reads store directly |
| `window.getSettingsScheduleReactSnapshot` | `app.js` | settings selectors | `done` | settings schedule route reads store directly |
| `window.getSettingsPreferencesReactSnapshot` | `app.js` | settings selectors | `done` | settings preferences route reads store directly |
| `window.getSettingsProgramReactSnapshot` | `app.js` | settings selectors + registry service | `done` | settings program route reads store directly |
| `window.getSettingsBodyReactSnapshot` | `app.js` | settings selectors | `done` | settings body route reads store directly |
| `window.getDashboardReactSnapshot` | `core/dashboard-layer.js` | dashboard selectors/store actions | `done` | dashboard route no longer depends on the getter and the helper is deleted |
| `window.getHistoryReactSnapshot` | `core/history-layer.js` | history selectors/store actions | `done` | history route no longer depends on the getter and the helper is deleted |
| `window.getNutritionReactSnapshot` | `core/nutrition-layer.js` | nutrition selectors | `done` | nutrition route reads store directly |
| `window.getOnboardingReactSnapshot` | `app.js` | onboarding store/service | `legacy` | onboarding reads draft from store/service |

## Island Flags And Events

| Bridge point | Current owner | Target owner | Status | Delete condition |
| --- | --- | --- | --- | --- |
| `__IRONFORGE_APP_SHELL_MOUNTED__` | app shell mount helper | app bootstrap only | `in_progress` | no hybrid fallback behavior remains |
| `__IRONFORGE_LOG_START_ISLAND_MOUNTED__` | log start island | delete | `done` | replaced by runtime-bridge capability checks |
| `__IRONFORGE_LOG_ACTIVE_ISLAND_MOUNTED__` | log active island | delete | `done` | replaced by runtime-bridge capability checks |
| `__IRONFORGE_HISTORY_ISLAND_MOUNTED__` | history island | delete | `done` | replaced by runtime-bridge capability checks |
| `__IRONFORGE_DASHBOARD_ISLAND_MOUNTED__` | dashboard island | delete | `done` | replaced by runtime-bridge capability checks |
| `__IRONFORGE_NUTRITION_ISLAND_MOUNTED__` | nutrition island | delete | `done` | replaced by runtime-bridge capability checks |
| `ironforge:app-shell-updated` | legacy shell bridge event | store actions | `in_progress` | route/store own shell state directly and no listeners need the event |
| `ironforge:settings-*-updated` events | settings bridge | delete | `done` | settings route reads store directly |
| `ironforge:history-updated` | history bridge | delete | `done` | history route reads store directly |
| `ironforge:dashboard-updated` | dashboard bridge | delete | `done` | dashboard route reads store directly |
| `ironforge:nutrition-updated` | nutrition bridge | delete | `done` | nutrition route reads store directly |
| `ironforge:onboarding-updated` | onboarding bridge | store/service | `in_progress` | onboarding data lives in store/service |

## Direct Storage Access

| Storage touchpoint | Current owner | Target owner | Status | Delete condition |
| --- | --- | --- | --- | --- |
| workout/profile/schedule caches | `core/data-layer.js` | storage service | `legacy` | storage reads/writes are wrapped behind service API |
| active workout draft | `core/data-layer.js` | session service + storage service | `in_progress` | draft restore/save do not mutate globals directly |
| nutrition API key | `core/nutrition-layer.js` | nutrition storage service | `legacy` | nutrition route/service owns key persistence |
| nutrition day history | `core/nutrition-layer.js` | nutrition storage service | `legacy` | nutrition route/service owns day history persistence |
| locale persistence | `core/i18n-layer.js` | i18n service | `legacy` | route code no longer reads locale from globals |

## DOM-Coupled Logic To Remove

| DOM-coupled area | Current owner | Target owner | Status | Delete condition |
| --- | --- | --- | --- | --- |
| page activation side effects | `core/ui-shell.js` | route effects + services | `in_progress` | side effects are invoked by the routed app |
| rest timer DOM updates | `app.js` | session service + React UI | `in_progress` | timer text/arc/classes no longer updated imperatively |
| RPE modal DOM population | `app.js` | session service + React state | `done` | prompt options render from React state |
| workout summary modal DOM population | `core/workout-layer.js` | session service + React state | `done` | summary content no longer renders through imperative HTML injection |
| sport check modal DOM population | `core/workout-layer.js` | session service + React state | `done` | sport check prompt no longer mutates modal text/classes directly |
| exercise catalog DOM writes | `core/workout-layer.js` | React overlay + service | `legacy` | catalog UI stops writing raw HTML |
| nutrition page init/render | `core/nutrition-layer.js` | React route + nutrition service | `in_progress` | entry no longer depends on `initNutritionPage()` or page-local init globals |
| settings tab DOM toggling | `app.js` | React route state | `done` | tabs now render from runtime state through `AppShell` |

## First Cutover Slice

- [x] Create this inventory file.
- [x] Add shared React runtime dependencies for router + Zustand.
- [x] Introduce a top-level app entry with store/service foundations.
- [x] Collapse app shell and onboarding into the shared app entry.
- [x] Finish Phase 1 of the log cutover: the active workout surface renders through React, rest selection no longer relies on hidden React inputs, workout overlays render through the app shell, and React owns active-workout focus/animation feedback when mounted.
- [x] Replace shell snapshot consumption with direct store-backed route/page state.
- [ ] Extract workout session ownership away from globals and DOM writes.
- [ ] Collapse remaining island entries into routed React pages.
