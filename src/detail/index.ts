import * as THREE from 'three';
import type { Building } from '../city-tile.ts';
import { Builder, type V2 } from './builder.ts';
import { buildFacades } from './facades.ts';
import { buildCentralbron, buildMetroBridge, buildPortals, buildRailway, buildSouthEnd, buildStation, stationOutline } from './gamla-stan.ts';
import { buildKonserthuset, konserthusetOutline } from './konserthuset.ts';
import { HOTORGSCITY_WEST } from './hotorgscity.ts';
import { KUNGSTORNEN } from './kungstornen.ts';
import { PUB } from './pub.ts';
import { detailMaterial } from './materials.ts';
import { buildCycleBridge, buildGuldbron, buildKatarinahissen, buildMalartrappan, buildVattentorget, KATARINAHISSEN_OUTLINE, MALARTRAPPAN_OUTLINE } from './slussen.ts';
import { inDetailArea } from './areas.ts';
import { ropstenWorld } from './viaducts.ts';
import { buildChimney, buildLidingobron, buildLillaLidingobron, buildRopstensplan, buildTramStop, buildVarmeverk, CHIMNEYS, ENERGIHAMNEN_TANKS, LIDINGOBRON_PARTS, LILLA_LIDINGOBRON_PARTS, VVR_OUTLINE } from './ropsten.ts';
import { buildRopstenStation } from './ropsten-station.ts';
import { buildE18Bridge, buildStocksundsbron, buildSvedenreservoaren, SVEDEN_OUTLINE } from './stocksundet.ts';
import { buildFence, buildHerrhagsvagen, buildRockFace, buildTallkrogenBridges, FENCE_PARTS, HERRHAGSVAGEN, ROCK_ANCHOR, TALLKROGEN_BRIDGES } from './gubbangen.ts';
import { buildFarstaViaduct, buildFarstavagenBridge, buildGubbangsfaltet, buildHokarangenBridges, FN_ANCHOR, FV_ANCHOR, GF_ANCHOR, HK_ANCHOR } from './farsta-line.ts';
import { buildHammarbybacken, buildNynasDeck, buildNynasvagen, buildSockenvagen, buildSofielundsvagen, buildTallkrogenPath, HAMMARBYBACKEN, NYNAS_DECK, NYNASVAGEN, SOCKENVAGEN, SOFIELUNDSVAGEN, TALLKROGEN_PATH } from './farsta-line-north.ts';
import {
  BANDHAGSVAGEN, BJURSATRAGATAN, buildBandhagsvagen, buildBjursatragatan, buildDepotBridge, buildHogdalenPath, buildMagelungsvagen, buildNynasLine,
  buildNynasRailwayBridges, buildOlshammarsgatan, buildOrbyleden, buildRagsvedsvagen, buildSkonviksvagen, buildSockenplan, buildSvedmyra, DEPOT_BRIDGE,
  HOGDALEN_PATH, MAGELUNGSVAGEN, NYNAS_LINE, NYNAS_RAILWAY, OLSHAMMARSGATAN, ORBYLEDEN, RAGSVEDSVAGEN, SKONVIKSVAGEN, SOCKENPLAN, SVEDMYRA,
} from './hagsatra-line.ts';
import { ANNEXET_ANCHOR, ANNEXET_OUTLINE, buildAnnexet, buildGloben, GLOBEN_ANCHOR, GLOBEN_OUTLINE } from './globen.ts';
import {
  BAGARMOSSEN, BAGARMOSSEN_VIADUCT, buildSkarpnackViaduct, HALMSTADS, HALMSTADSVAGEN, KARRTORPS, KARRTORPSVAGEN, MALMO, MALMOVAGEN, SKARMARBRINK,
  SKARMARBRINK_FLYOVER, SPARRMANS, SPARRMANSVAGEN, ULRICEHAMNS, ULRICEHAMNSVAGEN, YSTADS, YSTADSVAGEN,
} from './skarpnack-line.ts';
import { buildSkanstullsbron, SKANSTULLSBRON_PARTS } from './skanstull.ts';
import {
  ARVINGE_ROCK, buildArvingeRock, buildKymlinge, buildKymlingelanken, IGELBACKEN, IGELBACKEN_EAST, IGELBACKEN_WEST, KISTA_1, KISTA_2, KISTA_3, KISTA_4,
  KISTA_VIADUCT_1, KISTA_VIADUCT_2, KISTA_VIADUCT_3, KISTA_VIADUCT_4, KL_ANCHOR, KYMLINGE,
} from './akalla-line.ts';
import { buildStreets, type StreetGround, type TileStreets } from './streets.ts';
import {
  ABRAHAMSBERGSVAGEN, ABRAHAMSBERGSVAGEN_BRIDGE, AKESHOVSVAGEN, AKESHOVSVAGEN_BRIDGE, ALVIK_FLYOVER, ANGBY_UNDERPASS, ANGBY_UNDERPASS_BRIDGE, BROMMAPLAN_VIADUCT, BROMMAPLAN_WEST, buildDvTvarbanan, buildEssingeleden, buildLindhagensplan, buildMariebergsavfarten, buildNockebyViaduct, buildTranebergsbron, buildTranebergsslinganRoads,
  DROTTNINGHOLMSVAGEN, DROTTNINGHOLMSVAGEN_BRIDGE, DV_TVARBANAN_ANCHOR, ESSINGELEDEN_PARTS, FLYOVER, LINDHAGENSPLAN_ANCHOR, MARIEBERGSAVFARTEN_ANCHOR, NOCKEBY_ANCHORS,
  STORA_MOSSEN_BRIDGE, STORA_MOSSENS_BACKE, buildTrench, TRANEBERGSBRON_PARTS, TRENCH_PARTS, TRANEBERGSSLINGAN, TRANEBERGSSLINGAN_BRIDGE, TS_ROADS_ANCHOR,
} from './vasterort.ts';
import {
  ABISKOVAGEN, ABISKOVAGEN_BRIDGE, BERGSLAGSVAGEN_RACKSTA, BERGSLAGSVAGEN_RACKSTA_BRIDGE, BERGSLAGSVAGEN_VIADUCT, BERGSLAGSVAGEN_VIADUCT_BRIDGE, BJORNSONSGATAN,
  BJORNSONSGATAN_BRIDGE, buildLovstavagen, buildRackstaArches, DEPOT_FLYOVER, DEPOT_FLYOVER_BRIDGE, HASSELBY_ROADS, LOVSTAVAGEN, RACKSTA_ARCHES,
} from './hasselby-line.ts';
import { buildTower, TOWERS } from './towers.ts';

// The city in detail near the camera, in the areas of src/detail/areas.ts:
// landmarks built by hand in place of the city's plain blocks of them, and the other buildings'
// facades with real windows, shop fronts and cornices (src/detail/facades.ts), and the streets,
// squares and trees (src/detail/streets.ts). A tile drawn at full resolution (near the camera) gets
// them; further off it keeps its plain blocks.

export { DETAIL_ON } from './areas.ts';

// (a landmark carrying a road gets the tile's streets: the city's ground they lie on, and a way to
// lay them again on its own, a deck's, where the city leaves them out over the tracks)
export interface LandmarkStreets { ground: StreetGround; draw: (ground: StreetGround) => void }
interface Landmark { name: string; outline: V2[]; anchor: V2; build: (B: Builder, ground: (x: number, z: number) => number | null, streets?: LandmarkStreets) => void }
const LANDMARKS: Landmark[] = [
  { name: 'Konserthuset', outline: konserthusetOutline(), anchor: [230, -395], build: buildKonserthuset },
  ...TOWERS.map((t, i): Landmark => ({ name: `Hötorget tower ${i + 1}`, outline: t.outline, anchor: t.at, build: (B) => buildTower(B, t.tower) })),
  ...KUNGSTORNEN,
  HOTORGSCITY_WEST,
  PUB,
  // Gamla stan station with Centralbron and the railway over it, in two halves, each built with
  // the tile it is in
  { name: 'Gamla stan station', outline: stationOutline(), anchor: [449, 910], build: (B, g) => {
    buildStation(B, g); buildSouthEnd(B, g); buildCentralbron(B, g, 'north'); buildRailway(B, g, 'north');
  } },
  { name: 'Centralbron over Söderström', outline: [], anchor: [480, 1100], build: (B, g) => {
    buildCentralbron(B, g, 'south'); buildRailway(B, g, 'south'); buildPortals(B);
  } },
  // the metro's bridge to Slussen: its railings, girders and walkway (the network draws the rest)
  { name: 'Söderströmsbron', outline: [], anchor: [580, 1100], build: buildMetroBridge },
  // Slussen, in view east of the bridge (src/detail/slussen.ts)
  { name: 'Lilla Söderströmsbron', outline: [], anchor: [600, 1062], build: buildCycleBridge },
  { name: 'Guldbron', outline: [], anchor: [836, 1176], build: buildGuldbron },
  { name: 'Vattentorget', outline: [], anchor: [780, 1160], build: buildVattentorget },
  { name: 'Mälartrappan', outline: MALARTRAPPAN_OUTLINE, anchor: [700, 1210], build: buildMalartrappan },
  { name: 'Katarinahissen', outline: KATARINAHISSEN_OUTLINE, anchor: [800, 1292], build: buildKatarinahissen },
  // Ropsten (src/detail/ropsten.ts): the bridges to Lidingö, each built in parts, a part with the
  // tile it is in
  ...LIDINGOBRON_PARTS.map((p, i): Landmark => ({ name: `Lidingöbron ${i + 1}`, outline: [], anchor: p.anchor, build: (B, g) => buildLidingobron(B, g, p.range) })),
  ...LILLA_LIDINGOBRON_PARTS.map((p, i): Landmark => ({ name: `Lilla Lidingöbron ${i + 1}`, outline: [], anchor: p.anchor, build: (B, g) => buildLillaLidingobron(B, g, p.range) })),
  // the station itself: its two viaducts, platforms, roofs and the halls at either end (src/detail/ropsten-station.ts)
  { name: 'Ropsten station', outline: [], anchor: ropstenWorld(12, 0), build: buildRopstenStation },
  // the bus square under the platforms, Lidingöbanan's stop beside it, and the oil tanks across
  // the motorway in place of the city's plain blocks of them
  { name: 'Ropstensplan', outline: [], anchor: [2520, -2890], build: buildRopstensplan },
  { name: 'Ropsten tram stop', outline: [], anchor: [2540, -2965], build: buildTramStop },
  ...ENERGIHAMNEN_TANKS.map((t, i): Landmark => ({ name: `Energihamnen tank ${i + 1}`, ...t })),
  // the heat-pump plant on the shore north of the station, with its raked tower and its name
  { name: 'Värmeverk Ropsten', outline: VVR_OUTLINE, anchor: [2485, -3011], build: buildVarmeverk },
  // Värtaverket's two chimneys, the tallest things in sight there (OpenStreetMap has them, but not
  // as buildings)
  ...CHIMNEYS.map((c, i): Landmark => ({ name: `Värtaverket chimney ${i + 1}`, outline: [], anchor: c.c, build: (B, g) => buildChimney(B, g, c) })),
  // the red line's bridge over Stocksundet, between Bergshamra and Danderyds sjukhus
  // (src/detail/stocksundet.ts), built whole with the tile its middle is in
  { name: 'Stocksundsbron', outline: [], anchor: [-1259.5, -5935.8], build: buildStocksundsbron },
  // and the water tower over its southern end, in place of the city's plain block of it
  { name: 'Svedenreservoaren', outline: SVEDEN_OUTLINE, anchor: [-1402.1, -5800.4], build: buildSvedenreservoaren },
  // and the E18's bridge 320 m east of it, in view from it (OpenStreetMap's road bridges are left
  // out of the city)
  { name: 'Stocksundsbron (E18)', outline: [], anchor: [-995, -5744], build: buildE18Bridge },
  // the green line between Tallkrogen and Gubbängen (src/detail/gubbangen.ts): Tallkrogen's bridges
  // over Victor Balcks väg, Herrhagsvägen's over the tracks at Gubbängen, the rock face in the
  // cutting north of it, and the fences along the line, in parts, each built with the tile it is in
  { name: 'Tallkrogen bridges', outline: [], anchor: TALLKROGEN_BRIDGES.o, build: buildTallkrogenBridges },
  { name: 'Herrhagsvägen bridge', outline: [], anchor: HERRHAGSVAGEN.o, build: buildHerrhagsvagen },
  { name: 'Rock face north of Herrhagsvägen', outline: [], anchor: ROCK_ANCHOR, build: buildRockFace },
  ...FENCE_PARTS.map((p, i): Landmark => ({ name: `Gubbängen–Tallkrogen fence ${i + 1}`, outline: [], anchor: p.anchor, build: (B, g) => buildFence(B, g, p.pts, p.out) })),
  // and on south to Farsta strand (src/detail/farsta-line.ts): the steel viaduct over Gubbängsfältet,
  { name: 'Gubbängsfältet viaduct', outline: [], anchor: GF_ANCHOR, build: buildGubbangsfaltet },
  // Hökarängen's bridges over Örbyleden: the metro's and the cycle bridge beside it
  { name: 'Hökarängen bridges', outline: [], anchor: HK_ANCHOR, build: buildHokarangenBridges },
  // the bridge over Farstavägen north of Farsta
  { name: 'Farstavägen bridge', outline: [], anchor: FN_ANCHOR, build: buildFarstavagenBridge },
  // and the two decks into Farsta's platform
  { name: 'Farsta viaduct', outline: [], anchor: FV_ANCHOR, build: buildFarstaViaduct },
  // and north from Tallkrogen to Gullmarsplan (src/detail/farsta-line-north.ts): the bridge over the
  // path in the woods, the long one over Nynäsvägen, Sockenvägen's into Skogskyrkogården, and the
  // steel ones over Sofielundsvägen south of Blåsut and Hammarbybacken east of Gullmarsplan
  { name: 'Tallkrogen path bridge', outline: [], anchor: TALLKROGEN_PATH.at(15, 1), build: buildTallkrogenPath },
  { name: 'Nynäsvägen bridge', outline: [], anchor: NYNASVAGEN.at(80, 0), build: buildNynasvagen },
  { name: 'Sockenvägen bridge', outline: [], anchor: SOCKENVAGEN.at(67, -3), build: buildSockenvagen },
  { name: 'Sofielundsvägen bridge', outline: [], anchor: SOFIELUNDSVAGEN.at(25, -2), build: buildSofielundsvagen },
  { name: 'Hammarbybacken bridge', outline: [], anchor: HAMMARBYBACKEN.at(17, -3), build: buildHammarbybacken },
  // and Nynäsvägen's deck over the Skärmarbrink line's tracks south-east of Gullmarsplan, with the
  // city's streets laid on it
  { name: 'Nynäsvägen deck at Gullmarsplan', outline: [], anchor: NYNAS_DECK.o, build: buildNynasDeck },
  // the Hagsätra line from Gullmarsplan to Hagsätra (src/detail/hagsatra-line.ts): the metro's
  // bridges from Sockenplan's viaduct to the one over Olshammarsgatan south of Hagsätra, and the
  // depot tracks' over the main line south of Högdalen
  { name: 'Sockenplan viaduct', outline: [], anchor: SOCKENPLAN.at(62, 3), build: buildSockenplan },
  { name: 'Svedmyra viaduct', outline: [], anchor: SVEDMYRA.at(33, 3), build: buildSvedmyra },
  { name: 'Skönviksvägen bridge', outline: [], anchor: SKONVIKSVAGEN.at(15, 3.5), build: buildSkonviksvagen },
  { name: 'Bandhagsvägen bridge', outline: [], anchor: BANDHAGSVAGEN.at(19, -5), build: buildBandhagsvagen },
  { name: 'Örbyleden arches', outline: [], anchor: ORBYLEDEN.at(42, -4), build: buildOrbyleden },
  { name: 'Högdalen path bridge', outline: [], anchor: HOGDALEN_PATH.at(8.5, 2), build: buildHogdalenPath },
  { name: 'Högdalen depot bridge', outline: [], anchor: DEPOT_BRIDGE.at(16, -2), build: buildDepotBridge },
  { name: 'Magelungsvägen bridges', outline: [], anchor: MAGELUNGSVAGEN.at(30, 8), build: buildMagelungsvagen },
  { name: 'Nynäs railway bridges', outline: [], anchor: NYNAS_RAILWAY.at(12, 9), build: buildNynasRailwayBridges },
  // and the railway under them, which the city leaves out
  { name: 'Nynäs railway', outline: [], anchor: NYNAS_LINE.at(140, 0), build: buildNynasLine },
  { name: 'Bjursätragatan bridge', outline: [], anchor: BJURSATRAGATAN.at(26, 2), build: buildBjursatragatan },
  { name: 'Rågsvedsvägen arch', outline: [], anchor: RAGSVEDSVAGEN.at(38, 0), build: buildRagsvedsvagen },
  { name: 'Olshammarsgatan viaduct', outline: [], anchor: OLSHAMMARSGATAN.at(30, 1.5), build: buildOlshammarsgatan },
  // the Skarpnäck line from Skärmarbrink to Bagarmossen (src/detail/skarpnack-line.ts): the metro's
  // bridges from the flyover east of Skärmarbrink to the viaduct over Sockenvägen at Bagarmossen
  { name: 'Skärmarbrink flyover', outline: [], anchor: SKARMARBRINK_FLYOVER.at(27, -1), build: buildSkarpnackViaduct(SKARMARBRINK) },
  { name: 'Sparrmansvägen bridge', outline: [], anchor: SPARRMANSVAGEN.at(17, 1.8), build: buildSkarpnackViaduct(SPARRMANS) },
  { name: 'Ulricehamnsvägen bridges', outline: [], anchor: ULRICEHAMNSVAGEN.at(31, 5), build: buildSkarpnackViaduct(ULRICEHAMNS) },
  { name: 'Malmövägen viaduct', outline: [], anchor: MALMOVAGEN.at(60, -8), build: buildSkarpnackViaduct(MALMO) },
  { name: 'Halmstadsvägen bridges', outline: [], anchor: HALMSTADSVAGEN.at(22, -4.5), build: buildSkarpnackViaduct(HALMSTADS) },
  { name: 'Ystadsvägen viaduct', outline: [], anchor: YSTADSVAGEN.at(58, -1.7), build: buildSkarpnackViaduct(YSTADS) },
  { name: 'Kärrtorpsvägen bridges', outline: [], anchor: KARRTORPSVAGEN.at(48, 3), build: buildSkarpnackViaduct(KARRTORPS) },
  { name: 'Bagarmossen viaduct', outline: [], anchor: BAGARMOSSEN_VIADUCT.at(44.5, 1.3), build: buildSkarpnackViaduct(BAGARMOSSEN) },
  // Skanstullsbron, from Gullmarsplan over Hammarby kanal to Södermalm: the metro's deck and the road's
  // beside it, their bents and arches, in three parts along it (src/detail/skanstull.ts)
  ...SKANSTULLSBRON_PARTS.map((p, i): Landmark => ({ name: `Skanstullsbron ${i + 1}`, outline: [], anchor: p.anchor, build: (B, g) => buildSkanstullsbron(B, g, p.range) })),
  // the roads over and beside the line between Fridhemsplan and Kristineberg: Drottningholmsvägen's
  // trench, in two parts, Lindhagensplan's deck over it, Mariebergsavfarten's ramps, and Essingeleden's
  // viaduct, in two parts, with Fredhällspåfarten's deck under it (src/detail/vasterort.ts)
  ...TRENCH_PARTS.map((p, i): Landmark => ({ name: `Drottningholmsvägen's trench ${i + 1}`, outline: [], anchor: p.anchor, build: (B, g) => buildTrench(B, g, p.range) })),
  { name: 'Lindhagensplan', outline: [], anchor: LINDHAGENSPLAN_ANCHOR, build: buildLindhagensplan },
  { name: 'Mariebergsavfarten', outline: [], anchor: MARIEBERGSAVFARTEN_ANCHOR, build: buildMariebergsavfarten },
  ...ESSINGELEDEN_PARTS.map((p, i): Landmark => ({ name: `Essingeleden at Fredhällsmotet ${i + 1}`, outline: [], anchor: p.anchor, build: (B, g) => buildEssingeleden(B, g, p.range) })),
  // Tranebergsbron, from Kristineberg over Tranebergssund to Traneberg: the metro's deck and the road's
  // beside it, their walls, the three arches, the footings and the fenders, in four parts along it
  // (src/detail/vasterort.ts)
  ...TRANEBERGSBRON_PARTS.map((p, i): Landmark => ({ name: `Tranebergsbron ${i + 1}`, outline: [], anchor: p.anchor, build: (B, g) => buildTranebergsbron(B, g, p.range) })),
  // and west of it to Stora mossen: the bridge over Tranebergsslingan with Drottningholmsvägen's decks
  // beside it, Drottningholmsvägen's deck over Tvärbanan, the flyover over Alvik's sidings, the bridge
  // over Drottningholmsvägen, Nockebybanan's two viaducts over the line and the road, and the bridge
  // over Stora Mossens backe
  { name: 'Tranebergsslingan bridge', outline: [], anchor: TRANEBERGSSLINGAN.at(23.5, -3), build: buildSkarpnackViaduct(TRANEBERGSSLINGAN_BRIDGE) },
  { name: 'Drottningholmsvägen over Tranebergsslingan', outline: [], anchor: TS_ROADS_ANCHOR, build: buildTranebergsslinganRoads },
  { name: 'Drottningholmsvägen over Tvärbanan', outline: [], anchor: DV_TVARBANAN_ANCHOR, build: buildDvTvarbanan },
  { name: 'Alvik flyover', outline: [], anchor: FLYOVER.at(50, 1.5), build: buildSkarpnackViaduct(ALVIK_FLYOVER) },
  { name: 'Drottningholmsvägen bridge', outline: [], anchor: DROTTNINGHOLMSVAGEN.at(36, -2), build: buildSkarpnackViaduct(DROTTNINGHOLMSVAGEN_BRIDGE) },
  ...NOCKEBY_ANCHORS.map((anchor, k): Landmark => ({ name: `Nockebybanan viaduct ${k + 1}`, outline: [], anchor, build: (B, g) => buildNockebyViaduct(B, g, k) })),
  { name: 'Stora Mossens backe bridge', outline: [], anchor: STORA_MOSSENS_BACKE.at(14.5, -2.5), build: buildSkarpnackViaduct(STORA_MOSSEN_BRIDGE) },
  // and on west to Islandstorget: Abrahamsbergsvägen's bridge, Brommaplan's viaduct west of the
  // station's decks, Åkeshovsvägen's bridge and the path's underpass east of Ängbyplan
  { name: 'Abrahamsbergsvägen bridge', outline: [], anchor: ABRAHAMSBERGSVAGEN.at(16, -3.5), build: buildSkarpnackViaduct(ABRAHAMSBERGSVAGEN_BRIDGE) },
  { name: 'Brommaplan viaduct', outline: [], anchor: BROMMAPLAN_WEST.at(106, -1), build: buildSkarpnackViaduct(BROMMAPLAN_VIADUCT) },
  { name: 'Åkeshovsvägen bridge', outline: [], anchor: AKESHOVSVAGEN.at(10, -1.7), build: buildSkarpnackViaduct(AKESHOVSVAGEN_BRIDGE) },
  { name: 'Ängby underpass', outline: [], anchor: ANGBY_UNDERPASS.at(3, 2.1), build: buildSkarpnackViaduct(ANGBY_UNDERPASS_BRIDGE) },
  // from Blackeberg to Johannelund: Björnsonsgatan's bridge, the arches over Kanaans väg and
  // Grimstagatan, Bergslagsvägen's bridge at Råcksta, the depot's flyover, Abiskovägen's bridge,
  // Bergslagsvägen's viaduct and Lövstavägen's with its footway; and the roads and the path over the
  // line on to Hässelby strand (src/detail/hasselby-line.ts)
  { name: 'Björnsonsgatan bridge', outline: [], anchor: BJORNSONSGATAN.at(16, -4.5), build: buildSkarpnackViaduct(BJORNSONSGATAN_BRIDGE) },
  { name: 'Råcksta arches', outline: [], anchor: RACKSTA_ARCHES.at(80, -6.4), build: buildRackstaArches },
  { name: 'Bergslagsvägen bridge at Råcksta', outline: [], anchor: BERGSLAGSVAGEN_RACKSTA.at(21.5, 3), build: buildSkarpnackViaduct(BERGSLAGSVAGEN_RACKSTA_BRIDGE) },
  { name: 'Depot flyover', outline: [], anchor: DEPOT_FLYOVER.at(24, 0), build: buildSkarpnackViaduct(DEPOT_FLYOVER_BRIDGE) },
  { name: 'Abiskovägen bridge', outline: [], anchor: ABISKOVAGEN.at(14.5, 1.8), build: buildSkarpnackViaduct(ABISKOVAGEN_BRIDGE) },
  { name: 'Bergslagsvägen viaduct', outline: [], anchor: BERGSLAGSVAGEN_VIADUCT.at(81, 0.3), build: buildSkarpnackViaduct(BERGSLAGSVAGEN_VIADUCT_BRIDGE) },
  { name: 'Lövstavägen viaduct', outline: [], anchor: LOVSTAVAGEN.at(48, 1.8), build: buildLovstavagen },
  ...HASSELBY_ROADS.map((r): Landmark => ({ name: r.name, outline: [], anchor: r.anchor, build: r.build })),
  // the blue line in the open between Hallonbergen and Husby: the bridges over Igelbäcken,
  // Kymlinge's platform, Kymlingelänken's deck over the cutting at Ärvinge and the cutting's rock,
  // and Kista's viaduct either side of the station (src/detail/akalla-line.ts)
  { name: 'Igelbäcken bridge west', outline: [], anchor: IGELBACKEN.at(190, 17), build: buildSkarpnackViaduct(IGELBACKEN_WEST) },
  { name: 'Igelbäcken bridge east', outline: [], anchor: IGELBACKEN.at(180, 34), build: buildSkarpnackViaduct(IGELBACKEN_EAST) },
  { name: 'Kymlinge', outline: [], anchor: KYMLINGE.at(98, 8.5), build: buildKymlinge },
  { name: 'Kymlingelänken', outline: [], anchor: KL_ANCHOR, build: buildKymlingelanken },
  { name: 'Ärvinge cutting', outline: [], anchor: ARVINGE_ROCK, build: buildArvingeRock },
  { name: 'Kista viaduct 1', outline: [], anchor: KISTA_1.at(125, 3.3), build: buildSkarpnackViaduct(KISTA_VIADUCT_1) },
  { name: 'Kista viaduct 2', outline: [], anchor: KISTA_2.at(104, 4), build: buildSkarpnackViaduct(KISTA_VIADUCT_2) },
  { name: 'Kista viaduct 3', outline: [], anchor: KISTA_3.at(105, 10), build: buildSkarpnackViaduct(KISTA_VIADUCT_3) },
  { name: 'Kista viaduct 4', outline: [], anchor: KISTA_4.at(115, 13), build: buildSkarpnackViaduct(KISTA_VIADUCT_4) },
  // Avicii Arena: the sphere in place of the city's cone, the low buildings round it, and Annexet
  // beside it (src/detail/globen.ts)
  { name: 'Avicii Arena', outline: GLOBEN_OUTLINE, anchor: GLOBEN_ANCHOR, build: buildGloben },
  { name: 'Annexet', outline: ANNEXET_OUTLINE, anchor: ANNEXET_ANCHOR, build: buildAnnexet },
];

export interface TileDetail {
  meshes: THREE.Mesh[];
  replaced: Set<number>;  // buildings left out: a landmark stands there
  detailed: Set<number>;  // buildings whose walls are drawn here (the city keeps their roofs and gables)
}

export function tileDetail(buildings: Building[], x0: number, z0: number, size: number,
  colourOf: (k: number) => [number, number, number], ground: (x: number, z: number) => number | null, streets?: TileStreets): TileDetail {
  const replaced = new Set<number>(), detailed = new Set<number>();
  const B = new Builder();
  const mid = buildings.map((b) => centroid(b.rings[0]));
  // the landmarks: the blocks they stand in for, and those anchored in this tile
  buildings.forEach((b, k) => {
    if (LANDMARKS.some((l) => inPoly(mid[k][0], mid[k][1], l.outline))) replaced.add(k);
  });
  const roads = streets && { ground: streets.ground, draw: (G: StreetGround) => buildStreets(B, { streets: streets.streets, ground: G }, x0, z0, size) };
  for (const l of LANDMARKS) {
    if (l.anchor[0] >= x0 && l.anchor[0] < x0 + size && l.anchor[1] >= z0 && l.anchor[1] < z0 + size) {
      l.build(B, ground, roads);
      B.place([0, 0, 0], 0);
    }
  }
  // the other buildings in the areas, by a grid of their bounds for finding neighbours
  const cell = 20, grid = new Map<string, number[]>();
  const bounds = buildings.map((b) => box(b.rings[0]));
  bounds.forEach(([a, c, d, e], k) => {
    for (let i = Math.floor(a / cell); i <= Math.floor(d / cell); i++) for (let j = Math.floor(c / cell); j <= Math.floor(e / cell); j++) {
      const key = `${i},${j}`;
      (grid.get(key) ?? grid.set(key, []).get(key)!).push(k);
    }
  });
  const insideOther = (x: number, z: number, self: number) => (grid.get(`${Math.floor(x / cell)},${Math.floor(z / cell)}`) ?? []).some((k) => {
    if (k === self || buildings[k].kind === 'roof') return false;
    const [a, c, d, e] = bounds[k];
    return x >= a && x <= d && z >= c && z <= e && inPoly(x, z, buildings[k].rings[0] as V2[]);
  });
  buildings.forEach((b, k) => {
    if (replaced.has(k) || b.kind === 'roof' || b.kind === 'shed' || !inDetailArea(...mid[k])) return;
    detailed.add(k);
    buildFacades(B, b, k, colourOf(k), { ground, insideOther });
  });
  if (streets) buildStreets(B, streets, x0, z0, size);
  const meshes: THREE.Mesh[] = [];
  for (const [mat, geom] of B.geometries()) {
    const m = new THREE.Mesh(geom, detailMaterial(mat));
    m.name = `detail ${mat}`;
    meshes.push(m);
  }
  return { meshes, replaced, detailed };
}

function centroid(ring: [number, number][]): [number, number] {
  let x = 0, z = 0;
  for (const p of ring) { x += p[0]; z += p[1]; }
  return [x / ring.length, z / ring.length];
}
function box(ring: [number, number][]) {
  let a = Infinity, c = Infinity, d = -Infinity, e = -Infinity;
  for (const [x, z] of ring) { a = Math.min(a, x); c = Math.min(c, z); d = Math.max(d, x); e = Math.max(e, z); }
  return [a, c, d, e];
}
function inPoly(x: number, z: number, ring: V2[]) {
  let c = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, zi] = ring[i], [xj, zj] = ring[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c;
  }
  return c;
}
