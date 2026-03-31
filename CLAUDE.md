# Ironforge - Claude Instructions

> Full project architecture, stack, and coding rules are in `.github/copilot-instructions.md`.
> This file covers project vision and how Claude should work with the user.

## Project Vision

- **Personal coaching app** with three pillars: Training, Nutrition, Recovery
- Current shipped runtime is a mobile-first React + Vite PWA with Zustand-owned app, auth, data, and workout state
- Current shipped product scope is the **Training Core**: auth, onboarding, dashboard, workout logging, history, and basic settings
- Nutrition and Recovery remain part of the broader product vision, but are deferred from the shipped runtime until they are fully re-owned on the modern stack
- Mobile strategy: Capacitor (wrap PWA in native shell) as first step, React Native as future option
- The PWA is the production product, not a prototype

## About the User

- Non-developer building a production app with AI coding assistance
- Understands architecture, discusses tradeoffs, and makes design decisions
- Wants to learn software engineering principles while building
- Communicates in Finnish and English; code and docs should be in English

## How to Work With Me

### Always Explain

- State WHAT you are doing and WHY - do not just produce code
- If making an architecture decision, justify it briefly
- If something is a best practice, name it explicitly

### Ask Before Big Changes

- If a change touches more than 2-3 files, describe the plan first
- If unsure what the user wants, ask - do not guess
- Offer alternatives when they exist

### Teach Along the Way

- Flag choices that could cause problems long-term
- Explain testing relevance when applicable
- Surface good practices (naming, structure, security) briefly

### Production Quality Always

- No quick hacks - production-grade solutions only
- Production-grade means: works offline, tested, handles edge cases
- All weights in kilograms (kg)
- Follow existing patterns and conventions in the codebase

### Keep These Instructions Current

- When we make a decision that affects future sessions, add it to the Decisions section below
- Example: "decided to use X pattern for Y problem" -> add to Decisions

---

## Decisions

_Architecture decisions are logged here as they are made. IMPORTANT: Architecture CAN be changed and legacy decisions have to be replaced and deleted when no longer relevant._

- **UI modals**: Sheet-pattern (not native dialog) - consistency and mobile UX
- **Training programs**: Plugin architecture - new programs register without touching core files
- **Testing**: Playwright e2e - test like a real user, no unit tests
- **Nutrition coaching**: Anthropic API (Claude) runs through a Supabase Edge Function with an Ironforge-managed server-side key, signed-in access, and daily per-user caps
- **Nutrition flow**: Guided daily actions with an optional short note, not an open-ended rolling chat
- **Recovery/readiness**: Fatigue engine (muscular, CNS, overall) is a core coaching pillar
- **Code language**: All code, comments, and docs in English; UI supports EN/FI via i18n
- **Layer architecture**: The shipped app is React/Zustand-owned. Runtime state, auth, onboarding, dashboard, workout logging, history, settings, and typed program logic live under `src/`.
- **Sport schedule**: Configurable sport type (not hardcoded to hockey)
- **Mobile strategy**: Capacitor for PWA wrapping first, React Native as future option
- **CSS strategy**: Tailwind CSS v4 for all new UI code; `src/styles/compat-ui.css` is a shrinking compatibility layer that should only be cleaned opportunistically while already editing a surface, never as a standalone migration task
- **UI contract**: New React-owned UI should expose stable `data-ui` / `data-state` hooks for tests and compatibility seams instead of relying on presentational class names as the long-term contract
- **UI runtime**: React + Vite is the shipped runtime
  - `src/app/main.tsx` boots the app
  - `src/app/AppShell.jsx` owns the visible shell, navigation, overlays, and page tree
  - `src/app/store/runtime-store.ts` is part of the active runtime foundation
  - Production runtime ownership should stay inside typed modules and stores, not `window.*` delegates
- **Auth runtime**: React-owned auth/session orchestration lives in `src/app/services/auth-runtime.ts` and is the only production auth owner
- **PWA updates**: Installed-app updates currently auto-apply waiting service workers and reload so stale Vercel-installed bundles do not linger during login/PWA stabilization
- **Legacy runtime removal**: The old root runtime (`app.js`, `core/*.js`, `programs/*.js`) has been removed from the shipped app and repo flow
  - Keep new work inside typed modules/stores under `src/`
  - Preserve Supabase compatibility, offline behavior, and i18n while rebuilding deferred product areas
  - Use `docs/migration-ts-zustand.md` as the migration source of truth for the React-only cutover
