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
       heights.
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
       tracks between aren't drawn, so the turn happens out of sight.
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
7. **The surface.**
   - Ground from the elevation model, with buildings from OpenStreetMap at first, and Lantmäteriet
     or Stockholm stad later. Start where the red line is above ground.
   - Done when: the bridges at Gamla stan and Liljeholmen show the city around them.
8. **Depots and later lines.**
   - Add the depots the red line uses, then the green and blue lines.
   - The same tools work for those lines unchanged.

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
