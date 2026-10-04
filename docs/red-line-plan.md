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
       Phase 4 will need to smooth it and space parallel tracks properly.
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
4. **Tunnels and track in the game.**
   - Draw track, rails and third rail along the graph.
   - Add tunnel shells by type: rock tunnel, concrete box, open cutting, bridge and embankment.
     Size them from the typical sections in the 1952 and 1975 descriptions.
   - Load only the stretch near the player.
   - Done when: you can fly from T-Centralen to Östermalmstorg through a real tunnel.
5. **Trains on the network.**
   - Run T13 and T14 along the graph on a simple timetable, choosing their branch by route, with
     spacing between trains and turning at the ends of the line.
   - Riding continues to the next station without the fade.
   - Done when: you can board at T-Centralen and get off at Östermalmstorg.
6. **Stations, one at a time.**
   - A station builder that turns a short description into a walkable station: platform type and
     length, depth, ticket halls, stairs, escalators, lifts, exits.
   - Order: Östermalmstorg, then south through Gamla stan, Slussen, Mariatorget, Zinkensdamm and
     Hornstull to Liljeholmen, then the four branches.
   - Done when: each station can be walked from platform to street.
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
