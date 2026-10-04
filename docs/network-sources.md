# Sources for modelling the whole network

Research notes for extending the game from T-Centralen to the whole tunnelbana: where we can get
track alignment, depth, track layout (switches, crossovers, sidings, depots), station layouts, and
the surface world. Checked in October 2026.

**In short:** exact engineering drawings exist, but nobody publishes a complete set. Most are in
Stockholm stad's technical archive and at Region Stockholm, and you have to request them drawing by
drawing, with security redactions possible. Public sources are enough to build a good model:

| Need | Best source | Licence |
| --- | --- | --- |
| Plan-view track alignment | OpenStreetMap | ODbL |
| Switches, crossovers, depots | OSM topology, checked against Gleisplanweb | ODbL / CC BY-NC-SA (reference only) |
| Station depths | sv.wikipedia infoboxes, Wikidata P2044 | CC BY-SA / CC0 |
| Vertical profile, old lines | 1952 and 1975 technical descriptions, Teknisk Tidskrift | © (reference only) |
| Vertical profile, new lines | Nya tunnelbanan plan-and-profile drawings | public documents (reference) |
| Typical tunnel and station sections | Same as above | © (reference only) |
| Station layouts | Albert Guillaumes' drawings, plus photos | per station |
| Terrain | Lantmäteriet Markhöjdmodell, 1 m | CC BY 4.0 |
| Buildings | Lantmäteriet buildings, Stockholm stad LOD1 3D | CC BY 4.0 / open data |

"Reference only" means we can read dimensions off a source and model from them, but not copy its
images or vector data into the game.

## Track geometry and layout

### OpenStreetMap

Queried with Overpass on 2026-10-04 over 59.15–59.5 N, 17.7–18.3 E.

- 1,193 `railway=subway` ways, about 303 km of track: 219.5 km of running line, plus 65.6 km
  `service=yard`, 13.1 km `siding`, 3.6 km `crossover` (71 ways) and 1.1 km `spur`. Both tracks
  are mapped separately almost everywhere, in tunnels too (151 of 152 tunnel running-line ways have
  a parallel track within 60 m).
- 274 ways are `tunnel=yes` (about 161 km). `layer` runs from −4 to +3 but only says what is above
  what. There are **no `ele` or `incline` tags** on track, platforms or entrances.
- 392 `railway=switch` nodes, but the track branches at 644 nodes. Inside tunnels, 204 branch
  points have no switch tag and only 23 do, so find switches from where the track branches, not
  from the tags.
- Every depot has its yard tracks: Högdalen, Vällingby, Rissne (mostly in tunnel) and Nyboda
  about 11–14 km of track each, Norsborg about 6 km, Hammarby about 5.5 km.
- Lines under construction are there as `railway=construction` (Yellow line, Blue line extensions,
  Arenastaden, Barkarby depot).
- 189 platforms, 295 subway entrances, about 345 lifts, and a lot of indoor mapping.
- Accuracy: surface track is traced from aerial photos and is within a few metres. Tunnel track is
  hand-drawn (source tags like "sketched", "guesstimate"), and curves may be tens of metres off.

OpenRailwayMap renders the same data and adds nothing.

### Track plans

- **Gleisplanweb, "Metro Stockholm Gleisplan"** by Christian Stade, updated 12/2025:
  <https://www.gleisplanweb.eu/show.php?Map=Stockholm&Index=2> (SVG:
  <https://www.gleisplanweb.eu/Maps/Stockholm2.svg>). It is the best track plan found. It shows
  every track, crossover, siding and turnback, detailed depot layouts, km chainage per station and
  opening dates. It is **CC BY-NC-SA**, so use it only to check and fix the OSM topology. A forum
  thread notes some chainage errors: <https://forum.sparvagssallskapet.se/viewtopic.php?t=43743>.
- Wikimedia Commons `File:U-Stadt-undStraßenbahnGleisplanStockholm2021.png` (CC BY-SA 4.0): a
  geographic track map apparently drawn from OSM. It adds little.
- Wikipedia route diagrams show stations only, not crossovers.
- Spårvägssällskapet forum threads such as "Tunnelbanans depåer" (t=38053) and "Om
  växelförbindelser i Stockholms tunnelbana" are good for checking facts.
- <https://www.ekeving.se/rt/ss-spv/tub.html> has 1933–52 signal and track plans of Södertunneln
  (Slussen–Skanstull).

Sources checked that **do not** cover the metro:

- CartoMetro has no Stockholm map.
- trackmap.net is dead.
- Trafikverket's railway data (NJDB/BIS) covers Roslagsbanan, Saltsjöbanan, Nockebybanan and
  Lidingöbanan, but not the tunnelbana.
- Lantmäteriet's Topografi 10 has a "Tunnelbana" object type (CC BY 4.0). We have not checked
  whether it has one line per track or one centre line, nor how accurate it is.

## Depth and vertical profile

No public source gives a vertical profile of the existing lines. We have to piece it together:

- **Station elevations:** sv.wikipedia station infoboxes give a height above sea level
  ("höjdläge") for 49 stations, mostly on the red and blue lines. Examples: Kungsträdgården
  −29.3 m (the lowest), Östermalmstorg −23.3 m. The same 49 values are on Wikidata as P2044 (CC0).
  They are cited to *Stockholm under*. The height system is not stated, and may be the old
  Stockholm local system, a few decimetres off RH 2000.
- **Station depths:** 67 infoboxes give depth below ground. Examples: T-Centralen "8.5, 14 and
  32 m", Fridhemsplan 18 m on the green line and 28–31 m on the blue.
- **Between stations:** interpolate between station heights and tunnel portals, where the track
  meets the terrain. Respect the design limits below: 40‰ maximum gradient, 10‰ at stations.
- **Historical profiles:** the 1952 description has plan and profile for the whole
  Lindhagensgatan–Kungsgatan–Skanstull line. Teknisk Tidskrift 1954 has plan and profile of the
  inner-city line.
- **New lines:** exact top-of-rail profiles in RH 2000 (see below).

## Historical technical descriptions (scanned, free to read)

Scanned by fordonsradio.se. They are copyrighted, so use them as reference only.

- **"Stockholms tunnelbanesystem – allmän beskrivning"**, Svenska Kommunal-Tekniska Föreningen,
  1952, 61 pages:
  <https://fordonsradio.se/wp-content/uploads/2025/08/Stockholms-Tunnelbanesystem-1952.pdf>.
  - Design standards: minimum radius 200 m (400 m wanted), 40‰ maximum gradient, platforms 145 m
    long and 6–9 m wide, vertical curves at least 3,000 m.
  - The standard tunnel cross-section.
  - Station plans and profiles: Fridhemsplan, Kungsgatan (now Hötorget) and others.
  - Plan and profile of the whole first inner line.
- **"Stockholms tunnelbanor '75 – teknisk beskrivning"**, Stockholms läns landsting, 1975,
  188 pages, image only:
  <https://fordonsradio.se/wp-content/uploads/2025/08/Stockholms-Tunnelbanor-1975.pdf>. The file
  is 88 MB, and the download needs retrying (`curl -C -`).
  - Per-line design standards:

    | | Green (Tb1) | Red (Tb2) | Blue (Tb3) |
    | --- | --- | --- | --- |
    | Top speed | 80 km/h | 80 km/h | 90 km/h |
    | Minimum horizontal radius | 200 m | 250 m | 600 m |
    | Minimum radius at stations | 300 m | 400 m | straight |
    | Minimum vertical radius | 1,500 m | 2,000 m | 4,000 m |
    | Track centres | 3.15 m | 3.15 m | 3.20 m |
    | Platform length | 145 m | 145 m | 145 m (180 m prepared) |

    The double-track tunnel is 8.0 m wide.
  - Chapters on each line's alignment, and on T-Centralen, Fridhemsplan and Kungsträdgården.
  - The 1946 and 1947 planning reports are at <https://fordonsradio.se/tunnelbanesystem-1/>.
- **Teknisk Tidskrift on runeberg.org** (page scans with OCR):
  - Gyldenstein, "Konstruktioner för Stockholms tunnelbana", 1954:
    <https://runeberg.org/tektid/1954/0491.html>. Plan and profile of the inner-city line, and
    Fridhemsplan sections.
  - Ekwall on Slussen–Skanstull, 1933: <https://runeberg.org/tektid/1933v/0075.html>.
  - Samuelson, 1947: <https://runeberg.org/tektid/1947/0627.html>.
  - Roempke, 1950: <https://runeberg.org/tektid/1950/0621.html>.
  - Boberg on signalling, 1953: <https://runeberg.org/tektid/1953/0641.html>.
  - Vretblad on the Liljeholmsviken bridge, 1959: <https://runeberg.org/tektid/1959/0333.html>.

## New lines (Nya tunnelbanan)

The railway-plan documents are public A1 vector PDFs in SWEREF 99 18 00 / RH 2000. They are exact
enough to trace.

- Index pages:
  - <https://nyatunnelbanan.se/nacka-soderort/beslut-och-handlingar/>
  - <https://nyatunnelbanan.se/arenastaden/beslut-och-handlingar/>
  - <https://nyatunnelbanan.se/barkarby/beslut-och-handlingar/>
  - <https://nyatunnelbanan.se/gul-linje/beslut-och-handlingar/>
- **Barkarby:** plan and profile sheets 231–249 at 1:1000, showing track centre lines, chainage,
  switches, and top of rail against ground and rock.
  - Sheet 201 is a fully dimensioned station-tunnel section: rock contour 20.03 × 9.97 m:
    <https://nyatunnelbanan.se/wp-content/uploads/files/201.%20Illustrationsritning,%20Normalsektion.pdf>.
- **Yellow line, Fridhemsplan–Älvsjö:**
  - Plan and profile:
    <https://nyatunnelbanan.se/wp-content/uploads/2026/02/3-Plankartor-i-plan-och-profil.pdf>.
  - Cross-sections: <https://nyatunnelbanan.se/wp-content/uploads/2026/02/4-Tvarsektioner.pdf>.
- **Nacka/söderort:** station plan and profiles, and a technical description.
  - Single-track tunnel about 6 × 5 m. Double-track tunnel about 10.5 m wide.
  - Cross-passages at most every 300 m.
  - Platform level at Sofia about −75 m RH 2000, about 100 m below ground.
- New-line design rules: 90 km/h, radius at least 450 m, 40‰ maximum gradient, 145 m trains.

## Official drawings and archives

- **Trafikkontorets tekniska arkiv**, kept at Stadsarkivet, Liljeholmskajen. Gatukontoret built the
  tunnels, and this archive holds "huvudritningar och översiktsritningar på tunnelbana, broar,
  tunnlar, stödmurar, spår och typritningar" plus station drawings, from about 1960 to 1992. Older
  material (1920–59) is in Stadsarkivet proper. The registers can be searched by line, section or
  station, but only with staff help; book a visit at <arkivet.tk@stockholm.se>. **This is the most
  likely place to see switch-level track plans and real profiles.**
- **Regionarkivet, Region Stockholm** holds SL's archive (from 1967), drawings included.
- **ArkDes** collection ARKM.1987-25 has about 1,200 drawings from AB Stockholms Spårvägar's
  building department, mostly 1950s green-line stations (Hökarängen, Farsta, Vällingby,
  S:t Eriksplan and others). It is catalogued on DigitaltMuseum but almost nothing is scanned, for
  example <https://digitaltmuseum.se/011024922583>. Scans can be ordered from ArkDes'
  research service.
- **Spårvägsmuseet** has about 20,000 drawings, mostly of vehicles, and about 30,000 photos online.
- **Stadsbyggnadskontoret** has building-permit drawings of entrance buildings and ticket halls.
- **Secrecy:** drawings are public records, but each request is checked and parts can be withheld
  under OSL 18 kap. 8 § or the säkerhetsskydd law. Structural drawings of old tunnels are the most
  likely to be released. Signalling, power and security drawings are not.
- SL's technical requirements (clearance gauge, third-rail position) are not public.
- No accurate public 3D model of the network exists.

## Books worth borrowing

LIBRIS codes for who holds a book: Ssb = Stockholms stadsbibliotek, T = KTH Library, S = KB.

1. ***Stockholms tunnelbanor 1964: en teknisk beskrivning*** (136 pp). Can be borrowed from
   Stockholms stadsbibliotek: <https://biblioteket.stockholm.se/titel/66668>. Covers the green line
   and the first red line.
2. ***Stockholms tunnelbanor '75: teknisk beskrivning*** (Asker, 184 pp,
   <http://libris.kb.se/bib/1303796>). Held at KTH, KB and Stadsarkivet. Also scanned; see above.
3. ***Teknisk beskrivning av Stockholms tunnelbana*** (Wigander, 1957, 148 pp,
   <http://libris.kb.se/bib/8221881>). Construction 1950–57: T-Centralen, Gamla stan, Slussen.
4. Arne Dufwa, ***Stockholms tekniska historia 1: Trafik, broar, tunnelbanor, gator*** (1985,
   <http://libris.kb.se/bib/513275>). Widely held.
5. ***Stockholm under: 100 stationer*** (Alfredsson, Berndt, Harlén, 2007,
   <http://libris.kb.se/bib/10614768>). Station by station; the source of Wikipedia's elevations.
6. Hillbom (ed.), ***Stockholms tunnelbana: de första 75 åren 1950–2025*** (2025, 287 pp). Held
   at Ssb.
7. ***En värld under jord: färg och form i tunnelbanan*** (1985/2000). Station design, materials
   and art.

Also:

- *Tunnelbanan Skanstull–Slussen* (1933, facsimile 1982).
- *Broarna över Söderström* (1959), on Tunnelbanebron.
- The *Arkitektur* 9/1973 issue on the blue-line cave stations.
- Robert Schwandl's *U-Bahn, S-Bahn & Tram in Stockholm*, due winter 2026/27
  (<https://www.robert-schwandl.de/stockholm/>).

No book with a published track-plan atlas of the Stockholm metro was found.

When photographing pages, get:

- network and depot track plans
- longitudinal profiles
- standard cross-sections (rock tunnel, concrete box, trough, viaduct)
- station plans and sections
- tables of station data

Note each page's number and the drawing's date, and include a scale bar if there is one.

## Terrain and buildings

- **Lantmäteriet Markhöjdmodell:** 1 m grid, CC BY 4.0, as Cloud Optimized GeoTIFFs in 10 × 10 km
  tiles (SWEREF 99 TM, RH 2000). The STAC catalogue is at <https://api.lantmateriet.se/stac-hojd/v1>.
  Downloading needs a free Geotorget account.
- **Lantmäteriet buildings** (Byggnad Nedladdning, vektor): footprints, CC BY 4.0.
- **Stockholm stad:** LOD1 3D buildings (flat-roofed blocks) are listed as open data at
  <https://dataportalen.stockholm.se>. We have not read the licence text. LOD2, with roof shapes,
  is not open.

## Suggested pipeline

1. Build the track graph from OSM. Treat every node where track branches as a switch, and fix the
   topology against Gleisplanweb by hand.
2. Give stations heights from Wikidata or Wikipedia, and portals heights from the terrain model.
   Fill in the track between them within the gradient and vertical-radius limits above, refined
   with the 1952/1975 profiles where they exist.
3. Trace the new lines from the railway-plan PDFs.
4. Use the standard sections from the 1952/1975 descriptions for tunnels, and Albert Guillaumes'
   drawings for station layouts.
5. Optionally, request drawings for key stations from Trafikkontorets tekniska arkiv.
