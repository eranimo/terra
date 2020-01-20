import { WorldgenClient } from './worldgen/WorldgenClient';
import { WorldManager } from './WorldManager';
import { WorldExport } from './types';
import { BehaviorSubject } from 'rxjs';


export class WorldLoaderManager extends WorldManager {
  constructor(
    client: WorldgenClient,
  ) {
    super(client);
  }

  public async load(worldExport: WorldExport) {
    const result = await this.client.loadWorld(worldExport, this.mapMode);
    this.setWorld(result.world);
    return result;
  }
}