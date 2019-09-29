import { ReactiveWorkerClient } from '../utils/workers';
import WorldgenWorker from 'worker-loader!./Worldgen.worker';
import { IGlobeOptions } from 'src/types';
import { GlobeData } from '../types';


export class WorldgenClient {
  worker$: ReactiveWorkerClient;

  constructor() {
    this.worker$ = new ReactiveWorkerClient(new WorldgenWorker(), true);
  }

  newWorld(options: IGlobeOptions): Promise<GlobeData> {
    console.time('worldgen worker');
    return new Promise((resolve) => {
      this.worker$.action('init').send(options);

      this.worker$.on('generate').subscribe(result => {
        console.log('[worldgen client] result', result);

        console.timeEnd('worldgen worker');
        resolve(result);
      });
    });
  }
}