import { ReactiveWorker } from './workers';
import { EMapMode } from '../types';
import { clamp, isArray } from 'lodash';
import SimplexNoise from 'simplex-noise';
import { makeRandFloat, makeRandInt } from '@redblobgames/prng';

const ctx: Worker = self as any;
const worker = new ReactiveWorker(ctx, false);
let poolData = {};
let id = 0;

const executeNext = (freeWorkers, workers, actions, id) => {
    if (actions.length > 0) {
      const nextAction = this.actionQueue.shift();
      const executeNext = this.executeNext;
      const callback = (id) => executeNext(id);
      workers[id].action('call').send({nextAction, callback})
    } else {
      this.freeWorkers.push(id);
    }
}


worker.on('init', ({r}) => {
  id = r;
  console.log('Initializing worker ', id);
  worker.send('complete', id);
}, true);

worker.on('generateTemperature', async ({payload, taskid}) => {
  const result = {};
  worker.send('' + taskid, payload);
  worker.send('finishedTask', id);
});
