import { buildTrain } from './train';
import type { BuildOptions, Train, TrainSpec } from './train';
import { C20 } from './c20';
import { interior as C20_INTERIOR } from './c20-interior';
import type { C20InteriorStyle } from './c20-interior';
import { C30 } from './c30';
import { interior as C30_INTERIOR } from './c30-interior';

export type { Car, CarDef, BuildOptions, Train, TrainLights, TrainSpec } from './train';
export type { InteriorSpec } from './interior';
export type { C20InteriorStyle } from './c20-interior';
export { setOutsideLight } from './cabin-light';

export const TRAIN_TYPES = { C20: { ...C20, interior: C20_INTERIOR.upgraded }, C30: { ...C30, interior: C30_INTERIOR } };
export type TrainType = keyof typeof TRAIN_TYPES;
export interface CreateTrainOptions extends BuildOptions { interiorStyle?: C20InteriorStyle }

// Interior styles a type can be built with (the first is the current one).
export const INTERIOR_STYLES: Record<TrainType, string[]> = { C20: ['upgraded', 'original'], C30: ['current'] };

// Full-length trains as they run in service: three C20 units (139.5 m) or two C30 units (140 m).
export const SERVICE_UNITS: Record<TrainType, number> = { C20: 3, C30: 2 };

// createTrain('C30', { units: 2, destination: 'Norsborg' }) → { group, cars, length, setDestination, setLights, setInterior }
// C20 options: interiorStyle 'upgraded' (C20U, 2020–2024, the default) or 'original' (1997).
export function createTrain(type: TrainType, opts: CreateTrainOptions = {}): Train {
  let spec: TrainSpec = TRAIN_TYPES[type];
  if (!spec) throw new Error(`Unknown train type ${type}`);
  if (type === 'C20' && opts.interiorStyle === 'original') spec = { ...spec, interior: C20_INTERIOR.original };
  return buildTrain(spec, { ...opts, units: opts.units ?? SERVICE_UNITS[type] });
}
