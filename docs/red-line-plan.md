# Plan: the red line first

The working plan for growing the game from T-Centralen to the whole network, starting with the red
line. The sources behind it are in [`network-sources.md`](network-sources.md).

The first goal is to ride a real red line tunnel from T-Centralen to Östermalmstorg, instead of the
fade to black the game uses today. After that the line grows station by station to all 36 red line
stations.

## Why the red line

- It already runs in the game, from the T-Centralen platform, with C30 trains.
- 35 of its 36 stations have a height above sea level on Wikidata (P2044). The one without is
  T-Centralen, and we have its model.
- It has every kind of track we will meet later: deep rock tunnel, shallow tunnel, bridges
  (Gamla stan–Slussen, Liljeholmen) and long surface stretches towards Norsborg.

| Part | Stations |
| --- | --- |
| Shared trunk (8) | Östermalmstorg, T-Centralen, Gamla stan, Slussen, Mariatorget, Zinkensdamm, Hornstull, Liljeholmen |
| T13 north (3) | Karlaplan, Gärdet, Ropsten |
| T14 north (6) | Stadion, Tekniska högskolan, Universitetet, Bergshamra, Danderyds sjukhus, Mörby centrum |
| T14 south (5) | Midsommarkransen, Telefonplan, Hägerstensåsen, Västertorp, Fruängen |
| T13 south (14) | Aspudden, Örnsberg, Axelsberg, Mälarhöjden, Bredäng, Sätra, Skärholmen, Vårberg, Vårby gård, Masmo, Fittja, Alby, Hallunda, Norsborg |

## Stations are built from descriptions

Albert Guillaumes publishes downloadable 3D files (`3d/<name>.gltf`, listed in the site's
`js/dades.js`) for only three Stockholm stations: T-Centralen, Odenplan and Fridhemsplan. For the
other stations he publishes flat drawings, for example
`http://estacions.albertguillaumes.cat/img/estocolm/mariatorget.png`. So the red line stations are
built by our own code from a short description per station. The references for each description
are:

- his drawing
- the OpenStreetMap platforms
- the published height

## Phases

Each phase ends in a pull request with a playable preview.

1. **Shared coordinates.** *Done.*
   - The game is in metres on SWEREF 99 18 00 (EPSG:3011), with the origin at T-Centralen, +x east
     and +z south as before. Heights are RH 2000. This is the Stockholm zone rather than SWEREF 99
     TM: grid north is true north here, a grid metre is a ground metre, and the Nya tunnelbanan
     drawings use it. `src/geo.ts` also converts to SWEREF 99 TM for Lantmäteriet's data.
   - `tools/fit-station.ts` fits the T-Centralen model onto the OpenStreetMap tracks
     (`tools/fetch-osm.ts`). The result is a 0.14° turn and a shift of a few decimetres, in
     `public/data/stations.json`. The scale check is 1.0007, so the drawing is in metres.
   - Along the platforms the model's tracks are a median 0.8 m from OSM, and 90% are within 2 m.
     Red and green are best (0.7 m), blue is worst (1.4 m). The tunnel ends of the drawing are
     sketched and part from OSM by up to 40 m, so phase 2 must not take track geometry from them.
   - The drawing's heights are kept as drawn. They look like RH 2000:
     - The blue line is at −24 m, between Rådhuset at −20.5 m and Kungsträdgården at −29.3 m.
     - The Stockholm C tracks are at +6 m.
2. **Track data tools.** *Done.*
   - `tools/fetch-osm.ts network` downloads every metro track with its nodes, the switches,
     platforms (ways and multipolygons), stations, entrances and route relations.
   - `tools/build-track-graph.ts` writes `public/data/track-graph.json` (format in
     `src/track-graph.ts`). The network has 1,743 pieces and 304 km of track: 220 km of running
     line and 179 km in tunnel.
     - Pieces are cut at switches, ends and tunnel mouths and bridge ends ("portals", which phase
       3 needs).
     - It finds 608 switches. Only 385 are tagged in OSM, so switches come from where the track
       branches.
     - At each switch, two tracks connect if they leave it at more than 110° to each other.
   - Platforms are matched to the tracks running beside them.
   - T13 and T14 are traced in both directions with a Dijkstra search that keeps every way of
     standing at each station, so a cheap arrival can't strand the route. The trains never
     reverse, prefer their own line's running lines, and keep left: on double track the other
     track must be on the train's right.
   - Results:
     - T13 Norsborg–Ropsten is 26.9 km and T14 Fruängen–Mörby centrum is 19.1 km.
     - All four directions stop at all their stations, and none use a crossover or siding.
     - Every station's platform is on the train's right, except at Slussen and Gamla stan
       (where the red tracks run between the green ones) and Liljeholmen northbound on T14 (a
       five-track station).
     - The services run on the right-hand track for only three short stretches (52–151 m), at
       the junctions near Liljeholmen and Östermalmstorg and at Ropsten. There the "other
       track" check is ambiguous.
   - OSM fixes, in `data/track-corrections.json`, checked against Gleisplanweb:
     - The crossover south of Mörby centrum was missing, so one direction ran 9.4 km on the
       wrong track.
     - Norsborg has no platform mapped.
     - At Danderyds sjukhus and Aspudden, the island platform is drawn outside one of the
       tracks, and at Aspudden the other track is 25 m away.
   - `tools/plot-graph.ts` draws any part of the graph with the traced services, for checking.
   - Still open:
     - Track geometry in the tunnels is OSM's sketch: Mörby's two tracks are 30 m apart.
       Phase 4 smooths it and spaces the tracks as built.
     - The graph has the whole network, but only the red line is traced and checked.
3. **Heights.** *Done.*
   - `tools/fetch-station-heights.ts` takes the stations' heights from Wikidata, matched by
     OSM's `wikidata` tag. 49 stations have one, including 35 of the red line's 36; T-Centralen
     doesn't.
   - `tools/fetch-ground.ts` samples Lantmäteriet's 1 m elevation model every 10 m under the
     services' tracks: 8,354 samples in `data/ground/red-line.json`.
     - The files (2.5 km squares) are found through Lantmäteriet's STAC catalogue, and only the
       needed blocks of each Cloud Optimized GeoTIFF are read.
     - The download server turns away (403) some requests when several arrive at once, so they go
       out three at a time, with retries.
   - `tools/build-heights.ts` cuts every piece into points about 10 m apart, joined at the nodes,
     and fits the smoothest line by least squares through these anchors:
     - Stations: 1.0 m below their Wikidata height, which is taken to be the platform level, and
       level along the platform. Without that, the fit tilted Gamla stan's and Slussen's platforms
       by up to 26‰ to meet the line between them.
     - T-Centralen: its platform tracks in the station model. The model's tunnel ends drop at
       up to 70‰ and are only sketched, so they are left out.
     - Surface track: 0.2 m above the ground, except the last 30 m to a bridge, which is
       embankment.
     - Bridges: carried across with no anchor.
   - Two limits are enforced by holding the line where it breaks them, and letting go where a
     hold no longer pushes, until nothing changes:
     - Tunnels: at least 6 m under the ground more than 120 m from a mouth. The ground is
       averaged over 25 m, so a tunnel may pass under a short dip (a channel, a road cutting)
       with less. Platforms are exempt.
     - Gradient: at most 37‰. Between two level stations the smoothest line is an S whose middle
       is half as steep again as the average: 45‰ from Östermalmstorg up to Stadion. A real line
       runs at an even grade between short vertical curves.
   - The solve is an exact sparse Cholesky (reverse Cuthill–McKee order), in under a second.
     Conjugate gradients didn't converge on the long, gentle sags under the lakes.
   - `data/height-corrections.json` fixes the inputs, each with its reason:
     - Gamla stan's Wikidata height (2.6 m) is the street. The ticket hall is under the tracks,
       and the elevation model shows the station deck at +7 to +7.5 m. The bridge to Slussen
       (platforms at 8 m, which Wikipedia puts 7–24 m under the ground) is then nearly level.
     - Riddarholmskanalen: the line runs in a trough built in the canal, with Centralbron resting
       on it, so it needs no cover under the water.
     - The 54 m of OSM surface track south of Gamla stan's platforms is still on the deck.
   - It then checks the result against the 1975 limits and fails on anything outside them, with
     the place.
   - `tools/plot-profile.ts` draws a service's side view.
   - Result: all four directions pass. Steepest 37.2‰ (near Östermalmstorg), tightest vertical
     curve 3.1 km (near Telefonplan). Surface track is within 0.8 m of the ground for 90% of its
     length. T-Centralen is on two levels: northbound red at −12.6 m, southbound at −5.1 m.
   - Tunnels under water follow OSM: Riddarholmskanalen, Liljeholmsviken (OSM has the line in
     tunnel there, not on a bridge) and Brunnsviken. The elevation model gives the water's
     surface, not the bottom, so their depth is only as good as the 6 m rule.
4. **Tunnels and track in the game.** *Done.*
   - The typical sections are from the 1952 and 1975 descriptions (in `src/sections.ts`):
     - Track centres are 3.15 m.
     - The double-track rock tunnel is 8.0 m wide, with walls to 3.2 m and the crown 4.6 m above
       the rails.
     - The single-track rock tunnel is 4.3 m wide (1975: 1.9 m on one side of the track, 2.4 m on
       the other), with its crown at 4.45 m.
     - The concrete box is 4.2 m high inside, with haunched corners.
     - The embankment's formation is 10.8 m wide, with 1:2 slopes. A double-track viaduct deck is
       8.4 m wide.
     - Track is concrete sleepers 2.4 m long at 0.741 m, with SJ50 rail.
     - The conductor rail is on the side away from the other track and from the platform, 1.40 m
       from the track centre and 0.1 m above the rails, under a wooden cover board.
     - Tunnel lights are every 10 m on alternate walls (every 7 m in single-track tunnels).
     - Neither description dimensions an open trough or the Söderström bridge, so those sizes
       are guesses.
   - `tools/build-track-geometry.ts` writes `public/data/track-geometry.json`.
     - It refits the plan by least squares: closely to OSM in the open and at platforms (median
       0.1 m), loosely in tunnels (median 3.5 m, 90% within 9 m), and onto the T-Centralen model
       at its platforms.
     - In tunnels, the two tracks of a line at the same level are pulled to 3.15 m apart, away
       from mouths and platforms they don't share. At an island platform they are pulled to the
       platform's width apart: Mörby centrum's 30 m becomes 14.6 m.
     - Tracks at different levels are held at least 7.5 m apart. These are T-Centralen's two
       levels on their way to Gamla stan and Östermalmstorg.
     - Curves are held at 310 m radius between points 10 m apart. Over 20 m the tightest is
       253 m (limit 250 m), near Hötorget.
     - Each point is classified:
       - tunnels: concrete box within 20 m of a mouth, in the Riddarholmskanalen trough, and
         where the rail is less than 12 m below the ground; rock elsewhere
       - open track: cutting more than 1.5 m below the ground, embankment more than 1 m above
         it, otherwise on the ground
       - bridges: bridge
     - The red line comes out as 47.1 km of rock tunnel, 13.4 km of box, 13.0 km on the ground,
       5.9 km of bridge, 0.6 km of embankment and 0.2 km of cutting.
     - 74% of the track shares its tunnel, bridge or bank with the other track.
   - `src/network.ts` sweeps the cross-sections along the line every 2.5 m (Catmull–Rom through
     the 10 m points):
     - ballast and sleepers, rails, the conductor rail and its cover
     - the tunnel, cutting walls, bank or bridge deck with piers
     - portals where a tunnel opens, and bulkheads where its section changes
     - a hall, platform, lights and name signs at stations other than T-Centralen
     Where two tracks share a structure, each draws its half.
   - Only the 200 m tiles within about 600 m of the camera are built, two per frame. The whole
     line is 258 tiles, about 2.4 million triangles, and takes 0.6 s to build. A tile takes
     2.3 ms (median).
   - `src/station-join.ts` joins T-Centralen to the network.
     - Each red platform track in the model is replaced by its service's line through the
       network, out to 140 m short of the next stop, blended from the model's track over 40 m.
     - The station draws the platform stretch, and the network leaves it out.
     - The trains now run in the real tunnels. A ride goes to the approach of Östermalmstorg or
       Gamla stan, then fades and comes back through the tunnel.
   - Done: you can fly from T-Centralen to Östermalmstorg through the real tunnel.
     `tools/plot-graph.ts` also draws the refitted track, coloured by structure.
   - Still open:
     - Where T-Centralen's two levels meet into one tunnel there are three places (near Hötorget,
       Östermalmstorg and Gamla stan). There the tracks are 4.4–4.8 m apart at 2–2.5 m different
       heights, so their tunnels cut into each other for a few tens of metres. The build lists
       them.
     - Crossovers, sidings and turnback tracks aren't drawn, because only the services' track has
       heights. Phase 8 draws them.
     - Seven platforms had no room beside their track as matched, mostly at junction stations,
       and weren't drawn. Phase 6 fixed this (see there).
     - There is no ground or city around the open stretches yet; that is phase 7. The network
       can't be walked on yet; that is phase 6.
5. **Trains on the network.** *Done.*
   - The timetable is in `data/routes.json`, and `build-track-graph` copies it into the graph:
     - T13 and T14 each run a train every 5 minutes each way.
     - They are timed at T-Centralen to alternate on the shared trunk, so from Liljeholmen to
       Östermalmstorg there is a train every 2.5 minutes each way.
   - `src/timetable.ts` runs each trip along its route's line from end to end:
     - The line runs on 220 m beyond the drawn track at each end. A trip comes in from there and
       stands 75 s at its first station with its doors open. It stops at every station and runs
       out beyond the last.
     - At every terminus the trains arrive on one track and leave from the other. The turnback
       tracks between aren't drawn, so the turn happens out of sight. (Phase 8: they turn where
       they stand.)
     - Trains run at up to 20 m/s (about 70 km/h) and accelerate and brake at 1 m/s².
     - They stand at least 22 s at each stop. The timetable allows 4 s more, so a late train
       catches up.
     - With nothing in the way, T13 runs 42.0 minutes from its first station to its last, and T14
       30.6 minutes. T-Centralen to Östermalmstorg is 81 s from the closing chime. 32 trips are
       out at once.
     - Trips that set off before the game started are run on, each on its own, to where the
       timetable has them.
   - Spacing works on the track graph's pieces, so trips on different routes see each other where
     they share track:
     - Each trip holds the stretch of track under it, and claims its braking distance and 60 m
       more ahead.
     - A trip stops 30 m short of the train ahead.
     - At a junction, the trip that would get there first goes first, and the other waits 15 m
       short of it.
   - Checked by simulating three hours:
     - On the timetable no train is ever held, and every train is within 1 s of its times.
     - Holding a train for 4 minutes at Slussen queues the trains behind it.
     - So does timing T13 and T14 to reach the junctions together.
     - In both cases no two trains come closer than 30 m, and nothing deadlocks.
   - Through T-Centralen the routes run on the model's tracks at its platforms
     (`src/station-join.ts`), so the trains stand at the model's platforms.
   - Only trips within 700 m of the player get a train model. Models come from a pool and go back
     to it beyond 900 m (`src/trains.ts`). A new one takes about 2 ms to build.
   - Riding goes from station to station without the fade:
     - The network's platforms can be walked on (`src/network.ts`), so you can get off, wait, and
       board the next train.
     - The HUD lists the next trains both ways, and the toasts announce the next station.
     - Beyond the last station the screen goes dark. You come back in the same car of the trip
       that leaves from there the other way.
   - The sky shows where the track runs in the open, by the structure under the player.
   - Done: you can board at T-Centralen, ride to Östermalmstorg and get off on its platform.
   - Still open:
     - The network's platforms led nowhere; phase 6 built the stations.
     - The cars' indicator screens always say "Nästa T-Centralen".
     - The blue and green lines and the pendeltåg still run in and out of T-Centralen's model
       tunnels.
6. **Stations, one at a time.** *Done.*
   - `data/station-descriptions.json` describes all 35 red line stations beyond T-Centralen, in
     the plan's order: Östermalmstorg, the trunk south to Liljeholmen, then the four branches.
     - Each is read from Albert Guillaumes' drawing of the station, as a reference only. The
       platforms come from the track geometry, so a description gives only the ways out.
     - A way out is a route of steps from a point on the platform: walk to a point, stairs or
       escalators up or down a given height, a lift, ticket gates, and an exit. Points are given
       in the station's own frame: metres along the platforms and across them.
     - An exit comes up at one of OpenStreetMap's subway entrances, at the height of the street
       there. Vårberg has no entrance in OSM, so its exit is placed by hand, and so are the lift
       up the hill at Gärdet and Västertorp's western exit, which OSM has under the track.
     - 75 exits, 95 flights of stairs and escalators (30 with escalators), 48 rows of ticket gates.
       The deepest is Östermalmstorg: two flights of escalators, 38 m from platform to street.
   - `tools/fetch-ground.ts entrances` samples Lantmäteriet's elevation model around the stations:
     - a 72 m square at 4 m around each of the 115 entrances near them, in
       `data/ground/entrances.json`
     - a 200 m square around each station, for exits OSM doesn't map
   - `tools/build-stations.ts` turns the descriptions into `public/data/station-layouts.json`
     (format in `src/station-layout.ts`):
     - level floors and ramps
     - stairs and escalators: stairs rise 0.16 in 0.30 m, escalators at 30°
     - lifts, ticket gates, signs at the exits, and the street around each group of exits
     - roofs over open platforms
     - the insides of the platform halls the network draws
   - It fails on anything that can't be built, with the place:
     - a ramp steeper than 8%, or stairs with no room before their point or their exit
     - anything in the trains' space: 1.5 m either side of a track, from the ballast to 4 m
       above the rails
     - a platform from which the street can't be walked to, or an exit that leads to no
       platform. This is checked on a 0.5 m grid with steps of up to 0.6 m, as the player walks.
   - `src/stations.ts` builds the stations in the game:
     - Walls aren't described. They stand wherever a floor ends without another floor beyond it
       that can be stepped onto, as in the T-Centralen model, so a passage opens wherever another
       one meets it. Where a room opens into a lower one, a lintel comes down to its ceiling.
     - Each part's open space is cut out of whatever it runs into (`src/clip.ts`, exact convex
       clipping). This is how a passage opens through a platform hall's wall and an escalator
       climbs through its vault, and how stairs go down through a platform or come up through
       the street. The network cuts the same volumes out of its tunnels, platforms and their
       floors, and nobody walks under a flight of stairs.
     - Stairs going down through a floor get a railing round the opening. Exits come up through
       the street with a parapet round them and the blue T on a pole.
   - Everything that can be walked on is indexed at load, in 130 ms for all 35 stations. A
     station's meshes are built when the camera comes within 700 m: 7 ms (median), 47 ms for
     Östermalmstorg, 131,000 triangles for all of them.
   - The platforms in `build-track-geometry` are now measured square to their track at each point
     along them, and the median taken. Before, they were measured from the middle of the platform
     only, so on a curve a track 60 m away looked as if it ran beside the platform. All the
     platforms are now drawn, including Slussen's, Ropsten's and Liljeholmen's, and island
     platforms are the same width from both tracks.
   - The menu can jump to any of the stations, and `?at=Mariatorget` starts on its platform.
   - Done: every station can be walked from platform to street. A flood fill with the player's
     own step rule, in the game, reaches every exit from the platform of every station. Gärdet's
     lift is reached by riding it.
   - Still open:
     - The layouts follow the drawings, but are simpler: one or two ways out, straight passages,
       and few lifts. Some of the exits OSM maps are left out: Götgatan and Medborgarplatsen at
       Slussen, Fatbursgatan at Mariatorget, the western ones at Liljeholmen, the far ones at
       Ropsten, Bergshamra's southern one, and one each at Alby, Hallunda, Telefonplan, Vårby gård
       and Danderyds sjukhus.
     - Where two exit passages leave a hall side by side, a thin wall stands between them.
     - Exits that come up on a slope stand partly out of the ground, like small entrance
       buildings.
     - The street is a square of ground 60 m across around the exits, with nothing on it; the
       city is phase 7.
7. **The surface.** *Done.*
   - Settled before starting: the city reaches everywhere in view, not just a few hundred metres
     round the open stretches; buildings are plain blocks with flat roofs for now, in a format
     with room for roofs, streets and water later; the other lines' tracks wait for phase 8.
   - The city covers the 500 m tiles that come within 1 km of the track (`tools/lib/city-area.ts`):
     396 tiles, 99 km².
   - `tools/fetch-terrain.ts` samples the elevation model every 5 m on the game's grid, 4 million
     points, from the 2 m overviews of Lantmäteriet's 10 km files (`dtm-cog` in the STAC
     catalogue), in four and a half minutes. Within a tile, the game's grid is mapped onto the
     model's (turned 2.6°) through its corners, to within a millimetre. The heights are stored
     as centimetre steps along each row, which halves them gzipped (4 MB). The login and the file
     search moved to `tools/lib/lantmateriet.ts`, shared with `fetch-ground`.
   - `tools/fetch-city.ts` takes the buildings from OpenStreetMap's extract of Stockholm county
     (openstreetmap.fr, 80 MB of PBF, read in three passes by `tools/lib/osm-pbf.ts` in 18 s)
     rather than Overpass, which this many buildings would overload (and which wasn't reachable).
     29,888 buildings and parts, 228 with courtyards.
   - `tools/build-city.ts` writes `public/data/city/` (format in `src/city-tile.ts`: gzipped
     binary, one file a tile, in tagged sections: `GRND` ground, `BLDG` buildings, `HOLE` holes
     through the ground; a reader skips sections it doesn't know). 5.3 MB in all.
   - The ground is shaped round the track from `track-geometry.json`, in 3 s for all of it:
     - Under open track it is lowered 0.4 m below the formation, flat for a metre beyond the
       structure (formation, platform, deck, cutting walls), then rises at 1:2 (1:1 behind a
       cutting's walls). 13,571 points are lowered. Those cells aren't walked on.
     - Over a tunnel it is kept 0.5 m above the crown, falling away at 1:1.5: 172 points are
       raised, near the mouths and over the troughs under water.
     - A tunnel whose ground the elevation model has below half its height is taken to be a
       short covered way, or one under a road bridge that the model leaves out (west of
       Telefonplan, a 40 m box under a road has the ground at rail level). It stands in the open,
       and the ground round it is lowered as for open track.
     - At the 72 mouths the tunnel's space, wall to wall and floor to crown, is cut out of the
       ground from 6 m inside to 8 m out, where the lowered ground meets the raised.
   - Buildings:
     - Walls from 0.5 m below the lowest ground under the outline up to the height above it:
       OSM's `height` (1,935) or `building:levels` at 3.1 m a storey plus a parapet (9,757). For
       the other 18,041, the median levels of the tagged blocks (apartments, offices, `yes`…)
       within 150 m, or a default for the sort: houses 1.7 storeys, sheds and garages 1.
     - Buildings stand at least 2.5 m above their highest ground.
     - 359 outlines with `building:part` inside are drawn as their parts.
     - 21 buildings stand over open track (station buildings at Telefonplan, Hägerstensåsen,
       Västertorp, Ropsten, Sätra centrum…): the part over the track's space is lifted to 5 m
       above the rails, or left out if nothing is left above. 3 roofs on posts over the platforms
       are left out.
     - 58 of the 75 exits come up inside or against a building in OSM, most of them station
       buildings. Where a station's stairs, lift or hall reaches the surface, its plan (and 0.6 m)
       is cut out of the buildings, and so is a way on from the exit, the width of the stairs,
       until it is outside every building. 75 buildings are cut.
     - Roof shapes, roof heights and colours from OSM are kept in the tiles. Until roofs are
       built, a pitched roof is drawn flat halfway up.
   - `src/city.ts` builds the tiles within 1.1 km of the camera (800 m on phones), nearest first,
     one a frame, and drops them beyond 1.5 km. About 25 tiles and 400,000 triangles are built at
     once; a tile takes 10 ms (median), 33 ms at most. Beyond 600 m the ground has every other
     point, with skirts at the tiles' edges over the cracks.
     - Facades are one window bay of one storey repeated, tinted per building from a palette of
       Stockholm's plaster colours, or OSM's colour. The ground is paved where buildings are
       close together, grass where they aren't, and gravel beside the track.
     - The stations' stairs, lifts and rooms are cut out of the ground (exactly, `src/clip.ts`),
       from 0.3 m under their floors.
     - The ground can be walked on, except beside open track, inside buildings that stand on it,
       and over the stations' openings. The street round the exits is still walked on, but not
       drawn, and not inside buildings.
     - Out in the open the fog thins to show about 1 km, and flying shows the sky.
   - The network, with the city:
     - It draws no ground of its own: the bank runs on 3 m down into the city's ground, the
       cutting's walls go down behind, and piers 3 m into the ground.
     - Tunnel mouths at the ends of the track graph's pieces (60 of the 72) had no portal; they
       now have one. Portals are headwalls, a rectangle 3 m beyond the walls and up to the ground.
   - Checked:
     - Screenshots at both ends of the Gamla stan–Slussen bridge, Liljeholmen, Hallunda,
       Mariatorget's and Östermalmstorg's streets, Stockholm C, and inside tunnels near mouths.
     - A flood fill from each of the 75 exits, with the player's step rule, reaches the city's
       ground from 74. Sätra's comes up into a street hemmed in by the shopping centre, the
       track and higher ground.
   - Done: the bridge from Gamla stan to Slussen shows the city around it, and so does
     Liljeholmen. In OSM (and so in the game), the line crosses Liljeholmsviken in a tunnel, not
     on a bridge, so there the city is seen from the station, which is in the open.
   - Still open:
     - Water: lakes and bays are flat ground at the water's level, drawn as grass. They are the
       most visible gap, and the next section to add (OSM's water areas and coastline).
     - Roof shapes, and streets (OSM's roads, paths and squares) as their own sections.
     - Building heights are estimated for 60%. Lantmäteriet's or Stockholm stad's building data
       would do better.
     - The troughs under Riddarholmskanalen and Liljeholmsviken have their tops above the water
       in the track heights, and make low mounds across it.
     - The other lines' tracks above ground, at Gamla stan, Slussen and beyond, are phase 9.
8. **Depots and the red line's other track.** *Done.*
   - Settled before starting: this phase is the red line's own track (its two depots, crossovers,
     sidings and turnback tracks); the green and blue lines are phase 9. The trains turn where
     they can be seen and park in the depots, but don't run in and out of service. Nyboda's halls
     are sheds the tracks run into.
   - `lineTrack` (`tools/lib/graph.ts`) takes the services' track and everything joined to it that
     isn't another line's, stopping short of track that touches another line. It leaves out track
     no service runs on beside a platform (the middle tracks at Alby and Sätra, Liljeholmen's
     third track, Aspudden's depot track), because the stations were described without it, and
     what is then left leading nowhere. That adds 294 pieces and 23.2 km: 19.4 km of depot track
     (10.7 km at Nyboda, 8.7 km at Norsborg), 2.2 km of sidings, 1.4 km of crossovers.
     - Norsborgsdepån is in rock: 7.9 km of its yard is in tunnel (OSM's layer −1).
     - At Nyboda, OSM's `covered=yes` track runs through the halls. `build-track-graph` now counts
       a covered yard track as being in the open, flagged `covered` (it was a tunnel).
   - `fetch-ground` samples under the new track too: 11,165 samples.
   - Heights: the running lines are fitted first, then the rest with the running lines pinned, so
     the stations come out as before (to the centimetre) and the depots are fitted to the line.
     - Track inside a building (or within 8 m of its walls) gets no ground anchor: under Nyboda's
       halls the elevation model follows the roofs, 6 m above the yard.
     - Where two tracks cross one over the other more than 250 m apart along the track, and OSM's
       layers differ, they are held 6.5 m apart (29 points). A service's track stays put, and the
       other passes on the side it is already on. This is the Nyboda access tracks over T14 near
       Liljeholmen, and Norsborg's depot on two levels.
     - Tunnels of track no service runs on need 3 m of cover instead of 6: Norsborg's two-level
       stub by the portal can't have both 6 m of rock and 6.5 m over the lower track.
     - One more fix in `data/height-corrections.json`: at Sätra OSM draws a siding into the bank.
   - Plan: also in two stages. Track no service runs on is anchored closely to OSM even in the
     tunnels (0.3 m): the depots are mapped from plans, and anchored loosely the smoothing pulled
     the Norsborg loop well inside OSM's. Its curves are held only against kinks (50 m).
   - `build-track-geometry` notes the nearest track on each side of every point, within 12 m, at
     about the same level, and both in a tunnel or both not (negative for a service's track).
   - `src/network.ts`:
     - Depot tracks in rock or concrete side by side share a hall with a flat roof 6 m high and
       a lamp over each track every 8 m, with walls only at the outer tracks. Its height is a
       guess: the 1975 description has no section of a depot.
     - In the open their formations meet halfway between the tracks.
     - Where a siding or crossover comes within 4.5 m of a running line in a tunnel, the running
       line's tunnel widens round it with a flat roof at the crown, and the siding has none of its
       own. Where its own tunnel begins, each tunnel is cut out of the other's walls (42 short
       volumes, through a grid so a tile still builds in 3–13 ms median under software
       rendering).
     - No conductor rail where another track is closer than the standard spacing; buffer stops
       at track ends, and an end wall in a tunnel. The ballast of track no service runs on is
       1.5 cm lower, so it doesn't flicker where it meets a running line's.
   - Turning at the ends:
     - The termini have no tail tracks: the tracks end at buffers just past the platforms, with
       crossovers before them. So the trains turn where they stand.
     - `build-track-graph` traces each service again so that at each end the arriving train stands
       on the track the train the other way leaves from: either the arriving train crosses over
       (Fruängen) or the leaving one does after it leaves (Norsborg, Ropsten, Mörby centrum,
       whose crossover suits only that). Whichever costs less is taken at each end.
     - The running lines as first traced are kept as `ways`, which the tools fit and draw, so each
       terminus keeps both its tracks and its platform halls.
     - `src/timetable.ts`: a trip arriving at the end becomes the next trip the other way, doors
       open; its cars swap ends without moving, so a rider stays put. Once the game is going no
       new trips are set off at the ends.
     - A train waiting to leave the end of the line has a hard claim on the track out of the
       station, until it is out of the incoming trains' way; without it, an incoming train would
       pull up between the platform and the crossover the leaving one needs.
     - Simulated for three hours: 31 trains run round, nothing late beyond the closing chime, and
       they turn in 65 s (Fruängen), 105 s (Ropsten), 182 s (Mörby centrum) and 236 s (Norsborg).
       A train held 4 minutes at Slussen makes the trains after it late, by up to 215 s, and it
       dies out; nothing locks.
   - 25 trains stand out of service, showing "Ej i trafik", on about two in three of the stabling
     tracks (a yard track beside another for most of its length) and the sidings ending at a buffer.
     They get a model within 700 m, like the trips.
   - Nyboda's halls: `build-city` makes a building that covered track runs through for 20 m a shed
     (12 halls), standing on the ground, with a door 4.6 m wide and 5.2 m above the rails wherever a
     track crosses its outline (57 doors, a new `DOOR` section in the tiles). The game draws its
     walls inside and out and a ceiling. Its ground is walked on, and its walls block but at the
     doors.
   - The ground beside track no service runs on is walkable, so the yards and halls can be walked
     through (97% of a hall's floor).
   - The menu's list of stations has the depots, as views to fly to; `?at=Nybodadepån` too.
   - Checked: screenshots in Norsborg's hall, inside and outside Nyboda's halls, at buffer stops,
     and at the junctions at Ropsten, Sätra, Östermalmstorg and Alby; a train turning at Mörby
     centrum.
   - Still open:
     - Where a siding leaves a running line's widened tunnel at a sharp angle (south of Ropsten)
       there is a gap in the roof.
     - The Nyboda access tracks rise out of the main line's tunnels too close to their junctions
       to clear the line they cross over: their tunnels cut into the running lines' near
       Liljeholmen and Aspudden (the build lists them).
     - The middle tracks at Alby and Sätra and Liljeholmen's third track aren't drawn; the
       stations would need describing again with them.
     - Trains don't run in and out of the depots, and the termini use only one platform track
       each; a real terminus alternates.
     - Nyboda's halls have the city's facade and windows, and the depot's other buildings are
       blocks.
9. **The green and blue lines.** *Green line done; the blue line is next.*
   - The green line first, before the blue. The same tools, made to take any number of lines
     rather than copied; the services follow SL's pattern where the timetable allows it.
   - Services (`data/routes.json`): T17 Åkeshov–Skarpnäck, T18 Hässelby strand–Farsta strand and
     T19 Hässelby strand–Hagsätra, each every 10 minutes, taking turns from Alvik to Gullmarsplan
     (a train every 200 s). Off-peak T18 turns at Alvik, but Alvik has only the two through tracks
     for the metro (its middle tracks are the Nockebybanan's): a train turning there meets the
     through trains head-on, and the timetable deadlocked. So T18 runs to Hässelby strand, as in
     the rush hours.
   - Track graph:
     - At T-Centralen OSM glues the red and green lines' tracks together with shared nodes for
       400 m, where they run one over the other. That tied their heights and let a route switch
       lines. Each line now gets its own node where two lines' tracks pass straight through one.
       The old geometry had escaped its curve check there, because the shared nodes counted as
       switches; see below.
     - Overlapping platforms along a track (T-Centralen again) are stood at together, in the
       middle; a platform beside less than 50 m of track is another's (the pendeltåg's at
       Odenplan, which the trains had stopped at).
     - A terminus may be turned at on any of its platform tracks, not only those the first trace
       chose: T17 turns on Åkeshov's middle track. Two services that turn at the same station
       stand on different tracks (T18 and T19 at Hässelby strand), since each stands there longer
       than the other leaves between trains. The red line's routes came out the same.
     - Yard track wired only overhead is a tram depot's (the Nockebybanan's at Alvik, mapped as
       `railway=subway`), and is left out.
     - Corrections, checked against Gleisplanweb: Skarpnäck's scissors crossover and its platform
       (its node is 50 m off the tracks); Gubbängen's platform; island platforms drawn across a
       track at Medborgarplatsen, Skanstull (both with OSM `fixme`s), Svedmyra and Sankt
       Eriksplan; and platforms drawn short at Bagarmossen, Bandhagen, Blackeberg, Rågsved and
       Stureby, lengthened to 145 m (a new `extend`).
     - Result: T17 19.6 km, T18 29.1 km, T19 28.7 km. The green line's own track is 125 km: 85 km
       its services run on, 34 km of depots (Högdalen 14.4, Vällingby 12.7, Hammarby 6.0), and the
       rest crossovers, sidings and spurs. `lineTrack` now takes every drawn line, and the tracks
       joining them (near T-Centralen and Gamla stan).
   - Heights:
     - Wikidata has no height for any green line station. Swedish Wikipedia gives a depth or a
       height for the underground ones (Fridhemsplan 1.3 m above sea level, Medborgarplatsen
       17 m, Hagsätra 46.2 m; Sankt Eriksplan, Rådmansgatan 8 m deep, Odenplan 9, Skanstull and
       Farsta strand 5, Bagarmossen 19, Skarpnäck 25). A depth is taken from the ground over the
       platforms (`depth` in `data/height-corrections.json`). Hötorget has neither.
     - A station with no height still has its platform tracks level with each other: without it,
       Hötorget's two tracks came out 3.6 m apart, and Gullmarsplan's up to 6 m.
     - Vertical curves are held at the line's limit, like the gradient, across the nodes too: the
       ground at Gullmarsplan bent the line to 926 m. The 1975 limits are per line: 1,500 m on the
       green, 2,000 m on the red.
     - `fetch-ground` writes a file per line (`data/ground/green-line.json`, 14,280 samples).
     - New fixes: three road underpasses OSM doesn't map as bridges (Kristineberg, Alvik,
       Farsta); Svedmyra's platform on a bank over the street; Gullmarsplan's tracks under the bus
       terminal's deck, in a box.
     - The red line's heights are as before, to 0.13 m.
     - Result: within the limits; the green line's steepest is 37.6‰ near Gullmarsplan, and its
       tightest vertical curve 1,692 m, also there.
   - Plan:
     - Curve limits per line: 200 m on the green line (held at 248 m between points 10 m apart).
       The holds now reach across the nodes, so a curve can't kink where two pieces meet.
     - In the open the green line keeps OSM's curves, traced from aerial photos: between Alvik and
       Stora mossen it turns at 115–150 m, tighter than its limit, and holding it to 200 m moved
       the track 9 m off the photos. The check reports these as mapped.
     - The red line's plan moved up to 7 m within about 1 km of T-Centralen: with the glued nodes
       split, the curve holds now reach the stretches they didn't before. Its old geometry had
       curves down to 139 m there, hidden by the switches. Within 350 m of T-Centralen the check
       still leaves the curves out: OSM sketches the two levels winding out of the station, and
       the plan smooths them only roughly.
     - The green line is 13.7 km of box, 10.8 km of rock, 11.8 km of bridge, 2.8 km of bank,
       1.6 km of cutting and 83.9 km on the ground (the depots' yards included).
   - Trains:
     - The green line runs C20s, the red C30s; each line's trains have their length in the
       timetable, and the parked trains are their depot's line's.
     - T-Centralen's red and green northbound platforms hadn't joined the network once the graph's
       stop moved a few metres: a route now stops where its line passes the middle of the model's
       platform, and the timetable stops its trains there.
     - The green line's ends have long layovers (4–8 minutes), and the trains that had come in
       before the game started were dropped, so every later turn took a trip already due and ran
       late for good. They now stand at the ends as the next trips.
     - Simulated for three hours: 63 trains out, every green trip on time (the red line as before,
       T14 16 s late at Fruängen on `main` too). Green trains turn in 218–503 s.
     - The green depots are in the menu: Vällingbydepån, Hammarbydepån and Högdalsdepån, with
       about 50 trains parked on both lines.
   - Stations: all 46 of the green line's own (Gamla stan and Slussen were built with the red
     line), described from Albert Guillaumes' drawings, 80 exits.
     - The underground stations (Fridhemsplan to Hötorget, Medborgarplatsen, Skanstull, Bagarmossen,
       Skarpnäck, Farsta strand) have escalators from their ends, and Hötorget a third hall over
       the middle.
     - Most of the rest are islands in the open with a ticket hall under the tracks. OSM's entrance
       there often lies between the tracks just past the platform, where the passage comes out
       under the bank; with the tracks 3–5 m above the street there is no headroom for an exit
       there, so the passage goes on under the track to an exit beside the line.
     - Fridhemsplan's and Vällingby's wide islands are two platforms in OSM, so they are drawn as
       two side platforms joined by floors, like Östermalmstorg's halls; Högdalen's platforms are
       joined across its middle track, which isn't drawn.
     - At Gamla stan the Munkbroleden passage now runs under the green track, so it is lower
       (`ceiling` on an exit's ramp).
     - `build-stations` says where a clash is in the station's frame.
     - A flood fill in the game, with the player's step rule, from each of the 155 exits of both
       lines reaches the city's ground from all but Sätra's (as before).
   - City: the tiles within 1 km of either line, 766 (99 → 191 km²); 68,241 buildings; 24 depot
     halls, 12 of them at the green depots. 10.9 MB.
   - Still open:
     - T18 off-peak to Alvik, which needs trains to turn on a through platform.
     - Fridhemsplan and Odenplan have 3D files of their own from Albert Guillaumes; they could
       replace their descriptions, as T-Centralen's model does.
     - The green line at Gamla stan and Slussen shares the red line's stations; Slussen's and
       Gamla stan's green tracks are now drawn, but the stations were described for the red line.
     - Where the Skärmarbrink and Gullmarsplan halls meet the street, OSM's entrances are over the
       tracks (on a deck or a bridge); the exits are placed beside them.
     - The blue line.

The game reads only the files the tools write, so new lines and corrections need no change to the
game's code.

## Open questions

- [ ] Write to Albert Guillaumes: ask permission, and whether he would share the red line stations'
      3D files. That could save most of phase 6.
- [x] A free Geotorget account at Lantmäteriet, for the 1 m elevation model in phases 3 and 7.
      The downloads use HTTP Basic auth with the account's user name and password. Phase 3's tools
      will read them from the environment variables `LM_USER` and `LM_PASSWORD`.
- [ ] Borrow the 1964 technical description from Stockholms stadsbibliotek, and photograph its red
      line profiles and standard sections.
- [ ] Does Wikidata's station height mean top of rail or platform level, and in which height system?
      Check it against the new-line drawings, which give top of rail in RH 2000. Against the
      elevation model it is the platform for underground stations (Slussen: 8 m, with 7–24 m of
      ground above), but at least once the street (Gamla stan).
- [ ] Credits: OpenStreetMap is ODbL (attribution in the game, and our derived track data under the
      same licence). Lantmäteriet data needs attribution: "Markhöjdmodell © Lantmäteriet, CC BY
      4.0", which `track-heights.json` already carries.
