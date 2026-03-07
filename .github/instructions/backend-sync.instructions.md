---
applyTo: "app.js,core/data-layer.js,core/history-layer.js,core/workout-layer.js,supabase/migrations/*.sql"
description: "Use when changing Supabase sync, persistence, import/export, workout storage, or data migrations in Ironforge."
---

# Ironforge Backend And Sync Instructions

- Workout history sync now uses the dedicated `public.workouts` table in Supabase. Treat that table as the source of truth for synced workouts.
- `profiles.data` is for `profile` and `schedule` only. Do not add `workouts` back into the profile blob.
- `profile` and `schedule` sync use section-level timestamps stored in `profile.syncMeta`. Preserve that merge behavior when changing profile persistence.
- Keep the app local-first: localStorage remains the client cache and offline fallback, but synced workout history must round-trip through `public.workouts`.
- Preserve the current `client_workout_id` model. It is the stable per-user identifier used for upserts and soft deletes.
- Preserve soft-delete behavior through `deleted_at` unless the task explicitly requires a migration away from that model.
- When changing import, clear-all, delete, or undo flows, make sure the behavior stays correct for both local cache and the `workouts` table.
- Keep schema changes additive by default. Prefer new migrations under `supabase/migrations/` instead of destructive rewrites.
- If a persistence shape must change, include a migration path in `core/data-layer.js` and avoid silently invalidating existing user data.
- Use canonical workout payload fields such as `program`, `programMeta`, and `programDayNum`. Do not reintroduce legacy payload fields like `forgeWeek` or `forgeDayNum`.
- Prefer small, explicit sync helpers in `core/data-layer.js` over spreading Supabase calls across unrelated files.
