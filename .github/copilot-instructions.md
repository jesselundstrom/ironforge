# Ironforge Project Instructions

## Project Shape
- Ironforge is a **personal coaching app** with three pillars: Training, Nutrition, and Recovery.
- This repository is a mobile-first PWA with a hybrid runtime:
  - a React + Vite app shell in `src/app/`
  - an existing legacy runtime in `app.js`, `core/*.js`, and `programs/*.js`
  - an active migration path from that legacy runtime to TypeScript + Zustand
- Main runtime entry points are `index.html`, `app.js`, `src/app/main.tsx`, `styles.css`, `manifest.json`, and `sw.js`.
- The React shell already owns the visible app shell, page tree, and overlay host through `src/app/main.tsx` and `src/app/AppShell.jsx`.
- `src/app/store/runtime-store.ts` is already part of the active runtime foundation for shell/navigation/UI state.
- The legacy business/runtime layer still lives primarily in:
  - `core/workout-layer.js`
  - `core/dashboard-layer.js`
  - `core/plan-engine.js`
  - `core/data-layer.js`
  - `core/i18n-layer.js`
  - `core/exercise-library.js`
  - `core/program-layer.js`
  - `programs/*.js`
- `core/history-layer.js` is retired from the live page load order; keep its remaining behavior assumptions in `src/stores/history-store.ts` instead of reactivating it.
- `core/nutrition-layer.js` is compatibility/reference-only; live nutrition runtime ownership now lives in `src/stores/nutrition-store.ts`.
- `core/dashboard-layer.js` is retired from the live page load order; typed dashboard ownership now lives in `src/stores/dashboard-store.ts` plus `src/domain/dashboard-runtime.ts`.
- Training program definitions currently live under `programs/` (5 programs: forge, wendler531, stronglifts5x5, casualfullbody, hypertrophysplit).
- Contributor tooling uses `npm` scripts plus `Vite`, `TypeScript`, `ESLint`, `Prettier`, and `Playwright`.

## Primary Product Context
- The app is primarily used as an installed PWA on a phone (iPhone).
- The app has 5 pages: Dashboard, Log, History, Settings, and Nutrition.
- AI nutrition coaching is a core feature, not an add-on - it bridges training and nutrition data.
- Treat mobile usability as the default, not a secondary breakpoint.
- Avoid changes that assume desktop-first layouts, hover-only interactions, wide tables, or precise pointer input.
- Preserve installability, offline-friendly behavior, and fast startup.
- Be careful with anything that could break touch targets, viewport fit, safe-area behavior, or perceived responsiveness on slower mobile devices.
- This app is service-worker cached. When changing app-shell assets or core runtime files, review `sw.js` so users do not get stuck on stale JS/CSS after an update.

## Architecture Rules
- Prefer extending the existing layer structure instead of adding new abstractions.
- Do not introduce new frameworks or server dependencies unless explicitly requested.
- Do not add new legacy globals or new bridge-only patterns unless temporary compatibility truly requires them.
- Prefer new typed modules and Zustand stores for surfaces that are actively being migrated.
- Preserve existing runtime compatibility for untouched legacy surfaces until the migration phase for that surface is complete.
- React-owned UI should render from the shared app shell and typed app services/store slices instead of portaling into pre-rendered legacy page markup.
- React/store code should prefer typed store accessors or explicit adapter modules over direct `window.*` reads whenever a typed path exists.
- Keep legacy runtime access behind explicit adapters and compatibility seams instead of importing legacy files deeply into React code.
- Reuse existing state objects, helpers, and DOM patterns before creating new ones.
- Keep changes small and compatible with the current file organization.
- Use `docs/migration-ts-zustand.md` as the migration source of truth for the legacy runtime replacement.

## Runtime Compatibility Rules
- `core/ui-shell.js`, `window.showPage(...)`, `window.showToast(...)`, `window.showConfirm(...)`, and similar globals remain compatibility surfaces until their callers are fully migrated.
- `window.PROGRAMS`, `window.EXERCISE_LIBRARY`, `window.workouts`, `window.profile`, `window.schedule`, and `window.activeWorkout` may remain temporarily for untouched legacy code and Playwright compatibility.
- `window.renderHistory`, `window.switchHistoryTab`, `window.switchHistoryStatsRange`, and `window.toggleHeatmap` are provided by `src/stores/history-store.ts`.
- `window.setSelectedNutritionAction`, `window.submitNutritionMessage`, `window.submitNutritionTextMessage`, `window.handleNutritionPhoto`, `window.retryLastNutritionMessage`, `window.clearNutritionHistory`, `window.clearNutritionLocalData`, and `window.setNutritionSessionContext` are provided by `src/stores/nutrition-store.ts`.
- `window.computeFatigue` is a compatibility delegate installed from `src/app/services/planning-runtime.ts`.
- `window.updateDashboard`, `window.toggleDayDetail`, `window.wasSportRecently`, and `window.wasHockeyRecently` are provided by `src/stores/dashboard-store.ts`.
- Typed dashboard/history/nutrition surfaces should prefer the explicit legacy runtime setter/getter in `app.js` over `window.eval(...)` when a compatibility write is still required.
- When migrating a surface, prefer thin delegators and compatibility writes over big-bang removal.
- Remove bridge/shim code only after the typed runtime owns that surface and the relevant tests no longer depend on the legacy contract.
- Do not introduce new page-by-page React migration guidance; the visible-surface cutover is already complete.

## UI And Behavior
- Match the existing visual language and interaction patterns.
- Preserve the mobile-first PWA behavior already defined in the HTML, manifest, and service worker.
- Avoid large HTML rewrites unless the task requires them.
- Keep controls usable on small screens and ensure new UI works with touch input.
- Keep Settings simple-first: expose clear everyday controls in the main view, and keep technical program tuning behind a separate advanced setup path instead of pushing all knobs into the default UI.

## CSS and Tailwind
- Tailwind CSS v4 is installed and configured via `src/styles/tailwind.css`.
- Design tokens are bridged from CSS custom properties in `src/styles/tokens.css` to Tailwind's theme system — use Tailwind classes like `bg-accent`, `text-muted`, `rounded-card` for new code.
- **New components and new UI code must use Tailwind utilities**, not handwritten CSS.
- **Do not migrate existing legacy CSS for its own sake.** `src/styles/legacy-ui.css` contains the existing styles and must not be rewritten as a standalone task.
- When editing a component that already exists, opportunistically swap its legacy class names to Tailwind equivalents while you are already in the file — but only if the change is small and safe. Never open a file solely to migrate its CSS.
- When a class in `legacy-ui.css` has no remaining references in the codebase, delete it. Do not keep dead CSS.
- Do not add new rules to `legacy-ui.css`. That file shrinks over time, it does not grow.

## Internationalization
- User-facing strings must go through the translation system.
- Add new keys to the current translation source of truth, which is still `core/i18n-layer.js` unless the active migration phase moves that ownership.
- Keep English and Finnish translations in sync.
- Prefer existing `tr(...)`, `I18N.t(...)`, `data-i18n`, and `data-i18n-placeholder` patterns until a migrated i18n store fully replaces them.
- Do not hardcode new visible UI strings directly into templates or DOM updates unless there is a very strong reason.
- Follow the `section.area.action` naming style for translation keys.
- Avoid verbose labels that wrap badly on narrow screens or weaken tap-target layouts.

## Data And Persistence
- Respect the current localStorage-backed state and existing data shapes.
- Do not rename persisted keys or change stored structures without migration logic.
- Be careful with Supabase-related code in the current legacy runtime, especially `app.js` and `core/data-layer.js`, unless that responsibility is being migrated deliberately.
- Treat `public.workouts` as the source of truth for workout history sync.
- Treat `public.profile_documents` as the primary sync source for profile core, schedule, and per-program state.
- Treat `profile.preferences` as a durable part of `profile_core`. Preserve and migrate it when changing profile persistence or recommendation logic.
- Treat `profile.preferences.sportReadinessCheckEnabled` as an opt-in feature flag. Do not introduce sport check-in prompts into the workout start flow unless that preference explicitly enables them.
- Treat `profiles.data` as a compatibility mirror/fallback for profile and schedule only; do not reintroduce `profiles.data.workouts`.
- Keep workout-table changes compatible with the additive migration flow under `supabase/migrations/`.
- Keep profile-document sync compatible with the additive migration flow under `supabase/migrations/`.
- Profile-document writes go through the guarded Supabase RPC `upsert_profile_documents_if_newer(jsonb)` and resolve document freshness by `client_updated_at`, not by server `updated_at`.
- Preserve soft-delete behavior for synced workouts unless the task explicitly requires a different deletion model.
- Avoid changes that could silently invalidate existing user data on devices.
- `profile.bodyMetrics` stores body composition data (weight, height, age, sex, activity level, body goal, target weight).
- `profile.coaching` stores experience level, guidance mode, sport profile, physical limitations, and behavior signals.
- Nutrition day sessions are stored separately under `ic_nutrition_day::<userId>::YYYY-MM-DD` in localStorage.
- Use canonical workout payload fields: `program`, `programMeta`, `programDayNum`. Do not reintroduce legacy fields like `forgeWeek` or `forgeDayNum`.
- Profile and schedule sync use section-level timestamps in `profile.syncMeta`. Preserve that merge behavior when changing profile persistence.
- Keep saves targeted: program-state writes should update the relevant `program:<id>` document instead of re-writing every program state blob.
- When changing import, clear-all, delete, or undo flows, ensure behavior stays correct for both the local localStorage cache and the `workouts` Supabase table.
- Prefer small, explicit sync helpers while migrating instead of spreading Supabase calls across unrelated files.

## Program Files
- Files under `programs/` define training logic and metadata (5 programs: forge, wendler531, stronglifts5x5, casualfullbody, hypertrophysplit).
- Keep new program implementations consistent with the existing program modules and their current runtime contract.
- Avoid mixing program logic into unrelated UI code when a program file or a program/domain/store module is the correct home.
- Exercise metadata such as movement tags, muscle groups, and equipment tags belongs in the exercise-library surface. Reuse that catalog instead of scattering duplicate exercise heuristics across program files.
- User-facing muscle-load UI should use the display-group mapping from the exercise-library surface instead of inventing separate dashboard-only muscle labels.
- Keep new program objects compatible with the existing integration points: id, name, description, icon, session options, session building, state advancement, and settings hooks.
- When migrating program settings UI, preserve behavior first and refactor the rendering model later.

## Nutrition And AI Coaching
- Live nutrition runtime ownership lives in `src/stores/nutrition-store.ts` and `src/app/services/nutrition-coach.ts`.
- `core/nutrition-layer.js` is compatibility/reference-only and should not be restored to the live page load order unless the migration is intentionally reversed.
- Anthropic requests are routed through the Supabase `nutrition-coach` edge function with an Ironforge-managed server-side API key.
- Nutrition Coach requires a signed-in user and enforces daily per-user request caps in `public.nutrition_usage_daily`.
- The browser must never store an Anthropic API key or send requests directly to `api.anthropic.com`.
- Text coaching and food photo analysis use separate Claude models selected server-side.
- The system prompt dynamically includes training context, body metrics, TDEE/macro targets, and today's intake via `_buildTrainingContext()`.
- Nutrition uses guided daily actions with an optional short note instead of an open-ended free chat input.
- Day-scoped nutrition history is limited to 60 messages in localStorage (`ic_nutrition_day::<userId>::YYYY-MM-DD`).
- AI responses include structured macro data (kcal, protein, carbs, fat) extracted for daily intake tracking.
- Food photos are compressed client-side before sending to the API.
- When modifying nutrition features, preserve the `_buildTrainingContext()` bridge that connects training and nutrition data.
- Do not sync nutrition session history to Supabase; only server-side request accounting and model access live in Supabase.

## Recovery And Readiness
- The fatigue engine is a core coaching pillar, not just a training helper.
- `FATIGUE_CONFIG` currently lives in `app.js` and should move only as part of an intentional migration step.
- `computeFatigue` now lives in `src/domain/planning.ts`; keep `window.computeFatigue` only as a compatibility delegate for untouched legacy callers.
- `core/dashboard-layer.js` no longer owns fatigue calculations.
- `src/domain/dashboard-runtime.ts` now owns the typed dashboard recovery/plan/training-max helper composition and dashboard compatibility delegates.
- Three fatigue dimensions: Muscular, CNS, and Overall.
- Sport schedule integration affects leg fatigue calculations and training day recommendations.
- `getTodayTrainingDecision()` and readiness scoring form the recovery-layer logic.
- Future expansion areas: sleep tracking, subjective readiness check-ins, recovery recommendations.
- When changing readiness or fatigue logic, consider the impact on both training recommendations and the dashboard recovery display.

## Mobile Portability
- Mobile strategy: Capacitor (wrap PWA in native shell) as the pragmatic first step, React Native as a future option.
- When writing new business logic, keep it separable from DOM manipulation.
- Prefer pure functions (data in, data out) over functions that directly read/write the DOM in business logic layers.
- Avoid introducing new web-only APIs (for example `window.speechSynthesis` or `navigator.share`) in domain/business logic; keep them in UI code.
- The current layer split plus the ongoing TS/Zustand migration is the foundation for eventual extraction into a shared logic package.
- Avoid APIs that Capacitor cannot bridge when adding new platform features.
- React Native skills are available in `.agents/skills/vercel-react-native-skills/` for reference if a full rewrite is needed later.

## Change Strategy
- Fix root causes instead of layering on narrow patches when feasible.
- Avoid unrelated refactors.
- If adding a feature, update all affected layers, translations, and UI states.
- Prefer finishing requested development work end-to-end instead of only listing suggested next steps. If the repo needs tooling, tests, config, or small supporting changes to make the solution real, add them directly unless the user explicitly wants planning only.
- For meaningful behavior or UI changes, add or update automated tests when feasible. Prefer Playwright for user flows and deterministic validation paths over flaky network-dependent tests. If you skip test coverage, say why.
- Keep tests small, readable, and purpose-driven. One user flow per test is preferred over giant all-in-one scripts.
- Before closing meaningful work, run the relevant verification commands from the current toolchain such as `npm.cmd run lint`, `npm.cmd run typecheck`, `npm.cmd run build`, and targeted `npm.cmd run test:e2e` coverage when applicable.
- CI uses `npm run test:e2e:ci` for the deterministic single-worker Playwright gate; local development can still use `npm run test:e2e`.
- When a change alters architecture, persistence, sync behavior, migrations, or contributor workflow, also update the relevant AI instructions under `.github/` before committing.
- Before committing and pushing meaningful project changes, explicitly check whether `.github/copilot-instructions.md` should be updated to reflect the new reality.
- When changing cached runtime assets or PWA update behavior, also decide whether `sw.js` cache versioning or fetch strategy needs an update.
- Do not add instruction-only churn for trivial edits, but do document durable workflow or architecture changes once they become part of the project standard.
- Prefer minimal diffs that preserve the current coding style and user flows.
