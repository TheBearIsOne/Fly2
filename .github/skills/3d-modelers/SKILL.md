---
name: 3d-modelers
description: "Use when: creating, modifying, optimizing, or integrating Fly2 Three.js models, procedural geometry, GLB assets, materials, animations, terrain props, aircraft, or world objects."
---

# 3D Modelers

## Scope

Fly2 uses Three.js for procedural vehicles, terrain props, particles, and optional GLB assets. Model creation and material helpers live in `js/app.js`; external models are loaded through `AssetManager`.

## Modeling Rules

- Match the project's low-poly visual language and use `SEG` for procedural geometry detail so `SETTINGS.procDetail` remains effective.
- Prefer shared geometries and materials through the existing caches. Mark reusable geometry and materials as shared when following the current disposal conventions.
- Build models as `THREE.Group` instances with named/returned movable parts when they need animation or flight controls.
- Preserve Y-up coordinates, world scale, and existing shadow rules. Optional GLB models must gracefully fall back to procedural assets when loading fails.
- Avoid creating geometry, materials, textures, or vectors inside per-frame update paths.
- Verify terrain placement against `WATER_LEVEL` and the terrain-height APIs so props, animals, and vehicles do not float or clip.

## Validation

- Inspect models in the selection preview and in a running world.
- Check casts/receives-shadow behavior with shadows enabled and disabled.
- Test at the default and maximum procedural-detail settings, and confirm browser console remains free of Three.js errors.