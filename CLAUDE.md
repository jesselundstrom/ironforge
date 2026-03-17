# Ironforge — Claude Instructions

> Full project architecture, stack, and coding rules are in `.github/copilot-instructions.md`.
> This file covers project vision and how Claude should work with the user.

## Project Vision

- **Personal coaching app** with three pillars: Training, Nutrition, Recovery
- Currently a vanilla JS PWA, primarily used on iPhone
- Mobile strategy: Capacitor (wrap PWA in native shell) as first step, React Native as future option
- The PWA is the production product — not a prototype

## About the User

- Non-developer building a production app with AI coding assistance
- Understands architecture, discusses tradeoffs, and makes design decisions
- Wants to learn software engineering principles while building
- Communicates in Finnish and English; code and docs should be in English

## How to Work With Me

### Always Explain
- State WHAT you are doing and WHY — do not just produce code
- If making an architecture decision, justify it briefly
- If something is a best practice, name it explicitly

### Ask Before Big Changes
- If a change touches more than 2–3 files, describe the plan first
- If unsure what the user wants, ask — do not guess
- Offer alternatives when they exist

### Teach Along the Way
- Flag choices that could cause problems long-term
- Explain testing relevance when applicable
- Surface good practices (naming, structure, security) briefly

### Production Quality Always
- No quick hacks — production-grade solutions only
- Production-grade means: works offline, tested, handles edge cases
- All weights in kilograms (kg)
- Follow existing patterns and conventions in the codebase

### Keep These Instructions Current
- When we make a decision that affects future sessions, add it to the Decisions section below
- Example: "decided to use X pattern for Y problem" → add to Decisions

---

## Decisions

*Architecture decisions are logged here as they are made.*

- **UI modals**: Sheet-pattern (not native dialog) — consistency and mobile UX
- **Training programs**: Plugin architecture — new programs register without touching core files
- **Testing**: Playwright e2e — test like a real user, no unit tests
- **Nutrition coaching**: Anthropic API (Claude) called directly from browser with user-provided key
- **Recovery/readiness**: Fatigue engine (muscular, CNS, overall) is a core coaching pillar
- **Code language**: All code, comments, and docs in English; UI supports EN/FI via i18n
- **Layer architecture**: Business logic split into `core/*.js` layers, not a single monolith
- **Sport schedule**: Configurable sport type (not hardcoded to hockey)
- **Mobile strategy**: Capacitor for PWA wrapping first, React Native as future option
- **React migration**: Gradual island-based migration using React + Vite (not Next.js, not full rewrite)
  - Vite builds React islands as JS bundles loaded into the existing index.html (library/bundle mode)
  - Existing vanilla shell (app.js, showPage, global state) stays as source of truth during migration
  - React islands are consumers of existing state via a thin adapter layer (custom events for sync)
  - Program plugins stay as vanilla `<script>` tags; React accesses them via global `PROGRAMS` object
  - Migration order: History (read-only first) → Dashboard → Settings → full shell replacement
  - Settings migration uses bounded slices with the Body tab as the proving pattern; Body, Account, Preferences, Schedule, and Program now run as React islands while advanced program setup stays on the legacy sheet flow
  - Log migration now runs both the workout start shell and active workout editor through React islands, while the workout logic, draft persistence, rest-timer bar, modals, and finish/discard handlers stay legacy-backed under the same DOM contract
  - Nutrition migration now runs the visible chat shell through a React island while the Claude request flow, local history, setup card, clear-history flow, and photo handling remain legacy-backed under explicit snapshot events
  - The first shell-replacement step now runs the visible bottom nav, toast host, and confirm modal through a top-level React AppShell island; the exercise catalog/name modal host and workout overlay hosts (RPE, summary, sport-check, exercise guide) mount through dedicated React shell islands; and `core/ui-shell.js` remains the compatibility bridge for `showPage(...)`, `showToast(...)`, `showConfirm(...)`, page activation side effects, and legacy DOM ids
  - localStorage/Supabase data model unchanged throughout migration
  - Service worker must handle Vite's hashed output filenames
  - i18n and offline behavior preserved from day one in every migrated page
