import { ReactiveWorkerClient } from '../utils/workers';
import WorldgenWorker from 'worker-loader!./Worldgen.worker';
import { IGlobeOptions } from 'src/types';


export class WorldgenClient {
  worker$: ReactiveWorkerClient;

  constructor() {
    this.worker$ = new ReactiveWorkerClient(new WorldgenWorker(), true);
  }

  newWorld(options: IGlobeOptions): Promise<any> {
    return new Promise((resolve) => {
      this.worker$.action('init').send(options);
      this.worker$.on('generate').subscribe(result => {
        console.log('[worldgen client] result', result);

        const { t_xyz } = result;
        console.log(t_xyz);
        resolve({

        });
      });
    });
  }
}