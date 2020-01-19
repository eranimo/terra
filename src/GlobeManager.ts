import { IGlobeOptions, EMapMode, WorldData, WorldExport } from './types';
import { BehaviorSubject } from 'rxjs';
import { logGroupTime } from './utils';
import { WorldgenClient } from './worldgen/WorldgenClient';


export const initialOptions: IGlobeOptions = {
  core: {
    seed: 123,
  },
  sphere: {
    numberCells: 35_000,
    jitter: 0.30,
    protrudeHeight: 0, // 0.25,
  },
  hydrology: {
    flowModifier: 0.4,
    moistureModifier: 0,
  },
  climate: {
    temperatureModifier: 1,
    minTemperature: -40,
    maxTemperature: 30,
  },
  geology: {
    numberPlates: 25,
    oceanPlatePercent: 0.75,
    terrainRoughness: 0.5,
    heightModifier: -0.25,
    plateCollisionThreshold: 0.75,
  },
};

const DEFAULT_MAP_MODE = EMapMode.BIOME;

export class GlobeManager {
  worldOptions$: BehaviorSubject<IGlobeOptions>;
  world$: BehaviorSubject<WorldData>;
  loading$: BehaviorSubject<boolean>;
  mapMode: EMapMode;
  worldExport$: BehaviorSubject<WorldExport>;

  constructor(
    protected client: WorldgenClient,
    options: IGlobeOptions = initialOptions,
  ) {
    this.worldOptions$ = new BehaviorSubject<IGlobeOptions>(Object.assign({}, options));
    this.world$ = new BehaviorSubject<WorldData>(null);
    this.worldExport$ = new BehaviorSubject<WorldExport>(null);
    this.loading$ = new BehaviorSubject(false);
    this.mapMode = DEFAULT_MAP_MODE;

    this.worldOptions$.subscribe(() => {
      this.loading$.next(true);
      this.generate().then(() => {
        this.loading$.next(false);
      });
    });
  }

  public setMapMode(mapMode: EMapMode) {
    this.mapMode = mapMode;
  }

  @logGroupTime('generate')
  public async generate() {
    const result = await this.client.newWorld(this.worldOptions$.value, this.mapMode);
    this.world$.next(result.world);
    this.worldExport$.next(result.export);
    return result;
  }
}