import { IGlobeOptions, EMapMode, GlobeData } from './types';
import { BehaviorSubject } from 'rxjs';
import { logGroupTime } from './utils';
import { WorldgenClient } from './worldgen/WorldgenClient';


export const initialOptions: IGlobeOptions = {
  core: {
    seed: 123,
  },
  sphere: {
    numberCells: 35_000,
    jitter: 0.4,
    protrudeHeight: 0.25,
  },
  hydrology: {
    flowModifier: 0.2,
    moistureModifier: 0,
  },
  climate: {
    temperatureModifier: 0,
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
  globeOptions$: BehaviorSubject<IGlobeOptions>;
  globe$: BehaviorSubject<GlobeData>;
  loading$: BehaviorSubject<boolean>;
  mapMode: EMapMode;

  constructor(
    protected client: WorldgenClient,
  ) {
    this.globeOptions$ = new BehaviorSubject<IGlobeOptions>(Object.assign({}, initialOptions));
    this.globe$ = new BehaviorSubject<GlobeData>(null);
    this.loading$ = new BehaviorSubject(false);
    this.mapMode = DEFAULT_MAP_MODE;

    this.globeOptions$.subscribe(() => {
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
    const result = await this.client.newWorld(this.globeOptions$.value, this.mapMode);
    this.globe$.next(result.globe);
    return result.globe;
  }
}