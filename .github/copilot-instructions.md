# Ironforge Project Instructions

## Project Shape
- This repository is a no-build vanilla web app and PWA.
- Main entry points are `index.html`, `app.js`, `styles.css`, `manifest.json`, and `sw.js`.
- Core business logic is split into layer files under `core/`.
- Training program definitions live under `programs/`.
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

## Internationalization
- User-facing strings must go through the translation system.
- Add new keys to the central string map in `core/i18n-layer.js`.
- Keep English and Finnish translations in sync.
- Prefer existing `tr(...)`, `I18N.t(...)`, `data-i18n`, and `data-i18n-placeholder` patterns.
- Do not hardcode new visible UI strings directly into templates or DOM updates unless there is a very strong reason.

## Data And Persistence
- Respect the current localStorage-backed state and existing data shapes.
- Do not rename persisted keys or change stored structures without migration logic.
- Be careful with Supabase-related code in `app.js` and `core/data-layer.js`.
- Treat `public.workouts` as the source of truth for workout history sync.
- Treat `profiles.data` as profile and schedule sync only; do not reintroduce `profiles.data.workouts`.
- Keep workout-table changes compatible with the additive migration flow under `supabase/migrations/`.
- Preserve soft-delete behavior for synced workouts unless the task explicitly requires a different deletion model.
- Avoid changes that could silently invalidate existing user data on devices.

## Program Files
- Files under `programs/` define training logic and metadata.
- Keep new program implementations consistent with the existing program modules.
- Avoid mixing program logic into unrelated UI code when a program file or layer file is the correct home.

## Change Strategy
- Fix root causes instead of layering on narrow patches when feasible.
- Avoid unrelated refactors.
- If adding a feature, update all affected layers, translations, and UI states.
- When a change alters architecture, persistence, sync behavior, migrations, or contributor workflow, also update the relevant AI instructions under `.github/` before committing.
- Before committing and pushing meaningful project changes, explicitly check whether `.github/copilot-instructions.md` or a matching file under `.github/instructions/` should be updated to reflect the new reality.
- When changing cached runtime assets or PWA update behavior, also decide whether `sw.js` cache versioning or fetch strategy needs an update.
- Do not add instruction-only churn for trivial edits, but do document durable workflow or architecture changes once they become part of the project standard.
- Prefer minimal diffs that preserve the current coding style and user flows.
