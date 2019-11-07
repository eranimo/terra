import { SaveStore } from './SaveStore';
import { IGlobeOptions, IGameOptions } from './types';


export interface IWorldRecord {
  options: IGlobeOptions,
};

export const worldStore = new SaveStore<IWorldRecord>({
  name: 'worlds',
  load: data => data,
  createEntry: (entity) => entity.options,
  createRecord: (entity) => entity,
});

export interface IGameRecord {
  entry: {
    options: {
      world: IGlobeOptions,
      game: IGameOptions,
    },
    ticks: number,
  },
  gameState: any[],
};

export const gameStore = new SaveStore<IGameRecord>({
  name: 'games',
  load: data => data,
  createEntry: (entity) => entity.entry,
  createRecord: (entity) => entity,
})