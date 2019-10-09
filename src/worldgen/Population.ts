import { DAYS_PER_YEAR } from './GameLoop';
import shortid = require("shortid");


enum Job {
  HUNTER_GATHERER,
  FARMER,
  NOBLE,
  PRIEST,
}

export class Population {
  pop_ids: Set<string>;
  pop_count: Map<string, number>;
  pop_class: Map<string, number>;

  constructor(
    
  ) {
    this.pop_ids = new Set();
    this.pop_count = new Map();
    this.pop_class = new Map();
  }

  createPop(job: Job, count: number) {
    const id = shortid.generate();
    this.pop_ids.add(id);
    this.pop_count.set(id, count);
    this.pop_count.set(id, job);
  }

  removePop(id: string) {
    this.pop_ids.delete(id);
    this.pop_count.delete(id)
    this.pop_count.delete(id);
  }

  growth(yearlyGrowthRate: number) {
    for (const id of this.pop_ids) {
      const growth = this.pop_count.get(id) * (yearlyGrowthRate / DAYS_PER_YEAR);
      this.pop_count.set(id, this.pop_count.get(id) + growth);
    }
  }
}