import { ReactiveWorker, WorkerMethods } from './workers';
import { EMapMode } from '../types';
import SimplexNoise from 'simplex-noise';
import { makeRandFloat, makeRandInt } from '@redblobgames/prng';

const ctx: Worker = self as any;
const worker = new ReactiveWorker(ctx, false);
let poolData = {};
let id: number;
let freeWorkers: Uint8Array;
let randomNoise: SimplexNoise;
const methodDict = WorkerMethods();

worker.on('init', async ({r, seed, workerHandler}) => {
  randomNoise = new SimplexNoise(makeRandFloat(seed))
  id = r;
  freeWorkers = new Uint8Array(workerHandler);
  Atomics.store(freeWorkers, r, 1);
  console.log('Initializing worker ', id);
  worker.send('complete', id);
}, true);

worker.on('call', async ({taskName, payload, taskId, resultSet}) => {
  const resultSetAtomic = new Uint8Array(resultSet);
  Atomics.store(resultSetAtomic, payload.dest || taskId, methodDict[taskName](payload, randomNoise));
  Atomics.store(freeWorkers, id, 1);
});
