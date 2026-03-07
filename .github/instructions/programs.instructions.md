---
applyTo: "programs/*.js"
description: "Use when creating, updating, or reviewing training program files in programs/. Covers program registration, state shape, scheduling, and i18n patterns used by Ironforge."
---

# Ironforge Program File Instructions

- Keep program implementations inside `programs/` as self-registering modules that match the existing pattern used by the current program files.
- Preserve the current global registry approach and register new programs through the existing `registerProgram(...)` flow.
- Keep program objects compatible with the existing app integration points such as identifiers, labels, descriptions, session options, session building, state advancement, and settings hooks.
- Prefer extending the existing program object shape instead of introducing new abstractions or cross-file frameworks.
- Program state must remain serializable and compatible with the app's current localStorage-backed persistence.
- Do not rename persisted program ids or reshape stored state without a migration path.
- Route user-visible labels, descriptions, notes, and banners through the translation system rather than hardcoding new visible strings only in the program file.
- Match the current scheduling and sport-awareness patterns so recommendations still respect phone-first logging flows and sport-day fatigue logic.
- Keep output compact and readable on mobile screens, especially session labels, banner text, and settings copy.
- When adding settings UI from a program file, follow the existing inline DOM rendering style already used by current program modules.