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

1. **Shared coordinates.**
   - Put the game in metres on SWEREF 99 TM, with T-Centralen as the origin, +x east and +z south
     as today. Heights are RH 2000.
   - Fit the T-Centralen model onto that grid by matching its tracks to the OpenStreetMap tracks.
   - Done when: the T-Centralen tracks lie on the OpenStreetMap tracks to within about 2 m.
2. **Track data tools.** Scripts in `tools/` that write data files to `public/data/`:
   - Download the red line from OpenStreetMap (Overpass): tracks, platforms, stations, entrances.
   - Turn it into a track graph: track pieces with their polylines, and switches wherever a track
     branches. Many tunnel switches lack the `railway=switch` tag, so switches come from the
     branches, not the tags. Mark each piece as tunnel, bridge or surface.
   - Keep hand fixes in a small corrections file, checked against Gleisplanweb, which is reference
     only because of its NC licence.
   - Done when: T13 and T14 can be traced through the graph end to end, with every platform on its
     track.
3. **Heights.**
   - Give each station its Wikidata height and each tunnel mouth the height of the ground there.
   - Fill in the track between them within the 1975 limits for the red line: 40‰ at most, 10‰ at
     stations, vertical curves of at least 2,000 m, curve radius at least 250 m.
   - A check script reports anything outside the limits.
   - Done when: the whole red line passes the check, and a side view of the line looks plausible.
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
- [ ] A free Geotorget account at Lantmäteriet, to download the 1 m elevation model for phases 3
      and 7. Until then we can use the free 30 m Copernicus elevation model.
- [ ] Borrow the 1964 technical description from Stockholms stadsbibliotek, and photograph its red
      line profiles and standard sections.
- [ ] Does Wikidata's station height mean top of rail or platform level, and in which height system?
      Check it against the new-line drawings, which give top of rail in RH 2000.
- [ ] Credits: OpenStreetMap is ODbL (attribution in the game, and our derived track data under the
      same licence). Lantmäteriet data needs attribution.
