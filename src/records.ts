import { SaveStore } from './SaveStore';
import { IGlobeOptions } from './types';


export interface IWorldRecord {
  options: IGlobeOptions,
  data: {

  },
};

export const worldStore = new SaveStore<IWorldRecord>({
  name: 'worlds',
  load: data => data,
  createEntry: (entity) => entity.options,
  createRecord: (entity) => entity,
});