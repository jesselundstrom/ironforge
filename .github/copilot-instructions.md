# Ironforge Project Instructions

## Project Shape
- Ironforge is a **personal coaching app** with three pillars: Training, Nutrition, and Recovery.
- This repository is a mobile-first React + Vite PWA with Zustand-owned runtime state under `src/`.
- Main runtime entry points are `index.html`, `src/app/main.tsx`, `src/styles/tailwind.css`, `public/manifest.json`, and `public/sw.js`.
- The shipped app scope is the **Training Core**:
  - auth
  - onboarding
  - dashboard
  - workout logging
  - history
  - basic settings
- Typed training program definitions live under `src/programs/` (forge, wendler531, stronglifts5x5, casualfullbody, hypertrophysplit).
- Contributor tooling uses `npm` scripts plus `Vite`, `TypeScript`, `ESLint`, `Prettier`, and `Playwright`.

## Primary Product Context
- The app is primarily used as an installed PWA on a phone (iPhone).
- The shipped training-core app has 4 pages: Dashboard, Log, History, and Settings.
- Nutrition and Recovery are deferred from the shipped runtime until they are fully rebuilt on the current stack.
- Treat mobile usability as the default, not a secondary breakpoint.
- Avoid changes that assume desktop-first layouts, hover-only interactions, wide tables, or precise pointer input.
- Preserve installability, offline-friendly behavior, and fast startup.
- Be careful with anything that could break touch targets, viewport fit, safe-area behavior, or perceived responsiveness on slower mobile devices.
- This app is service-worker cached. When changing app-shell assets or core runtime files, review `sw.js` so users do not get stuck on stale JS/CSS after an update.

## Architecture Rules
- Prefer extending the existing layer structure instead of adding new abstractions.
- Do not introduce new frameworks or server dependencies unless explicitly requested.
- Do not add new legacy globals or new bridge-only patterns.
- Prefer new typed modules and Zustand stores for surfaces that are actively being migrated.
- React-owned UI should render from the shared app shell and typed app services/store slices instead of portaling into pre-rendered legacy page markup.
- React/store code should prefer typed store accessors or explicit adapter modules over direct `window.*` reads whenever a typed path exists.
- Do not reintroduce root runtime ownership outside `src/`.
- Reuse existing state objects, helpers, and DOM patterns before creating new ones.
- Keep changes small and compatible with the current file organization.
- Use `docs/migration-ts-zustand.md` as the migration source of truth for the React-only cutover.

## Runtime Compatibility Rules
- React-owned auth/session orchestration now lives in `src/app/services/auth-runtime.ts`.
- Production runtime contracts should stay internal to stores/services/modules wherever possible.
- Test-only globals under `window.__IRONFORGE_E2E__`, `window.__IRONFORGE_STORES__`, `window.__IRONFORGE_SET_AUTH_STATE__`, and `window.__IRONFORGE_SET_AUTH_LOGGED_IN__` are acceptable when needed for deterministic Playwright coverage.
- Do not restore `window.showPage`, `window.showToast`, `window.showConfirm`, `window.loadData`, or root legacy runtime setters/getters as production dependencies.

## UI And Behavior
- Match the existing visual language and interaction patterns.
- Preserve the mobile-first PWA behavior already defined in the HTML, manifest, and service worker.
- Avoid large HTML rewrites unless the task requires them.
- Keep controls usable on small screens and ensure new UI works with touch input.
- Keep Settings simple-first: expose clear everyday controls in the main view, and keep technical program tuning behind a separate advanced setup path instead of pushing all knobs into the default UI.
- Installed-PWA updates currently use an aggressive service-worker replacement path so stale installed bundles are replaced quickly on Vercel; when changing update behavior, prioritize fresh auth/login fixes reaching installed clients over prompt-driven niceties.

## CSS and Tailwind
- Tailwind CSS v4 is installed and configured via `src/styles/tailwind.css`.
- Design tokens are bridged from CSS custom properties in `src/styles/tokens.css` to Tailwind's theme system — use Tailwind classes like `bg-accent`, `text-muted`, `rounded-card` for new code.
- **New components and new UI code must use Tailwind utilities**, not handwritten CSS.
- **Do not migrate existing compatibility CSS for its own sake.** `src/styles/compat-ui.css` contains the existing styles and must not be rewritten as a standalone task.
- When editing a component that already exists, opportunistically swap its legacy class names to Tailwind equivalents while you are already in the file — but only if the change is small and safe. Never open a file solely to migrate its CSS.
- When a class in `compat-ui.css` has no remaining references in the codebase, delete it. Do not keep dead CSS.
- Do not add new rules to `compat-ui.css`. That file shrinks over time, it does not grow.
- New React-owned UI should expose stable `data-ui` and `data-state` hooks when tests or compatibility seams need a durable DOM contract.
- Prefer role, id, and `data-*` selectors in Playwright tests; do not make presentational class names the long-term test contract for newly touched surfaces.

## Internationalization
- User-facing strings must go through the translation system.
- Add new keys to the typed i18n source under `src/stores/i18n-store.ts`.
- Keep English and Finnish translations in sync.
- Prefer typed `t(...)` / `tr(...)` helpers backed by the store runtime.
- Do not hardcode new visible UI strings directly into templates or DOM updates unless there is a very strong reason.
- Follow the `section.area.action` naming style for translation keys.
- Avoid verbose labels that wrap badly on narrow screens or weaken tap-target layouts.

## Data And Persistence
- Respect the current localStorage-backed state and existing data shapes.
- Do not rename persisted keys or change stored structures without migration logic.
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
- Files under `src/programs/` define training logic and metadata (5 programs: forge, wendler531, stronglifts5x5, casualfullbody, hypertrophysplit).
- Keep new program implementations consistent with the existing program modules and their current runtime contract.
- Avoid mixing program logic into unrelated UI code when a program file or a program/domain/store module is the correct home.
- Exercise metadata such as movement tags, muscle groups, and equipment tags belongs in the exercise-library surface. Reuse that catalog instead of scattering duplicate exercise heuristics across program files.
- User-facing muscle-load UI should use the display-group mapping from the exercise-library surface instead of inventing separate dashboard-only muscle labels.
- Keep new program objects compatible with the existing integration points: id, name, description, icon, session options, session building, state advancement, and settings hooks.
- When migrating program settings UI, preserve behavior first and refactor the rendering model later.

## Nutrition And AI Coaching
- Nutrition is currently deferred from the shipped runtime during the React-only training-core cutover.
- Anthropic requests are routed through the Supabase `nutrition-coach` edge function with an Ironforge-managed server-side API key.
- Nutrition Coach requires a signed-in user and enforces daily per-user request caps in `public.nutrition_usage_daily`.
- The browser must never store an Anthropic API key or send requests directly to `api.anthropic.com`.
- Text coaching and food photo analysis use separate Claude models selected server-side.
- The system prompt dynamically includes training context, body metrics, TDEE/macro targets, and today's intake via `_buildTrainingContext()`.
- Nutrition uses guided daily actions with an optional short note instead of an open-ended free chat input.
- Day-scoped nutrition history is limited to 60 messages in localStorage (`ic_nutrition_day::<userId>::YYYY-MM-DD`).
- AI responses include structured macro data (kcal, protein, carbs, fat) extracted for daily intake tracking.
- Food photos are compressed client-side before sending to the API.
- If nutrition work resumes, rebuild it on typed stores/modules instead of reintroducing legacy globals or root runtime code.
- Do not sync nutrition session history to Supabase; only server-side request accounting and model access live in Supabase.

## Recovery And Readiness
- The fatigue engine is a core coaching pillar, not just a training helper.
- `computeFatigue` now lives in `src/domain/planning.ts`; keep `window.computeFatigue` only as a compatibility delegate for untouched legacy callers.
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
