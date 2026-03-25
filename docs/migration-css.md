# Ironforge: CSS Architecture Migration Plan

## Goal

Replace the monolithic `styles.css` (10,335 lines, 582 class names, 43 animations) with component-scoped CSS modules — one CSS file per island or logical component group. The result is the same visual output, zero behavior change, and a styling architecture that is maintainable, tree-shakeable, and prepared for a future React Native StyleSheet port.

---

## Why This Matters

**Now:** One file owns all styles for all 12 islands + shell + onboarding + animations. Changing a card style means searching a 10,000-line file. Dead CSS is invisible. Two components sharing a class name create invisible coupling.

**After:** Each island has its own CSS file. A change to `dashboard-island/dashboard.module.css` cannot affect the nutrition island. Unused styles are easy to spot and remove. The class name surface shrinks from 582 global names to ~80–120 per island.

**React Native path:** CSS modules → Tailwind utility classes → React Native StyleSheet is a known, well-trodden migration. Component-scoped modules are the necessary intermediate step.

---

## Current State

| Metric | Value |
|---|---|
| Total CSS lines | 10,335 |
| Logical sections | 66 |
| CSS custom properties | 63 |
| Keyframe animations | 43 |
| Unique class names | 582 |
| Media queries | 18 |
| Component-scoped CSS files | 0 |
| className usages across islands | ~769 |

**Biggest islands by className count:**
- `dashboard-island/main.jsx` — 155 className usages
- `history-island/main.jsx` — 126
- `AppShell.jsx` — 125
- `nutrition-island/main.jsx` — 104
- `log-start-island/main.jsx` — 89
- `log-active-island/main.jsx` — 74

---

## Approach: CSS Modules

**Why CSS Modules over Tailwind or styled-components:**

- Tailwind requires a full class-name audit and rewrite of every JSX element — bigger surface than CSS Modules
- styled-components / emotion add a runtime JS dependency and change the mental model significantly
- CSS Modules require zero new dependencies, work with Vite out of the box, preserve the existing class name structure and design system variables, and are the most direct path to "same visuals, better structure"

**How CSS Modules work:**

```css
/* dashboard.module.css */
.hero { background: var(--surface); }
.planCard { border-radius: var(--radius); }
```

```jsx
import styles from './dashboard.module.css';
<div className={styles.hero}>
<div className={styles.planCard}>
```

Vite transforms `.hero` into a unique scoped name like `dashboard_hero__3kX9` at build time, so `.hero` in one file can never collide with `.hero` in another.

---

## Shared Infrastructure (Extract First)

Before migrating any island, extract the shared foundation into standalone files. Every island imports from these.

### `src/styles/tokens.css`
The `:root` block — 63 CSS custom properties.
```
--bg, --surface, --surface2, --surface3
--orange, --orange-dim, --accent, --accent2, --gold
--text, --muted, --border, --focus-ring
--green, --red, --yellow, --blue, --purple
--radius, --page-pad, --section-gap, --nav-h, --app-vh
--sat, --sab, --sal, --sar (safe-area insets)
... etc.
```
This file is imported once in `src/app/main.tsx`. All other files consume the variables — they never redefine them.

### `src/styles/reset.css`
HTML reset, body/html base styles, scrollbar rules, safe-area setup, touch-action.
Imported once in `src/app/main.tsx`.

### `src/styles/animations.css`
All 43 `@keyframes` definitions. Named animations (e.g., `forgeStrike`, `summaryReveal`) that are referenced across more than one component stay here. Single-use animations move into the component's own module file.

### `src/styles/shared/buttons.module.css`
The full button system: `btn`, `btn-primary`, `btn-secondary`, `btn-ghost`, `btn-icon`, `btn-sm`, `btn-full`, `danger-btn`. Used by almost every island.

### `src/styles/shared/forms.module.css`
Inputs, selects, toggles, labels. Used by settings islands and onboarding.

### `src/styles/shared/modals.module.css`
`modal-overlay`, `modal-sheet`, `modal-handle`, `modal-title`, `modal-sub`. Used by AppShell and multiple islands.

### `src/styles/shared/cards.module.css`
The base `card` class and generic card variants. Island-specific card variants (e.g., `dashboard-plan-card`) stay in their own island module.

---

## Migration Phases

### Phase 0 — Shared infrastructure *(risk: low)*

**What:** Extract the four shared concerns above into standalone files without changing any JSX.

**Creates:**
- `src/styles/tokens.css`
- `src/styles/reset.css`
- `src/styles/animations.css`
- `src/styles/shared/buttons.module.css`
- `src/styles/shared/forms.module.css`
- `src/styles/shared/modals.module.css`
- `src/styles/shared/cards.module.css`

**Strategy:** The sections being extracted are kept in `styles.css` too (no deletions yet). `styles.css` becomes the fallback. Phase 0 is purely additive — nothing breaks.

**Gate:** `npm run build` passes. App looks identical.

---

### Phase 1 — Settings islands *(risk: low)*

Lowest className counts. Good practice run. Five islands, all simple.

**Islands:**
- `src/settings-body-island/` — 16 classNames
- `src/settings-account-island/` — 28 classNames
- `src/settings-schedule-island/` — 21 classNames
- `src/settings-preferences-island/` — 39 classNames
- `src/settings-program-island/` — 32 classNames

**For each island:**
1. Create `src/settings-*-island/settings-*.module.css`
2. Move the CSS section(s) that belong to that island from `styles.css` into the module file
3. Update the island's `main.jsx` to import the module and replace `className="foo"` with `className={styles.foo}`
4. For shared classes (`btn`, `card`, etc.), import from `src/styles/shared/`

**After all five pass:** Delete those sections from `styles.css`.

**Gate:** Full visual comparison. App looks identical on all settings pages.

---

### Phase 2 — Onboarding *(risk: low)*

`src/app/OnboardingFlow.jsx` — 60 classNames, 611 lines.

**Creates:** `src/app/onboarding.module.css`

Contains: `onboarding-sheet`, `onboarding-progress`, `onboarding-option-btn`, `onboarding-card`, and all onboarding step variants.

Shared buttons and form inputs imported from `src/styles/shared/`.

**Gate:** Walk through entire onboarding flow. Visuals identical.

---

### Phase 3 — Log islands *(risk: medium)*

The active workout UI. Higher className count, more animations, but logic is already contained.

**Islands:**
- `src/log-start-island/` — 89 classNames
- `src/log-active-island/` — 74 classNames

**Creates:**
- `src/log-start-island/log-start.module.css`
- `src/log-active-island/log-active.module.css`

The workout-specific animations (`forgeStrike`, `forgeSeal`, `forgeCooldown`, `forgeShockwave`, `emberFly`, `emberGlow`, `forgeShimmer`) are referenced only in log-active — move them from `animations.css` into `log-active.module.css` and remove from the global file.

Set rows, exercise blocks, rest timer, RPE modal classes all move here.

**Gate:** Complete a full workout — start, log sets, rest timer, RPE picker, finish. Visuals and animations identical.

---

### Phase 4 — History island *(risk: medium)*

`src/history-island/` — 126 classNames, 517 lines.

**Creates:** `src/history-island/history.module.css`

Contains: `hist-*` prefix classes, heatmap classes (`heatmap-*`), phase cards, session cards, TM adjustment pills, week sections, empty state. History-specific animation `histCardIn` moves here.

**Gate:** Open history page, expand/collapse workouts, check heatmap, verify all cards and labels.

---

### Phase 5 — Nutrition island *(risk: medium)*

`src/nutrition-island/` — 104 classNames, 980 lines.

**Creates:** `src/nutrition-island/nutrition.module.css`

Contains: All `nc-*` prefixed classes — header, messages, chat setup cards, avatar, macro summary, streaming cursor, today intake summary. Nutrition animations (`nutritionMsgIn`, `nutritionPulse`, `nc-blink`, `nc-card-in`) move here.

**Gate:** Open nutrition page, send a message, verify streaming display, macro card, photo upload UI.

---

### Phase 6 — Dashboard island *(risk: medium-high)*

Highest className count. The most complex island.

`src/dashboard-island/` — 155 classNames, 765 lines.

**Creates:** `src/dashboard-island/dashboard.module.css`

Contains: `dashboard-*` prefix classes — hero, section, plan cards, nutrition status, recovery display, coaching cards, fatigue visualization, calendar strip, maxes display, stats chart. Dashboard animations (`dashboardPlanFadeUp`, `fillBar`, `tmDigitRoll`, `tmForgeValueHeat`, etc.) move here.

**Strategy:** Migrate section by section within the dashboard rather than all at once. The dashboard has clear sub-sections (hero, plan, maxes, recovery, nutrition) — migrate one sub-section per sub-step, verify, then continue.

**Gate:** All dashboard cards render correctly. Fatigue bars animate. TM display works. Coaching card variants show correctly.

---

### Phase 7 — AppShell *(risk: high)*

`src/app/AppShell.jsx` — 125 classNames, 1000 lines.

AppShell owns: navigation bar, page containers, sheet modals, toast notifications, confirm modal, exercise guide overlay, authentication screen.

**Creates:**
- `src/app/shell.module.css` — nav, page wrappers, layout primitives
- `src/app/toast.module.css` — toast notifications
- `src/app/overlays.module.css` — confirm modal, sheet overlays, exercise guide

Login screen styling moves to `src/app/auth.module.css`.

**Why highest risk:** AppShell has window global integration, manages all overlays, and is the single component that wraps everything. A broken AppShell breaks the entire app.

**Strategy:** Migrate nav + layout first (most stable). Then overlays. Then auth. Verify after each sub-step.

**Gate:** Full app walkthrough — navigation, toast notifications, confirm dialog, rest timer modal, RPE modal, exercise guide, summary sheet, login screen.

---

### Phase 8 — Delete `styles.css` *(risk: low)*

By this point all CSS has been extracted. `styles.css` should contain only the sections not yet deleted (verified by running a diff against what was extracted in each phase).

**Steps:**
1. Run `npm run build` — check for any CSS class references still loading from `styles.css`
2. Remove the `<link rel="stylesheet" href="/styles.css">` from `index.html`
3. Verify build passes
4. Delete `styles.css`

**Gate:** Full Playwright suite passes. Full visual walkthrough on all pages. Build output is smaller than before.

---

## Invariants (Never Break These)

1. **Design tokens stay in `tokens.css`** — no hardcoded color values or spacing values in component files
2. **Safe-area insets** — the `--sat`, `--sab`, `--sal`, `--sar` variables and their fallbacks must be preserved exactly
3. **Reduced motion** — every `@keyframes` usage must have a corresponding `prefers-reduced-motion` rule
4. **Shared class imports** — buttons, forms, and modals are always imported from `src/styles/shared/`, never duplicated
5. **No visual regressions** — each phase gate is a visual check, not just a build check
6. **Fonts** — Google Fonts loading stays in `index.html`, not in CSS imports (avoids FOUC)

---

## CSS Module Naming Convention

CSS Modules use camelCase in JSX but kebab-case in the CSS file is allowed. Use this pattern:

```css
/* dashboard.module.css */
.plan-card { ... }          /* kebab-case in CSS */
.planCardHead { ... }       /* or camelCase — pick one per file, be consistent */
```

```jsx
import styles from './dashboard.module.css';
<div className={styles['plan-card']}>    /* bracket notation for kebab */
<div className={styles.planCardHead}>   /* dot notation for camelCase */
```

**Recommendation:** Keep kebab-case in CSS (matches existing convention) and use bracket notation in JSX when needed. This minimizes the rename surface during migration.

---

## Combining Multiple Classes

Many elements use compound classes like `className="card dashboard-plan-card"`. With CSS Modules:

```jsx
// Option 1 — template literal
className={`${styles.card} ${styles.dashboardPlanCard}`}

// Option 2 — clsx library (already in many React projects)
className={clsx(styles.card, styles.dashboardPlanCard)}
```

Check if `clsx` is already installed before adding it. If not, template literals are sufficient.

---

## What This Does NOT Do

- Does not change any component logic
- Does not change visual output
- Does not add Tailwind or any CSS framework
- Does not touch `core/*.js`, `app.js`, or programs
- Does not change how animations work — only where they are defined
- Does not change the design system (tokens stay the same)
- Does not add React Native compatibility (that is a separate subsequent step)

---

## Files Created By End State

```
src/
  styles/
    tokens.css
    reset.css
    animations.css
    shared/
      buttons.module.css
      forms.module.css
      modals.module.css
      cards.module.css
  app/
    shell.module.css
    toast.module.css
    overlays.module.css
    auth.module.css
    onboarding.module.css
  dashboard-island/
    dashboard.module.css
  history-island/
    history.module.css
  log-start-island/
    log-start.module.css
  log-active-island/
    log-active.module.css
  nutrition-island/
    nutrition.module.css
  settings-body-island/
    settings-body.module.css
  settings-account-island/
    settings-account.module.css
  settings-schedule-island/
    settings-schedule.module.css
  settings-preferences-island/
    settings-preferences.module.css
  settings-program-island/
    settings-program.module.css
```

**Deleted:** `styles.css` (root level)

---

## Verification

Each phase is verified by:
1. `npm run build` — no build errors
2. Visual check on the page(s) affected by that phase
3. After Phase 7: full Playwright suite passes
4. After Phase 8: build output CSS is smaller; `styles.css` is absent from dist
