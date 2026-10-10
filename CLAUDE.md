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
- **Lantmäteriet's laser scan** (`npm run laser-points`) for heights and outlines.
- **Wikimedia Commons photos and Wikipedia** for materials, details, signs and history.

## Checking a change

- `npm run shot -- out.png x,y,z,yaw,pitch --before` renders the game from a viewpoint. `--before` also renders it without `src/detail/`.
- `npm run build` typechecks and builds the game.
