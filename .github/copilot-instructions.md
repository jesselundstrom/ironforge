# Ironforge Project Instructions

## Project Shape
- Ironforge is a **personal coaching app** with three pillars: Training, Nutrition, and Recovery.
- This repository is a no-build vanilla web app and PWA.
- Main entry points are `index.html`, `app.js`, `styles.css`, `manifest.json`, and `sw.js`.
- `app.js` is the orchestration/bootstrap layer. Heavy business logic lives in 11 layer files under `core/`.
- Key layers: `core/workout-layer.js` (session logic), `core/nutrition-layer.js` (AI nutrition chat), `core/dashboard-layer.js`, `core/history-layer.js`, `core/plan-engine.js` (planning utilities), `core/data-layer.js` (persistence/sync), `core/i18n-layer.js` (translations), `core/exercise-library.js` (exercise catalog), `core/program-layer.js` (program helpers).
- Training program definitions live under `programs/` (5 programs: forge, wendler531, stronglifts5x5, casualfullbody, hypertrophysplit).
- Contributor tooling now uses `npm` scripts plus `Vite`, `TypeScript`, `ESLint`, `Prettier`, and `Playwright`.
- React islands may be introduced incrementally when explicitly requested, but the existing vanilla shell remains the source of truth during migration.
- Prefer extending the current global-function and shared-state style instead of introducing new architectural patterns.

## Primary Product Context
- The app is primarily used as an installed PWA on a phone (iPhone).
- The app has 5 pages: Dashboard, Log, History, Settings, and Nutrition.
- AI nutrition coaching is a core feature, not an add-on — it bridges training and nutrition data.
- Treat mobile usability as the default, not a secondary breakpoint.
- Avoid changes that assume desktop-first layouts, hover-only interactions, wide tables, or precise pointer input.
- Preserve installability, offline-friendly behavior, and fast startup.
- Be careful with anything that could break touch targets, viewport fit, safe-area behavior, or perceived responsiveness on slower mobile devices.
- This app is service-worker cached. When changing app-shell assets or core runtime files, review `sw.js` so users do not get stuck on stale JS/CSS after an update.

## Architecture Rules
- Prefer extending the existing layer structure instead of adding new abstractions.
- Do not introduce frameworks, bundlers, TypeScript, or a server dependency unless explicitly requested.
- When React islands exist, load them into the current `index.html` shell and bridge them through explicit global adapters/events instead of importing the legacy runtime directly.
- Reuse existing state objects, helpers, and DOM patterns before creating new ones.
- Keep changes small and compatible with the current file organization.

## UI And Behavior
- Match the existing visual language and interaction patterns.
- Preserve the mobile-first PWA behavior already defined in the HTML, manifest, and service worker.
- Avoid large HTML rewrites unless the task requires them.
- Favor simple DOM updates over heavy component-style rewrites.
- Keep controls usable on small screens and ensure new UI works with touch input.
- Keep Settings simple-first: expose clear everyday controls in the main view, and keep technical program tuning behind a separate advanced setup path instead of pushing all knobs into the default UI.

## Internationalization
- User-facing strings must go through the translation system.
- Add new keys to the central string map in `core/i18n-layer.js`.
- Keep English and Finnish translations in sync.
- Prefer existing `tr(...)`, `I18N.t(...)`, `data-i18n`, and `data-i18n-placeholder` patterns.
- Do not hardcode new visible UI strings directly into templates or DOM updates unless there is a very strong reason.
- Follow the `section.area.action` naming style for translation keys.
- Avoid verbose labels that wrap badly on narrow screens or weaken tap-target layouts.

## Data And Persistence
- Respect the current localStorage-backed state and existing data shapes.
- Do not rename persisted keys or change stored structures without migration logic.
- Be careful with Supabase-related code in `app.js` and `core/data-layer.js`.
- Treat `public.workouts` as the source of truth for workout history sync.
- Treat `public.profile_documents` as the primary sync source for profile core, schedule, and per-program state.
- Treat `profile.preferences` as a durable part of `profile_core`. Preserve and migrate it when changing profile persistence or recommendation logic.
- Treat `profile.preferences.sportReadinessCheckEnabled` as an opt-in feature flag. Do not introduce sport check-in prompts into the workout start flow unless that preference explicitly enables them.
- Treat `profiles.data` as a compatibility mirror/fallback for profile and schedule only; do not reintroduce `profiles.data.workouts`.
- Keep workout-table changes compatible with the additive migration flow under `supabase/migrations/`.
- Keep profile-document sync compatible with the additive migration flow under `supabase/migrations/`.
- Preserve soft-delete behavior for synced workouts unless the task explicitly requires a different deletion model.
- Avoid changes that could silently invalidate existing user data on devices.
- `profile.bodyMetrics` stores body composition data (weight, height, age, sex, activity level, body goal, target weight).
- `profile.coaching` stores experience level, guidance mode, sport profile, physical limitations, and behavior signals.
- Nutrition chat history is stored separately under `ic_nutrition_history::<userId>` in localStorage.
- Use canonical workout payload fields: `program`, `programMeta`, `programDayNum`. Do not reintroduce legacy fields like `forgeWeek` or `forgeDayNum`.
- Profile and schedule sync use section-level timestamps in `profile.syncMeta`. Preserve that merge behavior when changing profile persistence.
- Keep saves targeted: program-state writes should update the relevant `program:<id>` document instead of re-writing every program state blob.
- When changing import, clear-all, delete, or undo flows, ensure behavior stays correct for both the local localStorage cache and the `workouts` Supabase table.
- Prefer small, explicit sync helpers in `core/data-layer.js` over spreading Supabase calls across unrelated files.

## Program Files
- Files under `programs/` define training logic and metadata (5 programs: forge, wendler531, stronglifts5x5, casualfullbody, hypertrophysplit).
- Keep new program implementations consistent with the existing program modules.
- Avoid mixing program logic into unrelated UI code when a program file or layer file is the correct home.
- Exercise metadata such as movement tags, muscle groups, and equipment tags belongs in `core/exercise-library.js`. Reuse that catalog instead of scattering duplicate exercise heuristics across program files.
- User-facing muscle-load UI should use the display-group mapping from `core/exercise-library.js` instead of inventing separate dashboard-only muscle labels.
- Keep new program objects compatible with the existing integration points: id, name, description, icon, session options, session building, state advancement, and settings hooks. Extend the existing shape instead of introducing new abstractions.
- When adding settings UI from a program file, follow the existing inline DOM rendering style already used by current program modules.

## Nutrition And AI Coaching
- `core/nutrition-layer.js` is a self-contained Claude-powered nutrition chat coach.
- The user's Anthropic API key is stored in localStorage only (never synced to cloud).
- Two models are used: Sonnet for food photo analysis, Haiku for text coaching.
- The system prompt dynamically includes training context, body metrics, TDEE/macro targets, and today's intake via `_buildTrainingContext()`.
- Chat history is limited to 60 messages in localStorage (`ic_nutrition_history::<userId>`).
- AI responses include structured macro data (kcal, protein, carbs, fat) extracted for daily intake tracking.
- Food photos are compressed client-side before sending to the API.
- This is a browser-side direct API call using the `anthropic-dangerous-direct-browser-access` header.
- When modifying nutrition features, preserve the `_buildTrainingContext()` bridge that connects training and nutrition data.
- Do not sync the API key or chat history to Supabase.

## Recovery And Readiness
- The fatigue engine is a core coaching pillar, not just a training helper.
- `FATIGUE_CONFIG` constants live in `app.js` and drive sport-aware fatigue scoring.
- Three fatigue dimensions: Muscular, CNS, and Overall.
- Sport schedule integration affects leg fatigue calculations and training day recommendations.
- `getTodayTrainingDecision()` and readiness scoring form the recovery-layer logic.
- Future expansion areas: sleep tracking, subjective readiness check-ins, recovery recommendations.
- When changing readiness or fatigue logic, consider the impact on both training recommendations and the dashboard recovery display.

## Mobile Portability
- Mobile strategy: Capacitor (wrap PWA in native shell) as the pragmatic first step, React Native as a future option.
- When writing new business logic in `core/*.js`, keep it separable from DOM manipulation.
- Prefer pure functions (data in, data out) over functions that directly read/write the DOM in business logic layers.
- Avoid introducing new web-only APIs (e.g., `window.speechSynthesis`, `navigator.share`) in core layers — use them only in UI code.
- The `core/` layer split is the foundation for eventual extraction into a shared logic package.
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
- When a change alters architecture, persistence, sync behavior, migrations, or contributor workflow, also update the relevant AI instructions under `.github/` before committing.
- When changing recommendation logic, readiness logic, or future AI-training groundwork, check whether `profile.preferences` shape or related guidance in `.github/` needs to be updated too.
- Before committing and pushing meaningful project changes, explicitly check whether `.github/copilot-instructions.md` or a matching file under `.github/instructions/` should be updated to reflect the new reality.
- When changing cached runtime assets or PWA update behavior, also decide whether `sw.js` cache versioning or fetch strategy needs an update.
- Do not add instruction-only churn for trivial edits, but do document durable workflow or architecture changes once they become part of the project standard.
- Prefer minimal diffs that preserve the current coding style and user flows.
