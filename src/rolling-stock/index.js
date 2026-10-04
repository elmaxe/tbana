import { buildTrain } from './train.js';
import { C20 } from './c20.js';
import { C30 } from './c30.js';

export const TRAIN_TYPES = { C20, C30 };

// Full-length trains as they run in service: three C20 units (139.5 m) or two C30 units (140 m).
export const SERVICE_UNITS = { C20: 3, C30: 2 };

// createTrain('C30', { units: 2, destination: 'Norsborg' }) → { group, cars, length, setDestination, setLights }
export function createTrain(type, opts = {}) {
  const spec = TRAIN_TYPES[type];
  if (!spec) throw new Error(`Unknown train type ${type}`);
  return buildTrain(spec, { ...opts, units: opts.units ?? SERVICE_UNITS[type] });
}
