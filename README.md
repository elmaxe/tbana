# T-Centralen Walk

![Blue line platform](screenshot.png)

A first-person walk through **T-Centralen / Stockholm City / Stockholm C**, running in the browser
with [three.js](https://threejs.org/). It is built on Albert Guillaumes' 3D drawing of the station
from [Stations and transfers](http://stations.albertguillaumes.cat/).

## Run it

It's a static site with no build step. three.js is loaded from a CDN through an import map. Serve
the folder with any static server and open it:

```sh
npx serve .            # or: python3 -m http.server 8000
```

Then open the printed URL, for example http://localhost:3000. Opening `index.html` straight from
disk (`file://`) won't work, because browsers block loading the model that way.

## Controls

| Key | Action |
| --- | --- |
| `W A S D` / arrows | Walk (`Shift` to run) |
| Mouse | Look (click the view to capture the mouse, `Esc` to pause) |
| `E` / `Q` | Ride a lift up / down (stand next to a light-blue shaft) |
| `1`–`9` | Jump to a platform |
| `M` | Full map |
| `F` | Free flight (`Space` / `C` to rise and sink) |
| `R` | Back to the start |
| `N` | Sound on/off |

On touch devices, drag on the left half of the screen to walk and on the right half to look. The
buttons on the right are for lifts, the map and flight.

## What's generated

The source model is a diagram: extruded floor slabs, stairs, escalators and lift shafts, ticket
gates and tracks, identified by colour. `src/station.js` reads it and adds:

- **Walkable surfaces**: floors, stairs and escalators, indexed in an XZ grid
  (`src/surface-index.js`). Collision is simply "is there floor within a step of where you're
  going".
- **Walls, glass railings and platform edges**, generated along every slab outline. Each edge is
  probed to see whether it continues into another surface, overlooks a lower level, or faces a
  track. The blue line platform gets the blue vines on white rock that T-Centralen is known for.
- **Tracks**: each track ribbon's centre line is recovered and shifted to meet its platform edge,
  then given a track bed, rails, tunnels and a back wall.
- **Trains** (`src/trains.js`) on the blue, red and green metro lines and the pendeltåg. They arrive,
  dwell with a door chime and leave. Departure boards and the HUD show the next trains.
- **Lifts**: each shaft links the floors next to it.
- A **minimap** rendered once from above.

Model axes: +x is roughly east and +z roughly south. Destinations are picked from the direction of
travel.

## Credits

Station geometry: 3D drawing of T-Centralen / Stockholm City / Stockholm C © Albert Guillaumes,
[stations.albertguillaumes.cat](http://stations.albertguillaumes.cat/), converted unchanged from the
site's `t-centralen.gltf` to `assets/t-centralen.glb`. The drawing is his work. Ask him before you
publish or redistribute this project.
