import localforage from 'localforage';


export interface ISaveStoreEntry<Entry = any> {
  name: string;
  createdAt: number;
  data: Entry;
}

export interface ISaveStoreRecord<Record = any> {
  name: string;
  modifiedAt: number;
  data: Record;
}

interface ISaveStoreOptions<Entity, Entry, Record> {
  name: string,
  recordToEntity(record: Record): Entity,
  createEntry(entity: Entity): Entry,
  createRecord(entity: Entity): Record,
}

export class SaveStore<Entity, Entry, Record = Entity> {
  options: ISaveStoreOptions<Entity, Entry, Record>;
  private entries: LocalForage;
  private records: LocalForage;

  constructor(options: ISaveStoreOptions<Entity, Entry, Record>) {
    this.options = options;
    this.entries = localforage.createInstance({
      name: `${options.name}-entries`
    });
    this.records = localforage.createInstance({
      name: `${options.name}-records`
    });
  }

  async load(name: string): Promise<Entity> {
    const data = await this.records.getItem(name) as ISaveStoreRecord;
    if (data === null) {
      throw new Error(`Save '${name}' not found`);
    }
    return this.options.recordToEntity(data.data);
  }

  async save(entity: Entity, name: string) {
    const record: ISaveStoreRecord = {
      name,
      modifiedAt: Date.now(),
      data: this.options.createRecord(entity),
    };

    const entry: ISaveStoreEntry = {
      name,
      createdAt: Date.now(),
      data: this.options.createEntry(entity),
    };
    console.log('Save', record, entry);

    try {
      await this.records.setItem(name, record);
    } catch (error) {
      console.error('Error saving record');
      throw error;
    }

    try {
      await this.entries.setItem(name, entry);
    } catch (error) {
      console.error('Error saving entry');
      throw error;
    }
  }

  async removeSave(name: string): Promise<void> {
    await this.records.removeItem(name);
    await this.entries.removeItem(name);
  }

  async getSaves(): Promise<ISaveStoreEntry[]> {
    const saves = [];
    const saveNames = await this.entries.keys();
    for (const key of saveNames) {
      const save = await this.entries.getItem(key);
      saves.push(save);
    }
    return saves;
  }
}
