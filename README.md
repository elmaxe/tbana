# T-Centralen Walk

![Blue line platform](screenshot.png)

A first-person walk through **T-Centralen / Stockholm City / Stockholm C**, running in the browser
with [three.js](https://threejs.org/). It is built on Albert Guillaumes' 3D drawing of the station
from [Stations and transfers](http://stations.albertguillaumes.cat/).

**Play it online:** https://elmaxe.github.io/tbana/

## Run it

It's written in TypeScript and built with [Vite](https://vite.dev/). You need Node.js 20 or newer:

```sh
npm install
npm run dev            # dev server with hot reload, e.g. http://localhost:5173
npm run build          # type-check, then build the static site into dist/
npm run typecheck      # type-check only
```

`npm run preview` serves the built `dist/`. The station model is in `public/assets/` and is copied
into the build unchanged.

## Controls

| Key | Action |
| --- | --- |
| `W A S D` / arrows | Walk (`Shift` to run) |
| Mouse | Look (click the view to capture the mouse, `Esc` to pause) |
| `E` / `Q` | Ride a lift up / down (stand next to a light-blue shaft) |
| Walk through an open door | Board a metro train and ride it |
| `1`–`9` | Jump to a platform |
| `M` | Full map |
| `F` | Free flight (`Space` / `C` to rise and sink) |
| `R` | Back to the start |
| `N` | Sound on/off |

### Phones and tablets

Touch controls switch on automatically:

- **Left half:** drag to walk. Push the stick all the way to run.
- **Right half:** drag to look around. You can walk and look at the same time with two fingers.
- **Lift ▲ / Lift ▼** buttons appear when you stand next to a lift shaft.
- **⇡ / ⇣** appear in free flight.
- **Map** opens the full map, and so does tapping the minimap.
- Board a train by walking through an open door, as on a computer.
- **☰** opens the menu and the list of platforms to jump to.

On Android the game goes fullscreen in landscape when you start. On iPhone, turn the phone sideways
for the widest view. If the frame rate is low, the render resolution drops automatically.

### Riding the trains

Metro trains open their doors on the platform side a moment after they stop, and close them
after a chime before they leave. Walk in through an open door and you ride along: you can walk
through the car and, on the C30 and between the sections of a C20, into the next car. If you are
standing in a doorway when the doors close, you step inside or back onto the platform.

The model ends a little way into the tunnels. When your train gets there the screen goes dark for
the trip to the next station and back, and you arrive at T-Centralen again in the same spot of a
train coming in on the other track of the line. Seats don't block you, and the pendeltåg can't be
boarded.

## Deployment

`.github/workflows/pages.yml` publishes the site to GitHub Pages. It needs Pages to be switched on
once: **Settings → Pages → Build and deployment → Source: GitHub Actions**.

Every deploy rebuilds the whole site with `.github/scripts/assemble-site.sh`:

- `main` is at the root, https://elmaxe.github.io/tbana/.
- Every open pull request from this repository is at `pr/<number>/`, for example
  https://elmaxe.github.io/tbana/pr/3/. The workflow comments the link on the PR. Pushes to the PR
  redeploy it, and closing the PR takes it down. PRs from forks are not deployed, because their
  code would run on this site.
- The workflow always runs from `main`, and so do the build tools: a PR's files are compiled and
  bundled by `main`'s Vite and `vite.config.ts`, never run during the build. A PR that changes the
  build setup or adds packages is previewed with `main`'s setup until it is merged.

`.github/workflows/ci.yml` type-checks and builds every push and pull request.

The **Build** menu, on the start/pause screen and in the train viewer's panel, switches between
`main` and the PR builds and keeps you on the same page. It reads `builds.json` at the site root and
`build.json` in each build, which the workflow writes, so it doesn't show when you run the site
locally.

## What's generated

The source model is a diagram: extruded floor slabs, stairs, escalators and lift shafts, ticket
gates and tracks, identified by colour. `src/station.ts` reads it and adds:

- **Walkable surfaces**: floors, stairs and escalators, indexed in an XZ grid
  (`src/surface-index.ts`). Collision is simply "is there floor within a step of where you're
  going".
- **Walls, glass railings and platform edges**, generated along every slab outline. Each edge is
  probed to see whether it continues into another surface, overlooks a lower level, or faces a
  track. The blue line platform gets the blue vines on white rock that T-Centralen is known for.
- **Tracks**: each track ribbon's centre line is recovered and shifted to meet its platform edge,
  then given a track bed, rails, tunnels and a back wall.
- **Trains** (`src/trains.ts`) on the blue, red and green metro lines and the pendeltåg. They arrive,
  open their doors on the platform side, chime, close them and leave, and you can ride the metro
  trains. Departure boards and the HUD show the next trains. The red line runs C30 trains and the
  blue and green lines run C20s (see below). The pendeltåg are still plain boxes.
- **Lifts**: each shaft links the floors next to it.
- A **minimap** rendered once from above.

Destinations are picked from the direction of travel.

## World coordinates

The game is laid out on the real map, so that the rest of the network can be added around
T-Centralen (see [`docs/red-line-plan.md`](docs/red-line-plan.md)). World coordinates are metres on
SWEREF 99 18 00, the Stockholm zone of Sweden's national grid, around an origin at T-Centralen
(`src/geo.ts`):

- +x is east and +z is south (grid north is within 0.1° of true north here).
- y is the height above sea level in RH 2000. The station drawing is already drawn in those heights:
  the blue line platform is at −24 m, and the Stockholm C tracks are at +6 m.

`public/data/stations.json` says where each station model sits on that grid. The tools that make
it run on Node's built-in TypeScript support:

```sh
npm run fetch-osm -- t-centralen    # OpenStreetMap tracks and platforms -> data/osm/t-centralen.json
npm run fit-station -- t-centralen  # fit the model's tracks onto them -> public/data/stations.json
```

`fit-station` turns and moves the model in plan until its tracks lie on the OpenStreetMap tracks,
matching each line only to the same line. It prints how far apart they are: for T-Centralen the
median along the platforms is 0.8 m, and 90% are within 2 m. The tunnel ends of the drawing are
sketched, so they can be 20–40 m off.

### The track graph

`public/data/track-graph.json` holds the whole metro's track network from OpenStreetMap, with the
red line services traced through it. The format is in `src/track-graph.ts`. The game doesn't use
it yet.

```sh
npm run fetch-osm -- network      # every metro track, switch, platform and station -> data/osm/network.json
npm run build-track-graph         # -> public/data/track-graph.json
npm run plot-graph -- Slussen 400 slussen.svg   # draw part of it, to check by eye
```

`build-track-graph` does the following:

- It cuts the tracks into pieces at switches, ends and tunnel mouths.
- It works out which pairs of tracks each switch connects.
- It matches the platforms to the tracks beside them.
- It traces T13 and T14 in both directions (`data/routes.json`), stopping at every platform,
  never reversing, and keeping to the left-hand track.

The build fails if a service can't be traced. `DEBUG=1` lists stations with only one platform
track, and stretches where a service runs on the right-hand track.

OpenStreetMap is sketchy in the tunnels, so a few fixes are kept in `data/track-corrections.json`,
each with its reason:

- a missing crossover at Mörby centrum
- the missing platform at Norsborg
- island platforms drawn on the wrong side of a track at Danderyds sjukhus and Aspudden

[Gleisplanweb's track plan](https://www.gleisplanweb.eu/) was the reference for these. It is
only a reference, because its licence doesn't allow reuse.

### Track heights

`public/data/track-heights.json` gives the height of the top of the rail (RH 2000) along every
piece of track the red line services run on.

```sh
npm run fetch-station-heights    # Wikidata station heights -> data/station-heights.json
LM_USER=… LM_PASSWORD=… npm run fetch-ground   # ground under the tracks -> data/ground/red-line.json
npm run build-heights            # -> public/data/track-heights.json, and the check
npm run plot-profile -- "T13 Norsborg" t13.svg  # side view of a service
```

`build-heights` fits the smoothest line through these anchors:

- **Stations:** 1 m below their height from Wikidata, which is taken to be the platform's level.
- **T-Centralen:** its platforms in the station model.
- **Surface track:** the ground from Lantmäteriet's 1 m elevation model.

It keeps tunnels at least 6 m under the ground away from their mouths. It then checks the result
against the 1975 limits for the red line: 40‰, 10‰ along platforms, and vertical curves of at
least 2,000 m. It fails on anything outside them.

`fetch-ground` needs a free Geotorget account at Lantmäteriet, given as `LM_USER` and
`LM_PASSWORD`.

## Train models

![C30 and C20](trains.jpg)

`trains.html` is a viewer for procedural 3D models of the metro's two current train types, the
**C20** (1997–2004, corrugated stainless steel) and the **C30** (MOVIA, in service since 2020).

- It shows one unit or a full 140 m train.
- It has front, side, bogie and inside views. WASD walks the camera through the cars.
- **Doors** opens and closes the sliding doors.
- A cutaway takes the roof off to show the seat layout.
- It can download the model as `.glb`.

Open it at https://elmaxe.github.io/tbana/trains.html, or locally at `/trains.html`.

![C30, upgraded C20 and original C20 interiors](interiors.jpg)

The models include the passenger interiors: seats, poles and rails, lighting, screens, doors,
cab bulkheads and the open gangways, and you can see them through the windows. The C20 comes
with its current interior from the 2020–2024 upgrade, or the original 1997 one with Lasse
Åberg's moquette (`interiorStyle: 'original'`). In the station, interiors are drawn only for cars
near the player.

The models are built in code (`src/rolling-stock/`) from real dimensions, door and seat layouts,
liveries and fabrics. Research notes and sources are in
[`docs/rolling-stock.md`](docs/rolling-stock.md).

```ts
import { createTrain } from './src/rolling-stock';
const train = createTrain('C30', { destination: 'Norsborg' }); // two units, 140 m
scene.add(train.group);
train.setInterior(false); // exterior only; cars also have car.setInterior(on)
train.setDoors(1, 0);     // open the doors (0–1) on both sides; 1 / -1 for one side only
const c20 = createTrain('C20', { interiorStyle: 'original' }); // the 1997 interior
```

## Credits

Station geometry: 3D drawing of T-Centralen / Stockholm City / Stockholm C © Albert Guillaumes,
[stations.albertguillaumes.cat](http://stations.albertguillaumes.cat/), converted unchanged from the
site's `t-centralen.gltf` to `assets/t-centralen.glb`. The drawing is his work. Ask him before you
publish or redistribute this project.

Map data: © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors, under the Open
Database License (`data/osm/`, and the placements derived from it in `public/data/`).
