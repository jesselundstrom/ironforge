# PWA Device Validation

## Status

Manual installed-PWA validation is still pending after the 2026-03-31 Training Core cleanup slice.

Automated status before device testing:

- `npm run lint`: passed
- `npm run typecheck`: passed
- `npm run build`: passed
- `npm run test:e2e:ci`: passed

## Pending Real-Device Pass

### iPhone Safari

- add to home screen from the public app
- cold launch
- sign in
- verify `dashboard`, `log`, `history`, and `settings`
- relaunch offline
- confirm update behavior after a cache/version bump

### Android Chrome

- install from the public app
- cold launch
- sign in
- verify `dashboard`, `log`, `history`, and `settings`
- relaunch offline
- confirm update behavior after a cache/version bump

## Notes

- Validate against the shipped `public/manifest.json` and `public/sw.js` paths.
- Record device-specific regressions here once the pass is completed.
