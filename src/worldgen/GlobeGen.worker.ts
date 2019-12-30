import { ReactiveWorker } from '../utils/workers';
import { GameLoop } from './GameLoop';
import { IWorldOptions, World, CellGroup } from './World';
import { EMapMode } from '../types';
import { clamp, isArray } from 'lodash';
import SimplexNoise from 'simplex-noise';
import { makeRandFloat, makeRandInt } from '@redblobgames/prng';

const game = new GameLoop(error => {
  console.error(error);
});

const ctx: Worker = self as any;
const worker = new ReactiveWorker(ctx, false);

worker.on('getCellData', async ({r, randomNoise}) => {
  const x = this.globe.r_xyz[3 * r];
  const y = this.globe.r_xyz[3 * r + 1];
  const z = this.globe.r_xyz[3 * r + 2];
  const altitude = 1 - Math.max(0, this.globe.r_elevation[r]);
  const [lat, long] = this.globe.getLatLongForCell(r);
  const random1 = (randomNoise.noise3D(x, y, z) + 1) / 2;
  let localTemp = 0;
  if (this.globe.r_elevation[r] < 0) { // ocean
    const altitude = 1 + this.globe.r_elevation[r];
    // shallow seas are warmer than deep oceans
    localTemp = (
      (0.10 * random1) +
      (0.20 * altitude) +
      (0.70 * this.globe.insolation[r])
    );
  } else { // land
    const altitude = 1 - Math.max(0, this.globe.r_elevation[r]);
    // higher is colder
    // lower is warmer
    localTemp = (
      (0.10 * random1) +
      (0.20 * altitude) +
      (0.70 * this.globe.insolation[r])
    );
  }

  localTemp += localTemp * this.globe.options.climate.temperatureModifier;
  localTemp = clamp(localTemp, 0, 1);
  return localTemp;
}, true);
