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
- Blocks in the wrong colours: `npm run google-colours -- <x0,z0,x1,z1>` measures their walls and roofs from Google's mesh into `data/building-colours.json`; then `npm run build-city`.
- Ground that is grass where it is paved, where the elevation model took a bridge's deck for the ground (`open`), where it has a square as the pit it was while Slussen was rebuilt (`fill`), where a tunnel the network has too high for the street right over it raises a mound (`shallow`, as in front of Islandstorget), or where a street under the network's bridge is missing because the ground there counts as the track's (`under`, as under Tallkrogen's; with `"paved": false` where it is a park, as under Gubbängsfältet's viaduct): `data/ground-corrections.json`, with the reason.
- A road cut in two where it crosses open track on a bridge OpenStreetMap doesn't map as one: the city leaves the street out over the track. Draw the deck as a landmark that lays the city's own streets on it (its `streets` argument, as Nynäsvägen's deck at Gullmarsplan in `src/detail/farsta-line-north.ts`), with `walled` and `decks` corrections keeping the road level beside its ends.
- The streets and trees drawn near the camera are only in the areas of `src/detail/areas.ts`. After changing those areas, run `npm run fetch-streets` and `npm run find-trees -- --google <download>` (the mesh finds the trees planted since the 2021 laser scan), then `npm run build-city`.

## Checking a change

- `npm run shot -- out.png x,y,z,yaw,pitch --before` renders the game from a viewpoint. `--before` also renders it without `src/detail/`.
- `--google <glb>` (a mesh cut by `npm run google-mesh`) also renders Google's mesh from the same camera, to set beside the game's. These pictures stay local like the mesh.
- `npm run build` typechecks and builds the game.
