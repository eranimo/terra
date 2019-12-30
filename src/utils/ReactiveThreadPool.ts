import { ReactiveWorkerClient } from './workers';
// import { ReactiveWorker } from './workers';
import GenericWorker from 'worker-loader!./GenericWorker';
import { fromEvent, Observable, Subject, isObservable, BehaviorSubject, Subscription } from "rxjs";
export interface ThreadTask {
  name: string,
  payload: object,
  subscription: () => void,
  taskId?: number,
}
export interface ThreadResult {
  taskId: number,
  payload: object,
}
export interface workerPool {
  [key: number]: ReactiveWorkerClient
}
export interface workerSubscriptions {
  [key: number]: Subscription
}

export class ReactiveThreadPool {
  freeWorkers: number[];
  workers: workerPool;
  actionQueue: ThreadTask[];
  workerPromises: Promise<Boolean>[];
  subscriptions: object;
  taskId: number;

  constructor(public cpus?: number) {
    this.cpus = this.cpus || 2;
    this.actionQueue = [];
    this.workers = {};
    this.freeWorkers = [];
    this.workerPromises = [];
    this.taskId = 0;
    for (let r: number = 0; r < this.cpus; r++) {
      const newWorker: ReactiveWorkerClient = (new ReactiveWorkerClient(new GenericWorker(), false));
      newWorker.action('init').send({r});
      this.workerPromises.push(new Promise((resolve) => {
        newWorker.on('complete').subscribe(result => {
          this.freeWorkers.push(result);
          resolve(true);
        });
      }));
      newWorker.on('finishedTask').subscribe(id => {
        this.executeNext(id);
      });
      this.workers[r] = newWorker;
    }
  }

  add(action: ThreadTask)
  {
    console.log(this.freeWorkers);
    action.taskId = this.taskId++;
    this.actionQueue.push(action);
    if(this.freeWorkers.length > 0) {
      this.executeNext(this.freeWorkers.shift());
    }
  }

  executeNext(id:number) {
    if (this.actionQueue.length > 0) {
      const nextAction: ThreadTask = this.actionQueue.shift();
      const payload = nextAction.payload;
      const taskId = nextAction.taskId;
      const worker: ReactiveWorkerClient = this.workers[id];
      worker.action(nextAction.name).send({payload, taskId});
      worker.on('' + taskId).subscribe(nextAction.subscription);
    } else {
      this.freeWorkers.push(id);
    }
  } 

}