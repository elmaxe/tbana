# Notes for Claude

The README covers how the game is built and run. This file adds what a session needs to know about data and research.

## Data that must never be committed

- **Lantmäteriet's aerial photos** (`public/data/ortho/`, gitignored): their licence keeps them inside the EU/EEA.
- **Google's 3D mesh of the city and any pictures of it** (`.google/`, gitignored): Google's terms allow looking and measuring, not publishing.
- **Reference photos** of buildings, from Commons, Mapillary or elsewhere.

What goes in the repo are numbers read from these sources, shapes built by hand, and textures drawn in code (src/textures.ts).

## Research sources

Before modelling a real building, research it from the sources below. The skill `.claude/skills/tbana-landmark/` has the full method.

- **Google's 3D mesh** (`npm run google-mesh`) for shapes, proportions, colours and facades.
  - Prefer Axel's own download of Google Earth's mesh, in `C:\Users\axele\hobby\sthlm` on his computer (central Stockholm, level 20). A cloud session stages the files it needs from there.
  - Cesium ion (`CESIUM_ION_TOKEN`) serves the same mesh, but its heights can be off by up to 2.5 m.
  - Even the download's heights drift from place to place: they match the laser scan at Hötorget, but sit 2.8 m low at Kungstornen. Read heights from the mesh relative to the street beside the building, and take absolute heights from the laser scan.
- **Lantmäteriet's laser scan** (`npm run laser-points`) for heights and outlines.
- **Wikimedia Commons photos and Wikipedia** for materials, details, signs and history.

## Fixing a building

- A landmark worth modelling by hand goes in `src/detail/` (see the skill).
- A plain city block that is only the wrong height usually has wrong OpenStreetMap tags, which made `tools/build-city.ts` leave out the laser scan's height. Fix the tags in `data/building-corrections.json`, with the reason, and run `npm run build-city`. Only the tiles the building is in change.

## Checking a change

- `npm run shot -- out.png x,y,z,yaw,pitch --before` renders the game from a viewpoint. `--before` also renders it without `src/detail/`.
- `--google <glb>` (a mesh cut by `npm run google-mesh`) also renders Google's mesh from the same camera, to set beside the game's. These pictures stay local like the mesh.
- `npm run build` typechecks and builds the game.
