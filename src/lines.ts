// Line metadata. World axes: +x east, +z south (src/geo.ts).
export type LineId = 'blue' | 'red' | 'green' | 'pink' | 'tram' | 'main';
export type TrainKind = 'metro' | 'commuter' | 'tram' | 'mainline';
// [line number, destination]
export type Destination = [string, string];

export interface Line {
  name: string;
  local: string;
  color: string;
  kind: TrainKind;
  train?: 'C20' | 'C30';
  numbers: string[];
  sign: string;
  signBg: string;
  axis: 'x' | 'z';
  dest: { pos: Destination[]; neg: Destination[] } | null;
  // the next station each way, for riding
  next?: { pos: string; neg: string };
}

// Clearance of every kind; the ones with services also have their (box) train dimensions.
export interface GaugeSpec {
  halfWidth: number;
}

export interface ServiceSpec extends GaugeSpec {
  carLen: number;
  gap: number;
  height: number;
  maxCars: number;
  doors: number;
  vmax: number;
}

export const LINES: Record<LineId, Line> = {
  blue: {
    name: 'Blue line', local: 'Blå linjen', color: '#0a73c4', kind: 'metro', train: 'C20',
    numbers: ['10', '11'], sign: 'T-Centralen', signBg: '#0c4da2', axis: 'x',
    // travel towards +x (east) / -x (west)
    next: { pos: 'Kungsträdgården', neg: 'Rådhuset' },
    dest: {
      pos: [['10', 'Kungsträdgården'], ['11', 'Kungsträdgården']],
      neg: [['10', 'Hjulsta'], ['11', 'Akalla']],
    },
  },
  red: {
    name: 'Red line', local: 'Röda linjen', color: '#d71d24', kind: 'metro', train: 'C30',
    numbers: ['13', '14'], sign: 'T-Centralen', signBg: '#0c4da2', axis: 'z',
    // travel towards +z (south) / -z (north)
    next: { pos: 'Gamla stan', neg: 'Östermalmstorg' },
    dest: {
      pos: [['13', 'Norsborg'], ['14', 'Fruängen']],
      neg: [['13', 'Ropsten'], ['14', 'Mörby centrum']],
    },
  },
  green: {
    name: 'Green line', local: 'Gröna linjen', color: '#1f9a3c', kind: 'metro', train: 'C20',
    numbers: ['17', '18', '19'], sign: 'T-Centralen', signBg: '#0c4da2', axis: 'z',
    next: { pos: 'Gamla stan', neg: 'Hötorget' },
    dest: {
      pos: [['17', 'Skarpnäck'], ['18', 'Farsta strand'], ['19', 'Hagsätra']],
      neg: [['17', 'Åkeshov'], ['18', 'Hässelby strand'], ['19', 'Hässelby strand']],
    },
  },
  pink: {
    name: 'Commuter rail', local: 'Pendeltåg', color: '#e5609a', kind: 'commuter',
    numbers: ['40', '41', '42', '43', '44'], sign: 'Stockholm City', signBg: '#2f343b', axis: 'z',
    next: { pos: 'Stockholm Södra', neg: 'Stockholm Odenplan' },
    dest: {
      pos: [['40', 'Södertälje C'], ['41', 'Södertälje C'], ['42', 'Nynäshamn'], ['43', 'Nynäshamn'], ['44', 'Södertälje C']],
      neg: [['40', 'Uppsala C'], ['41', 'Märsta'], ['42', 'Märsta'], ['43', 'Bålsta'], ['44', 'Bålsta']],
    },
  },
  tram: {
    name: 'Tram 7', local: 'Spårväg City', color: '#7b7d80', kind: 'tram',
    numbers: ['7'], sign: 'T-Centralen', signBg: '#55595f', axis: 'x', dest: null,
  },
  main: {
    name: 'Mainline', local: 'Stockholm C', color: '#8c7b6e', kind: 'mainline',
    numbers: [], sign: 'Stockholm C', signBg: '#2f343b', axis: 'z', dest: null,
  },
};

export const TRAIN_SPECS: { metro: ServiceSpec; commuter: ServiceSpec; tram: GaugeSpec; mainline: GaugeSpec } = {
  metro: { halfWidth: 1.45, carLen: 15.6, gap: 0.5, height: 3.7, maxCars: 9, doors: 3, vmax: 18 },
  commuter: { halfWidth: 1.6, carLen: 26.5, gap: 0.6, height: 4.2, maxCars: 8, doors: 2, vmax: 20 },
  tram: { halfWidth: 1.3 },
  mainline: { halfWidth: 1.6 },
};
