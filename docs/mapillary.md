# Street-level photos from Mapillary: notes for the next step

The city's buildings have their heights and roofs from Lantmäteriet's laser scan
(`tools/fetch-laser.ts`, see the README), but their walls are still drawn from OSM's tags or
guessed: colour, material, windows. Street-level photos could tell them. These are notes for
whoever picks that up. Nothing here is built yet. Written in October 2026.

## Why Mapillary and not Google Street View

Google's Maps Platform terms forbid making 3D models or photogrammetry from Street View, and
downloading its images in bulk, commercial or not, and published or not. Mapillary's photos are
crowd-sourced under **CC BY-SA 4.0**, which allows derived data: the game must then credit
"Mapillary and its contributors, CC BY-SA 4.0" alongside Lantmäteriet and OSM (the city's
`index.json` `attribution` list, which `build-city` writes). Whether CC BY-SA's share-alike reaches
the city tiles built from it should be checked before publishing.

## Access

- A free account at mapillary.com, then the developer dashboard
  (https://www.mapillary.com/dashboard/developers): register an application (read access is
  enough) and copy its **client token** (`MLY|…`). It is sent as `access_token`.
- In the cloud environment, store it as the environment variable **`MAPILLARY_TOKEN`** (the
  environment's settings, not the chat); a new session picks it up. Tools should read it from
  there, as the Lantmäteriet tools read `LM_USER` and `LM_PASSWORD`.
- `graph.mapillary.com` is reachable from the environment: without a token it answers
  `Invalid OAuth 2.0 Access Token` (code 190).
- As in the other tools, Node's `fetch` needs `NODE_USE_ENV_PROXY=1` behind the environment's
  proxy.

## The API (from its documentation; check before relying on it)

- Images in a box: `GET https://graph.mapillary.com/images?bbox=<minLon>,<minLat>,<maxLon>,<maxLat>&fields=…&limit=…`.
  The box must be small (a few hundred metres), so the city has to be tiled.
- Useful fields: `computed_geometry` (the camera's position after Mapillary's own
  structure-from-motion, better than `geometry`, the GPS), `computed_compass_angle`,
  `computed_rotation`, `camera_type` (perspective, fisheye, spherical), `camera_parameters`
  (focal length, distortion), `captured_at`, `sequence`, `thumb_1024_url` / `thumb_2048_url`
  (the image), `sfm_cluster` (a link to the reconstruction's points for that sequence).
- Coverage, for choosing where to look: the vector tiles at
  `https://tiles.mapillary.com/maps/vtp/mly1_public/2/{z}/{x}/{y}?access_token=…`.

## What could be done with it

Roughly in order of effort and payoff:

1. **Wall colours.** For each building OSM gives no `building:colour`, find photos within ~50 m
   whose camera faces one of its walls, project the wall's middle (from its outline, ground and
   eaves, all known now) into the photo with the camera's pose and parameters, and take the
   median colour of a patch there. Several photos per wall outvote cars, trees and shadows. The
   result goes where `build-city` takes `building:colour` (the tile format already carries a
   wall colour per building, `colour` in `src/city-tile.ts`).
2. **Wall material.** Classify the same patches as plaster, brick, wood, glass or plain (the
   `WallStyle`s the game draws) where OSM gives no `building:material`.
3. **Storeys and windows.** Count the rows of windows on a wall to check the scan's eaves against
   the storeys, or to place the game's window texture at the right spacing.
4. **Facade textures.** Cutting the walls' own images out of the photos and laying them on the
   walls, as the aerial photos are laid on the roofs. Much harder (occlusion by trees and cars,
   perspective, uneven coverage), and the texture data would be large.

## Things learned from the laser work that apply here

- World coordinates are metres on SWEREF 99 18 00 around a fixed origin (`src/geo.ts`):
  `lonLatToWorld` turns Mapillary's longitude and latitude into them, and the ground's height is
  in `data/ground/` (RH 2000; Mapillary's altitudes are GPS heights, not RH 2000, so the camera's
  height is better taken as the ground's plus about 2.5 m).
- Work through the city in blocks, keep each block's results in `node_modules/.cache/`, and write
  the results as a plain data file under `data/` that `build-city` reads if it is there, so the
  city still builds without it (as `data/laser/buildings.json`).
- Measure the result against what's known: OSM's `building:colour` and `building:material` where
  given are the check, as OSM's `height` and `roof:shape` were for the laser.
