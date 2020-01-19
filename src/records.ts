import { SaveStore } from './SaveStore';
import { IGlobeOptions, IGameOptions, WorldExport } from './types';

type WorldEntry = {
  options: IGlobeOptions,
}
export const worldStore = new SaveStore<WorldExport, WorldEntry>({
  name: 'worlds',
  recordToEntity: data => data,
  createEntry: (entity) => ({ options: entity.options }),
  createRecord: (entity) => entity,
});