---
name: tbana-landmark
description: Use when modelling or improving a real Stockholm building in tbana (src/detail/). Research it first from Google's 3D mesh, Lantmäteriet's laser scan and photos, then build it and check it in the game.
---

# Modelling a real building for tbana

Axel knows these buildings in real life. A model built from memory or guesswork gets rejected, so research comes first, every time. Use all three sources below before writing any geometry: Google's 3D mesh, the laser scan, and photos.

## 1. Research

### Google's 3D mesh: shape, proportions, colours, facade pattern

`npm run google-mesh -- <x0,z0,x1,z1> <out> --frame <x,z,turn,length,depth>` (tools/google-mesh.ts) cuts Google's photorealistic mesh to a world box and writes:
- `<out>.glb`, in world coordinates and textured
- a top view and a height map of the top view
- the building's four sides seen straight on, at 0.05 m per pixel, with only what stands inside the frame (so make the frame just bigger than the building, or a neighbour in it hides it). These are the best reference for its facades
- a profile across the building in 1 m slices

Read the side views and the top view with the Read tool.

Where the mesh comes from:
- **Axel's download of Google Earth's mesh (preferred).** It is on his computer at `C:\Users\axele\hobby\sthlm\downloaded_files\web\central-20-1015`: central Stockholm at level 20, with about 0.1 m texels. Its heights match the laser scan to 0.1–0.3 m at Hötorget, but not everywhere: at Kungstornen they sit 2.8 m low. Read heights relative to the street beside the building (the profile prints the ground), and check the absolute ones against the laser scan.
  - On his computer the tool finds it by itself, through `../sthlm`.
  - From a cloud session, stage `tileset.json` with the remote-devices tools (folder `sthlm`, `~/mnt/sthlm/downloaded_files/web/central-20-1015/`). Then run the tool with `--dir <staged folder> --files` to list the node files the box needs, stage those (50 per call), and run it again with `--dir`.
- **Cesium ion (`--ion`, with `CESIUM_ION_TOKEN`, which the cloud sessions have).** This is the same mesh, but its heights are off by up to 2.5 m, and by different amounts in different places. Use it for shape and looks only, never for heights.

Licence: the mesh and every picture of it stay local, in `.google/` (git ignores it) or the scratchpad. Never commit them, and never attach them to a PR. The repo keeps only the numbers read from them; shapes are built by hand and textures are drawn in code.

### Lantmäteriet's laser scan: heights and outlines

The laser scan is the ground truth for geometry: Laserdata Nedladdning, skog, CC BY 4.0, heights in RH 2000.
- Run `npm run laser-points -- <x0,z0,x1,z1> <out> --frame <x,z,turn,length,depth>` (tools/laser-points.ts). It writes a height map and prints the same 1 m profile as google-mesh, so the two can be compared line by line.
- It uses the `LM_USER`/`LM_PASSWORD` login, like fetch-laser.
- In a cloud session the proxy logs in, but Node has to be told to use the proxy: `NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt`.
- Points within about 0.5 m of a wall are sparse, so edges read about 0.3 m short.
- `data/laser/buildings.json` already has eaves and roof heights per OSM id.
- OpenStreetMap heights are often wrong: the Hötorget towers are tagged 72 m but are 61 m. OSM outlines can be 1–2 m off.

### Photos and written sources: materials, details, signs

- Read Swedish and English Wikipedia and the architect's or owner's pages for the architect, the year, the materials and the colours.
- Find photos on Wikimedia Commons. The API needs a User-Agent header, or it returns 429.
  - List a category: `https://commons.wikimedia.org/w/api.php?action=query&list=categorymembers&cmtitle=Category:<name>&cmlimit=200&format=json`.
  - Fetch thumbnails at `Special:FilePath/<file>?width=1000`, one at a time with a 1.5 s pause between them.
  - Look at five or more photos, from all sides: the gables, the top, the ground floor, colours, signs and numbers.
- Never commit photos.
- Mapillary facade textures were tried and rejected ("looks terrible"); only its wall colours are used.

## 2. Build it in src/detail/

- **The landmark file.** It exports a build function `(B: Builder) => void` that works in the building's own frame. Call `B.place(at, turn)` first and `B.place([0, 0, 0], 0)` last.
- **Registering it.** Add it to `LANDMARKS` in src/detail/index.ts, with its outline in world x, z. The city block whose centroid lies inside that outline is replaced.
- **Measurements.** Put them as data at the top of the file, with a comment naming each source (laser scan, Google mesh, photos).
- **Textures.** All are procedural canvases in src/textures.ts; the repo ships no image assets.
- **Glass.** It must reflect the sky: use `paintGlass`, and draw panes untinted. Never black glass.
- **Materials.** Make per-building materials with `addMaterial(key, () => standard(...))` from src/detail/materials.ts.
- **Triangle budget.** Keep a landmark to a few thousand triangles. Generated facades cost about 25 triangles per window.
- **Blocks of several buildings or storeys stepping back.** Describe them as boxes in the building's frame, each with a top height and a look for its walls, and let the code draw only the walls that show (src/detail/pub.ts). Read the boxes off a 2 m grid of the laser scan's heights in that frame.
- **Where the walls stand.** Take them from the laser scan, not OSM: PUB's outline was 1–2 m short on two sides.

## 3. Check it in the game

- Take screenshots with `npm run shot -- <file.png> <x,y,z,yaw,pitch> [more pairs] --before`. It starts the dev server and writes `<file>-before.png` without the detail (`?nodetail`). Forward is (−sin yaw, 0, −cos yaw).
- Shoot from the viewpoints of the reference photos and of the Google side views, and compare them side by side before showing Axel. `--google <glb>` renders the mesh from google-mesh from the same cameras, as `<file>-google.png`, for a like-for-like comparison (local only, like the mesh).
- To find what to fix next in an area, compare each city block's height with the mesh's and the laser scan's over its outline. A block that is only the wrong height needs no landmark: its OpenStreetMap tags are usually wrong (too few levels make tools/build-city.ts doubt the laser scan). Fix them in `data/building-corrections.json` with the reason, and run `npm run build-city`.
- Put the screenshots in /mnt/project-files/<area>-pilot/ and attach them to the reply. Game screenshots are fine to share; Google pictures are not.

## 4. Ship it

- Run `npm run build`, which includes the typecheck.
- Open the PR in the repo's Before/After/How style.
- In the reply, say what the research found that changed the model, and link the reference photos' Commons pages.
