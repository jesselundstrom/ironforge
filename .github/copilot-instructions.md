# Ironforge Project Instructions

## Project Shape
- This repository is a no-build vanilla web app and PWA.
- Main entry points are `index.html`, `app.js`, `styles.css`, `manifest.json`, and `sw.js`.
- Core business logic is split into layer files under `core/`.
- Training program definitions live under `programs/`.
- Contributor tooling now uses `npm` scripts plus `Vite`, `TypeScript`, `ESLint`, `Prettier`, and `Playwright`.
- Prefer extending the current global-function and shared-state style instead of introducing new architectural patterns.

## Primary Product Context
- The app is primarily used as an installed PWA on a phone.
- Treat mobile usability as the default, not a secondary breakpoint.
- Avoid changes that assume desktop-first layouts, hover-only interactions, wide tables, or precise pointer input.
- Preserve installability, offline-friendly behavior, and fast startup.
- Be careful with anything that could break touch targets, viewport fit, safe-area behavior, or perceived responsiveness on slower mobile devices.
- This app is service-worker cached. When changing app-shell assets or core runtime files, review `sw.js` so users do not get stuck on stale JS/CSS after an update.

## Architecture Rules
- Prefer extending the existing layer structure instead of adding new abstractions.
- Do not introduce frameworks, bundlers, TypeScript, or a server dependency unless explicitly requested.
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
- Use canonical workout payload fields: `program`, `programMeta`, `programDayNum`. Do not reintroduce legacy fields like `forgeWeek` or `forgeDayNum`.
- Profile and schedule sync use section-level timestamps in `profile.syncMeta`. Preserve that merge behavior when changing profile persistence.
- Keep saves targeted: program-state writes should update the relevant `program:<id>` document instead of re-writing every program state blob.
- When changing import, clear-all, delete, or undo flows, ensure behavior stays correct for both the local localStorage cache and the `workouts` Supabase table.
- Prefer small, explicit sync helpers in `core/data-layer.js` over spreading Supabase calls across unrelated files.

## Program Files
- Files under `programs/` define training logic and metadata.
- Keep new program implementations consistent with the existing program modules.
- Avoid mixing program logic into unrelated UI code when a program file or layer file is the correct home.
- Exercise metadata such as movement tags, muscle groups, and equipment tags belongs in `core/exercise-library.js`. Reuse that catalog instead of scattering duplicate exercise heuristics across program files.
- User-facing muscle-load UI should use the display-group mapping from `core/exercise-library.js` instead of inventing separate dashboard-only muscle labels.
- Keep new program objects compatible with the existing integration points: id, name, description, icon, session options, session building, state advancement, and settings hooks. Extend the existing shape instead of introducing new abstractions.
- When adding settings UI from a program file, follow the existing inline DOM rendering style already used by current program modules.

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
