import { ReactiveWorkerClient, WorkerMethods } from './workers';
// import { ReactiveWorker } from './workers';
import GenericWorker from 'worker-loader!./GenericWorker';
import { fromEvent, Observable, Subject, isObservable, BehaviorSubject, Subscription } from "rxjs";
import SimplexNoise from 'simplex-noise';
import { makeRandFloat, makeRandInt } from '@redblobgames/prng';

export interface ThreadTask {
  name: string,
  payload: any,
  taskId?: number
}
export interface ThreadResult {
  taskId: number,
  payload: any,
}
export interface workerPool {
  [key: number]: ReactiveWorkerClient
}
export interface workerSubscriptions {
  [key: number]: Subscription
}

export class ReactiveThreadPool {
  private freeWorkers: SharedArrayBuffer;
  private freeWorkersAtomic: Uint8Array;
  workers: workerPool;
  actionQueue: ThreadTask[];
  workerPromises: Promise<Boolean>[];
  private taskId: number;
  private resultSet: SharedArrayBuffer;
  private resultSetAtomic: Uint8Array;
  private randomNoise: SimplexNoise;
  private methodDict;
  private actions;

  constructor(seed: number, public cpus?: number) {
    this.actions = {};
    this.cpus = this.cpus || 3;
    this.actionQueue = [];
    this.workers = {};
    this.freeWorkers = new SharedArrayBuffer(this.cpus);
    this.freeWorkersAtomic = new Uint8Array(this.freeWorkers);
    this.workerPromises = [];
    this.taskId = 0;
    this.randomNoise = new SimplexNoise(makeRandFloat(seed));
    for (let r: number = 0; r < this.cpus; r++) {
      const newWorker: ReactiveWorkerClient = (new ReactiveWorkerClient(new GenericWorker(), false));
      const freeWorkers = this.freeWorkers
      newWorker.action('init').send({r, workerHandler: freeWorkers, seed});
      this.workerPromises.push(new Promise((resolve) => {
        newWorker.on('complete').subscribe(result => {
          resolve(true);
        });
      }));
      this.workers[r] = newWorker;
      this.actions[r] = 0;
    }
    this.actions[-1] = 0;
    this.methodDict = WorkerMethods();
  }

  init(taskSize: number) {
    this.resultSet = new SharedArrayBuffer(taskSize);
    this.resultSetAtomic = new Uint8Array(this.resultSet);
    this.taskId = 0;
  }

  add(action: ThreadTask)
  {
    action.taskId = this.taskId++;
    this.actionQueue.push(action);
    this.executeNext();
  }

  executeNext() {
    let freeWorker: number = -1;
    for (let r = 0; r < this.cpus; r++) {
      freeWorker = Atomics.load(this.freeWorkersAtomic, r) ? r : freeWorker;
    }
    if (freeWorker > -1 && this.actionQueue.length > 0) {
      Atomics.store(this.freeWorkersAtomic, freeWorker, 0);
      const nextAction: ThreadTask = this.actionQueue.shift();
      const name: string = nextAction.name;
      const payload = nextAction.payload;
      const taskId = nextAction.taskId;
      const worker: ReactiveWorkerClient = this.workers[freeWorker];
      const resultSet: SharedArrayBuffer = this.resultSet;
      worker.action('call').send({taskName: name, payload, taskId, resultSet});
      this.actions[freeWorker]++;
      return 1;
    }
    return 0;
  }

  run(): number[] {
    while(this.actionQueue.length > 0)
    {
      const executeNext = this.executeNext();
      // if (!executeNext) {
      //   const nextAction: ThreadTask = this.actionQueue.shift();
      //   this.resultSetAtomic[nextAction.payload.dest || nextAction.taskId] = this.methodDict[nextAction.name](nextAction.payload, this.randomNoise);
      //   this.actions[-1]++;
      // }
    }
    let freedWorkers: number = 0;
    while(!Math.min(...this.freeWorkersAtomic.map((val, i) => Atomics.load(this.freeWorkersAtomic, i)))) {
    }
    const results: number[] = [];
    this.resultSetAtomic.forEach((val, i) => results.push(Number(Atomics.load(this.resultSetAtomic, i))));
    console.log(this.actions);
    return results;
  }

}