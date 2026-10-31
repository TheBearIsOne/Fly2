# Fly2

LowPolly Flight Sim is a browser-based Three.js flight simulator with procedural worlds, weather, vehicles, and mobile controls.

## Structure

- `index.html` contains the document structure, UI markup, and the Three.js import map.
- `css/styles.css` contains all interface and responsive styles.
- `js/app.js` is the ES module that owns simulation, rendering, world generation, input, and UI behavior.
- `.github/skills/` contains on-demand development guidance for JavaScript and Three.js work.

## Run locally

Run a local static server from the repository root, then open the displayed URL in a browser:

```powershell
python -m http.server 4173
```

The application imports Three.js from a CDN, so the browser needs internet access.
