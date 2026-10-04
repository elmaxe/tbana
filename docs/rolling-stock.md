# Rolling stock: C20 and C30

Research notes for the procedural train models in `src/rolling-stock/`. The models cover the
exterior only. Interiors come later.

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

- Wikipedia: [SL C20](https://en.wikipedia.org/wiki/SL_C20), [SL C30](https://en.wikipedia.org/wiki/SL_C30),
  [C20 (sv)](https://sv.wikipedia.org/wiki/C20_(tunnelbanevagn)), [C30 (sv)](https://sv.wikipedia.org/wiki/C30_(tunnelbanevagn))
- Wikimedia Commons: [Category:SL C20](https://commons.wikimedia.org/wiki/Category:SL_C20),
  [Category:SL C30](https://commons.wikimedia.org/wiki/Category:SL_C30). Mainly *C20 vagn 2201*,
  *C20 at T-Centralen 20250517*, *C30 train*, *C30 i T-Centralen 20220730*, *C30 20190301 - 1* and
  *Liljeholmen tunnelbana, C20, C30, 20240210 - 05*.
- [Railway Technology: Bombardier unveils new C30 MOVIA metro design](https://www.railway-technology.com/news/newsbombardier-unveils-new-c30-movia-metro-design-4527428/)
  (the LED light collar round the windscreens)
