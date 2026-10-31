import type { Builder, V2, V3 } from './builder.ts';
import { bar, block, Frame, type Ground, v3 } from './gubbangen.ts';
import { band, barRailing, CONCRETE, type Edge, steps } from './farsta-line-north.ts';
import { rod } from './gamla-stan.ts';
import { lampMast, Line, lines, post, railBar, table } from './ropsten.ts';

// S:t Eriksbron, which carries Sankt Eriksgatan from Kungsholmen over Barnhusviken, Kungsholms
// strand, Klarastrandsleden, the railway's tracks out of the Central station and Atlasmuren to
// Vasastan, and the green line between Fridhemsplan and S:t Eriksplan in a storey under the road:
// s metres north-north-eastwards along it from the middle of its deck, u to the right
// (east-south-east). The tracks are 1.7 m east and 1.5 m west of u = 0.1, the deck's middle.
//
// - The road's deck (1922–25; Swedish Wikipedia): a concrete slab on four riveted plate girders,
//   painted pale green, with cross beams and a stringer under the slab between the inner two and
//   wind bracing between each inner girder and the outer one beside it; concrete edge beams with
//   green railings of bars; four lanes with a cycle lane at either side and pavements raised a
//   kerb; lamp masts along both edges.
// - Three piers, a concrete shaft each with a console either side out under the outer girders, its
//   underside sloping down to the shaft, on a footing in the water or in the ground north of it.
// - The metro's storey (1944): a welded steel trough with a concrete floor, its sides plate girders
//   painted a darker green, through an opening 6.81 × 4.62 m in each pier and in the abutments,
//   which lowered the clearance under the bridge from 13.5 to 9.2 m (Swedish Wikipedia, from
//   Vinberg 1937 and Dufwa 1985): the trough's underside 4.3 m under the road's girders.
// - The abutments: concrete walls across the deck's whole width down to Kungsholms strand in the
//   south and Atlasmuren in the north, the trough's openings in them.
//
// The deck's edges, its surface and its ends, the ground and the water under it from Lantmäteriet's
// laser scan (Laserdata Nedladdning, 2021, CC BY 4.0); the piers, the consoles, the girders' places
// and the lamp masts from Google's 3D mesh; the girders, the bracing, the trough and the colours
// from photographs on Wikimedia Commons; the lanes from OpenStreetMap. The tracks' heights are set
// by the room the trough needs under the road's girders (data/height-corrections.json). The network
// draws the tracks in the trough and leaves its girders, piers, railings and headwalls to this
// (src/detail/viaducts.ts); the city leaves out the road on it, OpenStreetMap's bridge, which this
// lays on its deck.
export const SANKT_ERIKSBRON = new Frame([-1380.44, -650.8], [0.3826, -0.92391]);
const SE = SANKT_ERIKSBRON;
// the deck's middle and the trough's (u), and the rails' top along it (the tracks' heights)
const MID = 0.1;
const rail = (s: number) => 10.732 + 0.001177 * s;
// the road's surface down its middle (the laser scan's, every 8 m)
const ROAD = table([[-80, 17.17], [-72, 17.21], [-64, 17.28], [-56, 17.37], [-48, 17.45], [-40, 17.52], [-32, 17.61], [-24, 17.67],
  [-16, 17.75], [-8, 17.81], [0, 17.84], [8, 17.84], [16, 17.8], [24, 17.76], [32, 17.7], [40, 17.62], [48, 17.53], [56, 17.45], [64, 17.38],
  [72, 17.3], [80, 17.24]]);
// the deck's edges, and where its slab ends in the abutments; the abutments' faces (the laser
// scan's ground runs on under the deck to them); the piers' middles
const LO = -12.4, HI = 12.6;
const DECK: V2 = [-79.5, 76.5], FACES: V2 = [-76.8, 74.1], PIERS = [-54.6, -14.6, 26.2];
const WATER = 0.87;

// The road's cross-section, from the road's surface: the slab under it, the girders under the slab
// (their bottom 3.05 m under the road), the edge beams' fascia and the kerb they rise to.
const SLAB = -0.35, GIRDER_FOOT = -3.05, FASCIA = -0.65, EDGE_TOP = 0.35, EDGE_W = 0.45, KERB = 0.12;
// the girders across (from the middle), the cross beams' depth and spacing
const GIRDERS = [-10.4, -6.25, 6.25, 10.4], CROSS = { depth: 0.9, every: 4 }, FLANGE = 0.5;
// from the middle: the pavements' kerbs, the cycle lanes' lines, the lane lines and the centre line
const PAVEMENT = 8.25, CYCLE = 6.6, LANE = 3.35;
const LAMPS = [-67, -37.2, -7.7, 20.7, 48.7], LAMP_H = 9;
// The trough, from the rails' top: its underside, its floor (the network's ballast lies on it), the
// top of its sides, which are girders 0.1 m thick 3.32 m either side of its middle, with flanges.
const TROUGH = { under: -0.8, floor: -0.62, top: 2.05, web: 3.32, thick: 0.1, flange: 0.45 };
// The piers, from their middles: half their thickness along the bridge, the shaft's half-width, the
// opening's half-width and height (from the trough's underside), the consoles' tips, their depth
// there and their fall to the shaft, the shaft's top under the cross beams, the footing's reach.
const PIER = { half: 1.8, shaft: 4.5, opening: 3.4, openingH: 4.62, chamfer: 0.7, tip: 11.3, tipDepth: 1.2, fall: 6.0, foot: 2.4, footU: 5.4 };
// the abutments' depth into the banks, and the tunnels' outsides behind them (the network's boxes)
const ABUTMENT = 7, BOX = { half: 4.6, top: 4.8 };

const GREEN = 0x8fae95, TROUGH_GREEN = 0x7b9a82, RAIL_GREEN = 0x83a48b, BEARING = 0x5d6266, ASPHALT = 0x5f6164, PAVING = 0x86837e,
  PIER_GREY = 0xaaa59c, ABUT_GREY = 0xa29d94, CABLES = 0x2c2e30;

export function buildSanktEriksbron(B: Builder, ground: Ground) {
  B.place([0, 0, 0], 0);
  const at = (d: number): Edge => () => MID + d;
  const road = (s: number) => ROAD(s);
  const groundAt = (s: number, u: number) => ground(...SE.at(s, u));

  // ---------------------------------------------------------------- the road's deck
  const ds = steps(DECK[0], DECK[1], [...FACES, ...PIERS], 4);
  const fs = ds.filter((s) => s >= FACES[0] - 0.01 && s <= FACES[1] + 0.01);
  // the slab, the edge beams and their fascia
  B.tint(CONCRETE);
  band(B, SE, ds, () => LO + EDGE_W, () => HI - EDGE_W, (s) => road(s) + SLAB, (s) => road(s) - 0.02, 'fl-under', 3);
  band(B, SE, ds, () => LO, () => LO + EDGE_W, (s) => road(s) + FASCIA, (s) => road(s) + EDGE_TOP, 'gt-boards', 2.4);
  band(B, SE, ds, () => HI - EDGE_W, () => HI, (s) => road(s) + FASCIA, (s) => road(s) + EDGE_TOP, 'gt-boards', 2.4);
  // the road and its pavements
  B.tint(ASPHALT);
  band(B, SE, ds, at(-PAVEMENT), at(PAVEMENT), (s) => road(s) - 0.1, (s) => road(s), 'rp-asphalt', 6, { faces: 'top' });
  B.tint(PAVING);
  band(B, SE, ds, () => LO + EDGE_W, at(-PAVEMENT), (s) => road(s) - 0.1, (s) => road(s) + KERB, 'rp-asphalt', 6);
  band(B, SE, ds, at(PAVEMENT), () => HI - EDGE_W, (s) => road(s) - 0.1, (s) => road(s) + KERB, 'rp-asphalt', 6);
  // the lines: the centre line, the lanes', the cycle lanes'
  const L = new Line([SE.at(DECK[0], 0), SE.at(DECK[1], 0)]);
  const top = (t: number) => road(t + DECK[0]);
  const len = DECK[1] - DECK[0], u = (d: number) => () => MID + d;
  lines(B, L, top, 0, len, [0, len], [u(-0.1), u(0.1), u(-CYCLE), u(CYCLE)], false);
  lines(B, L, top, 0, len, [0, len], [u(-LANE), u(LANE)], true);
  // the railings on the edge beams, and the lamp masts beside them
  B.tint(RAIL_GREEN);
  const rs = steps(DECK[0] - 1, DECK[1] + 1, [], 2);
  barRailing(B, rs.map((s) => v3(SE.at(s, LO + 0.2), road(s) + EDGE_TOP)), 1.1);
  barRailing(B, rs.map((s) => v3(SE.at(s, HI - 0.2), road(s) + EDGE_TOP)), 1.1);
  for (const s of LAMPS) {
    lampMast(B, SE.at(s, LO + 0.25), road(s) + EDGE_TOP, LAMP_H, SE.t, [2.2]);
    lampMast(B, SE.at(s, HI - 0.25), road(s) + EDGE_TOP, LAMP_H, SE.t, [-2.2]);
  }

  // ---------------------------------------------------------------- the road's girders
  // between the abutments' faces: the four plate girders, each a web between two flanges, the outer
  // ones stiffened every 2 m on their outer face
  B.tint(GREEN);
  const foot = (s: number) => road(s) + GIRDER_FOOT, under = (s: number) => road(s) + SLAB;
  for (const g of GIRDERS) {
    const c = MID + g;
    band(B, SE, fs, () => c - 0.05, () => c + 0.05, (s) => foot(s) + 0.05, (s) => under(s) - 0.05, 'gs-paint', 4, { faces: 'sides' });
    band(B, SE, fs, () => c - FLANGE / 2, () => c + FLANGE / 2, foot, (s) => foot(s) + 0.05, 'gs-paint', 4);
    band(B, SE, fs, () => c - FLANGE / 2, () => c + FLANGE / 2, (s) => under(s) - 0.05, under, 'gs-paint', 4, { faces: 'sides' });
    if (Math.abs(g) > 8) {
      const out = Math.sign(g);
      for (let s = FACES[0] + 1; s < FACES[1]; s += 2) {
        if (PIERS.some((p) => Math.abs(s - p) < PIER.half + 0.2)) continue;
        post(B, SE.at(s, c + out * 0.11), SE.t, 0.14, 0.12, foot(s) + 0.05, under(s) - 0.05, 'gs-paint', 1);
      }
    }
  }
  // the cross beams and the stringer between the inner girders, the cross frames out to the outer ones
  for (let s = FACES[0] + 2; s < FACES[1] - 1; s += CROSS.every) {
    const y0 = under(s) - CROSS.depth, y1 = under(s) - 0.02;
    block(B, SE, [[s - 0.13, MID + GIRDERS[0]], [s + 0.13, MID + GIRDERS[0]], [s + 0.13, MID + GIRDERS[3]], [s - 0.13, MID + GIRDERS[3]]],
      () => y0, () => y1, 'gs-paint', 2);
  }
  band(B, SE, fs, at(-0.14), at(0.14), (s) => under(s) - 0.7, (s) => under(s) - 0.02, 'gs-paint', 2, { faces: 'sides' });
  band(B, SE, fs, at(-0.14), at(0.14), (s) => under(s) - 0.72, (s) => under(s) - 0.7, 'gs-paint', 2);
  // the wind bracing between each inner girder and the outer one, crossing every 8 m at the bottom
  for (const side of [-1, 1]) {
    const a = MID + side * 6.25, b = MID + side * 10.4;
    for (let s = FACES[0] + 2; s + 8 <= FACES[1] - 1; s += 8) {
      if (PIERS.some((p) => p > s - PIER.half && p < s + 8 + PIER.half)) continue;
      const y = (t: number) => foot(t) + 0.15;
      bar(B, v3(SE.at(s, a), y(s)), v3(SE.at(s + 8, b), y(s + 8)), 0.14, 0.14, 'gs-paint');
      bar(B, v3(SE.at(s, b), y(s)), v3(SE.at(s + 8, a), y(s + 8)), 0.14, 0.14, 'gs-paint');
    }
  }

  // ---------------------------------------------------------------- the metro's trough
  // its floor, its sides with their flanges, and the cable trays along their tops
  const ts = steps(FACES[0], FACES[1], PIERS.flatMap((p) => [p - PIER.half, p + PIER.half]), 4);
  const tr = (d: number) => (s: number) => rail(s) + d;
  B.tint(TROUGH_GREEN);
  const T = TROUGH;
  band(B, SE, ts, at(-T.web - T.thick), at(T.web + T.thick), tr(T.under), tr(T.under + 0.1), 'gs-paint', 3);
  B.tint(CONCRETE);
  band(B, SE, ts, at(-T.web), at(T.web), tr(T.under + 0.1), tr(T.floor), 'concrete', 3, { faces: 'top' });
  for (const side of [-1, 1]) {
    const inner = side * T.web, outer = side * (T.web + T.thick);
    const [lo, hi] = side < 0 ? [outer, inner] : [inner, outer];
    B.tint(TROUGH_GREEN);
    band(B, SE, ts, at(lo), at(hi), tr(T.under), tr(T.top - 0.05), 'gs-paint', 3, { faces: 'sides' });
    // (the top flange, wider outwards than in, clear of the trains)
    const [flo, fhi] = side < 0 ? [-T.web - T.thick - 0.18, -T.web + 0.18] : [T.web - 0.18, T.web + T.thick + 0.18];
    band(B, SE, ts, at(flo), at(fhi), tr(T.top - 0.05), tr(T.top), 'gs-paint', 3);
    const [blo, bhi] = side < 0 ? [-T.web - T.thick - 0.25, -T.web - T.thick] : [T.web + T.thick, T.web + T.thick + 0.25];
    band(B, SE, ts, at(blo), at(bhi), tr(T.under), tr(T.under + 0.05), 'gs-paint', 3);
    B.tint(CABLES);
    const [clo, chi] = side < 0 ? [-T.web - 0.05, -T.web + 0.15] : [T.web - 0.15, T.web + 0.05];
    band(B, SE, ts, at(clo), at(chi), tr(T.top), tr(T.top + 0.28), 'gs-paint', 3);
  }

  // ---------------------------------------------------------------- the piers
  for (const p of PIERS) {
    const r = rail(p), girderFoot = foot(p), shaftTop = under(p) - CROSS.depth - 0.05;
    const consoleTop = girderFoot - 0.25, openTop = r + T.under + PIER.openingH;
    const sq = (u0: number, u1: number, h = PIER.half): V2[] => [[p - h, MID + u0], [p + h, MID + u0], [p + h, MID + u1], [p - h, MID + u1]];
    // the footing: in the water, or in the ground north of it
    const corners = sq(-PIER.footU, PIER.footU, PIER.foot);
    const gs = corners.map(([s, uu]) => groundAt(s, uu));
    const wet = gs.some((g) => g === null || g < WATER + 0.3);
    const lowest = Math.min(...gs.map((g) => g ?? WATER - 3));
    const footTop = wet ? WATER + 0.5 : Math.max(...gs.map((g) => g ?? WATER)) + 0.15;
    B.tint(PIER_GREY);
    block(B, SE, corners, () => Math.min(lowest, WATER) - 2, () => footTop, 'concrete', 3);
    // the shaft round the opening: under it, either side of it, over it, and the chamfers at its top
    const S = PIER.shaft, O = PIER.opening;
    block(B, SE, sq(-S, S), () => footTop - 0.5, () => r + T.under, 'concrete', 3);
    block(B, SE, sq(-S, -O), () => r + T.under, () => shaftTop, 'concrete', 3);
    block(B, SE, sq(O, S), () => r + T.under, () => shaftTop, 'concrete', 3);
    block(B, SE, sq(-O, O), () => openTop, () => shaftTop, 'concrete', 3);
    const c = PIER.chamfer;
    for (const side of [-1, 1]) {
      // the chamfer in the opening's top corner, and the console, its underside falling to the shaft
      const m = (d: number) => MID + side * d;
      along(B, p - PIER.half, p + PIER.half, [[m(O), openTop - c], [m(O), openTop], [m(O - c), openTop]], 'concrete', 3);
      along(B, p - PIER.half, p + PIER.half, [[m(S), consoleTop - PIER.fall], [m(S), consoleTop], [m(PIER.tip), consoleTop],
        [m(PIER.tip), consoleTop - PIER.tipDepth]], 'concrete', 3);
    }
    // the bearings under the girders
    B.tint(BEARING);
    for (const g of GIRDERS) post(B, SE.at(p, MID + g), SE.t, 0.9, 0.7, consoleTop - 0.02, girderFoot, 'metal', 1);
  }

  // ---------------------------------------------------------------- the abutments
  // into the banks from their faces: either side of the tunnel and over and under it, and at the face
  // the opening, as the piers', narrower than the tunnel behind
  for (const [face, dir] of [[FACES[0], -1], [FACES[1], 1]] as const) {
    const back = face + dir * ABUTMENT, r = rail(face), y = road(face);
    const sq = (u0: number, u1: number, s1 = back): V2[] => [[face, MID + u0], [s1, MID + u0], [s1, MID + u1], [face, MID + u1]];
    const plan = sq(LO - MID - 0.3, HI - MID + 0.3);
    const street = Math.min(...plan.map(([s, uu]) => groundAt(s, uu) ?? r - 6));
    const bottom = () => street - 1, topY = () => y + SLAB - 0.01;
    B.tint(ABUT_GREY);
    block(B, SE, sq(LO - MID - 0.3, -BOX.half), bottom, topY, 'concrete', 3);
    block(B, SE, sq(BOX.half, HI - MID + 0.3), bottom, topY, 'concrete', 3);
    block(B, SE, sq(-BOX.half, BOX.half), () => r + BOX.top, topY, 'concrete', 3);
    block(B, SE, sq(-BOX.half, BOX.half), bottom, () => r + T.under, 'concrete', 3);
    const O = PIER.opening, openTop = r + T.under + PIER.openingH, frame = face + dir * 1.2;
    block(B, SE, sq(-BOX.half, -O, frame), () => r + T.under, () => r + BOX.top, 'concrete', 3);
    block(B, SE, sq(O, BOX.half, frame), () => r + T.under, () => r + BOX.top, 'concrete', 3);
    block(B, SE, sq(-O, O, frame), () => openTop, () => r + BOX.top, 'concrete', 3);
  }
}

// ---------------------------------------------------------------- the railway under it
// The railway's tracks between the Central station and Karlberg under the bridge's northern spans,
// which the city leaves out, within 240 m of its middle: Ostkustbanan's four main lines, the
// sidings and the yard's tracks beside them, on their ballast, with the overhead line over each on
// masts beside it, brought down to pass under the bridge. Their lines are OpenStreetMap's, their
// height the city's ground (the laser scan's: the ballast at 4.3–5.5 m); the masts every 60 m
// where there is room beside a track, as in photographs of the yard, their places a guess.
const YARD: number[][] = [
  /* w137005828 */ [-1486.9,-768.2,-1533.9,-794.0,-1556.0,-807.3],
  /* w137005833 */ [-1507.4,-757.8,-1540.3,-778.2,-1568.1,-797.7],
  /* w137005846 */ [-1507.6,-764.9,-1568.1,-797.7],
  /* w137005853 main */ [-1153.4,-627.2,-1179.2,-635.0,-1273.8,-667.7,-1305.0,-679.3,-1376.4,-707.1,-1412.7,-722.8,-1452.3,-740.9,-1466.4,-748.2,-1476.8,-753.3],
  /* w137007098 */ [-1154.2,-608.6,-1173,-617.4],
  /* w137007099 */ [-1213.2,-636.2,-1198.6,-629.6,-1173,-617.4],
  /* w137007100 siding */ [-1154.2,-608.6,-1173.8,-613.0,-1216.3,-623],
  /* w137030502 siding */ [-1155.6,-601.0,-1197.8,-616.4,-1216.3,-623.0,-1255.6,-636.2,-1304.1,-653.7,-1337.9,-666.2,-1399.4,-690.9,-1435.0,-706.9,-1463.3,-720.0,-1498.9,-737.8,-1522.1,-750.1,-1557.0,-770.2,-1569.0,-777.5],
  /* w137030508 */ [-1148.4,-637.9,-1175.3,-645.7,-1213.2,-658.0,-1241.7,-666.6,-1285.7,-678.7],
  /* w137030521 main */ [-1153.2,-615.9,-1163.3,-619.1,-1213.2,-636.2],
  /* w137037789 siding */ [-1173.0,-617.4,-1204.7,-628.0,-1301.2,-662.0,-1363.8,-686.5,-1411.6,-706.3,-1447.0,-722.2,-1487.0,-741.3,-1517.8,-758.0,-1527.9,-763.6,-1551.4,-777.3,-1563.2,-784.5],
  /* w140039615 */ [-1476.8,-753.3,-1508.7,-772.5,-1538.2,-792.1,-1557.5,-806.7],
  /* w211795443 main */ [-1155.7,-623.3,-1181.0,-631.4,-1218.4,-644.0,-1275.5,-663.9,-1343.8,-689.6,-1378.1,-703.1,-1414.4,-718.9,-1454.8,-737.4,-1490.6,-755.0,-1507.6,-764.9],
  /* w224067478 yard */ [-1152.5,-605.6,-1205.3,-624.0,-1254.8,-640.8,-1302.4,-657.7,-1362.1,-681.1,-1414.7,-702.8,-1460.9,-724.0,-1497.1,-741.8,-1530.5,-759.9,-1554.6,-773.9,-1566.3,-781.1],
  /* w243576399 main */ [-1213.2,-636.2,-1251.2,-649.3,-1299.3,-666.3,-1332.8,-678.8,-1380.2,-697.7,-1417.4,-713.6],
  /* w244229893 */ [-1153.3,-610.6,-1173,-617.4],
  /* w244229896 main */ [-1507.6,-764.9,-1562.4,-798.4],
  /* w244229897 main */ [-1507.4,-757.8,-1541.0,-776.4,-1562.1,-788.9],
  /* w311474325 main */ [-1551.3,-811.1,-1516.2,-786.9,-1486.9,-768.2,-1471.5,-758.7,-1449.0,-746.7,-1411.1,-728.2],
  /* w851930523 main */ [-1411.1,-728.2,-1374.3,-712.6,-1339.5,-699.0,-1317.7,-690.7,-1303.9,-685.3,-1285.7,-678.7,-1214.8,-654.1,-1178.3,-641.8,-1153.3,-634.1,-1141.5,-631.2],
  /* w851930524 main */ [-1417.4,-713.6,-1457.5,-732.5,-1492.5,-749.3,-1507.4,-757.8],
  /* w851932330 main */ [-1476.8,-753.3,-1508.8,-770.6,-1539.4,-788.4,-1557.5,-800.6]
];
export const YARD_ANCHOR: V2 = SE.at(45, 0);
const BALLAST = 0x847b72, STEEL = 0x8a8580, MASTS = 0x9a9ea2, WIRE = 0x3a3a3a;
const GAUGE = 0.7175, CONTACT = 5.5, MESSENGER = 6.6, MAST_OUT = 2.5, MAST_EVERY = 60;

export function buildYard(B: Builder, ground: Ground) {
  B.place([0, 0, 0], 0);
  const lines = YARD.map((f) => new Line(Array.from({ length: f.length / 2 }, (_, i): V2 => [f[2 * i], f[2 * i + 1]])));
  // the bridge's frame at a point, and how high over the ground a wire under it may run: under the
  // trough, under the road's girders, or anywhere else
  const local = (x: number, z: number): V2 => {
    const dx = x - SE.o[0], dz = z - SE.o[1];
    return [dx * SE.t[0] + dz * SE.t[1], -dx * SE.t[1] + dz * SE.t[0]];
  };
  const clearance = (p: V2) => {
    const [s, uu] = local(p[0], p[1]);
    if (s < FACES[0] - 1 || s > FACES[1] + 1 || uu < LO - 1 || uu > HI + 1) return Infinity;
    return Math.abs(uu - MID) < TROUGH.web + 0.4 ? rail(s) + TROUGH.under : ROAD(s) + GIRDER_FOOT;
  };
  // every track's samples every 4 m: its points, its sleepers' top
  const runs = lines.map((L, k) => {
    const ss = steps(0, L.length, [], 4);
    const g = (s: number, uu: number) => { const q = L.at(s, uu); return ground(q[0], q[1]); };
    const tops = ss.map((s) => Math.max(...[-1.4, 0, 1.4].map((uu) => g(s, uu) ?? 4.5)) + 0.28 + k * 0.004);
    return { L, ss, tops, g };
  });
  // a point beside another track, or on the bridge's pier, is no place for a mast
  const crowded = (p: V2) => runs.some(({ L }) => {
    for (let s = 0; s <= L.length; s += 2) { const q = L.at(s, 0); if (Math.hypot(q[0] - p[0], q[1] - p[1]) < MAST_OUT - 0.4) return true; }
    return false;
  }) || clearance(p) < Infinity;

  for (const { L, ss, tops, g } of runs) {
    // the ballast sloping out to the ground, the sleepers, the rails
    B.tint(BALLAST);
    loftRows(B, ss.map((s, i) => [v3(L.at(s, -2.6), Math.min(g(s, -2.6) ?? tops[i] - 0.5, tops[i] - 0.35) - 0.05), v3(L.at(s, -1.55), tops[i] - 0.03),
      v3(L.at(s, 1.55), tops[i] - 0.03), v3(L.at(s, 2.6), Math.min(g(s, 2.6) ?? tops[i] - 0.5, tops[i] - 0.35) - 0.05)]), 'stone', 3);
    B.tint(0xffffff);
    loftRows(B, ss.map((s, i) => [v3(L.at(s, -1.3), tops[i]), v3(L.at(s, 1.3), tops[i])]), 'gs-bed', 4, (i, k) => [k, ss[i] / 2.6]);
    B.tint(STEEL);
    for (const d of [-GAUGE, GAUGE]) {
      for (let i = 0; i + 1 < ss.length; i++) railBar(B, v3(L.at(ss[i], d), tops[i] + 0.17), v3(L.at(ss[i + 1], d), tops[i + 1] + 0.17));
    }
    // the overhead line: its heights over the rails, brought down at 4 % to pass under the bridge
    const rails = (i: number) => tops[i] + 0.17;
    const room = ss.map((s, i) => clearance(L.at(s, 0)) - rails(i));
    const eased = ss.map((s) => Math.min(...ss.map((t, j) => room[j] + Math.abs(s - t) * 0.04)));
    const messenger = (i: number) => Math.min(MESSENGER, eased[i] - 0.3), contact = (i: number) => Math.min(CONTACT, messenger(i) - 0.5);
    B.tint(WIRE);
    const ws = [...ss.keys()].filter((i) => i % 2 === 0 || i === ss.length - 1);
    for (let n = 0; n + 1 < ws.length; n++) {
      const [i, j] = [ws[n], ws[n + 1]], a = L.at(ss[i], 0), b = L.at(ss[j], 0);
      rod(B, v3(a, rails(i) + contact(i)), v3(b, rails(j) + contact(j)), 0.025, 0.025, 'metal');
      rod(B, v3(a, rails(i) + messenger(i)), v3(b, rails(j) + messenger(j)), 0.025, 0.025, 'metal');
    }
    // the masts, on whichever side has room, each with its cantilever out over the track
    for (let s = 20; s < L.length - 10; s += MAST_EVERY) {
      const i = Math.round(s / (ss[1] - ss[0]));
      if (i >= ss.length) continue;
      const side = [1, -1].find((d) => !crowded(L.at(ss[i], d * MAST_OUT)));
      if (!side) continue;
      const p = L.at(ss[i], side * MAST_OUT), t = L.frame(ss[i]).t, y = rails(i), gr = g(ss[i], side * MAST_OUT) ?? y - 0.4;
      B.tint(MASTS);
      post(B, p, t, 0.26, 0.3, gr - 0.5, y + MESSENGER + 1, 'metal', 2);
      const tip = L.at(ss[i], -side * 0.9), arm = L.at(ss[i], side * (MAST_OUT - 0.15));
      rod(B, v3(arm, y + messenger(i) + 0.1), v3(tip, y + messenger(i) + 0.1), 0.08, 0.08, 'metal');
      rod(B, v3(arm, y + contact(i) + 0.1), v3(tip, y + contact(i) + 0.1), 0.06, 0.06, 'metal');
    }
  }
}

// Quads between rows of points across, each facing up, as many wide as a row has gaps.
function loftRows(B: Builder, rows: V3[][], mat: string, tile: number, uv?: (i: number, k: number) => V2) {
  for (let i = 0; i + 1 < rows.length; i++) {
    for (let k = 0; k + 1 < rows[i].length; k++) {
      const q = [rows[i][k], rows[i][k + 1], rows[i + 1][k + 1], rows[i + 1][k]];
      B.poly(q, [0, 1, 0], mat, tile, uv && [uv(i, k), uv(i, k + 1), uv(i + 1, k + 1), uv(i + 1, k)]);
    }
  }
}

// A prism along the bridge from s0 to s1, its cross-section the convex polygon `sec` of (u, y).
function along(B: Builder, s0: number, s1: number, sec: V2[], mat: string, tile: number) {
  let area = 0;
  for (let k = 0; k < sec.length; k++) { const [a, b] = [sec[k], sec[(k + 1) % sec.length]]; area += a[0] * b[1] - b[0] * a[1]; }
  const P = (s: number, [u, y]: V2) => v3(SE.at(s, u), y), r = SE.right, t = SE.along;
  for (let k = 0; k < sec.length; k++) {
    const a = sec[k], b = sec[(k + 1) % sec.length], du = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(du, dy) || 1;
    // (outward: the edge turned a quarter away from the inside)
    const [nu, ny] = area > 0 ? [dy / l, -du / l] : [-dy / l, du / l];
    B.poly([P(s0, a), P(s1, a), P(s1, b), P(s0, b)], [r[0] * nu, ny, r[2] * nu], mat, tile);
  }
  B.poly(sec.map((q) => P(s0, q)), [-t[0], 0, -t[2]], mat, tile);
  B.poly(sec.map((q) => P(s1, q)), t, mat, tile);
}

// the anchor it is built with (its tile has all of it)
export const SANKT_ERIKSBRON_ANCHOR: V2 = SE.at(0, MID);