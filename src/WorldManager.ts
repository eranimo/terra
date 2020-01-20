import { IGlobeOptions, EMapMode, WorldData, WorldExport } from './types';
import { BehaviorSubject } from 'rxjs';
import { logGroupTime } from './utils';
import { WorldgenClient } from './worldgen/WorldgenClient';


const DEFAULT_MAP_MODE = EMapMode.BIOME;

export class WorldManager {
  worldData$: BehaviorSubject<WorldData>;
  mapMode: EMapMode;
  loading$: BehaviorSubject<boolean>;

  constructor(public client: WorldgenClient) {
    this.worldData$ = new BehaviorSubject<WorldData>(null);
    this.mapMode = DEFAULT_MAP_MODE;
    this.loading$ = new BehaviorSubject(true);
  }

  get worldData(): WorldData {
    return this.worldData$.value;
  }

  public setWorld(worldData: WorldData) {
    this.worldData$.next(worldData);
    this.loading$.next(false);
  }

  public setMapMode(mapMode: EMapMode) {
    this.mapMode = mapMode;
  }
}