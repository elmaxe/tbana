# Rolling stock: C20 and C30

Research notes for the procedural train models in `src/rolling-stock/`, outside and in.

The C20's lengths, heights, cross-section and door, window and bogie positions are measured from
a detailed SketchUp model of the train (*SL+C20.skp*). The C30's come from the side view and the
seat plans in SL's press presentation of the C30 (*Presentation pressträff C30*, 21 May 2013).
Wikipedia gives the other figures, and photos on Wikimedia Commons the liveries, the fronts and
the interiors. Positions read off photos are marked *est.* below. The model file, the
presentation and the photos are reference only: none of their geometry, pictures or textures is
in the repository.

## C20

Three-section articulated unit. Adtranz built it at Kalmar Verkstad, and Bombardier took over
production. Delivered 1997–2004.

| | |
| --- | --- |
| Fleet | 270 units 2001–2270, plus the C20F prototype 2000 |
| Unit | A + C + B, 46.5 m over couplers |
| Width / height | 2.90 m / 3.68 m |
| Running gear | 4 bogies per unit: two under the middle car, one under each cab end. The end cars rest on the middle car at their inner ends (semi-trailer coupling). Bo'Bo'Bo'Bo' |
| Wheels | 780 mm driving wheels, 1,435 mm gauge, 750 V DC third rail |
| Doors per side | End cars 2, middle car 3, so 7 per unit. Double sliding doors |
| Capacity | 126 seated, 288 standing |
| Power / speed | 1 MW. 90 km/h design, 80 km/h in service (70 km/h on the green line) |
| Body | Stainless steel with corrugated lower side panels. Composite cab ends |
| Service | All three lines. Three units make a 139.5 m train |

**Exterior, from photos**

- Bare stainless-steel sides. The lower panels under the windows are horizontally corrugated, and
  the roof is satin steel. Stainless skirts hide the equipment under the floor between the bogies.
- A black band runs the length of the car through the windows, from just under them to the tops
  of the doors.
- Doors are SL blue, each with a blue cap on the curved cant above it. Each door leaf has a window
  with rounded corners in its upper half.
- Windows are 1.1 m wide with rounded black frames, two between each pair of doors.
- The cab end is all blue. A black surround at the top holds the amber LED destination display
  and a windscreen in three panes, the centre one the emergency door. Below it a black band at
  light height sweeps up round the corners into the cab side windows; in it sit the lamp units,
  each a white headlight beside a red tail light. The white SL roundel is at the side of the
  front under the band, the unit number on the other side, and a ribbed black anticlimber across
  the foot, with the coupler and an obstacle deflector below.
- On the cab side: the driver's door with its window, a ventilation grille behind it, and the
  blue of the cab reaching 2.1 m back along the roof, where the cab's air-conditioning unit sits.
- Each unit has a name in script on the cab (2201 is *Ivo*) and car numbers like `2201A` / `2245B`.

**Model values**, from the SketchUp model: end cars 14.275 m and the middle car 16.0 m between
body ends, with 0.8 m gangways between them. Doors 1.6 m wide: in an end car 4.675 m and 9.875 m
from the cab end, in the middle car at the centre and 5.2 m either side. The end car's bogie is
3.58 m from the cab end and the middle car's are 11.51 m apart, all with a 2.3 m wheelbase.
Windows sit 0.45 m from the door edges and the car ends. Heights above the rail on the real
train: floor 1.17 m, window frames 2.03–3.05 m, black band 1.99–3.40 m, widest point (2.90 m)
1.68–1.88 m, roof 3.80 m (Wikipedia lists 3.68 m). The game's floors are at 1.0 m, so the model
is 0.17 m lower throughout.

## C30

Bombardier MOVIA, now Alstom, built in Hennigsdorf, Germany. In passenger service on the red
line since 11 August 2020. 116 four-car units are ordered or delivered, and surplus units are
planned for the blue line.

| | |
| --- | --- |
| Unit | A1 + B1 + B2 + A2, 70.0 m over couplers |
| Car | 16.756 m, two Bombardier FLEXX Eco inside-frame bogies per car, 11.0 m bogie centres |
| Width / height | 2.915 m / 3.915 m (as listed) |
| Gangways | Full-width open gangways with bellows through the unit |
| Doors per side | 3 per car, 12 per unit, 24 per 140 m train |
| Capacity | About 140–146 seated, 634 per unit at 5 standees/m² |
| Speed | 90 km/h design, 80 km/h in service |
| Body | Aluminium with smooth painted panels. Enclosed underframe and bogie skirts |
| Service | Two units make a 140 m train |

**Exterior, from photos**

- White body and light grey roof, with a dark grey skirt along the bottom.
- Doors are SL blue plug doors with rounded corners and a thin black outline. Each leaf has a tall
  window with rounded corners.
- Windows are rounded rectangles with black frames, in pairs between the doors.
- Pleated dark bellows between the cars, almost as wide as the body.
- The cab is a white rounded cap with one large black frame from the roof down round the
  destination display and the windscreen. An LED light collar runs in a U down both sides of the
  frame and across its foot: white at the leading end, red at the trailing end (the feature
  mentioned in the Good Design award). A big SL roundel is lit in the foot of the frame. Tall cab
  side windows sit at the corners, and a narrow light unit below each.
- Behind the cab side window comes the driver's door, with a tall narrow window, then the first
  passenger door.
- Car numbers like `2303B2` / `2310A1` in grey italic, at the top of the side and under the
  front's frame.

**Model values**, from the press presentation's side view: 18.246 m from the coupler face to the
first gangway's centre, 16.756 m between gangway centres, 0.92 m gangways. The nose is 0.35 m
behind the coupler face, so a cab car's body is 17.436 m and a middle car's 15.836 m. Doors are
5.585 m apart, the first 4.283 m from the coupler face. Each car's two bogies are 11.0 m apart,
the leading one 4.368 m from the coupler face. Windows are pairs of 1.26 m with a 0.31 m post,
0.6 m from the door leaves, and each middle car has a narrow window near each gangway. The cab is
2.44 m deep from the nose. Roof modelled at 3.75 m: the listed 3.915 m probably includes roof
equipment.


## Interiors

Nothing official gives interior dimensions, so the layouts and sizes below were read off photos,
mainly Wikimedia Commons, SL's press pictures and SL's seat plan for the C20 upgrade. Hex
colours are design values checked against photo samples. Measurements from photos are *est.*

### C20

There are two C20 interiors. All 270 units were refurbished between the first upgraded unit in
November 2020 and February 2024, by Alstom in Västerås for 1.4 billion SEK. So the **upgraded
(C20U)** interior is how every C20 looks today, and it is the model's default. The **original
1997** interior is available as an option (`interiorStyle: 'original'`, or *1997 original* in the
viewer).

| | Original (1997–2024) | Upgraded (C20U, 2020–2024) |
| --- | --- | --- |
| Seats per unit | 126 | 102 |
| Layout | All groups of four facing seats, 2 + 2 across the car. Each bay between doors has two groups per side, back to back in the middle. At the cab, one pair a side backs onto the bulkhead | In each bay, and at the inner end of the end cars, one side keeps two facing groups and the other gets a row along the wall: six seats in the end cars and five in the middle car, the yellow priority seat on a grey pedestal next to the door screen. The sides alternate. At the cab a pair a side still backs onto the bulkhead, with a single yellow seat along each wall by the door screen, so 6 + 14 + 14 in an end car and 4 + 13 + 13 + 4 in the middle car |
| Fabric | Lasse Åberg's 1995 design: navy (#233070) with quick sketches of Stockholm (City Hall, spires, boats, buses, moons, stars) in red, orange, yellow, green, light blue, pink and white | "Plattan" triangles as on the C30, charcoal #3a3d44 and grey-blue #6e7380, with plain slate cushions. Priority seats are yellow |
| Handholds | Yellow. Tall yellow hoops on the aisle seats where rows meet back to back. No overhead rails | Also yellow ceiling rails from the door grips, poles and rails at the ends of the wall rows, and hoops at the gangway portals |
| Accessibility | None | A multipurpose area with a double lean rail at each end of the middle car, diagonally opposite |
| Screens | Amber LED signs at the portals and over the cab door | Also TFT widescreens angled in the cove by the doors (next stop in white on dark blue) |

Both versions share these features:

- **Walls:** light grey-white (#e4e4e0). The lower walls have darker heater panels.
- **Doors:** grey door pillars (#a9abad) with stainless kick plates. Each pillar recess holds a yellow pole between two grey cups.
- **Door screens:** glass screens at the doors, with a floor-to-ceiling yellow pole at their aisle edge that curves out near the ceiling.
- **Door grip:** a yellow rectangular grip hangs over each door area at about 1.95 m.
- **Ceiling:** silver-grey (#c8cacc). Its lowered centre spine carries two rows of opal light panels and a perforated strip.
- **Cove:** a row of angled advert frames sits in the cove above the windows.
- **Door leaves:** grey-white, with a black centre seal.
- **Cab bulkhead:** bright yellow, with a yellow cab door that has a tall, narrow dark window
  with rounded corners (photos; the SketchUp model has a white door with a larger window).
- **Long rows (upgrade):** a yellow rail runs overhead along each row, and two poles come down
  from it and bend into the seat frame: one by the priority seat and one between the second and
  third seats from the far end.
- **Gangways:** open and about 1.8 × 2.0 m (*est.*), with grey bellows and a round turntable plate in the floor.

### C30

| | |
| --- | --- |
| Seats | 146 per unit, 36 per A car and 37 per B car: SL's seat plan, and 292 seated per 140 m train in the press presentation. SL's own site gives 140, 18 of them priority seats |
| Between doors | From SL's seat plan, checked against photos. Each side of a stretch between two doors has one of: two facing bays of 2 + 2 (1.78 m between the backs, 0.68 m between the knees), a bench of eight along the wall (0.445 m a seat), or a flex area for prams and wheelchairs (yellow double lean rails, signs on the wall, room for a 1.5 m turning circle) by one door with a bench of five or one facing bay beyond it. A car: by the cab a bench of eight opposite the flex area and a bay; then two bays opposite a bench of eight. B car: two bays opposite the flex area and a bench of five; then a bench of eight opposite two bays. B2 is B turned round |
| Screens | Glass screens stand beside the doorways where seats meet them: tall ones (to 1.9 m, with a top rail) for the bays, lower ones at the benches, none at the flex areas. A yellow-sleeved pole stands at each screen's aisle edge, and a pole bent into the seat front stands in front of the benches |
| Car ends | Two seats along each wall, also at the cab bulkhead, where the yellow priority seat is against the bulkhead |
| Fabric | "Plattan" by IDesign, woven in wool by Bogesunds väveri after the triangle paving of Sergels torg. Navy #2b3241 and blue-grey #5b6576 on the backs, plain #3a4250 cushions. Priority seats in yellow #e9b434 / #f3c94a. Some triangles hide small figures |
| Handholds | Stainless poles with a yellow sleeve (#f5c800) between about 0.3 and 1.9 m. Stainless overhead rails with drop handles along both sides, and tan leather straps near the doors |
| Doors | Dark anthracite leaves (#1f262e) with stainless kick plates and round open buttons. Green light strips light the door area in use. A navy panel over each door carries the network map, with an information screen in a black bezel beside it |
| Ceiling | White, with a band of round LED downlights and a light line along each side. A sloping cove carries the advert frames. Over each door area hangs a round lamp (about 1.1 m) inside a stainless ring handle (about 1.3 m), with a centre pole |
| Gangways | Octagonal portals traced by white light lines, about 1.75 × 2.05 m (*est.*). Pale grey pleated bellows and a black rubber walkway |
| Cab bulkhead | Dark slate (#3a3f47), with a narrow cab door carrying the rail network map |

The real C30 floor is 1.155 m above the rail. The model keeps both types' floors at 1.0 m to
match the exterior doors and the station's platforms.

**Model values:** the seat plan's layout gives 36 seats in an A car and 37 in a B car, as
SL's figures. Seats in the bays are 0.47 m wide, those along the walls 0.43 m.

### How the interiors are built

- `interior.ts`: the inner lining is swept from its own cross-section (floor, walls and ceiling
  in one surface). It is painted like a livery, with the windows and door glazing cut out
  (alpha-tested) where the outside glass is, and the doorways cut out for the door leaves. The kit
  also provides:
  - end walls with gangway portals or a cab bulkhead
  - pleated gangway tubes
  - a seat made of an extruded moulded shell and cushions
  - poles, and rails swept along polylines
  - moquette textures
- `cabin-light.ts`: the interiors are lit by their own ceiling lights. Each type lists them as
  strips along the saloon: the C20's two rows of opal panels, and the C30's cove light lines and
  rows of downlights. A patch to the standard material's shader adds, for every strip:
  - the analytic irradiance of a line light, clipped to the surface's horizon and weighted by the
    way the strip faces
  - a highlight from the point on the strip the reflection sees, so poles and rails gleam
  - a soft fill for light bounced round the car

  Each car template has a height map of its seats and fittings seen from above, made once on the
  CPU. The shader steps up the ray towards each strip through it, so the floor and walls under
  the seats fall into shadow. Outside light only gets in through the windows: the sky and
  environment are turned well down inside, and direct light is kept only where it casts shadows
  (the viewer's sun). The station turns it off with `setOutsideLight({ direct: 0 })`, since its
  lights would shine through the roofs.
- `c20-interior.ts` / `c30-interior.ts`: the lining paint, materials, the furnishing layout and
  the inside of the door leaves for each type. Window cut-outs come from the same functions that paint the windows outside
  (`windowPanes`, `windowFrames`).
- With an interior shown, a car's shell swaps to a glazed material whose windows are partly
  transparent. The station shows interiors only for cars within about 30 m of the player.

## How the models are built

- `kit.ts`: a cross-section profile made of filleted line segments is swept along the car. Cab
  noses are a "cap" surface: the profile shrinks towards its centre and is pushed back with a
  rounded edge plus a nose shape function (rake, plan curve). Liveries are painted on canvases in
  metres, so a door at x = 5.45 m lands at 5.45 m. Each car gets a colour map, a
  roughness/metalness map and an emissive map. Bogies, couplers, bellows and skirts are simple
  geometry.
- `c20.ts` / `c30.ts`: dimensions, profile, nose shape, livery painting, the door leaves and the
  parts under the body for each type.
- `doors.ts`: the sliding doors. Each doorway is painted into the body as an opening (dark, or
  clear when the interior shows), and its two leaves per side are separate slabs that follow the
  body's cross-section. Opening, they move out 4–5 cm and then slide apart along the outside of
  the body, like the plug doors of the C30 and the outside-hung sliding doors of the C20. All the
  leaves on one side of a car that slide the same way are one mesh, so a car's doors are four
  draw calls. With the interior shown, reveals join the doorways to the lining.
- `train.ts`: builds car templates once per type and quality, merges each car to one mesh per
  material, and assembles trains. Each train has per-cab destination displays and switchable
  head and tail lights; a light can also be a strip that glows only when on, like the C30's
  collar, white at the leading end and red at the trailing end. Cars open their doors with `car.setDoors(amount, side)` and describe their
  walkable floor (`car.floor`: saloon, gangways, doorways), which the station uses to let the
  player board and ride.
- `trains.html`: the model viewer, which can also export the models as `.glb`.

## Sources

The resource document in the project files (`trains/resources.md`) lists every source used for
the 2026 revision of both trains, with what was taken from each.

Drawings and models:

- *SL+C20.skp*: a detailed SketchUp model of the C20, outside, inside and under the floor (its
  metadata names its author as Lardman), supplied by Axel. Measured for the layout, heights,
  cross-section, nose, roof units and seats. It is not in the repository.
- *Presentation pressträff C30 130521*: SL's press presentation of the C30 order, 21 May 2013,
  with the side view and seat plans of all four cars (lengths, doors, bogies, windows, seats) and
  the unit's figures (292 seated per train, 636 passengers per unit). Not in the repository.

Exterior:

- Wikipedia: [SL C20](https://en.wikipedia.org/wiki/SL_C20), [SL C30](https://en.wikipedia.org/wiki/SL_C30),
  [C20 (sv)](https://sv.wikipedia.org/wiki/C20_(tunnelbanevagn)), [C30 (sv)](https://sv.wikipedia.org/wiki/C30_(tunnelbanevagn))
- Wikimedia Commons: [Category:SL C20](https://commons.wikimedia.org/wiki/Category:SL_C20),
  [Category:SL C30](https://commons.wikimedia.org/wiki/Category:SL_C30). Mainly *C20 vagn 2201*,
  *C20 at T-Centralen 20250517*, *C30 train*, *C30 i T-Centralen 20220730*, *C30 20190301 - 1* and
  *Liljeholmen tunnelbana, C20, C30, 20240210 - 05*.
- [Railway Technology: Bombardier unveils new C30 MOVIA metro design](https://www.railway-technology.com/news/newsbombardier-unveils-new-c30-movia-metro-design-4527428/)
  (the LED light collar round the windscreens)

Interiors:

- Wikipedia: [C20 (sv)](https://sv.wikipedia.org/wiki/C20_(tunnelbanevagn)) (seat counts, the upgrade),
  [C30 (sv)](https://sv.wikipedia.org/wiki/C30_(tunnelbanevagn)) (seats per car, facing-seat spacing),
  [SL C30](https://en.wikipedia.org/wiki/SL_C30)
- Wikimedia Commons: [Category:SL C30 interiors](https://commons.wikimedia.org/wiki/Category:SL_C30_interiors)
  and C20 interior photos such as *Tunnelbana-C20-Interior*, *SL C20, interiör, 20230326, bild 1–4*,
  *SL C20U (1–15)*, *Tunnelbanan, vagn C20U, interiör, bild 1–5*, *Uppgraderade C20*, *C20 interiör, 20220219*
- [Stockholms tunnelbana: Vagntyp C20](https://stockholmtunnelbana.wordpress.com/2017/09/19/vagntyp-c20/) (SL's seat plan for the upgrade)
- Region Stockholm: [Uppgraderingen av tunnelbanans C20-vagnar pågår för fullt](https://www.regionstockholm.se/nyheter/2022/09/uppgraderingen-av-tunnelbanans-c20-vagnar-pagar-for-fullt/);
  SL on Mynewsdesk: [Nyrenoverade tåg i tunnelbanan](https://www.mynewsdesk.com/se/sl/pressreleases/nyrenoverade-taag-i-tunnelbanan-3305430)
  and [Första nya tunnelbanetåget på plats](https://www.mynewsdesk.com/se/sl/pressreleases/foersta-nya-tunnelbanetaaget-paa-plats-2549298) (Bombardier's interior photos)
- [Järnvägar.nu: Nu är alla C20 uppgraderade](https://jarnvagar.nu/nu-ar-alla-c20-uppgraderade/),
  [Feber: Nu är moderniseringen av tunnelbanan klar](https://feber.se/samhalle/nu-ar-moderniseringen-av-tunnelbanan-klar/463566/) (Åberg's fabric)
- [SVT: Följ med in i de nya tunnelbanevagnarna](https://www.svt.se/nyheter/lokalt/stockholm/folj-med-in-i-de-nya-tunnelbanevagnarna),
  [Mitt i: SL:s hemliga mönster på tunnelbanans säten](https://www.mitti.se/nyheter/har-ar-sls-hemliga-monster-pa-tunnelbanans-saten-6.27.38498.4c5dff25f8),
  [Railvolution: Stockholm's new metro fleet](https://www.railvolution.net/news/stockholm-s-new-metro-fleet) (floor height, door width)
