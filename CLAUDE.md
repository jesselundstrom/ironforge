# Ironforge - Claude Instructions

> Full project architecture, stack, and coding rules are in `.github/copilot-instructions.md`.
> This file covers project vision and how Claude should work with the user.

## Project Vision

- **Personal coaching app** with three pillars: Training, Nutrition, Recovery
- Current app runtime is a mobile-first PWA with a React + Vite shell and legacy business logic still being migrated
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

### Migration Strategy

- The current stabilization phase ownership anti-drift contract lives in `docs/post-migration-consolidation.md`.
- Legacy code -> add typed equivalent -> delete legacy code -> bridge is unnecessary
- A migration slice is not complete until the legacy code it replaces is deleted. Adding a typed equivalent without deleting the legacy code is not progress, it is growth.
- A surface can still keep compatibility delegates for untouched callers while other sub-behaviors migrate, but any completed slice must delete the replaced legacy branch in the same change.
- Wrapper-only convergence work is not a completed migration outcome.

---

## Decisions

_Architecture decisions are logged here as they are made._

- **UI modals**: Sheet-pattern (not native dialog) - consistency and mobile UX
- **Training programs**: Plugin architecture - new programs register without touching core files
- **Testing**: Hybrid validation
  - Playwright covers real user journeys and regression smoke
  - Vitest covers extracted pure logic, runtime contracts, and store-adjacent invariants
- **Nutrition coaching**: Anthropic API (Claude) runs through a Supabase Edge Function with an Ironforge-managed server-side key, signed-in access, and daily per-user caps
- **Nutrition flow**: Guided daily actions with an optional short note, not an open-ended rolling chat
- **Recovery/readiness**: Fatigue engine (muscular, CNS, overall) is a core coaching pillar
- **Code language**: All code, comments, and docs in English; UI supports EN/FI via i18n
- **Layer architecture**: Business logic is still largely split across `core/*.js` plus `app.js`, with an active migration path toward TypeScript + Zustand
- **Sport schedule**: Configurable sport type (not hardcoded to hockey)
- **Mobile strategy**: Capacitor for PWA wrapping first, React Native as future option
- **CSS strategy**: Tailwind CSS v4 for all new UI code; `src/styles/legacy-ui.css` is a shrinking compatibility layer that should only be cleaned opportunistically while already editing a surface, never as a standalone migration task
- **UI contract**: New React-owned UI should expose stable `data-ui` / `data-state` hooks for tests and compatibility seams instead of relying on presentational class names as the long-term contract
- **UI runtime**: React + Vite is the shipped visible-shell runtime
  - `src/app/main.tsx` boots the app
  - `src/app/AppShell.jsx` owns the visible shell, navigation, overlays, and page tree
  - `src/app/store/runtime-store.ts` is already part of the active runtime foundation
  - Compatibility bridges and selected `window.*` globals still exist temporarily for untouched legacy logic and tests
- **Auth runtime**: React-owned auth/session orchestration now lives in `src/app/services/auth-runtime.ts`; legacy auth globals remain temporary compatibility delegates and should not be restored as the primary login owner
- **PWA updates**: Installed-app updates currently auto-apply waiting service workers and reload so stale Vercel-installed bundles do not linger during login/PWA stabilization
- **Legacy runtime migration**: The active migration is now the remaining business/runtime layer in `app.js`, `core/*.js`, and `programs/*.js` to TypeScript + Zustand
  - Migrate incrementally with compatibility shims until the typed runtime fully owns each surface
  - Preserve localStorage/Supabase compatibility, offline behavior, and i18n during every phase
  - Use `docs/migration-ts-zustand.md` as the migration roadmap and `docs/post-migration-consolidation.md` as the current ownership anti-drift contract
- **Stabilization cycle**: current migration work is under a hard freeze for new feature scope
  - Central risk: duplicate typed plus legacy ownership, including bridge regrowth and new `window.*` contracts
  - Allowed: bug fixes, ownership-reduction migration work, tests needed to land a migration slice, and minimal UX fixes required by that slice
  - Not allowed: new features, new `window.*` contracts, new program settings, new stores outside the approved migration path, or wrapper-only convergence changes
