import { IGlobeOptions, EMapMode, WorldData, WorldExport } from './types';
import { BehaviorSubject, Subject } from 'rxjs';
import { logGroupTime } from './utils';
import { WorldgenClient } from './worldgen/WorldgenClient';
import { WorldManager } from './WorldManager';


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

export class WorldEditorManager extends WorldManager {
  worldOptions$: Subject<IGlobeOptions>;
  worldOptions: IGlobeOptions;

  constructor(
    client: WorldgenClient,
    options: IGlobeOptions = initialOptions,
  ) {
    super(client);
    this.worldOptions$ = new Subject<IGlobeOptions>();
    this.worldOptions = options;
    this.worldOptions$.subscribe(() => {
      this.generate()
    });
  }

  public saveWorld(name: string) {
    return this.client.saveWorld(name);
  }

  @logGroupTime('load')
  public async load(worldExport: WorldExport) {
    const result = await this.client.loadWorld(worldExport, this.mapMode);
    this.setWorld(result.world);
    return result;
  }

  @logGroupTime('generate')
  public async generate() {
    const result = await this.client.newWorld(this.worldOptions, this.mapMode);
    this.setWorld(result.world);
    return result;
  }
}