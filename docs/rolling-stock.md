# Rolling stock: C20 and C30

Research notes for the procedural train models in `src/rolling-stock/`, outside and in.

Dimensions come from Wikipedia. Livery, door and window layouts, and front details were read off
photos on Wikimedia Commons. Positions the sources don't give, such as door centres and window
heights, were estimated from photos and are marked *est.* below.

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
  the roof is satin steel.
- Doors are SL blue, each with a blue cap on the curved cant above it. Each door leaf has a tall
  window.
- Large dark windows in a continuous band with thin posts between them.
- The cab end is all blue. A black windscreen area at the top holds the amber LED destination
  display and a windscreen split into three panes, the centre one being the emergency door. Below
  it is a black band at light height with red tail lights and white headlights. The white SL
  roundel is below that, then a black bumper, the coupler and an obstacle deflector.
- On the cab side, a black sweep runs from the light band up round the cab side window to the
  driver's door. A ventilation grille sits behind the door.
- Each unit has a name in script on the cab (2201 is *Ivo*) and car numbers like `2201A` / `2245B`.

**Model values**: end car 14.9 m, middle car 16.1 m, 0.25 m between bodies. Door centres
5.45 m apart (*est.*). Window band 1.93–2.88 m above the rail, floor about 1.0 m (*est.*).

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
- The cab is a white rounded cap with one large black frame round the windscreen and the
  destination display. An LED light collar rings the frame (the feature mentioned in the
  Good Design award). Vertical cab side windows sit at the corners. The light clusters are below
  the frame corners, with a grey lower front and the coupler pocket.
- Car numbers like `2303B2` / `2310A1` in black italic.

**Model values**: B cars 16.756 m. Cab cars 17.3 m and gangways 0.6 m (*est.*), so the unit
comes to 70 m. Door centres 5.35 m apart on B cars and 5.25 m on A cars (*est.*). Roof modelled at 3.75 m. The listed 3.915 m probably includes roof equipment.


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
| Layout | All groups of four facing seats, 2 + 2 across the car. Each bay between doors has two groups per side, back to back in the middle | In each bay one side keeps two facing groups and the other gets a row of about six seats along the wall. The sides alternate from bay to bay |
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
- **Cab bulkhead:** bright yellow, with a cab door that has a narrow dark window.
- **Gangways:** open and about 1.8 × 2.0 m (*est.*), with grey bellows and a round turntable plate in the floor.

### C30

| | |
| --- | --- |
| Seats | 140 per unit, 18 of them priority seats (SL). sv.wikipedia gives 146 (36 per A car, 37 per B car) |
| Between doors | One side has three transverse rows of two seats: a facing bay with 89 cm spacing plus one more row, backed by a glass screen at the door. The other side has a bench of four seats along the wall (the priority seat by the door) next to a flex area with yellow lean rails. The sides swap from zone to zone |
| Car ends | Two seats a side along the wall. At the cab, 2 + 2 seats back to the bulkhead either side of the cab door |
| Fabric | "Plattan" by IDesign, woven in wool by Bogesunds väveri after the triangle paving of Sergels torg. Navy #2b3241 and blue-grey #5b6576 on the backs, plain #3a4250 cushions. Priority seats in yellow #e9b434 / #f3c94a. Some triangles hide small figures |
| Handholds | Stainless poles with a yellow sleeve (#f5c800) between about 0.3 and 1.9 m. Stainless overhead rails with drop handles along both sides, and tan leather straps near the doors |
| Doors | Dark anthracite leaves (#1f262e) with stainless kick plates and round open buttons. Green light strips light the door area in use. A black panel over each door holds the line's strip map and a small screen |
| Ceiling | White, with a band of round LED downlights and a light line along each side. A sloping cove carries the advert frames. Over each door area hangs a round lamp (about 1.1 m) inside a stainless ring handle (about 1.3 m), with a centre pole |
| Gangways | Octagonal portals traced by white light lines, about 1.75 × 2.05 m (*est.*). Pale grey pleated bellows and a black rubber walkway |
| Cab bulkhead | Dark slate (#3a3f47), with a narrow cab door carrying the rail network map |

The real C30 floor is 1.155 m above the rail. The model keeps both types' floors at 1.0 m to
match the exterior doors and the station's platforms.

**Model values:** the C30 seat count comes to 28 per B car, short of the official 36–37. The
official layout must use space the photos don't show, so the model follows the photos.

### How the interiors are built

- `interior.js`: the inner lining is swept from its own cross-section (floor, walls and ceiling
  in one surface). It is painted like a livery, with the windows and door glazing cut out
  (alpha-tested) where the outside glass is. The kit also provides:
  - end walls with gangway portals or a cab bulkhead
  - pleated gangway tubes
  - a seat made of an extruded moulded shell and cushions
  - poles, and rails swept along polylines
  - moquette textures
- Interior surfaces glow a little at their own colour. This stands in for the cars' lighting, so
  they need no real lights.
- `c20-interior.js` / `c30-interior.js`: the lining paint, materials and the furnishing layout for
  each type. Window cut-outs come from the same functions that paint the windows outside
  (`windowPanes`, `windowFrames`).
- With an interior shown, a car's shell swaps to a glazed material whose windows are partly
  transparent. The station shows interiors only for cars within about 30 m of the player.

## How the models are built

- `kit.js`: a cross-section profile made of filleted line segments is swept along the car. Cab
  noses are a "cap" surface: the profile shrinks towards its centre and is pushed back with a
  rounded edge plus a nose shape function (rake, plan curve). Liveries are painted on canvases in
  metres, so a door at x = 5.45 m lands at 5.45 m. Each car gets a colour map, a
  roughness/metalness map and an emissive map. Bogies, couplers, bellows and skirts are simple
  geometry.
- `c20.js` / `c30.js`: dimensions, profile, nose shape, livery painting and the parts under the
  body for each type.
- `train.js`: builds car templates once per type and quality, merges each car to one mesh per
  material, and assembles trains. Each train has per-cab destination displays and switchable
  head and tail lights.
- `trains.html`: the model viewer, which can also export the models as `.glb`.

## Sources

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
