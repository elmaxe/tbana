# Street-level photos from Mapillary

The city's buildings have their heights and roofs from Lantmäteriet's laser scan
(`tools/fetch-laser.ts`, see the README), but their walls were drawn from OSM's tags or guessed:
colour, material, windows. Street-level photos can tell them. The first step, the walls' colours,
is built (`tools/fetch-mapillary.ts`, see the README and [What's built](#whats-built)); the rest
are notes for whoever picks it up. Written in October 2026.

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

## The API

- Images in a box: `GET https://graph.mapillary.com/images?bbox=<minLon>,<minLat>,<maxLon>,<maxLat>&fields=…&limit=…`.
  The box must be under 0.01 square degrees. **It isn't complete:** where there are many photos it
  returns some of them, and a smaller box inside it can return more (tried over Gamla stan: a box
  gave 103 photos, its four quarters 327 between them). So the tool finds the photos in the
  coverage tiles instead, and asks for their cameras by id (`images?image_ids=a,b,…`, 50 at a time).
- Useful fields: `computed_geometry` (the camera's position after Mapillary's own
  structure-from-motion, better than `geometry`, the GPS), `computed_compass_angle`,
  `computed_rotation`, `camera_type` (perspective, fisheye, spherical), `camera_parameters`
  (focal length, distortion), `captured_at`, `sequence`, `thumb_1024_url` / `thumb_2048_url`
  (the image), `sfm_cluster` (a link to the reconstruction's points for that sequence).
- Coverage: the vector tiles at
  `https://tiles.mapillary.com/maps/vtp/mly1_public/2/{z}/{x}/{y}?access_token=…`. At zoom 14 the
  layer `image` has every photo as a point, with `id`, `captured_at`, `compass_angle`,
  `sequence_id` and `is_pano`; a tile over the inner city is 2–4 MB.
- `computed_rotation` is OpenSfM's: an axis-angle vector turning east, north, up into the camera's
  x right, y down, z forward (checked: the camera's forward axis is `computed_compass_angle` to
  within 10⁻¹¹°). `camera_parameters` are OpenSfM's focal length (a fraction of the photo's longer
  side) and k1, k2, for perspective and fisheye cameras. The thumbnails are in the photo's own
  orientation, as the reconstruction is, even where that's upside down.
- Segmentation: `GET https://graph.mapillary.com/<id>/detections?fields=value,geometry` gives what
  Mapillary's own segmentation found in the photo (`construction--structure--building`,
  `nature--sky`, `nature--vegetation`, `object--vehicle--car`, `construction--structure--tunnel`,
  …), each a base64 vector tile of polygons over the photo (y down). It is about 30 kB a photo.
  Many photos have only a few objects detected (signs, lights) and no segmentation.

## What's built

**Wall colours** (`tools/fetch-mapillary.ts`, its header says how). For each building it finds
photos in front of its walls, projects a grid of points on the wall into each with the camera's
pose and lens, and takes the commonest colour of the pixels there that Mapillary's segmentation
calls building. `build-city` takes it where OSM gives no `building:colour`, and the game draws it
as it is, where it tones OSM's colours down (they are names or bright swatches).

What was learned getting there:

- Without the segmentation, the pixels at the wall's points are as often trees, shop signs,
  awnings, a bus shelter, the sky over a lower roof, or a road tunnel's wall (a photo taken in a
  tunnel under the building). Filtering pixels by colour (green for leaves, blue for sky) doesn't
  get rid of them. With it, the colours match the photos when looked at side by side.
- Against OSM's `building:colour` (where it is a hex colour, ~50 buildings in the inner city) the
  measured colours are a median ΔE of about 23 away: darker (photos of walls are exposed for the
  sky, and many walls are in shade) and greyer (overcast light, haze). A fitted correction
  (lightness and chroma in L\*a\*b\*) brings that to about 18, but no better than giving every
  building the same median colour, so OSM's swatches aren't a good enough check to calibrate on,
  and none is applied. Looked at against the photos, many of the large differences are OSM's
  (a building tagged brown that is pale, one tagged grey that is pink).
- Many buildings get no colour: they are in courtyards, behind others, or seen by too few
  segmented photos.

## What could be done next

1. **A better reference.** Exposure and white balance differ from photo to photo, and the
   median of a few photos only partly evens them out. The pavement or the road in the same photo
   (segmented, and grey) could be taken as each photo's white.
2. **Wall material.** Classify the same patches as plaster, brick, wood, glass or plain (the
   `WallStyle`s the game draws) where OSM gives no `building:material`.
3. **Storeys and windows.** Count the rows of windows on a wall to check the scan's eaves against
   the storeys, or to place the game's window texture at the right spacing.

## Tried and dropped: facade textures

Cutting each wall's own image out of the photos and laying it on the wall was tried in October
2026 for a test area round T-Centralen and Gamla stan (up to three photos within 45° of square on,
straightened at 10 cm a pixel, masked by the segmentation, packed into a JPEG atlas per city
tile). It was dropped because it looked worse than the plain colours:

- Few walls are seen square on: 723 of about 16,700 at least 4 m long (about 4%). A textured
  wall next to plain ones stands out.
- Slanted photos smear the wall; in narrow lanes they take in what's past the corner, which the
  segmentation also calls building. Gamla stan's lanes can't be seen square on at all.
- Light, cars, trees and the tops of tall walls (out of the photo) leave patches and seams.

The code is in the history of PR #22 (commit fad097c) for whoever wants to look again.

## Things learned from the laser work that apply here

- World coordinates are metres on SWEREF 99 18 00 around a fixed origin (`src/geo.ts`):
  `lonLatToWorld` turns Mapillary's longitude and latitude into them, and the ground's height is
  in `data/ground/` (RH 2000; Mapillary's altitudes are GPS heights, not RH 2000, so the camera's
  height is better taken as the ground's plus about 2.5 m).
- Work through the city in blocks, keep each block's results in `node_modules/.cache/`, and write
  the results as a plain data file under `data/` that `build-city` reads if it is there, so the
  city still builds without it (as `data/laser/buildings.json`).
- Measure the result against what's known: OSM's `building:colour` and `building:material` where
  given are the check, as OSM's `height` and `roof:shape` were for the laser. (For the colours
  that check turned out weak, above: look at the photos too.)
