# Ironforge Post-Migration Consolidation

## Summary

The visible-shell migration is complete, but the runtime still has two active mental models:

- React + Zustand own the shipped shell and several migrated page/store surfaces.
- Legacy scripts still own or mirror parts of runtime state, settings snapshot assembly, and compatibility globals.

This document tracks the cleanup that comes after the migration itself. The end-state is:

- the app runtime lives in `src/`
- legacy scripts provide only narrow compatibility adapters for untouched surfaces
- Playwright targets the typed E2E/store harness by default instead of incidental globals

## Current Consolidation Direction

### 1. `app.js` should be a compat shell, not a runtime owner

- Runtime state access, onboarding defaults, language refresh coordination, and settings view snapshot assembly should live in typed services under `src/app/services/`.
- `app.js` may still expose globals, but those globals should delegate to typed runtime ownership instead of computing state themselves.

### 2. Keep bridges narrow and explicit

- Prefer typed store/service entry points first.
- Keep `window.*` bridges only for genuinely unmigrated callers and focused test compatibility.
- Avoid adding new generic “read/write everything” bridge patterns.

### 3. Typed program ownership is authoritative

- `src/programs/index.ts` is the active registry source of truth.
- Legacy program/planning helpers should progressively call typed registry/planning surfaces instead of re-owning logic in parallel.

### 4. Tests should move toward the typed harness

- Prefer `window.__IRONFORGE_E2E__` for navigation, data seeding, and runtime patching.
- Prefer `window.__IRONFORGE_STORES__` only when a store-backed seam is the behavior under test.
- Keep direct legacy-global coverage small and intentional.

## First Implemented Consolidation Slice

The first consolidation slice moves these responsibilities out of `app.js` runtime ownership and into typed runtime code:

- legacy runtime state getters/setters
- settings page snapshot assembly
- onboarding default draft/recommendation helpers
- language refresh coordination for migrated shell surfaces

`app.js` still exposes the compatibility globals, but those globals now delegate into the typed app runtime bridge.
