---
applyTo: "app.js,index.html,core/i18n-layer.js,styles.css"
description: "Use when changing visible UI text, labels, placeholders, mobile interaction copy, or translation behavior in Ironforge."
---

# Ironforge i18n And Mobile UI Instructions

- Do not hardcode new user-visible strings directly into markup or DOM updates.
- Add translation keys to the central string map in `core/i18n-layer.js`.
- Keep `en` and `fi` entries aligned whenever new keys are added.
- Follow the existing translation key style such as `section.area.action`.
- When changing labels, placeholders, button text, or modal copy, preserve the current `data-i18n` and `data-i18n-placeholder` patterns where possible.
- Because the app is primarily used as a phone-installed PWA, keep copy concise and suitable for narrow screens.
- Avoid introducing verbose labels that wrap badly or weaken tap-target layouts.