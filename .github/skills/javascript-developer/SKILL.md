---
name: javascript-developer
description: "Use when: refactoring, debugging, or extending the Fly2 browser JavaScript, including ES modules, UI interactions, input handling, game-state changes, and performance-sensitive render-loop code."
---

# JavaScript Developer

## Scope

Work in `js/app.js` as an ES module loaded by `index.html`. Keep dependencies browser-native and preserve the existing import-map aliases for Three.js.

## Working Rules

- Keep render-loop work allocation-light: reuse the existing temporary Three.js vectors and quaternions where possible.
- Maintain the app's initialization order: UI setup and world selection happen before `startGame`, then the render loop owns continuous updates.
- Treat `SETTINGS` as the shared configuration source. Route live changes through `applySetting` so dependent systems remain synchronized.
- Keep DOM lookups behind `el`, `setText`, `setColor`, and `showEl` where those helpers apply.
- Preserve keyboard, touch, and pointer-lock behavior when changing controls. Validate both desktop input and touch UI paths.
- Keep Russian player-facing labels consistent with the existing UI unless the task asks for copy changes.

## Validation

- Serve the repository over HTTP; do not validate module imports with `file://`.
- Check the browser console after module edits.
- Start a world and verify the render loop, selection screens, settings panel, and the touched control path.