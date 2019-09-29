import { ReactiveWorkerClient } from '../utils/workers';
import WorldgenWorker from 'worker-loader!./Worldgen.worker';
import { IGlobeOptions, EMapMode } from 'src/types';
import { GlobeData, CellPoints, CellData } from '../types';


export class WorldgenClient {
  worker$: ReactiveWorkerClient;

  constructor() {
    this.worker$ = new ReactiveWorkerClient(new WorldgenWorker(), false);
  }

  newWorld(options: IGlobeOptions, mapMode: EMapMode): Promise<GlobeData> {
    console.time('worldgen worker');
    return new Promise((resolve) => {
      this.worker$.action('init').send({ options, mapMode });

      this.worker$.on('generate').subscribe(result => {
        console.log('[worldgen client] result', result);

        console.timeEnd('worldgen worker');
        resolve(result);
      });
    });
  }

  async getIntersectedCell(point: number[], dir: number[]): Promise<CellPoints | null> {
    return new Promise((resolve) => {
      this.worker$.action('getIntersectedCell')
        .observe({ point, dir })
        .subscribe(result => resolve(result as CellPoints));
    });
  }

  async getCellData(r: number) {
    return new Promise((resolve) => {
      this.worker$.action('getCellData')
        .observe(r)
        .subscribe(result => resolve(result as CellData));
    })
  }

  async setMapMode(mapMode: EMapMode) {
    return new Promise((resolve) => {
      this.worker$.action('setMapMode')
        .observe(mapMode)
        .subscribe(() => resolve());
    })
  }
}